// Собирает встроенные шрифты из пакетов @fontsource в src/fonts.
// Запуск: npm run fonts. Результат коммитится, так что для обычной сборки скрипт не нужен.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'fonts');
const SUBSETS = new Set(['latin', 'latin-ext', 'cyrillic']);
const VARIABLE = ['wght.css', 'wght-italic.css'];
const STATIC = ['400.css', '400-italic.css', '700.css', '700-italic.css'];

const FONTS = [
  { pkg: '@fontsource-variable/literata', css: VARIABLE },
  { pkg: '@fontsource/pt-serif', css: STATIC },
  { pkg: '@fontsource-variable/merriweather', css: VARIABLE },
  { pkg: '@fontsource-variable/lora', css: VARIABLE },
  { pkg: '@fontsource-variable/noto-serif', css: VARIABLE },
  { pkg: '@fontsource-variable/source-serif-4', css: VARIABLE },
  { pkg: '@fontsource-variable/eb-garamond', css: VARIABLE },
  { pkg: '@fontsource/ibm-plex-serif', css: STATIC },
  { pkg: '@fontsource-variable/alegreya', css: VARIABLE },
  { pkg: '@fontsource-variable/inter', css: VARIABLE },
  { pkg: '@fontsource-variable/roboto', css: VARIABLE },
  { pkg: '@fontsource-variable/open-sans', css: VARIABLE },
  { pkg: '@fontsource/pt-sans', css: STATIC },
  { pkg: '@fontsource-variable/jetbrains-mono', css: VARIABLE },
];

function subsetOf(name) {
  for (const s of ['cyrillic-ext', 'latin-ext', 'greek-ext', 'vietnamese', 'cyrillic', 'latin', 'greek', 'math', 'symbols']) {
    if (name.includes('-' + s + '-')) return s;
  }
  return null;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'licenses'), { recursive: true });

let css = '/* Сгенерировано scripts/build-fonts.js — не редактировать вручную. Лицензии: licenses/ */\n';
let bytes = 0;

for (const font of FONTS) {
  const dir = path.join(ROOT, 'node_modules', font.pkg);
  for (const file of font.css) {
    const src = path.join(dir, file);
    if (!fs.existsSync(src)) continue;
    const text = fs.readFileSync(src, 'utf8');
    for (const m of text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)) {
      if (!SUBSETS.has(subsetOf(m[1]))) continue;
      const body = m[2].replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => {
        fs.copyFileSync(path.join(dir, 'files', f), path.join(OUT, 'files', f));
        bytes += fs.statSync(path.join(OUT, 'files', f)).size;
        return `url(./files/${f})`;
      });
      css += `@font-face {${body}}\n`;
    }
  }
  fs.copyFileSync(path.join(dir, 'LICENSE'), path.join(OUT, 'licenses', font.pkg.split('/')[1] + '.txt'));
}

fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
console.log(`fonts: ${FONTS.length} families, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
