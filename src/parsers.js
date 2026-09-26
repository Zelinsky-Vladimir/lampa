// Разбор FB2 / EPUB / TXT в безопасный DOM.
// Разметка книги никогда не вставляется как HTML: каждый элемент создаётся заново
// по белому списку, поэтому скрипты и обработчики из файла в окно не попадают.
(function (global) {
  'use strict';

  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const OPS_NS = 'http://www.idpf.org/2007/ops';

  const HTML_ENTITIES = {
    nbsp: ' ', mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…',
    bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚',
    copy: '©', reg: '®', trade: '™', shy: '', middot: '·', bull: '•', deg: '°',
    times: '×', minus: '−', thinsp: ' ', ensp: ' ', emsp: ' ',
    zwnj: '‌', zwj: '‍', euro: '€', sect: '§', para: '¶', prime: '′',
    Prime: '″', larr: '←', rarr: '→', iexcl: '¡', iquest: '¿', dagger: '†', Dagger: '‡',
  };
  const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };
  const guessMime = (p) => MIME[(/\.([a-z0-9]+)$/i.exec(p) || [])[1]?.toLowerCase()] || 'application/octet-stream';

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ---------- XML ----------

  function parseXml(text, type) {
    const doc = new DOMParser().parseFromString(text, type || 'application/xml');
    return doc.getElementsByTagName('parsererror').length ? null : doc;
  }

  // Типичные поломки: HTML-сущности вроде &nbsp;, голые «&», управляющие символы.
  function repairXml(text) {
    return text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
        if (XML_ENTITIES.has(name)) return m;
        return name in HTML_ENTITIES ? HTML_ENTITIES[name] : '&amp;' + name + ';';
      })
      .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  }

  function parseXmlLenient(text, type) {
    text = text.replace(/^﻿/, '');
    return parseXml(text, type) || parseXml(repairXml(text), type);
  }

  const kids = (node, name) => (node ? Array.from(node.children).filter((c) => c.localName === name) : []);
  const kid = (node, name) => kids(node, name)[0] || null;
  const textOf = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

  function hrefOf(node) {
    const v = node.getAttributeNS(XLINK_NS, 'href');
    if (v) return v;
    for (const a of node.attributes) if (a.localName === 'href') return a.value;
    return '';
  }

  function base64ToBytes(b64) {
    const bin = atob(b64.replace(/[^A-Za-z0-9+/=]/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function makeAssets() {
    const urls = [];
    return {
      urls,
      add(bytes, type) {
        const url = URL.createObjectURL(new Blob([bytes], { type: type || '' }));
        urls.push(url);
        return url;
      },
    };
  }

  // ---------- FB2 ----------

  const INLINE_PARENTS = new Set(['p', 'v', 'subtitle', 'text-author', 'emphasis', 'strong', 'a', 'td', 'th', 'style', 'sub', 'sup']);

  function authorName(a) {
    const full = ['first-name', 'middle-name', 'last-name'].map((n) => textOf(kid(a, n))).filter(Boolean).join(' ');
    return full || textOf(kid(a, 'nickname'));
  }

  function parseFb2(bytes) {
    const { text } = Decode.decodeBytes(bytes, Decode.xmlDeclEncoding(bytes));
    const doc = parseXmlLenient(text);
    if (!doc) throw new Error(I18n.t('errFb2Broken'));
    const root = doc.documentElement;
    const assets = makeAssets();

    const images = new Map();
    for (const bin of kids(root, 'binary')) {
      const id = bin.getAttribute('id');
      if (!id) continue;
      try {
        images.set(id, assets.add(base64ToBytes(bin.textContent), bin.getAttribute('content-type') || guessMime(id)));
      } catch {
        // битая картинка — просто пропускаем
      }
    }
    const ctx = { imageUrl: (node) => images.get(hrefOf(node).replace(/^#/, '')) || null };

    const info = kid(kid(root, 'description'), 'title-info');
    const coverImg = kid(kid(info, 'coverpage'), 'image');

    const content = document.createDocumentFragment();
    for (const body of kids(root, 'body')) {
      const name = (body.getAttribute('name') || '').toLowerCase();
      const isNotes = /notes|comments|footnotes/.test(name);
      const wrap = el('div', isNotes ? 'fb2-body notes' : 'fb2-body');
      if (isNotes && !kid(body, 'title')) {
        const h = el('h2');
        h.textContent = I18n.t('notesHeading');
        wrap.append(h);
      }
      appendFb2(wrap, body, ctx, 0);
      content.append(wrap);
    }

    let annotation = null;
    const ann = kid(info, 'annotation');
    if (ann) {
      annotation = el('div');
      appendFb2(annotation, ann, ctx, 0);
    }

    return {
      title: textOf(kid(info, 'book-title')),
      author: kids(info, 'author').map(authorName).filter(Boolean).join(', '),
      lang: textOf(kid(info, 'lang')),
      coverUrl: coverImg ? ctx.imageUrl(coverImg) : null,
      annotation,
      content,
      urls: assets.urls,
    };
  }

  function appendFb2(target, node, ctx, depth) {
    for (const child of node.childNodes) {
      const out = convertFb2(child, ctx, depth);
      if (out) target.append(out);
    }
  }

  function convertFb2(node, ctx, depth) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) return document.createTextNode(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const name = node.localName;
    let out;
    switch (name) {
      case 'section':
        out = el('section');
        appendFb2(out, node, ctx, depth + 1);
        break;
      case 'title':
        return fb2Title(node, ctx, depth);
      case 'p': out = el('p'); break;
      case 'subtitle': out = el('p', 'subtitle'); break;
      case 'v': out = el('p', 'v'); break;
      case 'poem': out = el('div', 'poem'); break;
      case 'stanza': out = el('div', 'stanza'); break;
      case 'epigraph': out = el('blockquote', 'epigraph'); break;
      case 'cite': out = el('blockquote', 'cite'); break;
      case 'text-author': out = el('p', 'text-author'); break;
      case 'date': out = el('p', 'poem-date'); break;
      case 'empty-line': return el('div', 'empty-line');
      case 'image': {
        const url = ctx.imageUrl(node);
        if (!url) return null;
        const img = el('img');
        img.src = url;
        img.alt = node.getAttribute('alt') || '';
        if (INLINE_PARENTS.has(node.parentNode && node.parentNode.localName)) {
          img.className = 'inline';
          return img;
        }
        const fig = el('figure', 'image');
        fig.append(img);
        out = fig;
        break;
      }
      case 'emphasis': out = el('em'); break;
      case 'strong': out = el('strong'); break;
      case 'strikethrough': out = el('s'); break;
      case 'sub': case 'sup': case 'code': out = el(name); break;
      case 'style': out = el('span'); break;
      case 'a': out = fb2Link(node); break;
      case 'table': out = el('table'); break;
      case 'tr': out = el('tr'); break;
      case 'td': case 'th':
        out = el(name);
        for (const attr of ['colspan', 'rowspan']) if (node.hasAttribute(attr)) out.setAttribute(attr, node.getAttribute(attr));
        break;
      case 'binary': case 'description': return null;
      default: out = document.createDocumentFragment();
    }

    if (out.nodeType === Node.ELEMENT_NODE) {
      const id = node.getAttribute('id');
      if (id) out.id = 'n-' + id;
    }
    if (name !== 'section' && name !== 'image') appendFb2(out, node, ctx, depth);
    return out;
  }

  function fb2Title(node, ctx, depth) {
    const parent = node.parentNode && node.parentNode.localName;
    const out = parent === 'poem' || parent === 'stanza'
      ? el('div', 'poem-title')
      : el('h' + Math.min(depth + 1, 6), 'title');
    const lines = kids(node, 'p');
    if (!lines.length) appendFb2(out, node, ctx, depth);
    lines.forEach((p, i) => {
      if (i) out.append(el('br'));
      appendFb2(out, p, ctx, depth);
    });
    return out.textContent.trim() || out.querySelector('img') ? out : null;
  }

  function fb2Link(node) {
    const href = hrefOf(node);
    const a = el('a');
    if (href.startsWith('#')) {
      a.setAttribute('href', '#n-' + href.slice(1));
      if (node.getAttribute('type') === 'note') a.className = 'note-ref';
    } else if (/^(https?:|mailto:)/i.test(href)) {
      a.setAttribute('href', href);
      a.className = 'ext';
    }
    return a;
  }

  // ---------- EPUB ----------

  const KEEP = new Set(('p div span h1 h2 h3 h4 h5 h6 em i strong b u s del ins sub sup small br hr blockquote pre code ' +
    'ul ol li dl dt dd table thead tbody tfoot tr td th caption a figure figcaption section article aside header footer ' +
    'cite q abbr mark').split(' '));
  const DROP = new Set(('script style link meta title head iframe object embed form input button select textarea ' +
    'noscript video audio canvas template math').split(' '));

  function resolvePath(base, rel) {
    try {
      const baseUrl = 'https://book.invalid/' + base.split('/').map(encodeURIComponent).join('/');
      return decodeURIComponent(new URL(rel, baseUrl).pathname.slice(1));
    } catch {
      return rel;
    }
  }

  function epubType(node) {
    let t = node.getAttribute('role') || '';
    for (const a of node.attributes) {
      if (a.localName === 'type' && (a.namespaceURI === OPS_NS || a.prefix === 'epub')) t += ' ' + a.value;
    }
    return t;
  }

  function parseEpub(entries) {
    const byLower = new Map(Object.keys(entries).map((k) => [k.toLowerCase(), k]));
    const getBytes = (p) => entries[p] || entries[byLower.get(p.toLowerCase())] || null;
    const getText = (p) => {
      const b = getBytes(p);
      return b ? Decode.decodeBytes(b, Decode.xmlDeclEncoding(b)).text : null;
    };

    let opfPath = null;
    const containerText = getText('META-INF/container.xml');
    if (containerText) {
      const c = parseXmlLenient(containerText);
      const rf = c && c.getElementsByTagNameNS('*', 'rootfile')[0];
      opfPath = rf && rf.getAttribute('full-path');
    }
    if (!opfPath || !getBytes(opfPath)) opfPath = Object.keys(entries).find((k) => /\.opf$/i.test(k));
    if (!opfPath) throw new Error(I18n.t('errNoOpf'));

    const opf = parseXmlLenient(getText(opfPath) || '');
    if (!opf) throw new Error(I18n.t('errOpfBroken'));
    const q = (name) => Array.from(opf.getElementsByTagNameNS('*', name));

    const manifest = new Map();
    for (const item of q('item')) {
      manifest.set(item.getAttribute('id'), {
        href: resolvePath(opfPath, item.getAttribute('href') || ''),
        type: item.getAttribute('media-type') || '',
        props: item.getAttribute('properties') || '',
      });
    }
    const typeByPath = new Map([...manifest.values()].map((it) => [it.href, it.type]));
    const spine = q('itemref')
      .map((r) => manifest.get(r.getAttribute('idref')))
      .filter((it) => it && (/html/i.test(it.type) || /\.x?html?$/i.test(it.href)));

    const assets = makeAssets();
    const assetCache = new Map();
    const assetUrl = (p) => {
      if (!assetCache.has(p)) {
        const b = getBytes(p);
        assetCache.set(p, b ? assets.add(b, typeByPath.get(p) || guessMime(p)) : null);
      }
      return assetCache.get(p);
    };

    let coverItem = [...manifest.values()].find((it) => /\bcover-image\b/.test(it.props));
    if (!coverItem) {
      const meta = q('meta').find((m) => m.getAttribute('name') === 'cover');
      if (meta) coverItem = manifest.get(meta.getAttribute('content'));
    }
    if (coverItem && !/^image\//.test(coverItem.type)) coverItem = null;
    const coverUrl = coverItem ? assetUrl(coverItem.href) : null;

    const docIndex = new Map(spine.map((it, i) => [it.href, i]));
    const content = document.createDocumentFragment();

    spine.forEach((it, i) => {
      const text = getText(it.href);
      if (text == null) return;
      const doc = parseXmlLenient(text, 'application/xhtml+xml') || new DOMParser().parseFromString(text, 'text/html');
      const body = doc.body || doc.getElementsByTagNameNS('*', 'body')[0];
      if (!body) return;

      const wrap = el('section', 'epub-doc');
      wrap.id = 'd' + i;
      appendSanitized(wrap, body, { base: it.href, prefix: 'd' + i + '-', assetUrl, docIndex });

      const imgs = wrap.querySelectorAll('img');
      if (!wrap.textContent.trim()) {
        // Отдельная страница-обложка дублирует обложку из шапки.
        if (!imgs.length || (imgs.length === 1 && imgs[0].src === coverUrl)) return;
      }
      for (const img of imgs) {
        const p = img.parentElement;
        if (p === wrap) img.classList.add('block');
        else if (!p.textContent.trim() && p.children.length === 1) p.classList.add('img-block');
      }
      content.append(wrap);
    });

    return {
      title: textOf(q('title')[0]),
      author: q('creator').map(textOf).filter(Boolean).join(', '),
      lang: textOf(q('language')[0]),
      coverUrl,
      annotation: null,
      content,
      urls: assets.urls,
    };
  }

  function appendSanitized(target, node, ctx) {
    for (const child of node.childNodes) {
      const out = sanitize(child, ctx);
      if (out) target.append(out);
    }
  }

  function sanitize(node, ctx) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) return document.createTextNode(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const name = node.localName.toLowerCase();
    if (DROP.has(name)) return null;
    if (name === 'img' || name === 'image') return epubImage(node, ctx, node.getAttribute('src') || hrefOf(node));
    if (name === 'svg') {
      const im = node.getElementsByTagNameNS('*', 'image')[0];
      return im ? epubImage(im, ctx, hrefOf(im)) : null;
    }
    if (!KEEP.has(name)) {
      const frag = document.createDocumentFragment();
      appendSanitized(frag, node, ctx);
      return frag;
    }

    const out = el(name);
    const id = node.getAttribute('id') || (name === 'a' && node.getAttribute('name'));
    if (id) out.id = ctx.prefix + id;
    if (name === 'td' || name === 'th') {
      for (const attr of ['colspan', 'rowspan']) if (node.hasAttribute(attr)) out.setAttribute(attr, node.getAttribute(attr));
    }
    const type = epubType(node);
    if (name === 'a') {
      epubLink(out, node, ctx);
      if (/noteref/.test(type)) out.classList.add('note-ref');
    } else if (/footnote|endnote|rearnote/.test(type)) {
      out.classList.add('footnote');
    }
    appendSanitized(out, node, ctx);
    return out;
  }

  function epubImage(node, ctx, src) {
    if (!src || /^https?:/i.test(src)) return null;
    const url = /^data:image\//i.test(src) ? src : ctx.assetUrl(resolvePath(ctx.base, src));
    if (!url) return null;
    const img = el('img');
    img.src = url;
    img.alt = node.getAttribute('alt') || '';
    return img;
  }

  function epubLink(out, node, ctx) {
    const href = node.getAttribute('href') || hrefOf(node);
    if (!href) return;
    if (/^(https?:|mailto:)/i.test(href)) {
      out.setAttribute('href', href);
      out.classList.add('ext');
      return;
    }
    const hash = href.indexOf('#');
    const file = hash >= 0 ? href.slice(0, hash) : href;
    const frag = hash >= 0 ? decodeURIComponent(href.slice(hash + 1)) : '';
    const i = ctx.docIndex.get(file ? resolvePath(ctx.base, file) : ctx.base);
    if (i === undefined) return;
    out.setAttribute('href', '#d' + i + (frag ? '-' + frag : ''));
  }

  // ---------- TXT ----------

  // (?!\p{L}) вместо \b: в JS \b считает кириллицу «не буквами».
  const CHAPTER_RE = new RegExp('^(' + [
    'глава', 'часть', 'розділ', 'частина', 'книга', 'том', 'пролог', 'эпилог', 'епілог', 'предисловие', 'послесловие', 'передмова',
    'chapter', 'part', 'book', 'prologue', 'epilogue', 'preface', 'introduction',
    'chapitre', 'partie', 'livre', 'épilogue', 'préface',
    'kapitel', 'teil', 'buch', 'prolog', 'epilog', 'vorwort', 'nachwort',
    'capítulo', 'capitulo', 'parte', 'libro', 'prólogo', 'epílogo', 'prefacio',
  ].join('|') + ')(?!\\p{L})', 'iu');

  function txtKind(line) {
    if (/^[*\s]{3,}$|^[-–—\s]{3,}$/.test(line)) return 'sep';
    if (line.length > 80) return 'p';
    if (CHAPTER_RE.test(line) || /^([IVXLCDM]+|\d{1,3})\.?$/.test(line)) return 'h';
    if (line.length <= 50 && /\p{L}{2}/u.test(line) && line === line.toUpperCase() && !/[.,;:…]$/.test(line)) return 'h';
    return 'p';
  }

  function parseTxt(bytes) {
    const { text } = Decode.decodeBytes(bytes, null);
    const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
    const blank = lines.filter((l) => !l.trim()).length;

    // Абзацы разделены пустыми строками или каждая строка — абзац.
    const blocks = [];
    if (blank > lines.length * 0.15) {
      let cur = [];
      const flush = () => {
        if (cur.length) blocks.push(cur);
        cur = [];
      };
      for (const l of lines) (l.trim() ? cur.push(l.trim()) : flush());
      flush();
    } else {
      for (const l of lines) if (l.trim()) blocks.push([l.trim()]);
    }

    const content = document.createDocumentFragment();
    const wrap = el('div', 'txt-body');
    for (const block of blocks) {
      const joined = block.join(' ');
      const kind = block.length === 1 ? txtKind(joined) : 'p';
      if (kind === 'h') {
        const h = el('h2');
        h.textContent = joined;
        wrap.append(h);
      } else if (kind === 'sep') {
        const p = el('p', 'separator');
        p.textContent = '* * *';
        wrap.append(p);
      } else if (block.length > 1 && block.reduce((s, l) => s + l.length, 0) / block.length < 45) {
        // короткие строки подряд — скорее всего стихи
        const p = el('p', 'verse');
        block.forEach((l, i) => {
          if (i) p.append(el('br'));
          p.append(l);
        });
        wrap.append(p);
      } else {
        const p = el('p');
        p.textContent = joined;
        wrap.append(p);
      }
    }
    content.append(wrap);
    return { title: '', author: '', lang: '', coverUrl: null, annotation: null, content, urls: [] };
  }

  // ---------- общий вход ----------

  function looksLikeFb2(bytes) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
    return /<FictionBook[\s>]/.test(head);
  }

  function parseBook(data) {
    let book;
    if (data.entries) {
      const names = Object.keys(data.entries);
      if (data.ext === 'epub' || names.includes('META-INF/container.xml')) {
        book = parseEpub(data.entries);
      } else {
        const fb2 = names.find((n) => /\.fb2$/i.test(n));
        const txt = names.find((n) => /\.txt$/i.test(n));
        if (fb2) book = parseFb2(data.entries[fb2]);
        else if (txt) book = parseTxt(data.entries[txt]);
        else throw new Error(I18n.t('errNoBookInZip'));
      }
    } else if (data.ext === 'fb2' || looksLikeFb2(data.bytes)) {
      book = parseFb2(data.bytes);
    } else {
      book = parseTxt(data.bytes);
    }
    if (!book.title) book.title = data.name.replace(/(\.fb2)?\.(zip|epub|fb2|txt)$/i, '').replace(/_+/g, ' ').trim();
    return book;
  }

  global.Parsers = { parseBook };
})(window);
