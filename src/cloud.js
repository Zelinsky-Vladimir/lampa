// Облако (Supabase): вход, записи для синхронизации и файлы книг — через обычные HTTP-запросы,
// без клиентской библиотеки. Работает и в Electron, и в мобильной версии.
// Ключ ниже открытый (publishable): он встраивается в приложение, данные защищают правила доступа в базе.
(function (global) {
  'use strict';

  // при разработке — Supabase на этом компьютере (supabase start, LAMPA_CLOUD_URL)
  const dev = (global.api && global.api.cloudUrl) || '';
  const URL_BASE = dev || 'https://lxztjateewlladvgzzlj.supabase.co';
  const KEY = dev ? 'dev' : 'sb_publishable_usZ2I_BM4dbq8gdVmXgSkQ_YQ8FXdmc';
  const MAX_FILE = 50 * 1024 * 1024;

  async function call(path, { method = 'GET', token, body, headers = {}, raw = false } = {}) {
    const h = { apikey: KEY, ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    if (body !== undefined && !(body instanceof Uint8Array) && !(body instanceof Blob)) {
      h['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    let r;
    try {
      r = await fetch(URL_BASE + path, { method, headers: h, body });
    } catch {
      throw Object.assign(new Error('OFFLINE'), { code: 'OFFLINE' });
    }
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      let j = null;
      try {
        j = await r.json();
        msg = j.error_description || j.msg || j.message || j.error || msg;
      } catch {}
      throw Object.assign(new Error(msg), { status: r.status, body: j });
    }
    if (raw) return new Uint8Array(await r.arrayBuffer());
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  // ---------- вход ----------

  // Ответ сервера → сессия, которую храним у себя.
  function toSession(j) {
    if (!j || !j.access_token) return null;
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in || 3600) * 1000,
      user: { id: j.user && j.user.id, email: (j.user && j.user.email) || '' },
    };
  }

  const signIn = async (email, password) => toSession(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));

  // Если подтверждение почты выключено — сразу сессия; иначе null (ждём подтверждения).
  const signUp = async (email, password) => toSession(await call('/auth/v1/signup', { method: 'POST', body: { email, password } }));

  const refresh = async (session) =>
    toSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } }));

  async function signOut(session) {
    try {
      await call('/auth/v1/logout', { method: 'POST', token: session.access_token });
    } catch {}
  }

  // Вход через Google: PKCE — браузер возвращает код, код меняем на сессию.
  const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function oauthStart(provider, redirectTo) {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const url =
      `${URL_BASE}/auth/v1/authorize?provider=${encodeURIComponent(provider)}` +
      `&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${challenge}&code_challenge_method=s256`;
    return { url, verifier };
  }

  const idTokenSignIn = async (provider, idToken, nonce) =>
    toSession(await call('/auth/v1/token?grant_type=id_token', { method: 'POST', body: { provider, id_token: idToken, nonce } }));

  const oauthFinish = async (code, verifier) =>
    toSession(await call('/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: code, code_verifier: verifier } }));

  // ---------- записи ----------

  // Всё, что пришло на сервер после since (ISO-время сервера), по порядку прихода.
  async function pull(token, since) {
    const out = [];
    let after = since || '1970-01-01T00:00:00Z';
    for (;;) {
      const rows = await call(
        `/rest/v1/records?select=kind,id,data,deleted,updated_at,device,server_at&server_at=gt.${encodeURIComponent(after)}&order=server_at.asc&limit=500`,
        { token },
      );
      out.push(...rows);
      if (rows.length < 500) break;
      after = rows[rows.length - 1].server_at;
    }
    return out;
  }

  // Отправить записи; более старая версия, чем на сервере, сервером отбрасывается (триггер в базе).
  async function push(token, rows) {
    for (let i = 0; i < rows.length; i += 200) {
      await call('/rest/v1/records', {
        method: 'POST',
        token,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: rows.slice(i, i + 200),
      });
    }
  }

  const books = (session, body) => call('/functions/v1/books', { method: 'POST', token: session.access_token, body });

  async function transfer(url, init) {
    let r;
    try {
      r = await fetch(url, init);
    } catch {
      throw Object.assign(new Error('OFFLINE'), { code: 'OFFLINE' });
    }
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r;
  }

  async function usage(session) {
    const { used, quota } = await books(session, { action: 'list' });
    return { used, quota };
  }

  async function listFiles(session) {
    const { files } = await books(session, { action: 'list' });
    return new Set(files.map((f) => `${f.hash}.${f.ext}`));
  }

  async function upload(session, hash, ext, bytes) {
    const { url } = await books(session, { action: 'upload', hash, ext, size: bytes.length });
    await transfer(url, { method: 'PUT', body: bytes });
    await books(session, { action: 'confirm', hash, ext });
  }

  async function download(session, hash, ext) {
    const { url } = await books(session, { action: 'download', hash, ext });
    return new Uint8Array(await (await transfer(url, { method: 'GET' })).arrayBuffer());
  }

  async function removeFile(session, hash, ext) {
    try {
      await books(session, { action: 'delete', hash, ext });
    } catch {}
  }

  async function deleteAccount(session) {
    await books(session, { action: 'deleteAll' });
    await call('/rest/v1/rpc/delete_account', { method: 'POST', token: session.access_token, body: {} });
  }

  global.Cloud = { MAX_FILE, signIn, signUp, refresh, signOut, oauthStart, oauthFinish, idTokenSignIn, pull, push, listFiles, usage, upload, download, removeFile, deleteAccount };
})(window);
