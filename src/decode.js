// Определение кодировки текста: BOM → валидный UTF-8 → объявленная в XML → угадывание по частотам букв.
(function (global) {
  'use strict';

  // koi8-u — надмножество koi8-r по буквам, заодно понимает украинские і, ї, є, ґ.
  const CYRILLIC = ['windows-1251', 'koi8-u', 'ibm866', 'x-mac-cyrillic', 'iso-8859-5'];
  // Самые частые буквы русского и украинского — первые десять весят больше.
  const FREQ = 'оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъёіїєґ';

  function latin1(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function bomEncoding(b) {
    if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
    if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
    if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
    return null;
  }

  function xmlDeclEncoding(bytes) {
    const head = latin1(bytes.subarray(0, 512)).replace(/^\xEF\xBB\xBF/, '');
    const m = /^\s*<\?xml[^>]*?encoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/.exec(head);
    return m ? m[1] : null;
  }

  function decodeWith(bytes, label, fatal) {
    try {
      return new TextDecoder(label, { fatal }).decode(bytes);
    } catch {
      return null;
    }
  }

  function byteStats(bytes) {
    let high = 0;
    let asciiLetters = 0;
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if (c > 0x7f) high++;
      else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) asciiLetters++;
    }
    return { high, asciiLetters };
  }

  function cyrillicScore(text) {
    const sample = text.length > 60000 ? text.slice(0, 60000) : text;
    let score = 0;
    for (const ch of sample) {
      const c = ch.charCodeAt(0);
      if (c < 0x80) continue;
      const i = FREQ.indexOf(ch);
      if (i >= 0) score += i < 10 ? 3 : 1;
      else if ((c >= 0x0410 && c <= 0x042f) || c === 0x0401) score += 0.2; // заглавные
      else if (c >= 0x2500 && c <= 0x259f) score -= 2; // псевдографика — явный признак ошибки
      else score -= 0.5;
    }
    return score;
  }

  function decodeBytes(bytes, declared) {
    const bom = bomEncoding(bytes);
    if (bom) return { text: decodeWith(bytes, bom, false), encoding: bom };

    const { high, asciiLetters } = byteStats(bytes);
    if (!high) return { text: decodeWith(bytes, 'utf-8', false), encoding: 'ascii' };

    // Кириллица в windows-1251 почти никогда не бывает валидным UTF-8,
    // поэтому валидный UTF-8 выигрывает даже у неверного объявления в заголовке.
    const utf8 = decodeWith(bytes, 'utf-8', true);
    if (utf8 !== null) return { text: utf8, encoding: 'utf-8' };

    if (declared && !/^utf-?8$/i.test(declared)) {
      const t = decodeWith(bytes, declared, false);
      if (t !== null) return { text: t, encoding: declared.toLowerCase() };
    }

    // Мало «высоких» байтов на фоне латиницы — это западноевропейский текст.
    if (high / (high + asciiLetters) < 0.3) {
      return { text: decodeWith(bytes, 'windows-1252', false), encoding: 'windows-1252' };
    }

    let best = null;
    for (const enc of CYRILLIC) {
      const text = decodeWith(bytes, enc, false);
      if (text === null) continue;
      const score = cyrillicScore(text);
      if (!best || score > best.score) best = { text, encoding: enc, score };
    }
    return best || { text: decodeWith(bytes, 'utf-8', false), encoding: 'utf-8' };
  }

  global.Decode = { decodeBytes, xmlDeclEncoding };
})(window);
