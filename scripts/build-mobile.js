// Собирает интерфейс для мобильной версии (Capacitor) в папку www:
// src/ + mobile/mobile.js и mobile.css + fflate для EPUB + иконка.
// Запуск: npm run build:mobile (потом npx cap sync ios).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const from = (...p) => path.join(root, ...p);

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(from('src'), out, { recursive: true });
fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
fs.copyFileSync(from('node_modules', 'fflate', 'umd', 'index.js'), path.join(out, 'vendor', 'fflate.js'));
fs.copyFileSync(from('build', 'icon.png'), path.join(out, 'icon.png'));
fs.copyFileSync(from('mobile', 'mobile.js'), path.join(out, 'mobile.js'));
fs.copyFileSync(from('mobile', 'mobile.css'), path.join(out, 'mobile.css'));

const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
function swap(a, b) {
  if (!html.includes(a)) throw new Error('index.html: not found: ' + a);
  html = html.replace(a, b);
}
// весь экран, включая область под вырезом; без масштабирования щипком
swap('content="width=device-width, initial-scale=1"', 'content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"');
// обложки из папки приложения (capacitor://) и сеть для предпросмотра в браузере
swap("img-src 'self' blob: data: lampa-cover:;", "img-src 'self' blob: data: capacitor: https:;");
swap('connect-src https://lxztjateewlladvgzzlj.supabase.co http://127.0.0.1:54321 https://*.r2.cloudflarestorage.com', "connect-src 'self' https:");
swap('src="../build/icon.png"', 'src="icon.png"');
swap('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="mobile.css">');
swap('<script src="i18n.js"></script>', '<script src="vendor/fflate.js"></script>\n  <script src="online.js"></script>\n  <script src="mobile.js"></script>\n  <script src="i18n.js"></script>');
fs.writeFileSync(indexFile, html);

// Версия iOS-приложения — та же, что у настольного; номер сборки растёт вместе с ней (0.9.2 → 902).
const pbx = from('ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbx)) {
  const version = require(from('package.json')).version;
  const [major, minor, patch] = version.split('.').map(Number);
  const build = major * 10000 + minor * 100 + patch;
  const text = fs
    .readFileSync(pbx, 'utf8')
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
  fs.writeFileSync(pbx, text);
}

console.log('www ready');
