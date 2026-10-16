# Lampa — карточка в App Store Connect

Тексты, ответы для анкет и заметки для ревьюера. Скриншоты лежат рядом в папке `appstore/<язык>/iphone-6.9` (iPhone 6.9″, 1320×2868) и `appstore/<язык>/ipad-13` (iPad 13″, 2752×2064, горизонтальные). Загружай их в порядке номеров в имени файла.

## Общее (вкладка App Information)

- **Name:** Lampa: Book Reader
- **Primary category:** Books
- **Secondary category:** Reference
- **Content rights:** «Yes, it contains, shows or accesses third-party content» → «I have the necessary rights» (книги Project Gutenberg — общественное достояние).
- **Age rating:** на все вопросы анкеты ответ «None» / «No», включая «Unrestricted Web Access» и «User-Generated Content». Должно получиться **4+**.
- **Pricing and Availability:** Free, все страны.
- **Copyright** (на странице версии): `2026 Vladimir Zelinskyi`
- **Encryption:** уже указано в сборке (`ITSAppUsesNonExemptEncryption = false`), вопрос не всплывёт.

## App Privacy (вкладка App Privacy)

«Do you or your third-party partners collect data from this app?» → **Yes**. Отметить три типа данных:

| Тип данных | Для чего | Связано с пользователем | Для слежки |
|---|---|---|---|
| Contact Info → **Email Address** | App Functionality | Yes | No |
| Identifiers → **User ID** | App Functionality | Yes | No |
| User Content → **Other User Content** (библиотека, место чтения, закладки, заметки, файлы книг) | App Functionality | Yes | No |

Всё это собирается, только если человек вошёл в аккаунт. Ничего другого не отмечать: рекламы, аналитики, отчётов о сбоях и геолокации нет. Слово для словаря уходит в Викисловарь, а поиск в каталоге — в Project Gutenberg. Эти запросы мы не храним, поэтому в анкете это не «сбор данных».

Privacy Policy URL: `https://lampa-reader.github.io/privacy.html`

## App Review Information (на странице версии)

- **Sign-in required:** отметь и впиши почту и пароль тестового аккаунта, который ты создашь в приложении (вход по почте). Сюда их не пишу.
- **Contact:** твои имя, телефон и почта.
- **Notes** (по-английски, для ревьюера):

```
Lampa is a reader for the user's own FB2, EPUB and TXT books. No account is needed to read.

To try it without your own files: on the main screen tap "Add a book" -> "Catalogs" -> "Project Gutenberg" and download any book (public-domain classics). Books can also be opened from the Files app ("Add a book" -> "Files").

Signing in (Sign in with Apple, Google or email) only enables syncing the reading position, bookmarks, notes and book files between the user's devices. A demo account is provided above.

The account can be deleted in the app: account button (top right) -> "Delete account".

There are no ads, no tracking, no analytics and no in-app purchases.
```

## English (U.S.) — также English (U.K.), если добавишь

**Subtitle** (25/30)
```
FB2 & EPUB reader, synced
```
**Promotional Text** (154/170)
```
A calm reader for your own books. FB2, EPUB and TXT as they are, your page and notes on iPhone, iPad and your computer, and 70,000 classics to start with.
```
**Keywords** (93/100)
```
ebook,txt,novel,library,gutenberg,opds,calibre,dictionary,highlight,notes,night mode,classics
```
**Description** (1796/4000)
```
Lampa is a calm reader for the books you already have. No ads, no account required, no store pushing purchases — just your library and a page that is easy on the eyes.

ONE BOOK ON EVERY DEVICE
Close the book on your iPhone and carry on from the same page on your iPad or computer. Bookmarks, highlights, notes and reading lists follow you. Lampa runs on iPhone, iPad, Mac, Windows and Linux. Syncing needs a free account (Sign in with Apple, Google or email); without one everything stays on your device.

FB2, EPUB AND TXT AS THEY ARE
Open books from Files, from other apps or a whole folder at once. Covers, footnotes and chapters are kept, FB2 inside ZIP works too. Nothing is converted.

EASY ON THE EYES
• Five tuned themes, from warm paper to true black for reading at night — switch day and night with one tap
• Literata and four more fonts made for long reading, with size and line spacing
• Pages with a page-turn animation, or one continuous scroll
• In-app brightness that goes lower than the screen's

HIGHLIGHTS, NOTES AND A DICTIONARY
• Highlights in four colours and notes on any passage
• Look up a word in one tap — the dictionary finds the base form of inflected words
• Translate a phrase on iPhone without an internet connection
• Search the whole book, jump to any page and come back

WHERE TO GET BOOKS
Project Gutenberg is built in: 70,000 free public-domain classics to browse, search and download right in the app. Connect your own Calibre library or any OPDS catalog.

"READ" AND "WANT TO READ"
Keep a list of finished books with ratings, and a list of what to read next.

PRIVATE BY DESIGN
No ads, no analytics, no tracking. Your books stay on your device; with an account, book files are kept in private cloud storage in the EU so you can open them on another device.
```
**Support URL:** `https://lampa-reader.github.io/support.html`  
**Marketing URL:** `https://lampa-reader.github.io/`  
**Screenshots:** `appstore/en/iphone-6.9/` и `appstore/en/ipad-13/`

