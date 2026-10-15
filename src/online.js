(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Online = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_TRANSLATE = 1500;
  const isLangCode = (to) => /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(to);

  async function translate(text, to, getJson) {
    const q = encodeURIComponent(text);
    try {
      const j = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&hl=${to}&dt=t&dt=bd&dj=1&q=${q}`);
      return {
        text: (j.sentences || []).map((s) => s.trans || '').join('').trim(),
        src: j.src || (j.ld_result && j.ld_result.srclangs && j.ld_result.srclangs[0]) || '',
        dict: (j.dict || []).map((d) => ({ pos: d.pos || '', terms: (d.terms || []).slice(0, 8) })),
      };
    } catch {
      const j = await getJson(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${to}&q=${q}`);
      const first = Array.isArray(j) ? j[0] : null;
      if (Array.isArray(first)) return { text: String(first[0] || '').trim(), src: String(first[1] || ''), dict: [] };
      if (typeof first === 'string') return { text: first.trim(), src: '', dict: [] };
      throw new Error('TRANSLATE_FAILED');
    }
  }

  const COVER_HOSTS = /(^|\.)(mzstatic\.com|openlibrary\.org|archive\.org)$/;

  function isCoverUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && COVER_HOSTS.test(u.hostname);
    } catch {
      return false;
    }
  }

  const thumbUrl = (url) => url.replace(/\/\d+x\d+bb\.jpg$/, '/120x180bb.jpg').replace(/-L\.jpg$/, '-M.jpg');

  const GENRE_RULES = [
    ['classics', /classic|классик/],
    ['scifi', /science.?fiction|sci-?fi|научн\S* фантаст|фантастик/],
    ['fantasy', /fantasy|фэнтези/],
    ['mystery', /myster|detective|crime|детектив/],
    ['thriller', /thriller|suspense|триллер/],
    ['horror', /horror|ужас/],
    ['romance', /romance|love stor|любовн/],
    ['adventure', /adventure|приключ/],
    ['ya', /young adult|teen|подрост/],
    ['children', /child|kids|juvenile|picture book|детск/],
    ['comics', /comic|graphic novel|manga|комикс|манга/],
    ['poetry', /poetry|poems|поэз|стихи/],
    ['drama', /drama|plays\b|пьес/],
    ['biography', /biograph|memoir|биограф|мемуар/],
    ['history', /histor|истори/],
    ['philosophy', /philosoph|философ/],
    ['religion', /religio|spiritual|christian|bible|религи/],
    ['selfhelp', /self-?help|self-improvement|personal growth|psycholog|mind & body|саморазвит|психолог/],
    ['business', /business|financ|econom|management|marketing|бизнес|экономик/],
    ['science', /^(?!.*fiction).*(science|nature|physics|biolog|mathemat|astronom|научпоп)/],
    ['travel', /travel|путешеств/],
    ['nonfiction', /non-?fiction|^(?!.*(?<!non-?)fiction).*(politic|current events|reference|computer|technolog|cook|parenting|sport)/],
    ['fiction', /fiction|literature|novel|литератур|роман|проза/],
    ['humor', /humou?r|satire|comedy|юмор|сатир/],
  ];

  function classifyGenre(items, primaryFirst) {
    const score = new Map();
    (items || []).forEach((raw, i) => {
      let hits = GENRE_RULES.filter(([, re]) => re.test(String(raw).toLowerCase())).map(([id]) => id);
      if (hits.length > 1) hits = hits.filter((id) => id !== 'ya');
      if (hits.length > 1) hits = hits.filter((id) => id !== 'fiction');
      const weight = primaryFirst && i === 0 ? 2 : 1;
      for (const id of hits) score.set(id, (score.get(id) || 0) + weight / hits.length);
    });
    let best = '';
    for (const [id] of GENRE_RULES) if (score.has(id) && (!best || score.get(id) > score.get(best))) best = id;
    return best;
  }

  const readerRating = (avg, n, src) =>
    Number(n) >= 10 && Number(avg) > 0
      ? { avg: Math.round(Number(avg) * 100) / 100, n: Number(n), src, rank: Number(n) * (src === 'Open Library' && Number(n) >= 20 ? 1000 : 1) }
      : null;

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const unescapeHtml = (s) =>
    String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    });

  async function searchApple(q, getJson) {
    const j = await getJson(`https://itunes.apple.com/search?media=ebook&entity=ebook&country=us&limit=20&term=${encodeURIComponent(q)}`);
    return (j.results || [])
      .filter((x) => x.trackName)
      .map((x) => ({
        title: unescapeHtml(x.trackName),
        author: unescapeHtml(x.artistName),
        year: String(x.releaseDate || '').slice(0, 4),
        cover: x.artworkUrl100 ? String(x.artworkUrl100).replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x900bb.jpg') : null,
        genre: classifyGenre(x.genres, true),
        rating: readerRating(x.averageUserRating, x.userRatingCount, 'Apple Books'),
        ref: 'apple:' + x.trackId,
      }));
  }

  async function searchOpenLibrary(q, getJson) {
    const fields = 'key,title,author_name,first_publish_year,cover_i,ratings_average,ratings_count,subject';
    const j = await getJson(`https://openlibrary.org/search.json?limit=20&fields=${fields}&q=${encodeURIComponent(q)}`);
    return (j.docs || [])
      .filter((d) => d.title)
      .map((d) => ({
        title: String(d.title),
        author: (d.author_name || []).slice(0, 2).join(', '),
        year: d.first_publish_year ? String(d.first_publish_year) : '',
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
        genre: classifyGenre((d.subject || []).slice(0, 40)),
        rating: readerRating(d.ratings_average, d.ratings_count, 'Open Library'),
        ref: 'ol:' + d.key,
      }));
  }

  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const lastName = (author) => norm(author).split(' ').pop();
  const bookKey = (b) => norm(b.title) + '|' + lastName(b.author);

  async function searchBooks(q, getJson) {
    const [apple, ol] = await Promise.allSettled([searchApple(q, getJson), searchOpenLibrary(q, getJson)]);
    if (apple.status === 'rejected' && ol.status === 'rejected') throw apple.reason;
    const lists = [apple.value || [], ol.value || []];
    const out = [];
    const seen = new Map();
    for (let i = 0; i < 20; i++) {
      for (const list of lists) {
        const b = list[i];
        if (!b) continue;
        const prev = seen.get(bookKey(b));
        if (prev) {
          if (!prev.cover && b.cover) prev.cover = b.cover;
          if (b.year && (!prev.year || b.year < prev.year)) prev.year = b.year;
          if (b.rating && (!prev.rating || b.rating.rank > prev.rating.rank)) prev.rating = b.rating;
          if (!prev.genre) prev.genre = b.genre;
          continue;
        }
        seen.set(bookKey(b), b);
        out.push(b);
      }
    }
    return out.slice(0, 30);
  }

  function sameBook(results, title, author) {
    const t = norm(title);
    const last = lastName(author);
    let pool = results.filter((r) => norm(r.title).startsWith(t));
    const exact = pool.filter((r) => norm(r.title) === t);
    if (exact.length) pool = exact;
    const byAuthor = last ? pool.filter((r) => norm(r.author).includes(last)) : [];
    return byAuthor.length ? byAuthor : pool;
  }

  const bestRated = (pool) => pool.filter((r) => r.rating).sort((a, b) => b.rating.rank - a.rating.rank)[0] || null;

  async function englishTitle(title, author, getJson) {
    const api = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
    const s = await getJson(`${api}&action=wbsearchentities&type=item&limit=20&language=ru&uselang=ru&search=${encodeURIComponent(title)}`);
    const items = s.search || [];
    const stem = lastName(author).slice(0, 5);
    const literary = /роман|повест|рассказ|книг|пьес|поэм|novel|novella|book|poem/i;
    const pick = (stem && items.find((x) => norm(x.description).includes(stem))) || items.find((x) => literary.test(x.description || ''));
    if (!pick) return null;
    const e = await getJson(`${api}&action=wbgetentities&props=labels|claims&languages=en&ids=${pick.id}`);
    const ent = e.entities && e.entities[pick.id];
    const en = ent && ent.labels && ent.labels.en && ent.labels.en.value.split(/[:;]|,? or,? /i)[0].trim();
    if (!en) return null;
    const authorIds = ((ent.claims && ent.claims.P50) || [])
      .map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id)
      .filter(Boolean)
      .slice(0, 3);
    let enAuthor = '';
    if (authorIds.length) {
      const a = await getJson(`${api}&action=wbgetentities&props=labels&languages=en&ids=${authorIds.join('|')}`);
      enAuthor = authorIds.map((id) => a.entities && a.entities[id] && a.entities[id].labels.en && a.entities[id].labels.en.value).find(Boolean) || '';
    }
    return { title: en, author: enAuthor };
  }

  async function lookupBook(title, author, getJson) {
    let pool = sameBook(await searchBooks(`${title} ${author}`.trim(), getJson), title, author);
    let best = bestRated(pool);
    if ((!best || best.rating.n < 50) && /[^\u0000-ɏ\s\d\p{P}]/u.test(title)) {
      const en = await englishTitle(title, author, getJson).catch(() => null);
      if (en) {
        const pool2 = sameBook(await searchBooks(`${en.title} ${en.author}`.trim(), getJson), en.title, en.author);
        best = bestRated([best, bestRated(pool2)].filter(Boolean));
        if (!pool.length) pool = pool2;
        else if (!pool.some((r) => r.genre)) pool = pool.concat(pool2);
      }
    }
    return {
      rating: best ? best.rating : null,
      genre: (pool.find((r) => r.genre) || best || {}).genre || '',
      cover: (pool.find((r) => r.cover) || {}).cover || null,
    };
  }

  const RU_POS = { сущ: 'существительное', гл: 'глагол', прил: 'прилагательное', adv: 'наречие', мест: 'местоимение', числ: 'числительное', прич: 'причастие', деепр: 'деепричастие', conj: 'союз', prep: 'предлог', part: 'частица', interj: 'междометие' };

  function dropTemplates(t, name) {
    let s = t;
    for (let at = s.indexOf('{{' + name); at >= 0; at = s.indexOf('{{' + name)) {
      let depth = 0;
      let i = at;
      for (; i < s.length; i++) {
        if (s.startsWith('{{', i)) {
          depth++;
          i++;
        } else if (s.startsWith('}}', i)) {
          depth--;
          i++;
          if (!depth) break;
        }
      }
      s = s.slice(0, at) + s.slice(i + 1);
    }
    return s;
  }

  function cleanWikitext(t) {
    let s = dropTemplates(t, 'пример');
    const ABBR = { 'п.': 'перен.' };
    for (let i = 0; i < 5; i++) {
      s = s
        .replace(/\{\{(?:t:)?=\|([^{}|]*)[^{}]*\}\}/g, 'то же, что $1')
        .replace(/\{\{(?:помета|помета\.)\|([^{}|]*)[^{}]*\}\}/g, '$1')
        .replace(/\{\{([^{}|]+\.)(?:\|[^{}]*)?\}\}/g, (m, a) => ABBR[a] || a)
        .replace(/\{\{выдел\|([^{}|]*)\}\}/g, '$1');
      s = s.replace(/\{\{[^{}]*\}\}/g, '');
    }
    return s
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/'{2,}/g, '')
      .replace(/\s*\[\d+\]/g, '')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,;:—-]+|[\s,;:—]+$/g, '')
      .trim();
  }

  async function ruWiktionary(word, getJson) {
    const j = await getJson(`https://ru.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&formatversion=2&redirects=1&origin=*`);
    const text = j && j.parse && j.parse.wikitext;
    if (!text) return null;
    const ru = (/= *\{\{-ru-\}\} *=([\s\S]*?)(?:\n= *\{\{-[\w-]+-\}\} *=|$)/.exec(text) || [])[1] || '';
    if (!ru) return null;
    const posKey = (/\{\{(сущ|гл|прил|adv|мест|числ|прич|деепр|conj|prep|part|interj)[ |-]/.exec(ru) || [])[1];
    const block = (/=+ *Значение *=+\n([\s\S]*?)(?:\n=|$)/.exec(ru) || [])[1] || '';
    const senses = block
      .split('\n')
      .filter((l) => /^#(?![#:*])/.test(l))
      .map((l) => cleanWikitext(l.replace(/^#\s*/, '')))
      .filter((l) => l.length > 1)
      .slice(0, 4);
    if (!senses.length) return null;
    return { word: j.parse.title || word, pos: RU_POS[posKey] || '', senses, source: 'ru.wiktionary.org', url: `https://ru.wiktionary.org/wiki/${encodeURIComponent(j.parse.title || word)}` };
  }

  async function enDefinitions(word, getJson) {
    try {
      return await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}?redirect=true`);
    } catch {
      return null;
    }
  }

  const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s{2,}/g, ' ').trim();

  async function define(word, getJson) {
    const w = String(word || '').trim().replace(/[«»"“”„.,!?;:()]+/g, '');
    if (!w || w.length > 60) return null;
    const ru = /[Ѐ-ӿ]/.test(w);
    const forms = Array.from(new Set([w, w.toLowerCase()]));
    if (ru) {
      for (const f of forms) {
        const r = await ruWiktionary(f, getJson).catch(() => null);
        if (r) return r;
      }
      for (const f of forms) {
        const en = await enDefinitions(f, getJson);
        const html = en && (en.ru || []).flatMap((x) => x.definitions || []).map((d) => d.definition || '').join(' ');
        const lemma = html && Array.from(html.matchAll(/<a [^>]*title="([^"#]+)"/g), (m) => m[1]).find((x) => !x.includes(':'));
        if (lemma && lemma !== f) {
          const r = await ruWiktionary(lemma.replace(/[̀́]/g, ''), getJson).catch(() => null);
          if (r) return { ...r, from: w };
        }
      }
      return null;
    }
    for (const f of forms) {
      const en = await enDefinitions(f, getJson);
      if (!en) continue;
      const lang = en.en ? 'en' : Object.keys(en)[0];
      const items = (en[lang] || []).filter((x) => x.definitions && x.definitions.length);
      if (!items.length) continue;
      const senses = items.flatMap((x) => x.definitions.map((d) => stripHtml(d.definition))).filter(Boolean).slice(0, 4);
      if (senses.length) return { word: f, pos: items[0].partOfSpeech || '', senses, source: 'en.wiktionary.org', url: `https://en.wiktionary.org/wiki/${encodeURIComponent(f)}` };
    }
    return null;
  }

  return { MAX_TRANSLATE, isLangCode, translate, define, searchBooks, lookupBook, classifyGenre, isCoverUrl, thumbUrl };
});
