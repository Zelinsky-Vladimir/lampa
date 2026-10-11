// Мобильная версия (Capacitor, iOS): та же window.api, что даёт preload.js в Electron.
// Книги, список «Прочитано / Хочу прочитать» и обложки лежат в папке приложения (Directory.Data),
// сеть идёт через нативный HTTP Capacitor — без ограничений CORS.
// В обычном браузере (предпросмотр при разработке) всё хранится в памяти.
(function () {
  'use strict';
  if (window.api) return; // Electron

  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (Cap && Cap.Plugins) || {};
  const { Filesystem, App, StatusBar, CapacitorHttp: Http } = P;
  const DATA = 'DATA';

  const BOOK_EXTS = new Set(['fb2', 'epub', 'txt', 'zip']);
  const MAX_BOOK_SIZE = 300 * 1024 * 1024;
  const extOf = (p) => (String(p).match(/\.([^./\\]+)$/) || ['', ''])[1].toLowerCase();
  const baseName = (p) => String(p).split(/[\\/]/).pop();

  // ---------- байты и base64 ----------

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

  // Короткий отпечаток содержимого: одна и та же книга кладётся в библиотеку один раз.
  function hash16(u8) {
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < u8.length; i++) {
      h1 = Math.imul(h1 ^ u8[i], 16777619);
      h2 = Math.imul(h2 ^ u8[i], 2246822519);
    }
    const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
    return hex(h1) + hex(h2 ^ u8.length);
  }

  const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

  // ---------- файлы ----------

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

  // Предпросмотр в браузере: файлы в памяти, текстовые — ещё и в localStorage, чтобы пережить перезагрузку.
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

  // ---------- сеть ----------

  async function getJson(url) {
    if (!native) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    // Google отвечает на перевод, только если запрос похож на браузерный
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

  // Уменьшенная копия картинки в JPEG — для обложек и миниатюр.
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

  // ---------- книги ----------

  // Книга копируется в books/<отпечаток>/<имя файла>; библиотека открывает эту копию.
  async function importBook(name, bytes) {
    if (!BOOK_EXTS.has(extOf(name))) return name; // loadBook ответит «формат не поддерживается»
    if (bytes.length > MAX_BOOK_SIZE) throw new Error('TOO_LARGE');
    const path = `books/${hash16(bytes)}/${name.replace(/[\\/:*?"<>|]/g, '_')}`;
    if (!(await store.exists(path))) await store.write(path, bytes);
    return path;
  }

  // Файл, открытый через «Открыть в Lampa» из Файлов, Telegram, почты: iOS кладёт копию в Documents/Inbox.
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

  // ---------- «Прочитано» и «Хочу прочитать» ----------

  const COVER_NAME = /^[0-9a-f]{16}\.jpg$/;
  let coversBase = '';

  async function readShelf() {
    // shelf.json мог не успеть записаться — тогда берём прошлую версию
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

  // ---------- состояние окна: localStorage дублируется в файл ----------
  // iOS может очистить данные веб-просмотра при нехватке места; закладки и заметки так не потеряются.

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
    // app.js уже прочитал пустое хранилище — перезапускаем страницу с восстановленным
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
    // приложение уходит в фон — iOS может его выгрузить, сохраняем сразу
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) dumpState();
    });
  }

  // ---------- window.api ----------

  const updateCallbacks = [];
  let openCallback = null;
  let launchPath = null;

  window.api = {
    platform: native ? Cap.getPlatform() : 'web',
    // чего здесь нет: снимок окна для «загиба», полноэкранный режим, автообновление, перетаскивание файлов
    features: { curl: false, fullscreen: false, updates: false, dragDrop: false },
    defaults: { view: 'pages', pageAnim: 'slide' },

    // Выбор файла системным окном (приложение «Файлы»); книга сразу копируется в библиотеку.
    openDialog() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
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
      const out = { path: p, name: baseName(p), size: bytes.length, ext };
      if (ext === 'epub' || ext === 'zip') out.entries = fflate.unzipSync(bytes);
      else out.bytes = bytes;
      return out;
    },
    adoptBooks: async () => [],
    async forgetBook(p) {
      const m = /^books\/([0-9a-f]{16})\//.exec(String(p));
      if (m) await store.removeDir('books/' + m[1]);
    },

    // Открыть книгу, полученную не через окно выбора файла (например, «Поделиться»).
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
      // DARK — светлый текст строки состояния для тёмного фона
      StatusBar.setStyle({ style: lum < 115 ? 'DARK' : 'LIGHT' }).catch(() => {});
    },
    rendered: () => {},
    onUpdateReady: (cb) => updateCallbacks.push(cb),
    installUpdate: () => {},
    setUiLang: () => {},

    async translate(text, to) {
      text = String(text || '').trim();
      if (!text || text.length > Online.MAX_TRANSLATE || !Online.isLangCode(to)) throw new Error('BAD_REQUEST');
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

  // app.js ждёт этого перед запуском: папки, восстановление состояния, книга из «Открыть в Lampa».
  window.platformReady = (async () => {
    document.documentElement.dataset.platform = window.api.platform;
    await restoreState();
    watchState();
    if (!native) return;
    await Filesystem.mkdir({ path: 'covers', directory: DATA, recursive: true }).catch(() => {});
    coversBase = await store.uri('covers');
    // строка в журнале Xcode: видно, что нативные модули подключились и папка приложения пишется
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