## Русский

**Subtitle** (30/30)
```
Читалка FB2 и EPUB без рекламы
```
**Promotional Text** (149/170)
```
Спокойная читалка для ваших книг. FB2, EPUB и TXT как есть, место чтения и заметки на iPhone, iPad и компьютере, а для начала — 70 000 книг классики.
```
**Keywords** (98/100)
```
книги,чтение,электронная книга,библиотека,txt,словарь,закладки,заметки,ночной режим,gutenberg,opds
```
**Description** (1818/4000)
```
Lampa — спокойная читалка для книг, которые у вас уже есть. Без рекламы, без обязательного аккаунта и без магазина, который подсовывает покупки. Только ваша библиотека и страница, на которую приятно смотреть.

ОДНА КНИГА НА ВСЕХ УСТРОЙСТВАХ
Закрыли книгу на iPhone — продолжили на iPad или компьютере с той же страницы. Закладки, закраски, заметки и списки переносятся вместе с ней. Lampa есть для iPhone, iPad, Mac, Windows и Linux. Для синхронизации нужен бесплатный аккаунт (вход через Apple, Google или почту); без него всё остаётся на устройстве.

FB2, EPUB И TXT — КАК ЕСТЬ
Открывайте книги из «Файлов», из других приложений или целой папкой сразу. Обложки, сноски и главы сохраняются, FB2 в ZIP тоже открывается. Ничего не нужно конвертировать.

УДОБНО ГЛАЗАМ
• Пять выверенных тем — от тёплой бумаги до чистого чёрного для чтения ночью; день и ночь переключаются одним касанием
• Literata и ещё четыре шрифта для долгого чтения, размер и межстрочный интервал
• Страницы с перелистыванием или одна непрерывная лента
• Яркость внутри приложения — ниже, чем позволяет экран

ЗАКРАСКИ, ЗАМЕТКИ И СЛОВАРЬ
• Закраски в четыре цвета и заметки к любому фрагменту
• Значение слова в одно касание — словарь сам находит начальную форму
• Перевод фразы на iPhone без интернета
• Поиск по всей книге, переход на любую страницу и обратно

ГДЕ БРАТЬ КНИГИ
Project Gutenberg встроен: 70 000 бесплатных книг классики, которые можно листать, искать и скачивать прямо в приложении. Подключите свою библиотеку Calibre или любой каталог OPDS.

«ПРОЧИТАНО» И «ХОЧУ ПРОЧИТАТЬ»
Список прочитанного с оценками и список того, что прочитать дальше.

ЧАСТНОЕ ПО УМОЛЧАНИЮ
Без рекламы, аналитики и слежки. Книги хранятся на вашем устройстве; с аккаунтом файлы книг лежат ещё и в закрытом облаке в ЕС, чтобы открыть их на другом устройстве.
```
**Support URL:** `https://lampa-reader.github.io/ru/support.html`  
**Marketing URL:** `https://lampa-reader.github.io/ru/`  
**Screenshots:** `appstore/ru/iphone-6.9/` и `appstore/ru/ipad-13/`

## Français

