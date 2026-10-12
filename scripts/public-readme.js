// Страница публичного репозитория lampa-releases (установщики и обновления) из README этого репозитория:
// те же описание, скачивание и установка, но без сборки из исходников — код закрыт.
// Запуск: node scripts/public-readme.js <папка клона lampa-releases>
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/public-readme.js <lampa-releases folder>');

// Вырезать раздел от заголовка до следующего заголовка того же уровня (или до конца).
function cutSection(md, heading) {
  const start = md.indexOf('\n' + heading + '\n');
  if (start < 0) throw new Error('no section ' + heading);
  const level = heading.match(/^#+/)[0];
  const re = new RegExp('\\n#{1,' + level.length + '} ', 'g');
  re.lastIndex = start + heading.length + 1;
  const next = re.exec(md);
  return md.slice(0, start + 1) + (next ? md.slice(next.index + 1) : '');
}

function replaceSection(md, heading, body) {
  const cut = cutSection(md, heading);
  const at = md.indexOf('\n' + heading + '\n') + 1;
  return cut.slice(0, at) + heading + '\n\n' + body.trim() + '\n\n' + cut.slice(at);
}

function swap(md, a, b) {
  if (!md.includes(a)) throw new Error('not found: ' + a.slice(0, 60));
  return md.split(a).join(b);
}

function publicReadme(file, t) {
  let md = fs.readFileSync(path.join(root, file), 'utf8');
  md = md.split('Zelinsky-Vladimir/lampa/releases').join('Zelinsky-Vladimir/lampa-releases/releases');
  md = md.split('github/v/release/Zelinsky-Vladimir/lampa?').join('github/v/release/Zelinsky-Vladimir/lampa-releases?');
  md = md.split('github/downloads/Zelinsky-Vladimir/lampa/total').join('github/downloads/Zelinsky-Vladimir/lampa-releases/total');
  md = md.replace(/\n\s*<a href="LICENSE"><img[^\n]*\n/, '\n');
  md = md.split('src="build/icon.png"').join('src="docs/icon.png"');
  md = swap(md, t.signedFrom, t.signedTo);
  md = replaceSection(md, t.iosHeading, t.iosBody);
  md = cutSection(md, t.buildHeading);
  md = swap(md, t.licenseFrom, t.licenseTo);
  return md;
}

const en = publicReadme('README.md', {
  signedFrom: "The app isn't signed with a paid certificate; the code is all here and the builds come from [GitHub Actions](https://github.com/Zelinsky-Vladimir/lampa/actions).",
  signedTo: "The app isn't signed with a paid certificate yet.",
  iosHeading: '### iPhone and iPad (early version)',
  iosBody: 'The iPhone and iPad version is in testing and will come to TestFlight and the App Store. It syncs your library, reading position, notes and lists with the desktop app.',
  buildHeading: '## Building from source',
  licenseFrom:
    '[MIT](LICENSE). The built-in fonts are under the SIL Open Font License; their licenses are in [`src/fonts/licenses`](src/fonts/licenses). The sample books in the screenshots are in the public domain.',
  licenseTo: 'Lampa is free. The built-in fonts are under the SIL Open Font License. The sample books in the screenshots are in the public domain.',
});

const ru = publicReadme('README.ru.md', {
  signedFrom: 'У приложения нет платной цифровой подписи, но весь код открыт, а сборки делает [GitHub Actions](https://github.com/Zelinsky-Vladimir/lampa/actions).',
  signedTo: 'У приложения пока нет платной цифровой подписи.',
  iosHeading: '### iPhone и iPad (ранняя версия)',
  iosBody: 'Версия для iPhone и iPad сейчас тестируется и появится в TestFlight и App Store. Она синхронизирует библиотеку, место чтения, заметки и списки с версией для компьютера.',
  buildHeading: '## Сборка из исходников',
  licenseFrom:
    '[MIT](LICENSE). Встроенные шрифты распространяются по лицензии SIL Open Font License, тексты лицензий лежат в [`src/fonts/licenses`](src/fonts/licenses). Книги на скриншотах в общественном достоянии.',
  licenseTo: 'Lampa бесплатна. Встроенные шрифты распространяются по лицензии SIL Open Font License. Книги на скриншотах в общественном достоянии.',
});

fs.mkdirSync(path.join(out, 'docs', 'screenshots'), { recursive: true });
fs.writeFileSync(path.join(out, 'README.md'), en);
fs.writeFileSync(path.join(out, 'README.ru.md'), ru);
fs.copyFileSync(path.join(root, 'build', 'icon.png'), path.join(out, 'docs', 'icon.png'));
for (const f of fs.readdirSync(path.join(root, 'docs', 'screenshots'))) {
  fs.copyFileSync(path.join(root, 'docs', 'screenshots', f), path.join(out, 'docs', 'screenshots', f));
}
console.log('public README written to', out);
