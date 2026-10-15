(function (root) {
  'use strict';

  const ACQ = 'http://opds-spec.org/acquisition';
  const FORMATS = [
    { test: (t, h) => /epub\+zip/i.test(t) && !/noimages/i.test(h), ext: 'epub', label: 'EPUB', rank: 1 },
    { test: (t) => /epub\+zip/i.test(t), ext: 'epub', label: 'EPUB', rank: 2 },
    { test: (t, h) => /fb2\+zip|x-zip-compressed-fb2/i.test(t) || (/zip/i.test(t) && /fb2/i.test(h)), ext: 'zip', label: 'FB2', rank: 4 },
    { test: (t, h) => /fictionbook|fb2/i.test(t) || (/xml/i.test(t) && /\.fb2(\b|$)/i.test(h)), ext: 'fb2', label: 'FB2', rank: 3 },
    { test: (t) => /^text\/plain/i.test(t), ext: 'txt', label: 'TXT', rank: 5 },
  ];
  const OTHER = [
    [/pdf/i, 'PDF'],
    [/mobipocket|kindle/i, 'Kindle'],
    [/djvu/i, 'DjVu'],
    [/rtf/i, 'RTF'],
    [/msword|officedocument/i, 'DOC'],
  ];

  const kids = (node, name) => Array.from(node.children).filter((c) => c.localName === name);
  const kid = (node, name) => kids(node, name)[0] || null;
  const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

  function resolve(href, base) {
    try {
      return new URL(href, base).href;
    } catch {
      return '';
    }
  }

  function plainContent(node) {
    if (!node) return '';
    const type = node.getAttribute('type') || 'text';
    if (type === 'html' || /html/.test(type) && !node.children.length) {
      const doc = new DOMParser().parseFromString(node.textContent, 'text/html');
      return text(doc.body);
    }
    const blocks = Array.from(node.querySelectorAll('p, div, li, br'));
    if (!blocks.length) return text(node);
    return Array.from(node.querySelectorAll('p, li'))
      .map((p) => text(p))
      .filter(Boolean)
      .join('\n') || text(node);
  }

  function formatOf(type, href) {
    return FORMATS.find((f) => f.test(type || '', href || '')) || null;
  }

  function parseEntry(e, base) {
    const links = kids(e, 'link').map((l) => ({
      rel: l.getAttribute('rel') || '',
      type: l.getAttribute('type') || '',
      href: resolve(l.getAttribute('href') || '', base),
      title: l.getAttribute('title') || '',
      length: Number(l.getAttribute('length')) || 0,
    }));
    const files = [];
    const other = [];
    for (const l of links) {
      if (!l.rel.startsWith(ACQ) || /indirect/.test(l.rel) || !l.href) continue;
      const f = formatOf(l.type, l.href);
      if (f) files.push({ href: l.href, type: l.type, ext: f.ext, label: f.label, rank: f.rank, title: l.title, length: l.length });
      else {
        const o = OTHER.find(([re]) => re.test(l.type) || re.test(l.href));
        if (o && !other.includes(o[1])) other.push(o[1]);
      }
    }
    files.sort((a, b) => a.rank - b.rank);
    const image = (rel) => {
      const l = links.find((x) => x.rel === rel && /^https?:/i.test(x.href));
      return l ? l.href : '';
    };
    const navLink = links.find((l) => /atom\+xml|opds-catalog/i.test(l.type) && !/^(self|start|up|search|related|next|previous|first|last)$/.test(l.rel) && !l.rel.startsWith(ACQ));
    const gutenberg = navLink && /^https:\/\/www\.gutenberg\.org\/ebooks\/(\d+)\.opds$/.exec(navLink.href);
    const derived = gutenberg && !files.length ? `https://www.gutenberg.org/cache/epub/${gutenberg[1]}/pg${gutenberg[1]}.cover.small.jpg` : '';
    const authors = kids(e, 'author').map((a) => text(kid(a, 'name'))).filter(Boolean);
    return {
      id: text(kid(e, 'id')),
      title: text(kid(e, 'title')),
      author: authors.join(', '),
      summary: plainContent(kid(e, 'summary') || kid(e, 'content')),
      language: text(kid(e, 'language')),
      issued: text(kid(e, 'issued')) || text(kid(e, 'published')).slice(0, 4),
      cover: image('http://opds-spec.org/image') || image('http://opds-spec.org/image/thumbnail'),
      thumb: image('http://opds-spec.org/image/thumbnail') || image('http://opds-spec.org/image') || derived,
      files,
      other,
      nav: files.length ? '' : navLink ? navLink.href : '',
      related: links.filter((l) => l.rel === 'related' && /atom\+xml/i.test(l.type)).map((l) => ({ href: l.href, title: l.title.replace(/…$/, '') })),
    };
  }

  function parseFeed(xml, base) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const feed = doc.documentElement;
    if (!feed || feed.localName !== 'feed' || doc.getElementsByTagName('parsererror').length) throw new Error('NOT_OPDS');
    const link = (rel) => {
      const l = kids(feed, 'link').find((x) => x.getAttribute('rel') === rel);
      return l ? { href: resolve(l.getAttribute('href') || '', base), type: l.getAttribute('type') || '' } : null;
    };
    return {
      title: text(kid(feed, 'title')),
      subtitle: text(kid(feed, 'subtitle')),
      icon: resolve(text(kid(feed, 'icon')), base),
      next: (link('next') || {}).href || '',
      search: link('search'),
      entries: kids(feed, 'entry').map((e) => parseEntry(e, base)),
    };
  }

  function searchTemplate(search, osdXml, base) {
    if (!search) return '';
    if (/\{searchTerms\}/.test(search.href)) return search.href;
    if (!osdXml) return '';
    const doc = new DOMParser().parseFromString(osdXml, 'application/xml');
    const urls = Array.from(doc.getElementsByTagName('*')).filter((n) => n.localName === 'Url');
    const atom = urls.find((u) => /atom/i.test(u.getAttribute('type') || '')) || urls.find((u) => !/html|json/i.test(u.getAttribute('type') || ''));
    const tpl = atom ? atom.getAttribute('template') || '' : '';
    return tpl ? resolve(tpl.replace(/^http:\/\/m\.gutenberg\.org/, 'https://www.gutenberg.org').replace(/^http:\/\//, 'https://'), base).replace(/%7BsearchTerms%7D/gi, '{searchTerms}') : '';
  }

  function fillSearch(tpl, q) {
    return tpl
      .replace(/\{searchTerms\}/g, encodeURIComponent(q))
      .replace(/\{(?:startPage|startIndex|count|language)\?\}/g, '')
      .replace(/\{[^}]*\?\}/g, '');
  }

  root.Opds = { parseFeed, searchTemplate, fillSearch, formatOf };
})(typeof self !== 'undefined' ? self : this);