**Subtitle** (27/30)
```
Liseuse FB2 et EPUB synchro
```
**Promotional Text** (152/170)
```
Une liseuse paisible pour vos propres livres. FB2, EPUB et TXT tels quels, votre page et vos notes sur iPhone, iPad et ordinateur, et 70 000 classiques.
```
**Keywords** (95/100)
```
ebook,livres,lecture,txt,roman,bibliothèque,gutenberg,opds,calibre,dictionnaire,notes,mode nuit
```
**Description** (1882/4000)
```
Lampa est une liseuse paisible pour les livres que vous avez déjà. Sans publicité, sans compte obligatoire, sans boutique qui pousse à l’achat — juste votre bibliothèque et une page agréable à lire.

UN LIVRE SUR TOUS VOS APPAREILS
Fermez le livre sur l’iPhone, reprenez à la même page sur l’iPad ou l’ordinateur. Signets, surlignages, notes et listes suivent. Lampa existe pour iPhone, iPad, Mac, Windows et Linux. La synchronisation demande un compte gratuit (Apple, Google ou e-mail) ; sans compte, tout reste sur votre appareil.

FB2, EPUB ET TXT TELS QUELS
Ouvrez des livres depuis Fichiers, depuis d’autres apps ou tout un dossier d’un coup. Couvertures, notes et chapitres sont conservés, le FB2 dans un ZIP aussi. Aucune conversion.

DOUX POUR LES YEUX
• Cinq thèmes soignés, du papier chaud au noir pur pour lire la nuit — jour et nuit d’un seul geste
• Literata et quatre autres polices pour les longues lectures, taille et interligne
• Pages avec animation ou défilement continu
• Luminosité dans l’app, plus basse que celle de l’écran

SURLIGNAGES, NOTES ET DICTIONNAIRE
• Surlignage en quatre couleurs et notes sur n’importe quel passage
• Le sens d’un mot en un geste — le dictionnaire retrouve la forme de base
• Traduction d’une phrase sur iPhone sans connexion
• Recherche dans tout le livre, saut à n’importe quelle page et retour

OÙ TROUVER DES LIVRES
Project Gutenberg est intégré : 70 000 classiques du domaine public à parcourir, chercher et télécharger dans l’app. Connectez votre bibliothèque Calibre ou tout catalogue OPDS.

« LUS » ET « À LIRE »
Une liste des livres lus avec vos notes, et une liste de ce que vous lirez ensuite.

PRIVÉ PAR DÉFAUT
Sans publicité, sans statistiques, sans pistage. Vos livres restent sur votre appareil ; avec un compte, les fichiers sont aussi gardés dans un stockage privé dans l’UE pour les ouvrir sur un autre appareil.
```
**Support URL:** `https://lampa-reader.github.io/fr/support.html`  
**Marketing URL:** `https://lampa-reader.github.io/fr/`  
**Screenshots:** `appstore/fr/iphone-6.9/` и `appstore/fr/ipad-13/`

## Deutsch

**Subtitle** (27/30)
```
FB2- & EPUB-Reader mit Sync
```
**Promotional Text** (153/170)
```
Ein ruhiger Reader für Ihre eigenen Bücher. FB2, EPUB und TXT, wie sie sind, Lesestelle und Notizen auf iPhone, iPad und Computer, dazu 70.000 Klassiker.
```
**Keywords** (92/100)
```
ebook,bücher,lesen,txt,roman,bibliothek,gutenberg,opds,calibre,wörterbuch,notizen,nachtmodus
```
**Description** (1934/4000)
```
Lampa ist ein ruhiger Reader für die Bücher, die Sie schon haben. Ohne Werbung, ohne Kontopflicht, ohne Shop, der Käufe aufdrängt — nur Ihre Bibliothek und eine Seite, die angenehm zu lesen ist.

EIN BUCH AUF ALLEN GERÄTEN
Am iPhone schließen, auf iPad oder Computer auf derselben Seite weiterlesen. Lesezeichen, Markierungen, Notizen und Listen kommen mit. Lampa gibt es für iPhone, iPad, Mac, Windows und Linux. Für die Synchronisierung brauchen Sie ein kostenloses Konto (Apple, Google oder E-Mail); ohne Konto bleibt alles auf dem Gerät.

FB2, EPUB UND TXT, WIE SIE SIND
Öffnen Sie Bücher aus „Dateien“, aus anderen Apps oder einen ganzen Ordner auf einmal. Cover, Fußnoten und Kapitel bleiben erhalten, FB2 im ZIP auch. Nichts wird umgewandelt.

ANGENEHM FÜR DIE AUGEN
• Fünf abgestimmte Themen, von warmem Papier bis echtem Schwarz für die Nacht — Tag und Nacht mit einem Tipp
• Literata und vier weitere Schriften für langes Lesen, Größe und Zeilenabstand
• Seiten mit Blätter-Animation oder ein durchgehender Bildlauf
• Helligkeit in der App, dunkler als der Bildschirm erlaubt

MARKIERUNGEN, NOTIZEN UND WÖRTERBUCH
• Markierungen in vier Farben und Notizen zu jeder Stelle
• Die Bedeutung eines Wortes mit einem Tipp — das Wörterbuch findet die Grundform
• Übersetzung einer Phrase auf dem iPhone ohne Internet
• Suche im ganzen Buch, Sprung zu jeder Seite und zurück

WOHER DIE BÜCHER KOMMEN
Project Gutenberg ist eingebaut: 70.000 gemeinfreie Klassiker zum Stöbern, Suchen und Laden direkt in der App. Verbinden Sie Ihre Calibre-Bibliothek oder jeden OPDS-Katalog.

„GELESEN“ UND „WILL ICH LESEN“
Eine Liste gelesener Bücher mit Bewertungen und eine Liste für das, was als Nächstes kommt.

PRIVAT VON ANFANG AN
Keine Werbung, keine Analyse, kein Tracking. Ihre Bücher bleiben auf Ihrem Gerät; mit Konto liegen die Dateien zusätzlich in privatem Cloud-Speicher in der EU, damit Sie sie auf einem anderen Gerät öffnen können.
```
**Support URL:** `https://lampa-reader.github.io/de/support.html`  
**Marketing URL:** `https://lampa-reader.github.io/de/`  
**Screenshots:** `appstore/de/iphone-6.9/` и `appstore/de/ipad-13/`

