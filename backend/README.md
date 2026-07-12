# EkoSkopje — Backend & База (архитектура)

Овој фолдер ја содржи **заедничката PostgreSQL шема** и (наскоро) REST API-то за
EkoSkopje. Целта е **една база + еден backend** што ги опслужува сите клиенти.

## Целна архитектура

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Веб (React)  │   │  Android app  │   │    iOS app    │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └─────────── HTTPS / REST (JSON) ────────┘
                            │
                 ┌──────────▼──────────┐
                 │   Backend API       │   (еден код за сите клиенти)
                 │  auth · пријави ·   │
                 │  настани · сензори  │
                 └──────────┬──────────┘
                            │ SQL
                 ┌──────────▼──────────┐
                 │   PostgreSQL        │   (на Acton виртуелна машина)
                 │  + слики во BYTEA   │   (сите податоци во база)
                 └─────────────────────┘
```

- **Веб + Android + iOS** ја користат **истата** REST услуга и **истата** база.
  Мобилните апликации (React Native / Capacitor) само ги повикуваат истите
  ендпоинти како веб апликацијата.
- Backend-от се поврзува на PostgreSQL што работи на **Acton** околината на
  Град Скопје, зад заштитата на дата-центарот.

## База на податоци

| Датотека | Опис |
|---|---|
| `db/schema.sql` | Целосна шема (табели, ENUM типови, индекси, тригери, поглед) |
| `db/seed_reference.sql` | Почетни податоци: институции, типови контејнери, сензори |

### Иницијализација

```bash
createdb ekoskopje --encoding=UTF8      # UTF-8 е задолжително
psql -d ekoskopje -f db/schema.sql
psql -d ekoskopje -f db/seed_reference.sql
```

За постоечка база, примени ги миграциите по редослед:

```bash
psql -d ekoskopje -f db/migrations/001_reports_nearest_point.sql
psql -d ekoskopje -f db/migrations/002_perf_indexes.sql
psql -d ekoskopje -f db/migrations/003_reports_municipality.sql   # општина
psql -d ekoskopje -f db/migrations/004_device_tokens.sql          # push токени
psql -d ekoskopje -f db/migrations/005_users_points.sql           # поени кај корисник
psql -d ekoskopje -f db/migrations/006_photos_bytea.sql           # слики во база (BYTEA)
```

> **Кодирање:** базата мора да е **UTF-8** (стандардно за PostgreSQL) за
> правилно да се чуваат албанските знаци (ë, ç), кирилицата и латиницата.
> Бекендот дополнително поставува `client_encoding = UTF8` на секоја врска.

## Каде живеат корисничките податоци и сликите

| Податок | Табела | Колони |
|---|---|---|
| Профил, улога, преференци, тема, јазик, аватар | `users` | посебни колони по корисник |
| Пријави (миризба/депонија/контејнер) | `reports` | `reporter_id`, локација, опис, статус, институција |
| **Фотографии од пријава (макс. 6)** | `reports` | **`photo_1` … `photo_6`** (BYTEA — по една колона за секоја слика, во база) |
| Насочување до сектор + „препрати“ | `reports` | `institution_id`, `forwarded_institution_id` |
| Историја на статуси | `report_status_history` | аудит трага |
| Еко настани + пријави | `events`, `event_signups` | име/е-пошта/напомена на пријавени |
| Известувања | `notifications` | по корисник (или broadcast) |
| Поени / лидерборд | `points_events`, поглед `leaderboard_monthly` | |
| Сензори (кеш во живо) | `sensors` | референтни/нереферентни/град |

### Слики — важно

По барање на Град Скопје, сликите се чуваат **во самата PostgreSQL база како
`BYTEA` (бинарни податоци)** — колоните `photo_1 … photo_6` (и `avatar`,
`cover_photo`) ги содржат самите бајти на сликата, а не патека/URL. Така сите
податоци (вклучително сликите) остануваат во базата на Acton, без надворешен
диск/object storage.

- Прикачување: `POST /api/reports` како **multipart** (поле `photos`, макс. 6).
- Прикажување: `GET /api/reports/:id/photos/:n` — backend-от ја враќа сликата со
  авто-детекција на MIME (JPEG/PNG/WEBP) од првите бајти.
- Листата на пријави **не** ги пренесува бинарните слики (само знамиња дали
  постојат + URL-и), за да остане брза при голем број корисници.

> Ако сакате полесна база, вратете `BYTEA` → `TEXT` (патека/URL) и складирање на диск.

## Backend API (Node.js + Express)

Сликите се складираат како **BYTEA во база** и се сервираат преку endpoint
(`/api/reports/:id/photos/:n`).

### Стартување

```bash
cd backend
cp .env.example .env      # (Windows: Copy-Item .env.example .env)
npm install
npm run db:init           # креира шема + референтни податоци во PostgreSQL
npm run dev               # стартува API на http://localhost:4000
```

### Ендпоинти

| Метод | Патека | Опис |
|---|---|---|
| `GET`  | `/api/health` | Проверка на API + база |
| `POST` | `/api/auth/register` | Регистрација `{ email, password, displayName?, language? }` → 409 ако постои |
| `POST` | `/api/auth/login` | Најава `{ email, password }` (bcrypt) → 401 при погрешни податоци |
| `POST` | `/api/devices/token` | Зачувува FCM токен `{ token, email?, deviceId?, platform? }` |
| `DELETE`| `/api/devices/token` | Отповикување токен `{ token }` (при одјава) |
| `GET`  | `/api/reports` | Листа пријави (филтри `?type=&status=`) — без бинарни слики |
| `POST` | `/api/reports` | Нова пријава; multipart поле `photos` (макс. 6) → се складира во BYTEA. Прифаќа и JSON (без слики или base64) |
| `GET`  | `/api/reports/:id/photos/:n` | Сервира слика `n` (1..6) директно од база (BYTEA) |
| `PATCH`| `/api/reports/:id/status` | Промена на статус + аудит трага (**бара админ токен**) |
| `POST` | `/api/uploads` | (Опционо/legacy) multipart `files` → враќа `{ urls }`; не се користи за нови пријави |
| `GET`  | `/api/users?email=` | Профил на корисник + избран јазик (`language`) |
| `PATCH`| `/api/users/language` | Зачувува избран јазик `{ email, language }` (upsert по email) |
| `GET`  | `/api/events?email=` | Настани + дали корисникот е пријавен |
| `POST` | `/api/events` | Креира настан (организација) |
| `POST` | `/api/events/:id/signup` | Пријавување на настан `{ email, fullName, note }` |
| `DELETE`| `/api/events/:id/signup?email=` | Откажување пријава |
| `GET`  | `/api/notifications?email=` | Известувања (broadcast + лични) |
| `POST` | `/api/notifications` | Ново известување `{ title, body, email? }` |
| `PATCH`| `/api/notifications/:id/read` | Означи прочитано |
| `PATCH`| `/api/notifications/read-all` | Означи ги сите `{ email }` |
| `GET`  | `/api/leaderboard` | Месечен ранг (од погледот `leaderboard_monthly`) |
| static | `/uploads/*` | Сервирање на снимените слики |

Поените се доделуваат **серверски**: +1 при поднесена пријава и +4 кога ќе се
реши (само за регистрирани корисници; анонимните се водат локално по уред).

#### Регистрација / најава

Лозинките се хешираат со **bcrypt** и се чуваат во `users.password_hash`. Улогата
(`role`) се враќа при најава и се користи за рутирање (админ/организација/корисник).

Админ лозинка се поставува со:

```bash
ADMIN_PASSWORD=силна-лозинка npm run admin:password
```

#### Телефонски нотификации

- **Локални** (`@capacitor/local-notifications`) — работат веднаш на телефон при
  поднесена пријава и промена на статус, без надворешен сервер.
- **Push (FCM HTTP v1)** — стигнуваат и кога апликацијата е затворена. Токените
  се чуваат во табелата `device_tokens`. Ако клучот не е поставен, push е тивко
  исклучен (само локалните работат). Админ уреди не се регистрираат за push.

##### Како да го вклучиш push (Firebase)

1. Направи **Firebase проект** и додади Android апликација со package
   `mk.gov.skopje.ekoskopje` (Firebase Console → Add app → Android).
2. Симни го **`google-services.json`** и стави го во `android/app/google-services.json`.
   (Gradle-от веќе е подготвен: `android/build.gradle` го има google-services
   classpath, а `android/app/build.gradle` автоматски го применува приклучокот
   штом го најде фајлот. Ништо друго не се менува рачно — Capacitor приклучокот
   `@capacitor/push-notifications` сам ги внесува `FirebaseMessagingService` и
   `POST_NOTIFICATIONS` во манифестот.)
3. За **серверот**: Firebase Console → Project settings → **Service accounts** →
   *Generate new private key*. Постави го JSON-от во `FCM_SERVICE_ACCOUNT` (како
   патека до фајлот или inline JSON).
4. Rebuild: `npm run build && npx cap sync android`, па стартувај на телефон.

Тек: телефонот при старт добива FCM токен → `POST /api/devices/token` → кога
пријава ќе се реши, backend праќа push преку HTTP v1 до токените на пријавувачот.

Јазикот се чува во колоната `users.language` (`'mk' | 'en' | 'sq'`, со `CHECK` ограничување).
Frontend-от го синхронизира при најава и при промена во Поставки, со фолбек на `localStorage` кога API-то е офлајн.

#### Заштита на админ операциите

Промената на статус (`PATCH /api/reports/:id/status`) е заштитена со middleware што
бара заглавие `X-Admin-Token` еднакво на `ADMIN_TOKEN` од `.env`.

- Ако `ADMIN_TOKEN` **не е поставен** → заштитата е исклучена (локален развој).
- Ако е поставен → frontend-от мора да го испрати истиот токен преку `VITE_ADMIN_TOKEN`.

> Ова е привремена мерка пред вистинска најава (JWT/SSO). Бидејќи `VITE_`
> вредностите се вградуваат во клиентскиот bundle, во продукција заштитата
> треба да се префрли на автентикација со сесија/JWT за најавениот админ.

### Тек на прикачување слики (како работи storage-от)

```
1. Клиентот слика фото (камера) → компресира →
2. POST /api/reports како multipart (полиња + `photos` фајлови) во ЕДНО барање
3. Backend ги чита бинарните слики и ги запишува во photo_1..photo_6 (BYTEA, во база)
4. Прегледот ги вчитува преку GET /api/reports/:id/photos/:n
   (MIME се детектира од првите бајти; листата не праќа бинарни слики)
```

Сите слики живеат во PostgreSQL базата на Acton (BYTEA), па нема потреба од
надворешен диск/storage. `PUBLIC_BASE_URL` треба да е јавната адреса на API-то
(за да се формираат точни URL-и до сликите).

### 🔒 Безбедност (најдобри практики)

Вградено во кодот (без да го расипе искуството):
- **Параметризирани SQL прашања** секаде (`$1, $2, ...`) → нема SQL инјекција.
- **bcrypt** за лозинки (никогаш plaintext); логин враќа иста грешка за
  погрешна е-пошта/лозинка (не открива што е погрешно).
- **Rate-limit** на `/api/auth` (заштита од brute-force; лимитот е висок за да
  не пречи на нормални корисници).
- **Безбедносни заглавја** (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) и скриено `X-Powered-By`.
- **CORS** ограничен на дозволени origins (веб + Capacitor).
- **Лимит на големина** на JSON тело (1MB) и на прикачени слики (multer).
- Централизиран error-handler што **не открива stack trace**.

Препораки при деплој на Acton (надвор од кодот):
- Посебен **DB корисник со минимални привилегии** (само на потребните табели).
- Врска до Postgres со **SSL** (`sslmode=require`) и `.env` **надвор од git**.
- Силен `ADMIN_TOKEN`; во продукција премини на **JWT/SSO** за админ.
- Редовни **бекапи** на базата.

### Следни чекори (сè уште не се имплементирани)

- Замена на `ADMIN_TOKEN`/`VITE_ADMIN_TOKEN` со вистински JWT/SSO за најавениот админ
- Кеширање на сензорите во табелата `sensors` (сега се читаат во живо од WAQI во клиентот)
