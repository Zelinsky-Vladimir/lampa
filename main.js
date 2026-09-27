'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, Menu, screen, net, session } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { unzipSync } = require('fflate');
const { autoUpdater } = require('electron-updater');

const BOOK_EXTS = new Set(['fb2', 'epub', 'txt', 'zip']);
const MAX_BOOK_SIZE = 300 * 1024 * 1024;

let win = null;
let rendererReady = false;
let pendingPath = null;
let state = {};

const extOf = (p) => path.extname(p).slice(1).toLowerCase();
const isBookPath = (p) => typeof p === 'string' && BOOK_EXTS.has(extOf(p));

// Ищем путь к книге среди аргументов командной строки («Открыть с помощью», перетаскивание на ярлык).
function bookFromArgv(argv, cwd = process.cwd()) {
  const arg = argv.slice(1).find((a) => !a.startsWith('-') && isBookPath(a));
  return arg ? path.resolve(cwd, arg) : null;
}

function openInRenderer(p) {
  if (win && rendererReady) {
    win.webContents.send('open-path', p);
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    pendingPath = p;
  }
}

// ---------- состояние окна ----------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveState() {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // не критично
  }
}

function isOnScreen(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
}

// ---------- окно ----------

function createWindow() {
  rendererReady = false;
  const bounds = state.bounds && isOnScreen(state.bounds) ? state.bounds : { width: 1100, height: 800 };

  win = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 360,
    show: false,
    title: 'Lampa',
    backgroundColor: state.bg || '#f4ecd8',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // масштаб страницы целиком не нужен: Ctrl+колёсико и жесты меняют только шрифт книги
  win.webContents.setVisualZoomLevelLimits(1, 1);

  // Никаких переходов внутри окна: внешние ссылки открываются в браузере.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
  }

  win.on('close', () => {
    state.bounds = win.getNormalBounds();
    state.maximized = win.isMaximized();
    saveState();
  });
  win.on('closed', () => {
    win = null;
  });
}

function setupMenu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

// ---------- автообновление ----------

let updateReady = null;

// Новые версии берутся из GitHub Releases: скачиваются в фоне и ставятся при выходе
// (или сразу по кнопке «Перезапустить»). Работает для установленной версии на Windows и AppImage на Linux;
// переносной exe и неподписанные сборки для macOS обновлять себя не умеют.
function setupAutoUpdate() {
  const supported = app.isPackaged &&
    !process.env.PORTABLE_EXECUTABLE_DIR &&
    !process.env.LAMPA_SCREENSHOT &&
    (process.platform === 'win32' || (process.platform === 'linux' && process.env.APPIMAGE));
  if (!supported) return;

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = info.version;
    if (win) win.webContents.send('update-ready', info.version);
  });
  autoUpdater.on('error', (e) => console.warn('update check failed:', e && e.message));

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 4 * 60 * 60 * 1000);
}

// ---------- перевод ----------

// Бесплатный открытый адрес Google Translate (тот же, что у браузерных расширений): без ключа,
// но неофициальный — при большом числе запросов Google может временно ограничить.
const MAX_TRANSLATE = 1500;

function browserUserAgent() {
  return session.defaultSession.getUserAgent().replace(/ (Electron|Lampa|lampa-reader)\/\S+/g, '');
}

