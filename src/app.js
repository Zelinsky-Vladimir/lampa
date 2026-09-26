(() => {
  'use strict';

  const api = window.api;
  const $ = (sel) => document.querySelector(sel);
  const root = document.documentElement;

  const THEMES = [
    { id: 'light', name: 'Светлая', bg: '#fbfaf7', fg: '#22211e', accent: '#9c5b23' },
    { id: 'sepia', name: 'Сепия', bg: '#f4ecd8', fg: '#5b4636', accent: '#9a5b2e' },
    { id: 'olive', name: 'Олива', bg: '#c9cbb4', fg: '#1f3d47', accent: '#7a3f1d' },
    { id: 'mint', name: 'Мята', bg: '#dde8df', fg: '#27392f', accent: '#2f7a55' },
    { id: 'graphite', name: 'Графит', bg: '#2c2e33', fg: '#d4d0c8', accent: '#dba660' },
    { id: 'night', name: 'Ночь', bg: '#16181c', fg: '#aaa598', accent: '#c39152' },
    { id: 'black', name: 'OLED', bg: '#000000', fg: '#8e8a80', accent: '#b08850' },
    { id: 'custom', name: 'Своя' },
  ];

  const FONTS = [
    { id: 'georgia', name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
    { id: 'palatino', name: 'Palatino', stack: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
    { id: 'times', name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
    { id: 'cambria', name: 'Cambria', stack: "Cambria, 'PT Serif', 'Noto Serif', serif" },
    { id: 'system', name: 'Системный', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" },
    { id: 'verdana', name: 'Verdana', stack: "Verdana, 'DejaVu Sans', sans-serif" },
    { id: 'mono', name: 'Моноширинный', stack: "'Cascadia Mono', Consolas, Menlo, 'DejaVu Sans Mono', monospace" },
  ];

  const DEFAULTS = {
    theme: 'sepia',
    customBg: '#efe6d2',
    customFg: '#2f2a24',
    font: 'georgia',
    fontSize: 20,
    lineHeight: 1.6,
    width: 760,
    justify: true,
    indent: true,
    autoSpeed: 40,
    footerAlways: true,
  };

  const LS_SETTINGS = 'svitok.settings';
  const LS_LIBRARY = 'svitok.library';
  const LIBRARY_LIMIT = 60;
  // Страница — 1800 знаков, как в печатной книге. Номер не зависит от шрифта и размера окна.
  const CHARS_PER_PAGE = 1800;
  const SEARCH_LIMIT = 5000;
  const SEARCH_LIST_LIMIT = 300;
  // Элементы, по которым запоминается место чтения.
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, pre, tr, hr, figure, img.block, .img-block, .empty-line, .cover, .book-title, .book-author';

  const ui = {
    bar: $('#bar'),
    home: $('#home'),
    recent: $('#recent'),
    scroller: $('#scroller'),
    book: $('#book'),
    barBook: $('#bar-book'),
    barChapter: $('#bar-chapter'),
    progressFill: $('#progress-fill'),
    miniPage: $('#mini-page'),
    footChapter: $('#foot-chapter'),
    scrub: $('#scrub'),
    scrubTicks: $('#scrub-ticks'),
    scrubTip: $('#scrub-tip'),
    pageInput: $('#page-input'),
    pageTotal: $('#page-total'),
    pagePct: $('#page-pct'),
    searchPanel: $('#search-panel'),
    searchInput: $('#search-input'),
    searchCount: $('#search-count'),
    searchResults: $('#search-results'),
    homeContinue: $('#home-continue'),
    scrim: $('#scrim'),
    tocPanel: $('#toc-panel'),
    toc: $('#toc'),
    settingsPanel: $('#settings-panel'),
    notePop: $('#note-pop'),
    backBtn: $('#back-btn'),
    dropOverlay: $('#drop-overlay'),
    toast: $('#toast'),
    btnAuto: $('#btn-auto'),
  };

  let settings = { ...DEFAULTS, ...loadJSON(LS_SETTINGS, {}) };
  let library = loadJSON(LS_LIBRARY, []);
  if (!Array.isArray(library)) library = [];

  // { key, path, urls, blocks, starts, index, pages, toc, tocStarts, page, ratio, ready }
  let current = null;
  let openToken = 0;
  const backStack = [];

  // ---------- утилиты ----------

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

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    if (ms > 0) toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }

  function errorText(e) {
    const msg = String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    if (/ENOENT/.test(msg)) return 'файл не найден — возможно, он перемещён или удалён';
    if (/EACCES|EPERM/.test(msg)) return 'нет доступа к файлу';
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

  // ---------- оформление ----------

  function themeColors(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[1];
    if (t.id !== 'custom') return t;
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
    api?.setThemeBg(bg);
    syncSettingsUI();
  }

  // Меняем настройки так, чтобы читаемая строка осталась на месте.
  function updateSettings(patch) {
    const anchor = readerVisible() ? blockAtTop() : null;
    Object.assign(settings, patch);
    saveJSON(LS_SETTINGS, settings);
    applySettings();
    if (anchor) scrollToAnchor(anchor);
    updateProgress();
  }

  function buildSettingsUI() {
    const themes = $('#themes');
    for (const t of THEMES) {
      const b = el('button', 'theme-swatch');
      b.dataset.theme = t.id;
      b.title = t.name;
      b.append(el('span', 'aa', 'Аа'), el('span', 'nm', t.name));
      b.addEventListener('click', () => updateSettings({ theme: t.id }));
      themes.append(b);
    }

    const fontSel = $('#font');
    for (const f of FONTS) {
      const o = el('option', null, f.name);
      o.value = f.id;
      o.style.fontFamily = f.stack;
      fontSel.append(o);
    }
    fontSel.addEventListener('change', () => updateSettings({ font: fontSel.value }));

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

    $('#custom-bg').addEventListener('input', (e) => updateSettings({ theme: 'custom', customBg: e.target.value }));
    $('#custom-fg').addEventListener('input', (e) => updateSettings({ theme: 'custom', customFg: e.target.value }));
    $('#reset-settings').addEventListener('click', () => updateSettings({ ...DEFAULTS }));
  }

  function syncSettingsUI() {
    for (const b of document.querySelectorAll('.theme-swatch')) {
      const c = b.dataset.theme === 'custom' ? { bg: settings.customBg, fg: settings.customFg } : themeColors(b.dataset.theme);
      b.style.setProperty('--sw-bg', c.bg);
      b.style.setProperty('--sw-fg', c.fg);
      b.classList.toggle('active', b.dataset.theme === settings.theme);
    }
    $('#custom-colors').hidden = settings.theme !== 'custom';
    $('#custom-bg').value = settings.customBg;
    $('#custom-fg').value = settings.customFg;
    $('#font').value = settings.font;
    $('#font-size').value = settings.fontSize;
    $('#font-size-val').textContent = settings.fontSize + ' px';
    $('#line-height').value = settings.lineHeight;
    $('#line-height-val').textContent = settings.lineHeight.toFixed(2);
    $('#width').value = settings.width;
    $('#width-val').textContent = settings.width + ' px';
    $('#auto-speed').value = settings.autoSpeed;
    $('#auto-speed-val').textContent = settings.autoSpeed + ' px/с';
    for (const seg of document.querySelectorAll('.seg')) {
      for (const b of seg.children) b.classList.toggle('active', b.dataset.value === String(settings[seg.dataset.key]));
    }
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

  // Все текстовые узлы книги подряд с их смещением в символах — основа страниц и поиска.
  function buildTextIndex() {
    const texts = [];
    const cum = [];
    let total = 0;
    const walker = document.createTreeWalker(ui.book, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      texts.push(n);
      cum.push(total);
      total += n.data.length;
    }
    return { texts, cum, total, full: null, lower: null };
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

  function jumpToPage(n, remember) {
    if (!readerVisible() || !current.ready) return;
    const page = clamp(Math.round(n) || 1, 1, current.pages);
    if (remember) pushBack();
    // +2 символа, чтобы округление не показало предыдущую страницу
    scrollToAnchor(anchorForChar((page - 1) * CHARS_PER_PAGE + (page > 1 ? 2 : 0)));
    updateProgress();
  }

  function chapterAt(pos) {
    const k = lastAtOrBefore(current.tocStarts || [], pos);
    return k >= 0 ? current.toc[k].text : '';
  }

  function libraryEntry() {
    return current && library.find((e) => e.key === current.key);
  }

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
    saveJSON(LS_LIBRARY, library);
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

  // ---------- верхняя панель ----------

  let lastScrollTop = 0;
  function setBar(visible) {
    root.dataset.chrome = visible ? 'shown' : 'hidden';
  }

  // ---------- ползунок и номер страницы ----------

  let scrubbing = false;

  function setupScrubber() {
    const { pages, toc, tocStarts } = current;
    ui.scrub.max = pages;
    ui.scrub.disabled = pages < 2;
    ui.pageTotal.textContent = 'из ' + pages;
    ui.scrubTicks.replaceChildren();
    if (pages < 2) return;
    // отметки глав: самый верхний уровень, где заголовков больше одного (один — обычно название книги)
    const counts = {};
    for (const t of toc) counts[t.level] = (counts[t.level] || 0) + 1;
    const levels = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const tickLevel = levels.find((l) => counts[l] > 1) ?? levels[0];
    toc.forEach((t, k) => {
      if (t.level !== tickLevel) return;
      const tick = el('i');
      tick.style.left = ((pageOf(tocStarts[k]) - 1) / (pages - 1)) * 100 + '%';
      ui.scrubTicks.append(tick);
    });
  }

  function showScrubTip() {
    const v = Number(ui.scrub.value);
    const max = Math.max(1, Number(ui.scrub.max) - 1);
    const pct = (v - 1) / max;
    const chapter = chapterAt((v - 1) * CHARS_PER_PAGE + 2);
    ui.scrubTip.textContent = `стр. ${v}` + (chapter ? ' · ' + chapter : '');
    ui.scrubTip.style.left = `calc(${pct * 100}% + ${(0.5 - pct) * 16}px)`;
    ui.scrubTip.hidden = false;
  }

  function commitPageInput() {
    const n = parseInt(ui.pageInput.value.replace(/\D/g, ''), 10);
    ui.pageInput.blur();
    ui.scroller.focus({ preventScroll: true });
    if (n) jumpToPage(n, true);
  }

  function onScroll() {
    const st = ui.scroller.scrollTop;
    if (!anyPanelOpen()) {
      if (st > lastScrollTop + 6 && st > 120) setBar(false);
      else if (st < lastScrollTop - 6) setBar(true);
    }
    lastScrollTop = st;
    if (!ui.notePop.hidden) closeNote();
    scheduleProgress();
    scheduleSave();
  }

  // ---------- открытие книги ----------

  async function openDialog() {
    const p = await api.openDialog();
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
    ui.book.lang = book.lang || 'ru';
    ui.book.replaceChildren(head, book.content, el('div', 'book-end', '— конец —'));
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
    if (!toc.length) ui.toc.append(el('div', 'toc-empty', 'В этой книге нет оглавления'));
    return toc;
  }

  async function openPath(p) {
    if (!p) return;
    const token = ++openToken;
    toast('Открываю…', 0);

    let data;
    let book;
    try {
      data = await api.loadBook(p);
      book = Parsers.parseBook(data);
    } catch (e) {
      if (token === openToken) toast('Не удалось открыть книгу: ' + errorText(e), 5000);
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
    saveJSON(LS_LIBRARY, library);

    renderBook(book);
    showReader();
    ui.barBook.textContent = book.title;
    ui.barChapter.textContent = '';
    lastChapter = -2;
    document.title = `${book.title} — Svitok`;

    await waitImages(ui.book, 2500);
    if (token !== openToken) return;

    current.blocks = Array.from(ui.book.querySelectorAll(BLOCK_SEL));
    current.index = buildTextIndex();
    current.starts = charOffsets(current.blocks, current.index);
    current.pages = Math.max(1, Math.ceil(current.index.total / CHARS_PER_PAGE));
    current.toc = buildToc();
    current.tocStarts = charOffsets(current.toc.map((t) => t.el), current.index);
    current.toc.forEach((t, k) => {
      t.pageEl.textContent = pageOf(current.tocStarts[k]);
    });
    setupScrubber();

    ui.scroller.scrollTop = 0;
    if (entry.pos) scrollToAnchor(entry.pos);
    lastScrollTop = ui.scroller.scrollTop;
    current.ready = true;
    setBar(true);
    updateProgress();
    if (entry.pos && current.page > 1) toast(`Продолжаем со стр. ${current.page} из ${current.pages}`, 2200);
    else ui.toast.classList.remove('show');
    ui.scroller.focus({ preventScroll: true });

    if (!entry.thumb && book.coverUrl) {
      makeThumb(book.coverUrl).then((t) => {
        if (!t) return;
        entry.thumb = t;
        saveJSON(LS_LIBRARY, library);
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
    ui.backBtn.hidden = true;
    ui.scroller.hidden = true;
    ui.home.hidden = false;
    root.dataset.mode = 'home';
    setBar(true);
    document.title = 'Svitok';
    renderHome();
  }

  function readLabel(entry) {
    if (!entry.progress && !entry.page) return 'не начата';
    const pct = Math.round((entry.progress || 0) * 100) + '%';
    return entry.page ? `стр. ${entry.page} из ${entry.pages} · ${pct}` : `прочитано ${pct}`;
  }

  function renderHome() {
    ui.recent.replaceChildren();
    $('#recent-section').hidden = !library.length;

    const last = library[0];
    ui.homeContinue.hidden = !last;
    if (last) {
      $('#home-continue-text').textContent = `Продолжить «${last.title}»` + (last.page > 1 ? ` · стр. ${last.page}` : '');
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
      const pct = readLabel(entry);

      const remove = el('button', 'remove', '×');
      remove.title = 'Убрать из списка';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        library = library.filter((x) => x !== entry);
        saveJSON(LS_LIBRARY, library);
        renderHome();
      });

      card.append(thumb, el('div', 't', entry.title), el('div', 'a', entry.author || ' '), bar, el('div', 'pct', pct), remove);
      card.addEventListener('click', () => openPath(entry.path));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openPath(entry.path);
      });
      ui.recent.append(card);
    }
  }

  // ---------- панели ----------

  const anyPanelOpen = () => ui.tocPanel.classList.contains('open') || ui.settingsPanel.classList.contains('open');

  function openPanel(panel) {
    const wasOpen = panel.classList.contains('open');
    closePanels();
    closeSearch();
    if (wasOpen) return;
    stopAuto();
    panel.classList.add('open');
    ui.scrim.classList.add('show');
    setBar(true);
    if (panel === ui.tocPanel) highlightToc();
  }

  function closePanels() {
    ui.tocPanel.classList.remove('open');
    ui.settingsPanel.classList.remove('open');
    ui.scrim.classList.remove('show');
  }

  function highlightToc() {
    if (!current) return;
    const ci = currentTocIndex();
    current.toc.forEach((t, i) => t.btn.classList.toggle('current', i === ci));
    if (ci >= 0) current.toc[ci].btn.scrollIntoView({ block: 'center' });
  }

  // ---------- ссылки и сноски ----------

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

  function showNote(a, target) {
    const src = noteSource(target);
    if (!src) return false;
    stopAuto();
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    clone.querySelectorAll(':scope > .title').forEach((n) => n.remove());

    const go = el('button', 'note-go', 'Перейти к примечанию →');
    go.addEventListener('click', () => {
      closeNote();
      jumpTo(target, true);
    });
    ui.notePop.replaceChildren(clone, go);
    ui.notePop.hidden = false;

    const r = a.getBoundingClientRect();
    const w = ui.notePop.offsetWidth;
    const h = ui.notePop.offsetHeight;
    const left = clamp(r.left + r.width / 2 - w / 2, 12, window.innerWidth - w - 12);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    ui.notePop.style.left = left + 'px';
    ui.notePop.style.top = top + 'px';
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

  function searchHaystack() {
    const index = current.index;
    if (index.lower == null) {
      index.full = index.texts.map((t) => t.data).join('');
      index.lower = normalizeText(index.full);
    }
    return index.lower;
  }

  function rangeFor(start, end) {
    const { texts, cum } = current.index;
    const a = Math.max(0, lastAtOrBefore(cum, start));
    const b = Math.max(0, lastAtOrBefore(cum, end - 1));
    const r = document.createRange();
    r.setStart(texts[a], start - cum[a]);
    r.setEnd(texts[b], end - 1 - cum[b] + 1);
    return r;
  }

  function clearHighlights() {
    if (!hasHighlights) return;
    CSS.highlights.delete('search-hit');
    CSS.highlights.delete('search-current');
  }

  function resetSearch() {
    clearTimeout(search.timer);
    Object.assign(search, { query: '', matches: [], cur: -1, jumped: false, items: [] });
    ui.searchInput.value = '';
    ui.searchCount.textContent = '';
    ui.searchResults.replaceChildren();
    clearHighlights();
  }

  function updateSearchCount() {
    const n = search.matches.length;
    if (!search.query) ui.searchCount.textContent = '';
    else if (!n) ui.searchCount.textContent = 'Ничего не найдено';
    else if (search.cur < 0) ui.searchCount.textContent = `Найдено: ${n}${n >= SEARCH_LIMIT ? '+' : ''}`;
    else ui.searchCount.textContent = `${search.cur + 1} из ${n}${n >= SEARCH_LIMIT ? '+' : ''}`;
  }

  function runSearch() {
    clearTimeout(search.timer);
    search.timer = 0;
    const query = normalizeText(ui.searchInput.value).replace(/ +/g, ' ').trim();
    if (!current || !current.ready || query === search.query) return;
    search.query = query;
    search.matches = [];
    search.cur = -1;
    search.jumped = false;
    search.items = [];
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
      for (const m of search.matches) hl.add(rangeFor(m.start, m.end));
      CSS.highlights.set('search-hit', hl);
    }

    const full = current.index.full;
    const frag = document.createDocumentFragment();
    search.matches.slice(0, SEARCH_LIST_LIMIT).forEach((m, k) => {
      const item = el('button', 'search-item');
      const chapter = chapterAt(m.start);
      item.append(el('div', 'meta', `стр. ${pageOf(m.start)}` + (chapter ? ' · ' + chapter : '')));
      const snip = el('div', 'snip');
      const from = Math.max(0, m.start - 50);
      const to = Math.min(full.length, m.end + 70);
      const clean = (s) => s.replace(/\s+/g, ' ');
      const mark = el('mark', null, full.slice(m.start, m.end));
      snip.append((from > 0 ? '…' : '') + clean(full.slice(from, m.start)).trimStart(), mark, clean(full.slice(m.end, to)).trimEnd() + (to < full.length ? '…' : ''));
      item.append(snip);
      item.addEventListener('click', () => gotoMatch(k));
      frag.append(item);
      search.items.push(item);
    });
    if (search.matches.length > SEARCH_LIST_LIMIT) {
      frag.append(el('div', 'search-more', `Показаны первые ${SEARCH_LIST_LIMIT}. Уточните запрос или листайте стрелками.`));
    }
    ui.searchResults.append(frag);
    updateSearchCount();
  }

  function gotoMatch(k) {
    const m = search.matches[k];
    if (!m) return;
    if (search.items[search.cur]) search.items[search.cur].classList.remove('active');
    search.cur = k;
    const range = rangeFor(m.start, m.end);
    if (hasHighlights) CSS.highlights.set('search-current', new Highlight(range));
    if (!search.jumped) {
      pushBack();
      search.jumped = true;
    }
    const s = ui.scroller;
    const sr = s.getBoundingClientRect();
    const r = range.getBoundingClientRect();
    if (r.top < sr.top + 70 || r.bottom > sr.bottom - 90) s.scrollTop += r.top - sr.top - s.clientHeight * 0.35;
    const item = search.items[k];
    if (item) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    }
    updateSearchCount();
  }

  function stepMatch(dir) {
    if (search.timer || normalizeText(ui.searchInput.value).replace(/ +/g, ' ').trim() !== search.query) runSearch();
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
    if (anchor) scrollToAnchor(anchor);
    clearHighlights();
    ui.scroller.focus({ preventScroll: true });
  }

  // ---------- автопрокрутка ----------

  const auto = { on: false, last: 0, acc: 0 };

  function startAuto() {
    if (!readerVisible()) return;
    auto.on = true;
    auto.last = performance.now();
    auto.acc = 0;
    ui.btnAuto.classList.add('active');
    setBar(false);
    toast(`Автопрокрутка: ${settings.autoSpeed} px/с · [ ] — скорость, A — стоп`);
    requestAnimationFrame(autoTick);
  }

  function stopAuto() {
    auto.on = false;
    ui.btnAuto.classList.remove('active');
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
    toast(`Скорость автопрокрутки: ${settings.autoSpeed} px/с`, 1400);
  }

  // ---------- клавиатура ----------

  function pageScroll(dir) {
    const s = ui.scroller;
    const line = settings.fontSize * settings.lineHeight;
    s.scrollBy({ top: dir * (s.clientHeight - line * 2), behavior: 'smooth' });
  }

  function changeFont(delta) {
    updateSettings({ fontSize: delta ? clamp(settings.fontSize + delta, 12, 44) : DEFAULTS.fontSize });
    toast(`Размер шрифта: ${settings.fontSize} px`, 1200);
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
    if (e.target.closest('input, select, textarea')) {
      if (e.key === 'Escape') {
        if (e.target === ui.searchInput) closeSearch();
        else e.target.blur();
      }
      return;
    }
    if (ctrl) {
      if (e.code === 'KeyO') openDialog();
      else if (e.code === 'KeyG') focusPageInput();
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') changeFont(1);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') changeFont(-1);
      else if (e.code === 'Digit0' || e.code === 'Numpad0') changeFont(0);
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
      if (!ui.notePop.hidden) closeNote();
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
      case 'KeyA': (auto.on ? stopAuto : startAuto)(); break;
      case 'BracketRight': changeAutoSpeed(1); break;
      case 'BracketLeft': changeAutoSpeed(-1); break;
      default: return;
    }
    e.preventDefault();
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
    ui.homeContinue.addEventListener('click', () => library[0] && openPath(library[0].path));
    ui.btnAuto.addEventListener('click', () => (auto.on ? stopAuto() : startAuto()));

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
    ui.scrim.addEventListener('click', closePanels);
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
    ui.backBtn.addEventListener('click', goBack);

    ui.scroller.addEventListener('scroll', onScroll, { passive: true });
    ui.book.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) handleLink(e, a);
    });
    ui.notePop.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) handleLink(e, a);
    });
    document.addEventListener('mousedown', (e) => {
      if (!ui.notePop.hidden && !ui.notePop.contains(e.target) && !e.target.closest('a')) closeNote();
    });
    document.addEventListener('mousemove', (e) => {
      if (e.clientY < 56 || e.clientY > window.innerHeight - 56) setBar(true);
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', savePosition);
    window.addEventListener('resize', scheduleProgress);
    setupDragDrop();
  }

  async function init() {
    buildSettingsUI();
    applySettings();
    bindUI();
    renderHome();
    api.onOpenPath(openPath);
    api.onUpdateReady((version) => {
      $('#update-text').textContent = `Готова новая версия ${version}`;
      $('#update-banner').hidden = false;
    });
    $('#update-restart').addEventListener('click', () => {
      savePosition();
      api.installUpdate();
    });
    $('#update-later').addEventListener('click', () => {
      $('#update-banner').hidden = true;
      toast('Обновление установится, когда вы закроете Svitok', 3000);
    });
    const initial = await api.takeInitialPath();
    if (initial) openPath(initial);
    else api.rendered();
  }

  init();
})();
