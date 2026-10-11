// Поиск книг в каталогах и перевод: общий код для Electron (main.js) и мобильной версии (mobile.js).
// Сеть каждая платформа даёт свою: функции принимают getJson(url) → Promise<object>.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Online = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- перевод ----------

  // Бесплатный открытый адрес Google Translate (тот же, что у браузерных расширений): без ключа,
  // но неофициальный — при большом числе запросов Google может временно ограничить.
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
      // запасной адрес: только перевод, без словаря
      const j = await getJson(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${to}&q=${q}`);
      const first = Array.isArray(j) ? j[0] : null;
      if (Array.isArray(first)) return { text: String(first[0] || '').trim(), src: String(first[1] || ''), dict: [] };
      if (typeof first === 'string') return { text: first.trim(), src: '', dict: [] };
      throw new Error('TRANSLATE_FAILED');
    }
  }

  // ---------- поиск книг ----------

  // картинки скачиваем только с сайтов, которые отдают обложки в поиске
  const COVER_HOSTS = /(^|\.)(mzstatic\.com|openlibrary\.org|archive\.org)$/;

  function isCoverUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && COVER_HOSTS.test(u.hostname);
    } catch {
      return false;
    }
  }

  // Та же обложка, но маленькая — для результатов поиска.
  const thumbUrl = (url) => url.replace(/\/\d+x\d+bb\.jpg$/, '/120x180bb.jpg').replace(/-L\.jpg$/, '-M.jpg');

  // Жанр по рубрикам Apple Books или темам Open Library. Порядок — приоритет при равенстве.
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
    // «political fiction» — художественная книга, а не публицистика
    ['nonfiction', /non-?fiction|^(?!.*(?<!non-?)fiction).*(politic|current events|reference|computer|technolog|cook|parenting|sport)/],
    ['fiction', /fiction|literature|novel|литератур|роман|проза/],
    // сатира обычно ещё и проза — при равенстве побеждает проза
    ['humor', /humou?r|satire|comedy|юмор|сатир/],
  ];

  // primaryFirst: у Apple первая рубрика — основная, она весит вдвое больше.
  function classifyGenre(items, primaryFirst) {
    const score = new Map();
    (items || []).forEach((raw, i) => {
      let hits = GENRE_RULES.filter(([, re]) => re.test(String(raw).toLowerCase())).map(([id]) => id);
      // «Science Fiction» — фантастика, а не просто проза; «Mysteries for Young Adults» — детектив
      if (hits.length > 1) hits = hits.filter((id) => id !== 'ya');
      if (hits.length > 1) hits = hits.filter((id) => id !== 'fiction');
      const weight = primaryFirst && i === 0 ? 2 : 1;
      for (const id of hits) score.set(id, (score.get(id) || 0) + weight / hits.length);
    });
    let best = '';
    for (const [id] of GENRE_RULES) if (score.has(id) && (!best || score.get(id) > score.get(best))) best = id;
    return best;
  }

  // Средняя оценка читателей по пятибалльной шкале; редкие оценки ничего не говорят.
  // rank — чем больше, тем надёжнее: Apple округляет среднюю до 0,5, поэтому Open Library с 20+ оценками точнее.
  const readerRating = (avg, n, src) =>
    Number(n) >= 10 && Number(avg) > 0
      ? { avg: Math.round(Number(avg) * 100) / 100, n: Number(n), src, rank: Number(n) * (src === 'Open Library' && Number(n) >= 20 ? 1000 : 1) }
      : null;

  // Apple иногда отдаёт названия с HTML-сущностями: «Питер &amp; Майкл».
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const unescapeHtml = (s) =>
    String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    });

  // Apple Books: хорошо находит русские книги и даёт обложки в любом размере.
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

  // Open Library: открытый каталог, год первого издания, оценки читателей.
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

  const bookKey = (b) => {
    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return norm(b.title) + '|' + norm(b.author).split(' ').pop();
  };

  async function searchBooks(q, getJson) {
    const [apple, ol] = await Promise.allSettled([searchApple(q, getJson), searchOpenLibrary(q, getJson)]);
    if (apple.status === 'rejected' && ol.status === 'rejected') throw apple.reason;
    const lists = [apple.value || [], ol.value || []];
    const out = [];
    const seen = new Map();
    // по очереди из обоих источников; одну и ту же книгу показываем один раз
    for (let i = 0; i < 20; i++) {
      for (const list of lists) {
        const b = list[i];
        if (!b) continue;
        const prev = seen.get(bookKey(b));
        if (prev) {
          if (!prev.cover && b.cover) prev.cover = b.cover;
          // у переизданий год новый — оставляем самый ранний
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

  return { MAX_TRANSLATE, isLangCode, translate, searchBooks, classifyGenre, isCoverUrl, thumbUrl };
});