async function fetchJson(url) {
  const r = await net.fetch(url, { headers: { 'User-Agent': browserUserAgent() } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const text = await r.text();
  if (!/^\s*[[{]/.test(text)) throw new Error('not json');
  return JSON.parse(text);
}

async function translate(text, to) {
  const q = encodeURIComponent(text);
  try {
    const j = await fetchJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&hl=${to}&dt=t&dt=bd&dj=1&q=${q}`);
    return {
      text: (j.sentences || []).map((s) => s.trans || '').join('').trim(),
      src: j.src || (j.ld_result && j.ld_result.srclangs && j.ld_result.srclangs[0]) || '',
      dict: (j.dict || []).map((d) => ({ pos: d.pos || '', terms: (d.terms || []).slice(0, 8) })),
    };
  } catch {
    // запасной адрес: только перевод, без словаря
    const j = await fetchJson(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${to}&q=${q}`);
    const first = Array.isArray(j) ? j[0] : null;
    if (Array.isArray(first)) return { text: String(first[0] || '').trim(), src: String(first[1] || ''), dict: [] };
    if (typeof first === 'string') return { text: first.trim(), src: '', dict: [] };
    throw new Error('TRANSLATE_FAILED');
  }
}

// ---------- IPC ----------

function registerIpc() {
  // подписи диалога приходят из окна на выбранном языке интерфейса
  ipcMain.handle('dialog:open', async (_e, labels = {}) => {
    const r = await dialog.showOpenDialog(win, {
      title: String(labels.title || 'Open book'),
      properties: ['openFile'],
      filters: [
        { name: String(labels.books || 'Books'), extensions: ['fb2', 'epub', 'txt', 'zip'] },
        { name: String(labels.all || 'All files'), extensions: ['*'] },
      ],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('book:load', async (_e, p) => {
    if (!isBookPath(p)) throw new Error('UNSUPPORTED');
    const st = await fsp.stat(p);
    if (st.size > MAX_BOOK_SIZE) throw new Error('TOO_LARGE');
    const buf = await fsp.readFile(p);
    const ext = extOf(p);
    const out = { path: p, name: path.basename(p), size: st.size, ext };
    // Архивы распаковываем здесь, чтобы окну не нужен был доступ к Node.
    if (ext === 'epub' || ext === 'zip') out.entries = unzipSync(new Uint8Array(buf));
    else out.bytes = buf;
    return out;
  });

  ipcMain.handle('app:take-initial-path', () => {
    rendererReady = true;
    const p = pendingPath;
    pendingPath = null;
    // обновление могло скачаться раньше, чем окно было готово
    if (updateReady && win) win.webContents.send('update-ready', updateReady);
    return p;
  });

  ipcMain.on('app:install-update', () => {
    // тихая установка и сразу запуск новой версии
    if (updateReady) autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.handle('translate', async (_e, req) => {
    const text = req && typeof req.text === 'string' ? req.text.trim() : '';
    const to = req && typeof req.to === 'string' ? req.to : '';
    if (!text || text.length > MAX_TRANSLATE || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(to)) throw new Error('BAD_REQUEST');
    try {
      return await translate(text, to);
    } catch {
      throw new Error('TRANSLATE_FAILED');
    }
  });

  ipcMain.on('app:open-external', (_e, url) => {
    if (typeof url === 'string' && /^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  });

  ipcMain.on('win:toggle-fullscreen', () => {
    if (win) win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.on('app:theme-bg', (_e, color) => {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return;
    state.bg = color;
    if (win) win.setBackgroundColor(color);
  });

  // Для разработки: LAMPA_SCREENSHOT=out.png сохраняет снимок окна после отрисовки и закрывает приложение.
  ipcMain.on('dev:rendered', () => {
    const out = process.env.LAMPA_SCREENSHOT;
    if (!out || !win) return;
    setTimeout(async () => {
      if (process.env.LAMPA_EVAL) {
        await win.webContents.executeJavaScript(process.env.LAMPA_EVAL);
        await new Promise((r) => setTimeout(r, 500));
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(out, img.toPNG());
      app.quit();
    }, 700);
  });
}

// ---------- запуск ----------

// Приложение раньше называлось Svitok: при первом запуске под новым именем переносим
// профиль (библиотеку, закладки, настройки), пока Chromium его ещё не открыл.
function migrateUserData() {
  try {
    const now = app.getPath('userData');
    const old = path.join(app.getPath('appData'), 'Svitok');
    // Electron создаёт пустую папку профиля ещё до этого кода, поэтому смотрим не на папку, а на данные в ней.
    const hasData = (dir) => fs.existsSync(path.join(dir, 'Local Storage'));
    if (!hasData(now) && hasData(old)) fs.cpSync(old, now, { recursive: true });
  } catch {
    // не получилось — начнём с чистого профиля
  }
}

// Для разработки: отдельный профиль, чтобы тесты не трогали настоящую библиотеку.
if (process.env.LAMPA_USER_DATA) app.setPath('userData', path.resolve(process.env.LAMPA_USER_DATA));
else migrateUserData();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  pendingPath = bookFromArgv(process.argv);

  app.on('second-instance', (_e, argv, cwd) => {
    const p = bookFromArgv(argv, cwd);
    if (p) openInRenderer(p);
    else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // macOS: файл открыт через Finder или перетащен на иконку в Dock.
  app.on('open-file', (e, p) => {
    e.preventDefault();
    openInRenderer(p);
  });

  app.whenReady().then(() => {
    state = loadState();
    setupMenu();
    registerIpc();
    createWindow();
    setupAutoUpdate();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