## Español (España) — можно скопировать и в Español (México)

**Subtitle** (30/30)
```
Lector FB2 y EPUB sincronizado
```
**Promotional Text** (153/170)
```
Un lector tranquilo para tus propios libros. FB2, EPUB y TXT tal cual, tu página y tus notas en iPhone, iPad y ordenador, y 70.000 clásicos para empezar.
```
**Keywords** (100/100)
```
ebook,libros,leer,txt,novela,biblioteca,gutenberg,opds,calibre,diccionario,notas,modo noche,clásicos
```
**Description** (1866/4000)
```
Lampa es un lector tranquilo para los libros que ya tienes. Sin anuncios, sin cuenta obligatoria y sin una tienda que empuje a comprar: solo tu biblioteca y una página agradable de leer.

UN LIBRO EN TODOS TUS DISPOSITIVOS
Cierra el libro en el iPhone y sigue en la misma página en el iPad o el ordenador. Marcadores, subrayados, notas y listas te acompañan. Lampa está para iPhone, iPad, Mac, Windows y Linux. Para sincronizar hace falta una cuenta gratuita (Apple, Google o correo); sin ella, todo se queda en tu dispositivo.

FB2, EPUB Y TXT TAL CUAL
Abre libros desde Archivos, desde otras apps o una carpeta entera de una vez. Se conservan portadas, notas al pie y capítulos, y el FB2 dentro de ZIP también. Sin convertir nada.

CÓMODO PARA LA VISTA
• Cinco temas cuidados, del papel cálido al negro puro para leer de noche: día y noche con un toque
• Literata y cuatro fuentes más pensadas para leer mucho rato, con tamaño e interlineado
• Páginas con animación o un desplazamiento continuo
• Brillo dentro de la app, más bajo que el de la pantalla

SUBRAYADOS, NOTAS Y DICCIONARIO
• Subrayado en cuatro colores y notas en cualquier pasaje
• El significado de una palabra con un toque: el diccionario encuentra la forma base
• Traducción de una frase en el iPhone sin conexión
• Búsqueda en todo el libro, salto a cualquier página y vuelta

DE DÓNDE SACAR LIBROS
Project Gutenberg viene integrado: 70.000 clásicos de dominio público para explorar, buscar y descargar en la app. Conecta tu biblioteca Calibre o cualquier catálogo OPDS.

«LEÍDOS» Y «QUIERO LEER»
Una lista de libros leídos con tus valoraciones y otra con lo próximo que leerás.

PRIVADO DE SERIE
Sin anuncios, sin analítica y sin rastreo. Tus libros se quedan en tu dispositivo; con cuenta, los archivos también se guardan en un almacenamiento privado en la UE para abrirlos en otro dispositivo.
```
**Support URL:** `https://lampa-reader.github.io/es/support.html`  
**Marketing URL:** `https://lampa-reader.github.io/es/`  
**Screenshots:** `appstore/es/iphone-6.9/` и `appstore/es/ipad-13/`
