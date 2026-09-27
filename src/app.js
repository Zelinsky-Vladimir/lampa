(() => {
  'use strict';

  const api = window.api;
  const t = I18n.t;
  const $ = (sel) => document.querySelector(sel);
  const root = document.documentElement;

  const THEMES = [
    { id: 'light', name: 'themeLight', bg: '#fbfaf7', fg: '#22211e', accent: '#9c5b23' },
    { id: 'sepia', name: 'themeSepia', bg: '#f4ecd8', fg: '#5b4636', accent: '#9a5b2e' },
    { id: 'olive', name: 'themeOlive', bg: '#c9cbb4', fg: '#1f3d47', accent: '#7a3f1d' },
    { id: 'mint', name: 'themeMint', bg: '#dde8df', fg: '#27392f', accent: '#2f7a55' },
    { id: 'graphite', name: 'themeGraphite', bg: '#2c2e33', fg: '#d4d0c8', accent: '#dba660' },
    { id: 'night', name: 'themeNight', bg: '#16181c', fg: '#aaa598', accent: '#c39152' },
    { id: 'black', name: 'themeBlack', bg: '#000000', fg: '#8e8a80', accent: '#b08850' },
    { id: 'custom', name: 'themeCustom' },
  ];

  // Встроенные шрифты (src/fonts, свободная лицензия OFL) выглядят одинаково на всех системах;
  // системные есть не везде, поэтому у них запасные варианты.
  const FONTS = [
    { id: 'literata', group: 'fontGroupSerif', name: 'Literata', stack: "'Literata Variable', Georgia, serif" },
    { id: 'pt-serif', group: 'fontGroupSerif', name: 'PT Serif', stack: "'PT Serif', Georgia, serif" },
    { id: 'merriweather', group: 'fontGroupSerif', name: 'Merriweather', stack: "'Merriweather Variable', Georgia, serif" },
    { id: 'lora', group: 'fontGroupSerif', name: 'Lora', stack: "'Lora Variable', Georgia, serif" },
    { id: 'noto-serif', group: 'fontGroupSerif', name: 'Noto Serif', stack: "'Noto Serif Variable', Georgia, serif" },
    { id: 'source-serif', group: 'fontGroupSerif', name: 'Source Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
    { id: 'garamond', group: 'fontGroupSerif', name: 'EB Garamond', stack: "'EB Garamond Variable', Garamond, serif" },
    { id: 'plex-serif', group: 'fontGroupSerif', name: 'IBM Plex Serif', stack: "'IBM Plex Serif', Georgia, serif" },
    { id: 'alegreya', group: 'fontGroupSerif', name: 'Alegreya', stack: "'Alegreya Variable', Georgia, serif" },
    { id: 'inter', group: 'fontGroupSans', name: 'Inter', stack: "'Inter Variable', system-ui, sans-serif" },
    { id: 'roboto', group: 'fontGroupSans', name: 'Roboto', stack: "'Roboto Variable', system-ui, sans-serif" },
    { id: 'open-sans', group: 'fontGroupSans', name: 'Open Sans', stack: "'Open Sans Variable', system-ui, sans-serif" },
    { id: 'pt-sans', group: 'fontGroupSans', name: 'PT Sans', stack: "'PT Sans', system-ui, sans-serif" },
    { id: 'jetbrains', group: 'fontGroupMono', name: 'JetBrains Mono', stack: "'JetBrains Mono Variable', Consolas, monospace" },
    { id: 'georgia', group: 'fontGroupSystem', name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
    { id: 'times', group: 'fontGroupSystem', name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
    { id: 'palatino', group: 'fontGroupSystem', name: 'Palatino', stack: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
    { id: 'cambria', group: 'fontGroupSystem', name: 'Cambria', stack: "Cambria, 'PT Serif', serif" },
    { id: 'system', group: 'fontGroupSystem', name: null, stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { id: 'verdana', group: 'fontGroupSystem', name: 'Verdana', stack: "Verdana, 'DejaVu Sans', sans-serif" },
    { id: 'mono', group: 'fontGroupSystem', name: 'Consolas', stack: "'Cascadia Mono', Consolas, Menlo, monospace" },
  ];
  const fontName = (f) => f.name || t('fontSystemUi');

  const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink'];

  // Готовые цвета фона и текста; любой другой — через палитру.
  const BG_SWATCHES = ['#ffffff', '#fbfaf7', '#f4ecd8', '#efe0c4', '#e6dcc6', '#c9cbb4', '#dde8df', '#dde6ee', '#d9d9d9', '#2c2e33', '#1c2633', '#16181c', '#000000'];
  const FG_SWATCHES = ['#000000', '#22211e', '#3d3a35', '#5b4636', '#1f3d47', '#27392f', '#2b3a55', '#e9e4d8', '#d4d0c8', '#aaa598', '#8e8a80', '#c9b58f'];

  // [клавиши, описание]; клавиша-строка из словаря помечена префиксом «@»
  const SHORTCUTS = [
    [['@keySpace', 'PgDn'], 'kPageDown'],
    [['Shift+@keySpace', 'PgUp'], 'kPageUp'],
    [['Ctrl+F'], 'kSearch'],
    [['Ctrl+G'], 'kGoto'],
    [['T'], 'kToc'],
    [['B'], 'kBookmark'],
    [['@keySelect'], 'kSelect'],
    [['S'], 'kSettings'],
    [['A'], 'kAuto'],
    [['Ctrl +', 'Ctrl −', 'Ctrl+@keyWheel'], 'kZoom'],
    [['Ctrl+Shift+←', 'Ctrl+Shift+→'], 'kWidth'],
    [['Ctrl+O'], 'kOpen'],
    [['F11'], 'kFull'],
  ];

  const DEFAULTS = {
    lang: 'auto',
    theme: 'sepia',
    customBg: '#efe6d2',
    customFg: '#2f2a24',
    font: 'literata',
    fontSize: 20,
    lineHeight: 1.6,
    width: 760,
    justify: true,
    indent: true,
    autoSpeed: 40,
    footerAlways: true,
    brightness: 1,
    translateTo: 'auto',
  };

  const LS = { settings: 'lampa.settings', library: 'lampa.library', marks: 'lampa.marks' };
  // Прежнее название приложения — данные переезжают при первом запуске.
  const LS_OLD = { settings: 'svitok.settings', library: 'svitok.library', marks: 'svitok.marks' };
  const LIBRARY_LIMIT = 60;
  // Страница — 1800 знаков, как в печатной книге. Номер не зависит от шрифта и размера окна.
  const CHARS_PER_PAGE = 1800;
  const SEARCH_LIMIT = 5000;
  const SEARCH_LIST_LIMIT = 300;
  const MIN_WIDTH = 480;
  const MAX_WIDTH = 2400;
  // Элементы, по которым запоминается место чтения.
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, pre, tr, hr, figure, img.block, .img-block, .empty-line, .cover, .book-title, .book-author';

  const ui = {
    bar: $('#bar'),
    home: $('#home'),
    recent: $('#recent'),
    homeContinue: $('#home-continue'),
    scroller: $('#scroller'),
    book: $('#book'),
    barBook: $('#bar-book'),
    barChapter: $('#bar-chapter'),
    barFont: $('#bar-font'),
    btnAuto: $('#btn-auto'),
    btnBookmark: $('#btn-bookmark'),
    progressFill: $('#progress-fill'),
    miniPage: $('#mini-page'),
    footChapter: $('#foot-chapter'),
    scrub: $('#scrub'),
    scrubTicks: $('#scrub-ticks'),
    scrubTip: $('#scrub-tip'),
    pageInput: $('#page-input'),
    pageTotal: $('#page-total'),
    pagePct: $('#page-pct'),
    scrim: $('#scrim'),
    tocPanel: $('#toc-panel'),
    toc: $('#toc'),
    bookmarksList: $('#bookmarks-list'),
    notesList: $('#notes-list'),
    searchPanel: $('#search-panel'),
    searchInput: $('#search-input'),
    searchCount: $('#search-count'),
    searchResults: $('#search-results'),
    settingsPanel: $('#settings-panel'),
    notePop: $('#note-pop'),
    selBar: $('#sel-bar'),
    annotPop: $('#annot-pop'),
    annotText: $('#annot-text'),
    trPop: $('#tr-pop'),
    backBtn: $('#back-btn'),
    autoPill: $('#auto-pill'),
    autoSpeedLabel: $('#auto-speed-label'),
    dropOverlay: $('#drop-overlay'),
    toast: $('#toast'),
  };

  // ---------- хранилище ----------

  function loadJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // переполнение хранилища — не критично
    }
  }

  function loadStored(name, fallback) {
    const v = loadJSON(LS[name], null);
    return v ?? loadJSON(LS_OLD[name], fallback);
  }

  const savedSettings = loadStored('settings', null);
  let settings = { ...DEFAULTS, ...(savedSettings || {}) };
  // Кто пользовался приложением до появления переводов, читал его по-русски.
  if (savedSettings && !savedSettings.lang) settings.lang = 'ru';
  if (!FONTS.some((f) => f.id === settings.font)) settings.font = DEFAULTS.font;

  let library = loadStored('library', []);
  if (!Array.isArray(library)) library = [];
  let marks = loadStored('marks', {});
  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) marks = {};

  const saveSettings = () => saveJSON(LS.settings, settings);
  const saveLibrary = () => saveJSON(LS.library, library);
  const saveMarks = () => saveJSON(LS.marks, marks);

  // { key, path, urls, blocks, starts, index, pages, toc, tocStarts, page, ratio, ready }
  let current = null;
  let openToken = 0;
  const backStack = [];

  // ---------- утилиты ----------

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    if (ms > 0) toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }

  function errorText(e) {
    const msg = String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    if (/ENOENT/.test(msg)) return t('errNotFound');
    if (/EACCES|EPERM/.test(msg)) return t('errAccess');
    if (msg === 'UNSUPPORTED') return t('errUnsupported');
    if (msg === 'TOO_LARGE') return t('errTooLarge');
    return msg;
  }

  function isDark(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return lum < 115;
  }

  function hue(str) {
    let h = 0;
    for (const ch of str || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  // ---------- язык интерфейса ----------

  function buildShortcuts() {
    const dl = $('#shortcuts');
    dl.replaceChildren();
    for (const [keys, desc] of SHORTCUTS) {
      const dt = el('dt');
      keys.forEach((k, i) => {
        if (i) dt.append(' ');
        const text = k.replace(/@(\w+)/, (_, key) => t(key));
        const plus = text.lastIndexOf('+');
        // «Ctrl+F» → <kbd>Ctrl</kbd>+<kbd>F</kbd>; «выделить текст» — просто текст
        if (/^@key(Select)$/.test(k)) dt.append(text);
        else if (plus > 0 && plus < text.length - 1) {
          const parts = text.split('+');
          parts.forEach((p, j) => {
            if (j) dt.append('+');
            dt.append(el('kbd', null, p.trim()));
          });
        } else dt.append(el('kbd', null, text));
      });
      dl.append(dt, el('dd', null, t(desc)));
    }
  }

  function fillFontSelect(sel) {
    const value = sel.value;
    sel.replaceChildren();
    const groups = new Map();
    for (const f of FONTS) {
      if (!groups.has(f.group)) {
        const g = el('optgroup');
        g.label = t(f.group);
        groups.set(f.group, g);
        sel.append(g);
      }
      const o = el('option', null, fontName(f));
      o.value = f.id;
      o.style.fontFamily = f.stack;
      groups.get(f.group).append(o);
    }
    sel.value = value || settings.font;
  }

  // Перерисовать всё, что содержит переведённые строки.
  function applyLanguage() {
    I18n.setLang(settings.lang);
    I18n.apply();
    const langSel = $('#lang');
    langSel.options[0].textContent = t('langAuto');
    fillFontSelect($('#font'));
    fillFontSelect(ui.barFont);
    fillTranslateSelect();
    for (const b of document.querySelectorAll('.theme-swatch')) {
      const th = THEMES.find((x) => x.id === b.dataset.theme);
      b.title = t(th.name);
      b.querySelector('.nm').textContent = t(th.name);
    }
    buildShortcuts();
    buildColorControls();
    syncSettingsUI();
    renderHome();
    if (current && current.ready) {
      ui.pageTotal.textContent = t('ofTotal', { total: current.pages });
      if (!current.toc.length) ui.toc.replaceChildren(el('div', 'toc-empty', t('noToc')));
      const end = ui.book.querySelector('.book-end');
      if (end) end.textContent = t('theEnd');
      renderMarkLists();
      updateSearchCount();
      lastChapter = -2;
      updateProgress();
    }
  }

  // ---------- оформление ----------

  function themeColors(id) {
    const th = THEMES.find((x) => x.id === id) || THEMES[1];
    if (th.id !== 'custom') return th;
    return { bg: settings.customBg, fg: settings.customFg, accent: `color-mix(in srgb, ${settings.customFg} 65%, #c07a3a)` };
  }

  function applySettings() {
    const { bg, fg, accent } = themeColors(settings.theme);
    const font = FONTS.find((f) => f.id === settings.font) || FONTS[0];
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--fg', fg);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--font', font.stack);
    root.style.setProperty('--fs', settings.fontSize + 'px');
    root.style.setProperty('--lh', String(settings.lineHeight));
    root.style.setProperty('--width', settings.width + 'px');
    root.style.colorScheme = isDark(bg) ? 'dark' : 'light';
    root.dataset.justify = String(settings.justify);
    root.dataset.indent = String(settings.indent);
    root.dataset.footer = settings.footerAlways ? 'always' : 'auto';
    root.style.setProperty('--dim', String(1 - settings.brightness));
    api.setThemeBg(bg);
    syncSettingsUI();
  }

  // Меняем настройки так, чтобы читаемая строка осталась на месте.
  function updateSettings(patch) {
    const anchor = readerVisible() ? blockAtTop() : null;
    const langChanged = patch.lang && patch.lang !== settings.lang;
    Object.assign(settings, patch);
    saveSettings();
    applySettings();
    if (langChanged) applyLanguage();
    if (anchor) {
      quietScroll();
      scrollToAnchor(anchor);
    }
    updateProgress();
  }

  function buildSettingsUI() {
    const langSel = $('#lang');
    langSel.append(el('option', null, t('langAuto')));
    langSel.options[0].value = 'auto';
    for (const l of I18n.LANGS) {
      const o = el('option', null, l.name);
      o.value = l.id;
      langSel.append(o);
    }
    langSel.addEventListener('change', () => updateSettings({ lang: langSel.value }));
    const trSel = $('#translate-to');
    trSel.addEventListener('change', () => updateSettings({ translateTo: trSel.value }));

    const themes = $('#themes');
    for (const th of THEMES) {
      const b = el('button', 'theme-swatch');
      b.dataset.theme = th.id;
      b.append(el('span', 'aa', 'Aa'), el('span', 'nm'));
      b.addEventListener('click', () => updateSettings({ theme: th.id }));
      themes.append(b);
    }

    for (const sel of [$('#font'), ui.barFont]) {
      sel.addEventListener('change', () => {
        updateSettings({ font: sel.value });
        sel.blur();
      });
    }

    const ranges = { 'font-size': 'fontSize', 'line-height': 'lineHeight', width: 'width', 'auto-speed': 'autoSpeed' };
    for (const [id, key] of Object.entries(ranges)) {
      $('#' + id).addEventListener('input', (e) => updateSettings({ [key]: Number(e.target.value) }));
    }

    for (const seg of document.querySelectorAll('.seg')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) updateSettings({ [seg.dataset.key]: b.dataset.value === 'true' });
      });
    }

    $('#reset-settings').addEventListener('click', () => updateSettings({ ...DEFAULTS, lang: settings.lang }));
  }

  function syncSettingsUI() {
    for (const b of document.querySelectorAll('.theme-swatch')) {
      const c = b.dataset.theme === 'custom' ? { bg: settings.customBg, fg: settings.customFg } : themeColors(b.dataset.theme);
      b.style.setProperty('--sw-bg', c.bg);
      b.style.setProperty('--sw-fg', c.fg);
      b.classList.toggle('active', b.dataset.theme === settings.theme);
    }
    const font = FONTS.find((f) => f.id === settings.font) || FONTS[0];
    $('#lang').value = settings.lang;
    syncColorControls();
    $('#font').value = settings.font;
    ui.barFont.value = settings.font;
    ui.barFont.style.fontFamily = font.stack;
    $('#font-size').value = settings.fontSize;
    $('#font-size-val').textContent = settings.fontSize + ' px';
    $('#line-height').value = settings.lineHeight;
    $('#line-height-val').textContent = settings.lineHeight.toFixed(2);
    $('#width').value = settings.width;
    $('#width-val').textContent = settings.width + ' px';
    $('#auto-speed').value = settings.autoSpeed;
    $('#auto-speed-val').textContent = t('pxs', { n: settings.autoSpeed });
    ui.autoSpeedLabel.textContent = t('pxs', { n: settings.autoSpeed });
    for (const seg of document.querySelectorAll('.seg')) {
      for (const b of seg.children) b.classList.toggle('active', b.dataset.value === String(settings[seg.dataset.key]));
    }
  }

  // ---------- цвета фона и текста, яркость ----------

  // Одни и те же элементы стоят в быстром окошке «☀» и в панели оформления.
  const colorBoxes = () => [$('#quick-colors'), $('#settings-colors')];

  function buildColorControls() {
    for (const box of colorBoxes()) {
      box.replaceChildren();
      const bLabel = el('div', 'cc-label');
      bLabel.append(el('span', null, t('brightness')), el('span', 'cc-bright-val'));
      const range = el('input', 'cc-bright');
      Object.assign(range, { type: 'range', min: '0.3', max: '1', step: '0.05' });
      range.addEventListener('input', () => updateSettings({ brightness: Number(range.value) }));
      box.append(bLabel, range);

      for (const [kind, list, label] of [['bg', BG_SWATCHES, 'customBg'], ['fg', FG_SWATCHES, 'customFg']]) {
        const row = el('div', 'cc-row');
        row.dataset.kind = kind;
        for (const c of list) {
          const b = el('button', 'cc-sw');
          b.dataset.color = c;
          b.title = c;
          b.style.setProperty('--c', c);
          b.addEventListener('click', () => setColor(kind, c));
          row.append(b);
        }
        const pick = el('label', 'cc-sw cc-pick');
        pick.title = t('pickColor');
        const input = el('input');
        input.type = 'color';
        input.addEventListener('input', () => setColor(kind, input.value));
        pick.append(input);
        row.append(pick);
        box.append(el('div', 'cc-label', t(label)), row);
      }
      box.append(el('div', 'cc-contrast'));
    }
    syncColorControls();
  }

  // Цвет выбирается поверх текущей темы: второй цвет берётся из неё, результат — тема «Своя».
  function setColor(kind, color) {
    const cur = themeColors(settings.theme);
    updateSettings({
      theme: 'custom',
      customBg: kind === 'bg' ? color : cur.bg,
      customFg: kind === 'fg' ? color : cur.fg,
    });
  }

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  const contrastRatio = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  function syncColorControls() {
    const { bg, fg } = themeColors(settings.theme);
    const ratio = contrastRatio(bg, fg);
    for (const box of colorBoxes()) {
      const range = box.querySelector('.cc-bright');
      if (!range) continue;
      range.value = settings.brightness;
      box.querySelector('.cc-bright-val').textContent = Math.round(settings.brightness * 100) + '%';
      for (const row of box.querySelectorAll('.cc-row')) {
        const value = row.dataset.kind === 'bg' ? bg : fg;
        for (const b of row.querySelectorAll('button.cc-sw')) b.classList.toggle('active', b.dataset.color.toLowerCase() === value.toLowerCase());
        row.querySelector('input[type=color]').value = value;
      }
      const note = box.querySelector('.cc-contrast');
      note.textContent = t('contrast', { r: ratio.toFixed(1) }) + (ratio < 3 ? ' — ' + t('lowContrast') : '');
      note.classList.toggle('warn', ratio < 3);
    }
  }

  const displayOpen = () => !$('#display-pop').hidden;

  function toggleDisplayPop() {
    const pop = $('#display-pop');
    if (displayOpen()) {
      closeDisplayPop();
      return;
    }
    closePanels();
    closeSearch();
    setBar(true);
    pop.hidden = false;
    $('#btn-display').classList.add('active');
    const r = $('#btn-display').getBoundingClientRect();
    pop.style.top = r.bottom + 8 + 'px';
    pop.style.left = clamp(r.right - pop.offsetWidth, 12, window.innerWidth - pop.offsetWidth - 12) + 'px';
  }

  function closeDisplayPop() {
    $('#display-pop').hidden = true;
    $('#btn-display').classList.remove('active');
  }

  // ---------- место чтения ----------

  const readerVisible = () => !!current && !ui.scroller.hidden;

  // Первый блок, видимый у верхнего края, и доля, на которую он уже прокручен.
  function blockAtTop() {
    const blocks = current && current.blocks;
    if (!blocks || !blocks.length) return null;
    const top = ui.scroller.getBoundingClientRect().top;
    let lo = 0;
    let hi = blocks.length - 1;
    let ans = hi;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (blocks[mid].getBoundingClientRect().bottom > top) {
        ans = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    const r = blocks[ans].getBoundingClientRect();
    return { i: ans, f: r.height ? clamp((top - r.top) / r.height, 0, 1) : 0 };
  }

  function scrollToAnchor(a) {
    const blocks = current && current.blocks;
    if (!blocks || !blocks.length || !a) return;
    const b = blocks[clamp(a.i | 0, 0, blocks.length - 1)];
    const r = b.getBoundingClientRect();
    ui.scroller.scrollTop += r.top - ui.scroller.getBoundingClientRect().top + (a.f || 0) * r.height;
  }

  // ---------- страницы ----------

  // Все текстовые узлы книги подряд с их смещением в символах — основа страниц, поиска и заметок.
  function buildTextIndex() {
    const texts = [];
    const cum = [];
    const nodeIndex = new Map();
    let total = 0;
    const walker = document.createTreeWalker(ui.book, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodeIndex.set(n, texts.length);
      texts.push(n);
      cum.push(total);
      total += n.data.length;
    }
    return { texts, cum, nodeIndex, total, full: null, lower: null };
  }

  function fullText() {
    const index = current.index;
    if (index.full == null) index.full = index.texts.map((n) => n.data).join('');
    return index.full;
  }

  // Смещение (в символах) начала каждого элемента; элементы должны идти в порядке документа.
  function charOffsets(elements, index) {
    const { texts, cum, total } = index;
    const out = new Array(elements.length);
    let j = 0;
    for (let i = 0; i < elements.length; i++) {
      const b = elements[i];
      while (j < texts.length && !b.contains(texts[j]) && !(b.compareDocumentPosition(texts[j]) & Node.DOCUMENT_POSITION_FOLLOWING)) j++;
      out[i] = j < texts.length ? cum[j] : total;
    }
    return out;
  }

  // Последний индекс i, для которого arr[i] <= value (arr отсортирован), или -1.
  function lastAtOrBefore(arr, value) {
    let lo = 0;
    let hi = arr.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= value) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  function blockEnd(i) {
    const { starts, index } = current;
    for (let k = i + 1; k < starts.length; k++) if (starts[k] > starts[i]) return starts[k];
    return index.total;
  }

  const pageOf = (pos) => clamp(Math.floor(pos / CHARS_PER_PAGE) + 1, 1, current.pages);

  function atBookEnd() {
    const s = ui.scroller;
    return s.scrollTop >= s.scrollHeight - s.clientHeight - 2;
  }

  // Позиция чтения в символах: блок у верхнего края плюс прочитанная доля блока.
  function currentCharPos() {
    if (atBookEnd()) return current.index.total;
    const a = blockAtTop();
    if (!a) return 0;
    const start = current.starts[a.i];
    return start + a.f * (blockEnd(a.i) - start);
  }

  function anchorForChar(pos) {
    const i = Math.max(0, lastAtOrBefore(current.starts, pos));
    const start = current.starts[i];
    const end = blockEnd(i);
    return { i, f: end > start ? clamp((pos - start) / (end - start), 0, 1) : 0 };
  }

  function jumpToChar(pos, remember) {
    if (!readerVisible() || !current.ready) return;
    if (remember) pushBack();
    scrollToAnchor(anchorForChar(pos));
    updateProgress();
  }

  // +2 символа, чтобы округление не показало предыдущую страницу
  const jumpToPage = (n, remember) => {
    const page = clamp(Math.round(n) || 1, 1, current.pages);
    jumpToChar((page - 1) * CHARS_PER_PAGE + (page > 1 ? 2 : 0), remember);
  };

  function chapterAt(pos) {
    const k = lastAtOrBefore(current.tocStarts || [], pos);
    return k >= 0 ? current.toc[k].text : '';
  }

  const libraryEntry = () => current && library.find((e) => e.key === current.key);

  function savePosition() {
    if (!current || !current.ready || !readerVisible()) return;
    const entry = libraryEntry();
    if (!entry) return;
    updateProgress();
    const a = blockAtTop();
    if (a) entry.pos = a;
    entry.progress = current.ratio;
    entry.page = current.page;
    entry.pages = current.pages;
    saveLibrary();
  }

  let saveTimer = 0;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 400);
  };

  // Индекс заголовка текущей главы (последний, чья верхняя граница выше линии чтения).
  function currentTocIndex() {
    const toc = current && current.toc;
    if (!toc || !toc.length) return -1;
    const line = ui.scroller.getBoundingClientRect().top + ui.scroller.clientHeight * 0.25;
    let lo = 0;
    let hi = toc.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (toc[mid].el.getBoundingClientRect().top <= line) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  let lastChapter = -2;
  function updateProgress() {
    if (!readerVisible() || !current.ready) return;
    const pos = currentCharPos();
    const total = current.index.total;
    current.ratio = total ? clamp(pos / total, 0, 1) : 0;
    current.page = atBookEnd() ? current.pages : pageOf(pos);

    ui.progressFill.style.transform = `scaleX(${current.ratio})`;
    ui.pagePct.textContent = Math.round(current.ratio * 100) + '%';
    ui.miniPage.textContent = `${current.page} / ${current.pages}`;
    if (document.activeElement !== ui.pageInput) ui.pageInput.value = current.page;
    if (!scrubbing) ui.scrub.value = current.page;
    ui.btnBookmark.classList.toggle('active', bookmarksOnPage(current.page).length > 0);

    const ci = currentTocIndex();
    if (ci !== lastChapter) {
      lastChapter = ci;
      const text = ci >= 0 ? current.toc[ci].text : '';
      ui.barChapter.textContent = text ? ' · ' + text : '';
      ui.footChapter.textContent = text;
      ui.footChapter.title = text;
    }
  }

  let progressQueued = false;
  function scheduleProgress() {
    if (progressQueued) return;
    progressQueued = true;
    requestAnimationFrame(() => {
      progressQueued = false;
      updateProgress();
    });
  }

  // ---------- панели сверху и снизу ----------

  let lastScrollTop = 0;
  // Мышь над панелью — панели не прячутся; подкрутка самим приложением (смена шрифта, ширины) их тоже не прячет.
  let chromeHover = false;
  let quietScrollUntil = 0;
  const quietScroll = () => {
    quietScrollUntil = performance.now() + 350;
  };

  function setBar(visible) {
    root.dataset.chrome = visible ? 'shown' : 'hidden';
  }

  let editorOpenedAt = 0;
  function onScroll() {
    const st = ui.scroller.scrollTop;
    if (!anyPanelOpen() && !displayOpen() && !chromeHover && performance.now() > quietScrollUntil) {
      if (st > lastScrollTop + 6 && st > 120) setBar(false);
      else if (st < lastScrollTop - 6) setBar(true);
    }
    lastScrollTop = st;
    if (!ui.notePop.hidden) closeNote();
    if (!ui.selBar.hidden) hideSelBar();
    if (!ui.trPop.hidden && performance.now() - trOpenedAt > 400) closeTranslate();
    if (!ui.annotPop.hidden && performance.now() - editorOpenedAt > 400) closeNoteEditor();
    scheduleProgress();
    scheduleSave();
  }

  // ---------- ползунок и номер страницы ----------

  let scrubbing = false;

  function setupScrubber() {
    const { pages } = current;
    ui.scrub.max = pages;
    ui.scrub.disabled = pages < 2;
    ui.pageTotal.textContent = t('ofTotal', { total: pages });
    renderTicks();
  }

  const tickLeft = (pos) => ((pageOf(pos) - 1) / Math.max(1, current.pages - 1)) * 100 + '%';

  // Отметки на ползунке: главы, закладки и заметки.
  function renderTicks() {
    ui.scrubTicks.replaceChildren();
    const { pages, toc, tocStarts } = current;
    if (pages < 2) return;
    // главы: самый верхний уровень, где заголовков больше одного (один — обычно название книги)
    const counts = {};
    for (const x of toc) counts[x.level] = (counts[x.level] || 0) + 1;
    const levels = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const tickLevel = levels.find((l) => counts[l] > 1) ?? levels[0];
    toc.forEach((x, k) => {
      if (x.level !== tickLevel) return;
      const tick = el('i');
      tick.style.left = tickLeft(tocStarts[k]);
      ui.scrubTicks.append(tick);
    });
    const bm = bookMarks();
    for (const b of bm.bookmarks) {
      const tick = el('i', 'bm');
      tick.style.left = tickLeft(b.pos);
      ui.scrubTicks.append(tick);
    }
    for (const n of bm.notes) {
      if (n.orphan) continue;
      const tick = el('i', 'nt ' + n.color);
      tick.style.left = tickLeft(n.start);
      ui.scrubTicks.append(tick);
    }
  }

  function showScrubTip() {
    const v = Number(ui.scrub.value);
    const max = Math.max(1, Number(ui.scrub.max) - 1);
    const pct = (v - 1) / max;
    const chapter = chapterAt((v - 1) * CHARS_PER_PAGE + 2);
    ui.scrubTip.textContent = t('pageShort', { n: v }) + (chapter ? ' · ' + chapter : '');
    ui.scrubTip.style.left = `calc(${pct * 100}% + ${(0.5 - pct) * 16}px)`;
    ui.scrubTip.hidden = false;
  }

  function commitPageInput() {
    const n = parseInt(ui.pageInput.value.replace(/\D/g, ''), 10);
    ui.pageInput.blur();
    ui.scroller.focus({ preventScroll: true });
    if (n) jumpToPage(n, true);
  }

  // ---------- открытие книги ----------

  async function openDialog() {
    const p = await api.openDialog({ title: t('dialogTitle'), books: t('dialogBooks'), all: t('dialogAll') });
    if (p) openPath(p);
  }

  async function waitImages(container, timeout) {
    const imgs = Array.from(container.querySelectorAll('img'));
    if (!imgs.length) return;
    await Promise.race([Promise.all(imgs.map((img) => img.decode().catch(() => {}))), sleep(timeout)]);
  }

  async function makeThumb(url) {
    if (!url) return null;
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = 150;
      const h = Math.round(w * 1.5);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      // заполняем 2:3, обрезая лишнее
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      c.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return c.toDataURL('image/jpeg', 0.78);
    } catch {
      return null;
    }
  }

  function renderBook(book) {
    const head = el('header', 'book-head');
    if (book.coverUrl) {
      const cover = el('img', 'cover');
      cover.src = book.coverUrl;
      cover.alt = '';
      head.append(cover);
    }
    head.append(el('div', 'book-title', book.title));
    if (book.author) head.append(el('div', 'book-author', book.author));
    if (book.annotation && book.annotation.textContent.trim()) {
      book.annotation.className = 'annotation';
      head.append(book.annotation);
    }
    ui.book.lang = book.lang || I18n.lang;
    ui.book.replaceChildren(head, book.content, el('div', 'book-end', t('theEnd')));
  }

  function buildToc() {
    const heads = Array.from(ui.book.querySelectorAll('h1, h2, h3, h4'));
    const minLevel = Math.min(...heads.map((h) => Number(h.tagName[1])));
    const toc = [];
    ui.toc.replaceChildren();
    heads.forEach((h, n) => {
      // innerText, а не textContent: строки заголовка, разделённые <br>, не должны слипаться
      const text = h.innerText.replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (!h.id) h.id = 'toc-' + n;
      const level = Number(h.tagName[1]) - minLevel;
      const b = el('button', level ? 'toc-item sub' : 'toc-item');
      const page = el('span', 'toc-page');
      b.append(el('span', 'toc-text', text.length > 90 ? text.slice(0, 88) + '…' : text), page);
      b.style.setProperty('--lvl', Math.min(level, 3));
      b.addEventListener('click', () => {
        closePanels();
        jumpTo(h, false);
      });
      ui.toc.append(b);
      toc.push({ el: h, btn: b, text, level, pageEl: page });
    });
    if (!toc.length) ui.toc.append(el('div', 'toc-empty', t('noToc')));
    return toc;
  }

  async function openPath(p) {
    if (!p) return;
    const token = ++openToken;
    toast(t('opening'), 0);

    let data;
    let book;
    try {
      data = await api.loadBook(p);
      book = Parsers.parseBook(data);
    } catch (e) {
      if (token === openToken) toast(t('openFailed', { e: errorText(e) }), 5000);
      api.rendered();
      return;
    }
    if (token !== openToken) {
      book.urls.forEach((u) => URL.revokeObjectURL(u));
      return;
    }

    savePosition();
    stopAuto();
    closePanels();
    closeSearch();
    resetSearch();
    closeNote();
    closeNoteEditor();
    closeTranslate();
    hideSelBar();
    clearNoteHighlights();
    backStack.length = 0;
    ui.backBtn.hidden = true;
    if (current) current.urls.forEach((u) => URL.revokeObjectURL(u));

    const key = `${data.size}|${book.title}|${book.author}`;
    current = { key, path: p, urls: book.urls, blocks: [], toc: [], ready: false };

    let entry = library.find((e) => e.key === key);
    if (entry) library.splice(library.indexOf(entry), 1);
    else entry = { key, progress: 0, pos: null };
    Object.assign(entry, { path: p, title: book.title, author: book.author, openedAt: Date.now() });
    library.unshift(entry);
    library.length = Math.min(library.length, LIBRARY_LIMIT);
    saveLibrary();

    renderBook(book);
    showReader();
    ui.barBook.textContent = book.title;
    ui.barChapter.textContent = '';
    lastChapter = -2;
    document.title = `${book.title} — Lampa`;

    await waitImages(ui.book, 2500);
    if (token !== openToken) return;

    current.blocks = Array.from(ui.book.querySelectorAll(BLOCK_SEL));
    current.index = buildTextIndex();
    current.starts = charOffsets(current.blocks, current.index);
    current.pages = Math.max(1, Math.ceil(current.index.total / CHARS_PER_PAGE));
    current.toc = buildToc();
    current.tocStarts = charOffsets(current.toc.map((x) => x.el), current.index);
    current.toc.forEach((x, k) => {
      x.pageEl.textContent = pageOf(current.tocStarts[k]);
    });
    validateNotes();
    setupScrubber();
    applyNoteHighlights();
    renderMarkLists();

    ui.scroller.scrollTop = 0;
    if (entry.pos) scrollToAnchor(entry.pos);
    lastScrollTop = ui.scroller.scrollTop;
    current.ready = true;
    setBar(true);
    updateProgress();
    if (entry.pos && current.page > 1) toast(t('continuing', { n: current.page, total: current.pages }), 2200);
    else ui.toast.classList.remove('show');
    ui.scroller.focus({ preventScroll: true });

    if (!entry.thumb && book.coverUrl) {
      makeThumb(book.coverUrl).then((thumb) => {
        if (!thumb) return;
        entry.thumb = thumb;
        saveLibrary();
      });
    }
    api.rendered();
  }

  // ---------- экраны ----------

  function showReader() {
    ui.home.hidden = true;
    ui.scroller.hidden = false;
    root.dataset.mode = 'reader';
  }

  function showHome() {
    savePosition();
    stopAuto();
    closePanels();
    closeSearch();
    closeNote();
    closeNoteEditor();
    closeTranslate();
    hideSelBar();
    ui.backBtn.hidden = true;
    ui.scroller.hidden = true;
    ui.home.hidden = false;
    root.dataset.mode = 'home';
    setBar(true);
    document.title = 'Lampa';
    renderHome();
  }

  function readLabel(entry) {
    if (!entry.progress && !entry.page) return t('notStarted');
    const pct = Math.round((entry.progress || 0) * 100) + '%';
    return entry.page ? t('pageOf', { n: entry.page, total: entry.pages }) + ' · ' + pct : t('readPct', { pct });
  }

  function renderHome() {
    ui.recent.replaceChildren();
    $('#recent-section').hidden = !library.length;

    const last = library[0];
    ui.homeContinue.hidden = !last;
    if (last) {
      $('#home-continue-text').textContent = t('continueBook', { title: last.title }) + (last.page > 1 ? ' · ' + t('pageShort', { n: last.page }) : '');
      ui.homeContinue.title = last.path;
    }

    for (const entry of library) {
      const card = el('div', 'card');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.title = entry.path;

      let thumb;
      if (entry.thumb) {
        thumb = el('img', 'thumb');
        thumb.src = entry.thumb;
        thumb.alt = '';
      } else {
        thumb = el('div', 'thumb ph', (entry.title || '?').trim().charAt(0).toUpperCase());
        thumb.style.setProperty('--h', hue(entry.title));
      }

      const bar = el('div', 'pbar');
      const fill = el('i');
      fill.style.setProperty('--p', entry.progress || 0);
      bar.append(fill);

      const remove = el('button', 'remove', '×');
      remove.title = t('removeFromList');
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        library = library.filter((x) => x !== entry);
        saveLibrary();
        renderHome();
      });

      card.append(thumb, el('div', 't', entry.title), el('div', 'a', entry.author || ' '), bar, el('div', 'pct', readLabel(entry)), remove);
      card.addEventListener('click', () => openPath(entry.path));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openPath(entry.path);
      });
      ui.recent.append(card);
    }
  }

  // ---------- боковые панели ----------

  const anyPanelOpen = () => ui.tocPanel.classList.contains('open') || ui.settingsPanel.classList.contains('open');
  let leftTab = 'toc';

  function switchTab(name) {
    leftTab = name;
    for (const b of ui.tocPanel.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === name);
    for (const body of ui.tocPanel.querySelectorAll('[data-tab-body]')) body.hidden = body.dataset.tabBody !== name;
    if (name === 'toc') highlightToc();
  }

  function openPanel(panel, tab) {
    const wasOpen = panel.classList.contains('open');
    closePanels();
    closeSearch();
    closeDisplayPop();
    if (wasOpen && !tab) return;
    stopAuto();
    panel.classList.add('open');
    ui.scrim.classList.add('show');
    setBar(true);
    if (panel === ui.tocPanel) switchTab(tab || leftTab);
  }

  function closePanels() {
    ui.tocPanel.classList.remove('open');
    ui.settingsPanel.classList.remove('open');
    ui.scrim.classList.remove('show');
  }

  function highlightToc() {
    if (!current || !current.toc) return;
    const ci = currentTocIndex();
    current.toc.forEach((x, i) => x.btn.classList.toggle('current', i === ci));
    if (ci >= 0) current.toc[ci].btn.scrollIntoView({ block: 'center' });
  }

  // ---------- ссылки и сноски книги ----------

  function pushBack() {
    backStack.push(ui.scroller.scrollTop);
    ui.backBtn.hidden = false;
  }

  function jumpTo(target, remember) {
    if (remember) pushBack();
    ui.scroller.scrollTop += target.getBoundingClientRect().top - ui.scroller.getBoundingClientRect().top - 24;
  }

  function goBack() {
    if (backStack.length) ui.scroller.scrollTop = backStack.pop();
    ui.backBtn.hidden = !backStack.length;
  }

  function noteSource(target) {
    let src = target;
    if (src.textContent.trim().length < 3 || /^(A|SPAN|SUP|EM|STRONG)$/.test(src.tagName)) {
      src = target.closest('p, li, aside, dd, div, section') || target;
    }
    return src.textContent.length > 4000 ? null : src;
  }

  function isNoteLink(a, target) {
    return a.classList.contains('note-ref') ||
      !!target.closest('.notes, .footnote') ||
      /^[[(]?\s*[\d*†‡]{1,4}\s*[\])]?$/.test(a.textContent.trim());
  }

  function placePopup(pop, rect) {
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = clamp(rect.left + rect.width / 2 - w / 2, 12, window.innerWidth - w - 12);
    let top = rect.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, rect.top - h - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function showNote(a, target) {
    const src = noteSource(target);
    if (!src) return false;
    stopAuto();
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    clone.querySelectorAll(':scope > .title').forEach((n) => n.remove());

    const go = el('button', 'note-go', t('goToNote'));
    go.addEventListener('click', () => {
      closeNote();
      jumpTo(target, true);
    });
    ui.notePop.replaceChildren(clone, go);
    ui.notePop.hidden = false;
    placePopup(ui.notePop, a.getBoundingClientRect());
    return true;
  }

  function closeNote() {
    ui.notePop.hidden = true;
  }

  function handleLink(e, a) {
    e.preventDefault();
    const href = a.getAttribute('href');
    if (!href) return;
    if (/^(https?:|mailto:)/i.test(href)) {
      api.openExternal(href);
      return;
    }
    if (!href.startsWith('#')) return;
    const target = document.getElementById(href.slice(1));
    if (!target || !ui.book.contains(target)) return;
    const insidePopup = ui.notePop.contains(a);
    closeNote();
    if (insidePopup || !isNoteLink(a, target) || !showNote(a, target)) jumpTo(target, true);
  }

  // ---------- поиск ----------

  const search = { query: '', matches: [], cur: -1, timer: 0, jumped: false, items: [] };
  const hasHighlights = !!(window.CSS && CSS.highlights && window.Highlight);

  // Нижний регистр и ё→е без изменения длины строки, чтобы смещения совпадали с текстом.
  function normalizeText(s) {
    let lower = s.toLowerCase();
    if (lower.length !== s.length) lower = Array.from(s, (c) => (c.toLowerCase().length === c.length ? c.toLowerCase() : c)).join('');
    return lower.replace(/ё/g, 'е').replace(/\s/g, ' ');
  }

  const normalizeQuery = (s) => normalizeText(s).replace(/ +/g, ' ').trim();

  function searchHaystack() {
    const index = current.index;
    if (index.lower == null) index.lower = normalizeText(fullText());
    return index.lower;
  }

  function rangeFor(start, end) {
    const { texts, cum } = current.index;
    const a = Math.max(0, lastAtOrBefore(cum, start));
    const b = Math.max(0, lastAtOrBefore(cum, end - 1));
    const r = document.createRange();
    r.setStart(texts[a], clamp(start - cum[a], 0, texts[a].length));
    r.setEnd(texts[b], clamp(end - cum[b], 0, texts[b].length));
    return r;
  }

  function clearHighlights() {
    if (!hasHighlights) return;
    CSS.highlights.delete('search-hit');
    CSS.highlights.delete('search-current');
  }

  function resetSearch() {
    clearTimeout(search.timer);
    Object.assign(search, { query: '', matches: [], cur: -1, timer: 0, jumped: false, items: [] });
    ui.searchInput.value = '';
    ui.searchCount.textContent = '';
    ui.searchResults.replaceChildren();
    clearHighlights();
  }

  function updateSearchCount() {
    const n = search.matches.length;
    const shown = n + (n >= SEARCH_LIMIT ? '+' : '');
    if (!search.query) ui.searchCount.textContent = '';
    else if (!n) ui.searchCount.textContent = t('nothingFound');
    else if (search.cur < 0) ui.searchCount.textContent = t('foundN', { n: shown });
    else ui.searchCount.textContent = t('matchOf', { i: search.cur + 1, n: shown });
  }

  function runSearch() {
    clearTimeout(search.timer);
    search.timer = 0;
    const query = normalizeQuery(ui.searchInput.value);
    if (!current || !current.ready || query === search.query) return;
    Object.assign(search, { query, matches: [], cur: -1, jumped: false, items: [] });
    ui.searchResults.replaceChildren();
    clearHighlights();
    if (query.length < 2) {
      if (query) search.query = '';
      updateSearchCount();
      return;
    }

    const hay = searchHaystack();
    for (let i = hay.indexOf(query); i !== -1 && search.matches.length < SEARCH_LIMIT; i = hay.indexOf(query, i + query.length)) {
      search.matches.push({ start: i, end: i + query.length });
    }

    if (hasHighlights && search.matches.length) {
      const hl = new Highlight();
      hl.priority = 1;
      for (const m of search.matches) hl.add(rangeFor(m.start, m.end));
      CSS.highlights.set('search-hit', hl);
    }

    const full = fullText();
    const frag = document.createDocumentFragment();
    search.matches.slice(0, SEARCH_LIST_LIMIT).forEach((m, k) => {
      const item = el('button', 'search-item');
      const chapter = chapterAt(m.start);
      item.append(el('div', 'meta', t('pageShort', { n: pageOf(m.start) }) + (chapter ? ' · ' + chapter : '')));
      const from = Math.max(0, m.start - 50);
      const to = Math.min(full.length, m.end + 70);
      const clean = (s) => s.replace(/\s+/g, ' ');
      const snip = el('div', 'snip');
      snip.append(
        (from > 0 ? '…' : '') + clean(full.slice(from, m.start)).trimStart(),
        el('mark', null, full.slice(m.start, m.end)),
        clean(full.slice(m.end, to)).trimEnd() + (to < full.length ? '…' : ''),
      );
      item.append(snip);
      item.addEventListener('click', () => gotoMatch(k));
      frag.append(item);
      search.items.push(item);
    });
    if (search.matches.length > SEARCH_LIST_LIMIT) frag.append(el('div', 'search-more', t('searchMore', { n: SEARCH_LIST_LIMIT })));
    ui.searchResults.append(frag);
    updateSearchCount();
  }

  function scrollRangeIntoView(range) {
    const s = ui.scroller;
    const sr = s.getBoundingClientRect();
    const r = range.getBoundingClientRect();
    if (r.top < sr.top + 70 || r.bottom > sr.bottom - 90) s.scrollTop += r.top - sr.top - s.clientHeight * 0.35;
  }

  function gotoMatch(k) {
    const m = search.matches[k];
    if (!m) return;
    if (search.items[search.cur]) search.items[search.cur].classList.remove('active');
    search.cur = k;
    const range = rangeFor(m.start, m.end);
    if (hasHighlights) {
      const hl = new Highlight(range);
      hl.priority = 2;
      CSS.highlights.set('search-current', hl);
    }
    if (!search.jumped) {
      pushBack();
      search.jumped = true;
    }
    scrollRangeIntoView(range);
    const item = search.items[k];
    if (item) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    }
    updateSearchCount();
  }

  function stepMatch(dir) {
    if (search.timer || normalizeQuery(ui.searchInput.value) !== search.query) runSearch();
    const n = search.matches.length;
    if (!n) return;
    if (search.cur < 0) {
      // первое совпадение после текущего места чтения
      const pos = currentCharPos();
      const k = search.matches.findIndex((m) => m.start >= pos);
      gotoMatch(dir > 0 ? (k < 0 ? 0 : k) : ((k < 0 ? n : k) - 1 + n) % n);
    } else {
      gotoMatch((search.cur + dir + n) % n);
    }
  }

  const searchOpen = () => ui.searchPanel.classList.contains('open');

  function openSearch() {
    if (!readerVisible()) return;
    closePanels();
    stopAuto();
    const anchor = blockAtTop();
    ui.searchPanel.classList.add('open');
    root.dataset.search = 'open';
    quietScroll();
    scrollToAnchor(anchor);
    setBar(true);
    // подсветка возвращается, если поиск открыли повторно
    if (search.query) {
      const q = search.query;
      search.query = '';
      ui.searchInput.value = ui.searchInput.value || q;
      runSearch();
    }
    ui.searchInput.focus();
    ui.searchInput.select();
  }

  function closeSearch() {
    if (!searchOpen()) return;
    const anchor = readerVisible() ? blockAtTop() : null;
    ui.searchPanel.classList.remove('open');
    delete root.dataset.search;
    quietScroll();
    if (anchor) scrollToAnchor(anchor);
    clearHighlights();
    ui.scroller.focus({ preventScroll: true });
  }

  // ---------- закладки и заметки ----------

  function bookMarks() {
    if (!marks[current.key]) marks[current.key] = { bookmarks: [], notes: [] };
    return marks[current.key];
  }

  const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

  function snippetAt(pos, len = 110) {
    const s = oneLine(fullText().slice(pos, pos + len * 2));
    return s.length > len ? s.slice(0, len).trimEnd() + '…' : s;
  }

  const bookmarksOnPage = (page) => (current && current.ready ? bookMarks().bookmarks.filter((b) => pageOf(b.pos) === page) : []);

  function toggleBookmark() {
    if (!readerVisible() || !current.ready) return;
    updateProgress();
    const bm = bookMarks();
    const here = bookmarksOnPage(current.page);
    if (here.length) {
      bm.bookmarks = bm.bookmarks.filter((b) => !here.includes(b));
      toast(t('bookmarkRemoved'), 1400);
    } else {
      const pos = Math.floor(currentCharPos());
      bm.bookmarks.push({ id: uid(), pos, created: Date.now() });
      bm.bookmarks.sort((a, b) => a.pos - b.pos);
      toast(t('bookmarkAdded', { n: pageOf(pos) }), 1400);
    }
    saveMarks();
    refreshMarks();
  }

  // Заметка хранит смещения в тексте и цитату. Если текст книги сдвинулся, ищем цитату заново.
  function validateNotes() {
    const full = fullText();
    for (const n of bookMarks().notes) {
      if (oneLine(full.slice(n.start, n.end)) === n.quote) {
        n.orphan = false;
        continue;
      }
      const i = full.indexOf(n.quote);
      if (i >= 0) {
        n.start = i;
        n.end = i + n.quote.length;
        n.orphan = false;
      } else {
        n.orphan = true;
      }
    }
  }

  function clearNoteHighlights() {
    if (!hasHighlights) return;
    for (const c of NOTE_COLORS) CSS.highlights.delete('note-' + c);
    CSS.highlights.delete('note-comment');
  }

  function applyNoteHighlights() {
    clearNoteHighlights();
    if (!hasHighlights) return;
    const groups = {};
    const comment = new Highlight();
    for (const n of bookMarks().notes) {
      if (n.orphan) continue;
      const r = rangeFor(n.start, n.end);
      if (!groups[n.color]) groups[n.color] = new Highlight();
      groups[n.color].add(r);
      if (n.text) comment.add(r);
    }
    for (const [c, hl] of Object.entries(groups)) CSS.highlights.set('note-' + c, hl);
    CSS.highlights.set('note-comment', comment);
  }

  function refreshMarks() {
    if (!current || !current.ready) return;
    applyNoteHighlights();
    renderTicks();
    renderMarkLists();
    updateProgress();
  }

  function markMeta(pos) {
    const chapter = chapterAt(pos);
    return t('pageShort', { n: pageOf(pos) }) + (chapter ? ' · ' + chapter : '');
  }

  function renderMarkLists() {
    if (!current || !current.index) return;
    const bm = bookMarks();
    $('#bm-count').textContent = bm.bookmarks.length || '';
    $('#note-count').textContent = bm.notes.length || '';

    ui.bookmarksList.replaceChildren();
    if (!bm.bookmarks.length) ui.bookmarksList.append(el('div', 'mark-empty', t('noBookmarks')));
    for (const b of bm.bookmarks) {
      const item = el('div', 'mark-item');
      item.append(el('div', 'meta', markMeta(b.pos)), el('div', 'snip', snippetAt(b.pos)));
      const del = el('button', 'mark-del', '×');
      del.title = t('delete');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        bm.bookmarks = bm.bookmarks.filter((x) => x !== b);
        saveMarks();
        refreshMarks();
      });
      item.append(del);
      item.addEventListener('click', () => {
        closePanels();
        jumpToChar(b.pos, true);
      });
      ui.bookmarksList.append(item);
    }

    ui.notesList.replaceChildren();
    if (!bm.notes.length) {
      ui.notesList.append(el('div', 'mark-empty', t('noNotes')));
      return;
    }
    const copyAll = el('button', 'text-btn copy-all', t('copyAllNotes'));
    copyAll.addEventListener('click', copyAllNotes);
    ui.notesList.append(copyAll);
    for (const n of bm.notes) {
      const item = el('div', 'mark-item note ' + n.color);
      item.append(el('div', 'meta', n.orphan ? t('orphan') : markMeta(n.start)));
      item.append(el('div', 'quote', n.quote.length > 240 ? n.quote.slice(0, 238) + '…' : n.quote));
      if (n.text) item.append(el('div', 'note-text', n.text));
      const edit = el('button', 'mark-edit', '✎');
      edit.title = t('edit');
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        closePanels();
        if (!n.orphan) jumpToChar(n.start, true);
        requestAnimationFrame(() => openNoteEditor(n, false));
      });
      const del = el('button', 'mark-del', '×');
      del.title = t('delete');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(n);
      });
      item.append(edit, del);
      item.addEventListener('click', () => {
        if (n.orphan) return;
        closePanels();
        jumpToChar(Math.max(0, n.start - 1), true);
      });
      ui.notesList.append(item);
    }
  }

  function copyAllNotes() {
    const bm = bookMarks();
    const entry = libraryEntry();
    const lines = [`# ${entry ? entry.title : ''}`, ''];
    for (const n of bm.notes) {
      lines.push(`> ${n.quote}`, '');
      if (n.text) lines.push(n.text, '');
      if (!n.orphan) lines.push(`— ${markMeta(n.start)}`, '');
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast(t('notesCopied'), 1600));
  }

  // Граница выделения (узел, смещение) → позиция в символах.
  function boundaryToChar(node, offset) {
    const idx = current.index;
    if (node.nodeType === Node.TEXT_NODE && idx.nodeIndex.has(node)) return idx.cum[idx.nodeIndex.get(node)] + offset;
    const pre = document.createRange();
    pre.setStart(ui.book, 0);
    pre.setEnd(node, offset);
    return pre.toString().length;
  }

  function selectionCharRange() {
    if (!readerVisible() || !current.ready) return null;
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!ui.book.contains(r.commonAncestorContainer)) return null;
    let start = boundaryToChar(r.startContainer, r.startOffset);
    let end = boundaryToChar(r.endContainer, r.endOffset);
    const full = fullText();
    while (start < end && /\s/.test(full[start])) start++;
    while (end > start && /\s/.test(full[end - 1])) end--;
    return end > start ? { start, end, rect: r.getBoundingClientRect() } : null;
  }

  function showSelBar() {
    const r = selectionCharRange();
    if (!r) {
      hideSelBar();
      return;
    }
    ui.selBar.hidden = false;
    const w = ui.selBar.offsetWidth;
    const h = ui.selBar.offsetHeight;
    const left = clamp(r.rect.left + r.rect.width / 2 - w / 2, 12, window.innerWidth - w - 12);
    let top = r.rect.top - h - 10;
    if (top < 60) top = r.rect.bottom + 10;
    ui.selBar.style.left = left + 'px';
    ui.selBar.style.top = top + 'px';
  }

  function hideSelBar() {
    ui.selBar.hidden = true;
  }

  function addNote(range, color, text) {
    const note = {
      id: uid(),
      start: range.start,
      end: range.end,
      quote: oneLine(fullText().slice(range.start, range.end)),
      color,
      text: text || '',
      created: Date.now(),
    };
    const bm = bookMarks();
    bm.notes.push(note);
    bm.notes.sort((a, b) => a.start - b.start);
    saveMarks();
    refreshMarks();
    return note;
  }

  function deleteNote(note) {
    const bm = bookMarks();
    bm.notes = bm.notes.filter((x) => x !== note);
    saveMarks();
    refreshMarks();
    toast(t('noteDeleted'), 1400);
  }

  // Заметка под точкой клика (самая короткая из пересекающихся).
  function noteAtPoint(x, y) {
    let node;
    let offset;
    if (document.caretPositionFromPoint) {
      const cp = document.caretPositionFromPoint(x, y);
      if (cp) {
        node = cp.offsetNode;
        offset = cp.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const cr = document.caretRangeFromPoint(x, y);
      if (cr) {
        node = cr.startContainer;
        offset = cr.startOffset;
      }
    }
    if (!node || node.nodeType !== Node.TEXT_NODE || !current.index.nodeIndex.has(node)) return null;
    const pos = current.index.cum[current.index.nodeIndex.get(node)] + offset;
    const hits = bookMarks().notes.filter((n) => !n.orphan && pos >= n.start && pos <= n.end);
    hits.sort((a, b) => a.end - a.start - (b.end - b.start));
    return hits[0] || null;
  }

  let editing = null; // { note, isNew }

  function openNoteEditor(note, isNew) {
    closeNoteEditor();
    hideSelBar();
    editing = { note, isNew };
    editorOpenedAt = performance.now();
    $('#annot-quote').textContent = note.quote.length > 200 ? note.quote.slice(0, 198) + '…' : note.quote;
    ui.annotText.value = note.text;
    for (const b of $('#annot-colors').children) b.classList.toggle('active', b.dataset.color === note.color);
    ui.annotPop.hidden = false;
    const rect = note.orphan ? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0) : rangeFor(note.start, note.end).getBoundingClientRect();
    placePopup(ui.annotPop, rect);
    ui.annotText.focus();
  }

  // Закрытие всегда сохраняет; пустая только что созданная заметка удаляется.
  function closeNoteEditor() {
    if (!editing) return;
    const { note, isNew } = editing;
    editing = null;
    ui.annotPop.hidden = true;
    note.text = ui.annotText.value.trim();
    const bm = marks[current && current.key];
    if (isNew && !note.text && bm) bm.notes = bm.notes.filter((x) => x !== note);
    saveMarks();
    refreshMarks();
  }

  function setEditorColor(color) {
    if (!editing) return;
    editing.note.color = color;
    for (const b of $('#annot-colors').children) b.classList.toggle('active', b.dataset.color === color);
    saveMarks();
    refreshMarks();
  }

  // ---------- перевод выделенного текста ----------

  const TRANSLATE_LANGS = ['ru', 'uk', 'en', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'tr', 'zh-CN', 'ja', 'ko', 'ar'];
  let trState = null; // { start, end, translation }
  let trOpenedAt = 0;

  function langName(code) {
    try {
      const n = new Intl.DisplayNames([I18n.lang], { type: 'language' }).of(code);
      return n.charAt(0).toUpperCase() + n.slice(1);
    } catch {
      return code;
    }
  }

  function fillTranslateSelect() {
    const sel = $('#translate-to');
    sel.replaceChildren();
    const auto = el('option', null, t('langInterface'));
    auto.value = 'auto';
    sel.append(auto);
    for (const code of TRANSLATE_LANGS) {
      const o = el('option', null, langName(code));
      o.value = code;
      sel.append(o);
    }
    sel.value = settings.translateTo;
  }

  const translateTarget = () => (settings.translateTo === 'auto' ? I18n.lang : settings.translateTo);

  // Предложение вокруг выделения — по нему видно, какое значение слова подразумевается.
  function sentenceAround(start, end) {
    const full = fullText();
    const bi = Math.max(0, lastAtOrBefore(current.starts, start));
    const pStart = current.starts[bi];
    const para = full.slice(pStart, Math.max(blockEnd(bi), end));
    let s = start - pStart;
    let e = end - pStart;
    while (s > 0 && !/[.!?…]/.test(para[s - 1])) s--;
    while (e < para.length && !/[.!?…]/.test(para[e])) e++;
    while (e < para.length && /[.!?…"»”’)\]]/.test(para[e])) e++;
    s = Math.max(s, start - pStart - 300);
    e = Math.min(e, end - pStart + 300);
    return oneLine(para.slice(s, e));
  }

  // Язык по умолчанию — язык интерфейса; если книга уже на нём (русская книга при русском интерфейсе),
  // переводим на английский. Явно выбранный язык соблюдаем всегда.
  async function translateText(text) {
    let to = translateTarget();
    let res = await api.translate(text, to);
    if (settings.translateTo === 'auto' && res.src && res.src.split('-')[0] === to.split('-')[0] && to !== 'en') {
      to = 'en';
      res = await api.translate(text, to);
    }
    return { ...res, to };
  }

  function placeTranslate() {
    if (!trState) return;
    ui.trPop.scrollTop = 0;
    placePopup(ui.trPop, rangeFor(trState.start, trState.end).getBoundingClientRect());
  }

  function fillTrTo(value) {
    const sel = $('#tr-to');
    if (!sel.options.length) {
      for (const code of TRANSLATE_LANGS) {
        const o = el('option', null, langName(code));
        o.value = code;
        sel.append(o);
      }
    }
    sel.value = value;
  }

  async function translateSelection() {
    const r = selectionCharRange();
    if (!r) return;
    const text = oneLine(fullText().slice(r.start, r.end)).slice(0, 1500);
    const sentence = sentenceAround(r.start, r.end);
    hideSelBar();
    window.getSelection().removeAllRanges();
    closeTranslate();

    trState = {
      start: r.start,
      end: r.end,
      text,
      context: sentence.length > text.length + 3 && sentence.length <= 1200 ? sentence : '',
      translation: '',
      sentence: '',
    };
    if (hasHighlights) {
      const hl = new Highlight(rangeFor(r.start, r.end));
      hl.priority = 3;
      CSS.highlights.set('tr-current', hl);
    }
    runTranslation(trState);
  }

  async function runTranslation(state) {
    trOpenedAt = performance.now();
    const main = $('#tr-main');
    main.textContent = t('translating');
    main.classList.add('loading');
    $('#tr-src').textContent = '';
    fillTrTo(translateTarget());
    $('#tr-dict').replaceChildren();
    $('#tr-context').hidden = !state.context;
    if (state.context) {
      const orig = $('#tr-orig');
      const i = state.context.indexOf(state.text);
      if (i >= 0) orig.replaceChildren(state.context.slice(0, i), el('mark', null, state.text), state.context.slice(i + state.text.length));
      else orig.textContent = state.context;
      $('#tr-sentence').textContent = '…';
    }
    ui.trPop.hidden = false;
    placeTranslate();

    const mainReq = translateText(state.text);
    const ctxReq = state.context ? translateText(state.context) : null;
    try {
      const res = await mainReq;
      if (trState !== state) return;
      main.classList.remove('loading');
      main.textContent = res.text || '—';
      state.translation = res.text;
      $('#tr-src').textContent = (res.src || '?').toUpperCase() + ' →';
      fillTrTo(res.to);
      for (const d of res.dict.slice(0, 4)) {
        const row = el('div', 'tr-dict-row');
        if (d.pos) row.append(el('span', 'tr-pos', d.pos));
        row.append(el('span', null, d.terms.slice(0, 6).join(', ')));
        $('#tr-dict').append(row);
      }
    } catch {
      if (trState !== state) return;
      main.classList.remove('loading');
      main.textContent = t('translateFailed');
    }
    placeTranslate();
    if (!ctxReq) return;
    try {
      const res = await ctxReq;
      if (trState === state) {
        $('#tr-sentence').textContent = res.text || '—';
        state.sentence = res.text || '';
      }
    } catch {
      if (trState === state) $('#tr-sentence').textContent = '—';
    }
    placeTranslate();
  }

  // Язык меняется прямо в окошке перевода: запоминаем выбор и сразу переводим заново.
  function changeTranslateLang(code) {
    const state = trState;
    if (!state) return;
    trOpenedAt = performance.now();
    updateSettings({ translateTo: code });
    Object.assign(state, { translation: '', sentence: '' });
    runTranslation(state);
  }

  function closeTranslate() {
    trState = null;
    ui.trPop.hidden = true;
    if (hasHighlights) CSS.highlights.delete('tr-current');
  }

  // ---------- автопрокрутка ----------

  const auto = { on: false, last: 0, acc: 0 };

  function startAuto() {
    if (!readerVisible()) return;
    auto.on = true;
    auto.last = performance.now();
    auto.acc = 0;
    ui.btnAuto.classList.add('active');
    ui.autoPill.hidden = false;
    setBar(false);
    requestAnimationFrame(autoTick);
  }

  function stopAuto() {
    auto.on = false;
    ui.btnAuto.classList.remove('active');
    ui.autoPill.hidden = true;
  }

  function autoTick(now) {
    if (!auto.on) return;
    const dt = Math.min(100, now - auto.last);
    auto.last = now;
    auto.acc += (settings.autoSpeed * dt) / 1000;
    const whole = Math.floor(auto.acc);
    if (whole > 0) {
      auto.acc -= whole;
      const s = ui.scroller;
      s.scrollTop += whole;
      if (s.scrollTop >= s.scrollHeight - s.clientHeight - 1) {
        stopAuto();
        return;
      }
    }
    requestAnimationFrame(autoTick);
  }

  function changeAutoSpeed(dir) {
    const v = settings.autoSpeed;
    const next = clamp(Math.round((dir > 0 ? v * 1.2 : v / 1.2) / 5) * 5 || 10, 10, 300);
    updateSettings({ autoSpeed: next === v ? clamp(v + dir * 5, 10, 300) : next });
    // когда прокрутка идёт, скорость и так видна на плашке
    if (!auto.on) toast(t('autoSpeedToast', { n: settings.autoSpeed }), 1400);
  }

  // ---------- масштаб и ширина колонки ----------

  // Самая широкая колонка, которая помещается в окно (поля по 44 px с каждой стороны).
  function maxUsableWidth() {
    const w = (readerVisible() ? ui.scroller.clientWidth : window.innerWidth) - 88;
    return clamp(Math.floor(w / 10) * 10, MIN_WIDTH, MAX_WIDTH);
  }

  // Масштаб: шрифт и ширина колонки меняются вместе, поэтому текст занимает больше места на экране,
  // а длина строки в символах остаётся удобной.
  function zoom(dir) {
    if (!dir) {
      updateSettings({ fontSize: DEFAULTS.fontSize, width: DEFAULTS.width });
    } else {
      const fontSize = clamp(settings.fontSize + dir * 2, 12, 44);
      if (fontSize === settings.fontSize) return;
      const scaled = Math.round((Math.min(settings.width, maxUsableWidth()) * fontSize) / settings.fontSize / 10) * 10;
      updateSettings({ fontSize, width: clamp(scaled, MIN_WIDTH, maxUsableWidth()) });
    }
    toast(t('zoomToast', { fs: settings.fontSize, w: Math.min(settings.width, maxUsableWidth()) }), 1400);
  }

  function changeWidth(dir) {
    const cur = Math.min(settings.width, maxUsableWidth());
    const next = clamp(cur + dir * 80, MIN_WIDTH, maxUsableWidth());
    if (next === cur) {
      toast(dir > 0 ? t('widthMax') : t('widthMin'), 1400);
      return;
    }
    updateSettings({ width: next });
    toast(t('widthToast', { w: next }), 1200);
  }

  // ---------- клавиатура ----------

  function pageScroll(dir) {
    const s = ui.scroller;
    const line = settings.fontSize * settings.lineHeight;
    s.scrollBy({ top: dir * (s.clientHeight - line * 2), behavior: 'smooth' });
  }

  function focusPageInput() {
    if (!readerVisible()) return;
    setBar(true);
    ui.pageInput.focus();
  }

  function onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    // Эти работают и из поля поиска.
    if (ctrl && e.code === 'KeyF') {
      e.preventDefault();
      openSearch();
      return;
    }
    if (e.key === 'F3') {
      e.preventDefault();
      if (!searchOpen()) openSearch();
      stepMatch(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.target instanceof Element && e.target.closest('input, select, textarea')) {
      if (e.key === 'Escape') {
        if (e.target === ui.searchInput) closeSearch();
        else if (e.target === ui.annotText) closeNoteEditor();
        else e.target.blur();
      }
      return;
    }
    if (ctrl) {
      if (e.code === 'KeyO') openDialog();
      else if (e.code === 'KeyG') focusPageInput();
      else if (e.code === 'KeyD') toggleBookmark();
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(1);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(-1);
      else if (e.code === 'Digit0' || e.code === 'Numpad0') zoom(0);
      else if (e.shiftKey && e.code === 'ArrowRight') changeWidth(1);
      else if (e.shiftKey && e.code === 'ArrowLeft') changeWidth(-1);
      else return;
      e.preventDefault();
      return;
    }
    if (e.key === 'F11') {
      e.preventDefault();
      api.toggleFullscreen();
      return;
    }
    if (e.key === 'Escape') {
      if (displayOpen()) closeDisplayPop();
      else if (!ui.trPop.hidden) closeTranslate();
      else if (!ui.notePop.hidden) closeNote();
      else if (!ui.selBar.hidden) hideSelBar();
      else if (anyPanelOpen()) closePanels();
      else if (searchOpen()) closeSearch();
      else if (auto.on) stopAuto();
      return;
    }
    if (e.code === 'KeyS' && !e.altKey) {
      openPanel(ui.settingsPanel);
      return;
    }
    if (!readerVisible() || e.altKey) return;

    const s = ui.scroller;
    const step = settings.fontSize * settings.lineHeight * 3;
    switch (e.code) {
      case 'Space': pageScroll(e.shiftKey ? -1 : 1); break;
      case 'PageDown': pageScroll(1); break;
      case 'PageUp': pageScroll(-1); break;
      case 'ArrowDown': s.scrollBy({ top: step, behavior: 'smooth' }); break;
      case 'ArrowUp': s.scrollBy({ top: -step, behavior: 'smooth' }); break;
      case 'Home': s.scrollTop = 0; break;
      case 'End': s.scrollTop = s.scrollHeight; break;
      case 'KeyT': openPanel(ui.tocPanel); break;
      case 'KeyB': toggleBookmark(); break;
      case 'KeyA': (auto.on ? stopAuto : startAuto)(); break;
      case 'BracketRight': changeAutoSpeed(1); break;
      case 'BracketLeft': changeAutoSpeed(-1); break;
      default: return;
    }
    e.preventDefault();
  }

  // Ctrl+колёсико — тот же масштаб, что Ctrl +/−.
  let wheelAcc = 0;
  function onWheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < 80) return;
    zoom(wheelAcc < 0 ? 1 : -1);
    wheelAcc = 0;
  }

  // ---------- перетаскивание файлов ----------

  function setupDragDrop() {
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      depth++;
      ui.dropOverlay.classList.add('show');
    });
    window.addEventListener('dragleave', () => {
      if (--depth <= 0) {
        depth = 0;
        ui.dropOverlay.classList.remove('show');
      }
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      ui.dropOverlay.classList.remove('show');
      const file = e.dataTransfer.files[0];
      if (file) openPath(api.pathForFile(file));
    });
  }

  // ---------- запуск ----------

  function bindUI() {
    $('#btn-open').addEventListener('click', openDialog);
    $('#home-open').addEventListener('click', openDialog);
    $('#btn-home').addEventListener('click', showHome);
    $('#btn-toc').addEventListener('click', () => openPanel(ui.tocPanel));
    $('#btn-settings').addEventListener('click', () => openPanel(ui.settingsPanel));
    $('#btn-full').addEventListener('click', () => api.toggleFullscreen());
    $('#btn-search').addEventListener('click', () => (searchOpen() ? closeSearch() : openSearch()));
    $('#btn-display').addEventListener('click', toggleDisplayPop);
    $('#btn-zoom-in').addEventListener('click', () => zoom(1));
    $('#btn-zoom-out').addEventListener('click', () => zoom(-1));
    $('#btn-wide').addEventListener('click', () => changeWidth(1));
    $('#btn-narrow').addEventListener('click', () => changeWidth(-1));
    ui.btnBookmark.addEventListener('click', toggleBookmark);
    ui.homeContinue.addEventListener('click', () => library[0] && openPath(library[0].path));
    ui.btnAuto.addEventListener('click', () => (auto.on ? stopAuto() : startAuto()));
    $('#auto-stop').addEventListener('click', stopAuto);
    $('#auto-slower').addEventListener('click', () => changeAutoSpeed(-1));
    $('#auto-faster').addEventListener('click', () => changeAutoSpeed(1));
    for (const b of ui.tocPanel.querySelectorAll('[data-tab]')) b.addEventListener('click', () => switchTab(b.dataset.tab));

    // поиск
    $('#search-close').addEventListener('click', closeSearch);
    $('#search-next').addEventListener('click', () => stepMatch(1));
    $('#search-prev').addEventListener('click', () => stepMatch(-1));
    ui.searchInput.addEventListener('input', () => {
      clearTimeout(search.timer);
      search.timer = setTimeout(runSearch, 250);
    });
    ui.searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      stepMatch(e.shiftKey ? -1 : 1);
    });

    // ползунок прогресса и номер страницы
    ui.scrub.addEventListener('pointerdown', () => {
      scrubbing = true;
      pushBack();
      showScrubTip();
    });
    ui.scrub.addEventListener('input', () => {
      jumpToPage(Number(ui.scrub.value), false);
      if (scrubbing) showScrubTip();
    });
    window.addEventListener('pointerup', () => {
      if (!scrubbing) return;
      scrubbing = false;
      ui.scrubTip.hidden = true;
      ui.scroller.focus({ preventScroll: true });
    });
    ui.pageInput.addEventListener('focus', () => ui.pageInput.select());
    ui.pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitPageInput();
      }
    });
    ui.pageInput.addEventListener('blur', () => {
      if (current && current.page) ui.pageInput.value = current.page;
    });

    // выделение текста и заметки
    ui.book.addEventListener('mouseup', () => setTimeout(showSelBar, 0));
    ui.book.addEventListener('keyup', (e) => {
      if (e.shiftKey) showSelBar();
    });
    document.addEventListener('selectionchange', () => {
      if (!ui.selBar.hidden && window.getSelection().isCollapsed) hideSelBar();
    });
    // клик по кнопкам панели не должен снимать выделение
    ui.selBar.addEventListener('mousedown', (e) => e.preventDefault());
    for (const b of ui.selBar.querySelectorAll('.sw')) {
      b.addEventListener('click', () => {
        const r = selectionCharRange();
        if (!r) return;
        addNote(r, b.dataset.color, '');
        window.getSelection().removeAllRanges();
        hideSelBar();
      });
    }
    $('#sel-note').addEventListener('click', () => {
      const r = selectionCharRange();
      if (!r) return;
      const note = addNote(r, 'yellow', '');
      window.getSelection().removeAllRanges();
      openNoteEditor(note, true);
    });
    $('#sel-translate').addEventListener('click', translateSelection);
    $('#tr-to').addEventListener('change', (e) => changeTranslateLang(e.target.value));
    $('#tr-copy').addEventListener('click', () => {
      if (trState && trState.translation) navigator.clipboard.writeText(trState.translation).then(() => toast(t('copied'), 1200));
    });
    $('#tr-save').addEventListener('click', () => {
      if (!trState || !trState.translation) return;
      const { start, end, translation, sentence } = trState;
      closeTranslate();
      // перевод предложения сохраняем тоже: по нему видно значение слова в этом месте
      addNote({ start, end }, 'blue', sentence ? `${translation}

${sentence}` : translation);
      toast(t('noteSaved'), 1400);
    });
    $('#sel-copy').addEventListener('click', () => {
      const text = window.getSelection().toString();
      if (text) navigator.clipboard.writeText(text).then(() => toast(t('copied'), 1200));
      hideSelBar();
    });
    for (const b of $('#annot-colors').children) b.addEventListener('click', () => setEditorColor(b.dataset.color));
    $('#annot-save').addEventListener('click', closeNoteEditor);
    $('#annot-delete').addEventListener('click', () => {
      if (!editing) return;
      const { note } = editing;
      editing = null;
      ui.annotPop.hidden = true;
      deleteNote(note);
    });
    ui.annotText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        closeNoteEditor();
      }
    });

    ui.scrim.addEventListener('click', closePanels);
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
    ui.backBtn.addEventListener('click', goBack);

    ui.scroller.addEventListener('scroll', onScroll, { passive: true });
    for (const panel of [ui.bar, $('#footer')]) {
      panel.addEventListener('mouseenter', () => {
        chromeHover = true;
      });
      panel.addEventListener('mouseleave', () => {
        chromeHover = false;
      });
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    ui.book.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) {
        handleLink(e, a);
        return;
      }
      if (!window.getSelection().isCollapsed || !current || !current.ready) return;
      const note = noteAtPoint(e.clientX, e.clientY);
      if (note) openNoteEditor(note, false);
    });
    ui.notePop.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) handleLink(e, a);
    });
    document.addEventListener('mousedown', (e) => {
      if (!ui.notePop.hidden && !ui.notePop.contains(e.target) && !e.target.closest('a')) closeNote();
      if (!ui.annotPop.hidden && !ui.annotPop.contains(e.target)) closeNoteEditor();
      if (displayOpen() && !$('#display-pop').contains(e.target) && !e.target.closest('#btn-display')) closeDisplayPop();
      if (!ui.trPop.hidden && !ui.trPop.contains(e.target) && !ui.selBar.contains(e.target)) closeTranslate();
    });
    document.addEventListener('mousemove', (e) => {
      if (e.clientY < 56 || e.clientY > window.innerHeight - 56) setBar(true);
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', () => {
      closeNoteEditor();
      savePosition();
    });
    window.addEventListener('resize', scheduleProgress);
    setupDragDrop();

    api.onUpdateReady((version) => {
      $('#update-text').textContent = t('updateReady', { v: version });
      $('#update-banner').hidden = false;
    });
    $('#update-restart').addEventListener('click', () => {
      closeNoteEditor();
      savePosition();
      api.installUpdate();
    });
    $('#update-later').addEventListener('click', () => {
      $('#update-banner').hidden = true;
      toast(t('updateOnQuit'), 3000);
    });
  }

  async function init() {
    I18n.setLang(settings.lang);
    buildSettingsUI();
    applySettings();
    applyLanguage();
    bindUI();
    // перенос данных под новым названием
    if (!localStorage.getItem(LS.settings)) saveSettings();
    if (!localStorage.getItem(LS.library)) saveLibrary();
    if (!localStorage.getItem(LS.marks)) saveMarks();
    api.onOpenPath(openPath);
    const initial = await api.takeInitialPath();
    if (initial) openPath(initial);
    else api.rendered();
  }

  init();
})();
