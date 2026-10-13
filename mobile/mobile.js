(function () {
  'use strict';
  if (window.api) return;

  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (Cap && Cap.Plugins) || {};
  const { Filesystem, App, StatusBar, CapacitorHttp: Http } = P;
  const DATA = 'DATA';
  const AUTH_SCHEME = 'io.github.zelinskyvladimir.lampa';
  const WebAuth = (native && P.WebAuth) || null;
  const AppleSignIn = (native && P.AppleSignIn) || null;
  const AppleTranslate = (native && P.AppleTranslate) || null;
  const ReaderMenu = (native && P.ReaderMenu) || null;
  let authCallback = () => {};

  const BOOK_EXTS = new Set(['fb2', 'epub', 'txt', 'zip']);
  const MAX_BOOK_SIZE = 300 * 1024 * 1024;
  const extOf = (p) => (String(p).match(/\.([^./\\]+)$/) || ['', ''])[1].toLowerCase();
  const baseName = (p) => String(p).split(/[\\/]/).pop();

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  async function hash16(u8) {
    let digest;
    try {
      digest = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
    } catch {
      digest = sha256(u8);
    }
    return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function sha256(bytes) {
    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
      0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
      0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const len = bytes.length;
    const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(bytes);
    padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
    view.setUint32(padded.length - 4, (len * 8) >>> 0);
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = W[i - 16] + s0 + W[i - 7] + s1;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i];
        const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] += a;
      H[1] += b;
      H[2] += c;
      H[3] += d;
      H[4] += e;
      H[5] += f;
      H[6] += g;
      H[7] += h;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
  }

  const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

  const notFound = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

  const store = native
    ? {
        async read(path) {
          try {
            const r = await Filesystem.readFile({ path, directory: DATA });
            return b64ToBytes(r.data);
          } catch {
            throw notFound();
          }
        },
        async readText(path) {
          try {
            return (await Filesystem.readFile({ path, directory: DATA, encoding: 'utf8' })).data;
          } catch {
            throw notFound();
          }
        },
        write: (path, bytes) => Filesystem.writeFile({ path, directory: DATA, data: bytesToB64(bytes), recursive: true }),
        writeText: (path, text) => Filesystem.writeFile({ path, directory: DATA, data: text, encoding: 'utf8', recursive: true }),
        async exists(path) {
          try {
            await Filesystem.stat({ path, directory: DATA });
            return true;
          } catch {
            return false;
          }
        },
        removeFile: (path) => Filesystem.deleteFile({ path, directory: DATA }).catch(() => {}),
        removeDir: (path) => Filesystem.rmdir({ path, directory: DATA, recursive: true }).catch(() => {}),
        rename: (from, to) => Filesystem.rename({ from, to, directory: DATA, toDirectory: DATA }),
        async list(path) {
          try {
            const r = await Filesystem.readdir({ path, directory: DATA });
            return r.files.map((f) => (typeof f === 'string' ? f : f.name));
          } catch {
            return [];
          }
        },
        uri: async (path) => (await Filesystem.getUri({ path, directory: DATA })).uri,
      }
    : memoryStore();

  function memoryStore() {
    const files = new Map();
    const LS = 'lampa.dev-fs:';
    const has = (p) => files.has(p) || localStorage.getItem(LS + p) != null;
    return {
      async read(p) {
        if (!files.has(p)) throw notFound();
        return files.get(p);
      },
      async readText(p) {
        const v = localStorage.getItem(LS + p);
        if (v == null) throw notFound();
        return v;
      },
      async write(p, bytes) {
        files.set(p, bytes);
      },
      async writeText(p, text) {
        localStorage.setItem(LS + p, text);
      },
      exists: async (p) => has(p),
      async removeFile(p) {
        files.delete(p);
        localStorage.removeItem(LS + p);
      },
      async removeDir(p) {
        for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k);
      },
      async rename(from, to) {
        const v = localStorage.getItem(LS + from);
        if (v == null) throw notFound();
        localStorage.setItem(LS + to, v);
        localStorage.removeItem(LS + from);
      },
      async list(p) {
        return [...files.keys()].filter((k) => k.startsWith(p + '/')).map((k) => k.slice(p.length + 1));
      },
      uri: async (p) => p,
      files,
    };
  }

  async function getJson(url) {
    if (!native) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    const r = await Http.request({
      url,
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': navigator.userAgent },
      responseType: 'json',
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    if (r.status >= 400) throw new Error('HTTP ' + r.status);
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }

  async function getBytes(url) {
    if (/^data:image\/(jpeg|png|webp);base64,/.test(url)) return b64ToBytes(url.slice(url.indexOf(',') + 1));
    if (!Online.isCoverUrl(url)) throw new Error('BAD_URL');
    if (!native) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    }
    const r = await Http.request({ url, method: 'GET', responseType: 'arraybuffer', connectTimeout: 15000, readTimeout: 15000 });
    if (r.status >= 400) throw new Error('HTTP ' + r.status);
    return typeof r.data === 'string' ? b64ToBytes(r.data) : new Uint8Array(r.data);
  }

  async function toJpeg(bytes, maxWidth, quality) {
    const bmp = await createImageBitmap(new Blob([bytes]));
    if (bmp.width < 10) throw new Error('NOT_IMAGE');
    const w = Math.min(maxWidth, bmp.width);
    const h = Math.round((bmp.height * w) / bmp.width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function importBook(name, bytes) {
    if (!BOOK_EXTS.has(extOf(name))) return name;
    if (bytes.length > MAX_BOOK_SIZE) throw new Error('TOO_LARGE');
    const path = `books/${await hash16(bytes)}/${name.replace(/[\\/:*?"<>|]/g, '_')}`;
    if (!(await store.exists(path))) await store.write(path, bytes);
    return path;
  }

  async function importUrl(url) {
    if (!url || !/^file:/i.test(url)) return null;
    try {
      const r = await Filesystem.readFile({ path: url });
      const path = await importBook(decodeURIComponent(baseName(url)), b64ToBytes(r.data));
      Filesystem.deleteFile({ path: url }).catch(() => {});
      return path;
    } catch (e) {
      console.error('import failed', e);
      return null;
    }
  }

  const COVER_NAME = /^[0-9a-f]{16}\.jpg$/;
  let coversBase = '';

  async function readShelf() {
    for (const f of ['shelf.json', 'shelf.json.bak']) {
      if (!(await store.exists(f))) continue;
      try {
        const d = JSON.parse(await store.readText(f));
        if (d && Array.isArray(d.books)) return d.books;
      } catch {}
    }
    if ((await store.exists('shelf.json')) || (await store.exists('shelf.json.bak'))) throw new Error('SHELF_UNREADABLE');
    return [];
  }

  let shelfWrite = Promise.resolve();
  function writeShelf(books) {
    const job = shelfWrite.then(async () => {
      await store.writeText('shelf.json.tmp', JSON.stringify({ version: 1, books }));
      await store.removeFile('shelf.json.bak');
      if (await store.exists('shelf.json')) await store.rename('shelf.json', 'shelf.json.bak');
      await store.rename('shelf.json.tmp', 'shelf.json');
    });
    shelfWrite = job.catch(() => {});
    return job;
  }

  async function pruneCovers(books) {
    const used = new Set(books.map((b) => b && b.cover).filter(Boolean));
    for (const n of await store.list('covers')) if (COVER_NAME.test(n) && !used.has(n)) store.removeFile('covers/' + n);
  }

  const thumbCache = new Map();
  async function coverThumb(url) {
    if (thumbCache.has(url)) return thumbCache.get(url);
    const jpg = await toJpeg(await getBytes(Online.thumbUrl(url)), 120, 0.82);
    const data = 'data:image/jpeg;base64,' + bytesToB64(jpg);
    if (thumbCache.size > 300) thumbCache.delete(thumbCache.keys().next().value);
    thumbCache.set(url, data);
    return data;
  }

  const devCovers = new Map();
  async function saveCover(url) {
    const jpg = await toJpeg(await getBytes(url), 400, 0.86);
    const name = randomHex() + '.jpg';
    await store.write('covers/' + name, jpg);
    if (!native) devCovers.set(name, 'data:image/jpeg;base64,' + bytesToB64(jpg));
    return name;
  }

  const STATE_FILE = 'local-storage.json';
  let stateTimer = 0;

  function dumpState() {
    clearTimeout(stateTimer);
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('lampa.') && !k.startsWith('lampa.dev-fs:')) out[k] = localStorage.getItem(k);
    }
    return store.writeText(STATE_FILE, JSON.stringify(out)).catch(() => {});
  }

  async function restoreState() {
    if (localStorage.getItem('lampa.settings') || !(await store.exists(STATE_FILE))) return;
    let saved;
    try {
      saved = JSON.parse(await store.readText(STATE_FILE));
    } catch {
      return;
    }
    for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
    location.reload();
    await new Promise(() => {});
  }

  function watchState() {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      setItem.call(this, k, v);
      if (this === localStorage && String(k).startsWith('lampa.') && !String(k).startsWith('lampa.dev-fs:')) {
        clearTimeout(stateTimer);
        stateTimer = setTimeout(dumpState, 1500);
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) dumpState();
    });
  }

  const updateCallbacks = [];
  let openCallback = null;
  let launchPath = null;

  window.api = {
    platform: native ? Cap.getPlatform() : 'web',
    features: { curl: false, fullscreen: false, updates: false, dragDrop: false },
    defaults: { view: 'pages', pageAnim: 'slide' },

    openDialog() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fb2,.epub,.txt,.zip';
        input.hidden = true;
        document.body.append(input);
        const done = (v) => {
          input.remove();
          resolve(v);
        };
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return done(null);
          try {
            done(await importBook(file.name, new Uint8Array(await file.arrayBuffer())));
          } catch (e) {
            console.error(e);
            done(null);
          }
        });
        input.addEventListener('cancel', () => done(null));
        input.click();
      });
    },

    async loadBook(p) {
      const ext = extOf(p);
      if (!BOOK_EXTS.has(ext)) throw new Error('UNSUPPORTED');
      const bytes = await store.read(p);
      if (bytes.length > MAX_BOOK_SIZE) throw new Error('TOO_LARGE');
      const m = /^books\/([0-9a-f]{16})\//.exec(p);
      const out = { path: p, name: baseName(p), size: bytes.length, ext, hash: m ? m[1] : await hash16(bytes) };
      if (ext === 'epub' || ext === 'zip') out.entries = fflate.unzipSync(bytes);
      else out.bytes = bytes;
      return out;
    },
    adoptBooks: async () => [],
    readBookFile: (p) => store.read(p),
    async version() {
      if (!App || !App.getInfo) return '';
      const info = await App.getInfo();
      return info.version || '';
    },
    saveBookFile: (name, bytes) => importBook(baseName(name), bytes),
    takeAuthCallback: async () => null,
    onAuthCallback: (cb) => {
      authCallback = cb;
    },
    authRedirect: WebAuth ? AUTH_SCHEME + '://auth-callback' : '',
    signInApple: AppleSignIn
      ? async (nonce) => {
          const res = await AppleSignIn.authorize({ nonce });
          return (res && res.idToken) || null;
        }
      : null,
    async openAuth(url) {
      const res = await WebAuth.start({ url, scheme: AUTH_SCHEME });
      if (res && res.url) authCallback(res.url);
    },
    cloudUrl: '',
    async forgetBook(p) {
      const m = /^books\/([0-9a-f]{16})\//.exec(String(p));
      if (m) await store.removeDir('books/' + m[1]);
    },

    async importAndOpen(name, bytes) {
      const p = await importBook(name, bytes);
      if (openCallback) openCallback(p);
      return p;
    },

    takeInitialPath: async () => {
      const p = launchPath;
      launchPath = null;
      return p;
    },
    onOpenPath: (cb) => {
      openCallback = cb;
    },
    pathForFile: () => '',
    openExternal: (url) => window.open(url, '_blank'),
    toggleFullscreen: () => {},
    setThemeBg(color) {
      if (!native || !StatusBar) return;
      const n = parseInt(String(color).slice(1), 16);
      const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
      StatusBar.setStyle({ style: lum < 115 ? 'DARK' : 'LIGHT' }).catch(() => {});
    },
    rendered: () => {},
    onUpdateReady: (cb) => updateCallbacks.push(cb),
    installUpdate: () => {},
    setUiLang: () => {},

    setEditMenu(on) {
      if (ReaderMenu) ReaderMenu.set({ off: !on }).catch(() => {});
    },

    translateOnDevice: !!AppleTranslate,
    async translateStatus(text, to, from) {
      if (!AppleTranslate) return null;
      try {
        return await AppleTranslate.status({ text: String(text || '').slice(0, 500), to, from: from || '' });
      } catch {
        return null;
      }
    },
    async translatePrepare(from, to) {
      if (!AppleTranslate) return null;
      try {
        return await AppleTranslate.prepare({ from, to });
      } catch {
        return null;
      }
    },
    async translate(text, to) {
      text = String(text || '').trim();
      if (!text || text.length > Online.MAX_TRANSLATE || !Online.isLangCode(to)) throw new Error('BAD_REQUEST');
      if (AppleTranslate) {
        let res;
        try {
          res = await AppleTranslate.translate({ text, to });
        } catch (e) {
          throw new Error(e && e.code ? e.code : 'TRANSLATE_FAILED');
        }
        return { text: res.text || '', src: res.src || '', dict: [] };
      }
      try {
        return await Online.translate(text, to, getJson);
      } catch {
        throw new Error('TRANSLATE_FAILED');
      }
    },
    capture: async () => null,

    async shelfLoad() {
      const books = await readShelf();
      pruneCovers(books);
      return books;
    },
    shelfSave(books) {
      if (!Array.isArray(books)) return Promise.reject(new Error('BAD_REQUEST'));
      return writeShelf(books);
    },
    shelfSearch(q) {
      const query = typeof q === 'string' ? q.trim().slice(0, 200) : '';
      return query ? Online.searchBooks(query, getJson) : Promise.resolve([]);
    },
    shelfLookup(title, author) {
      title = String(title || '').trim().slice(0, 300);
      if (!title) return Promise.reject(new Error('BAD_REQUEST'));
      return Online.lookupBook(title, String(author || '').trim().slice(0, 300), getJson);
    },
    shelfThumb: (url) => coverThumb(String(url)),
    shelfCover: (url) => saveCover(String(url)),
    coverUrl: (name) => (native ? Cap.convertFileSrc(coversBase + '/' + name) : devCovers.get(name) || ''),
  };

  window.platformReady = (async () => {
    document.documentElement.dataset.platform = window.api.platform;
    await restoreState();
    watchState();
    if (!native) return;
    if (StatusBar) StatusBar.hide().catch(() => {});
    await Filesystem.mkdir({ path: 'covers', directory: DATA, recursive: true }).catch(() => {});
    coversBase = await store.uri('covers');
    try {
      await store.writeText('selfcheck.txt', 'ok');
      console.info(`[lampa] ready: plugins=${Object.keys(P).join(',')} fs=${await store.readText('selfcheck.txt')} covers=${coversBase}`);
    } catch (e) {
      console.error('[lampa] storage check failed: ' + (e && e.message));
    }
    if (App) {
      const launch = await App.getLaunchUrl().catch(() => null);
      if (launch && launch.url) launchPath = await importUrl(launch.url);
      App.addListener('appUrlOpen', async ({ url }) => {
        const p = await importUrl(url);
        if (p && openCallback) openCallback(p);
      });
      App.addListener('pause', dumpState);
    }
  })().catch((e) => console.error('platform init failed', e));
})();
