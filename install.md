# REZSI FLOW — INSTALL.md / Teljes fejlesztési terv

> Verzió: 1.0 | Dátum: 2026-11-19 | Nyelv: magyar | Pénznem: HUF
> Állapot: implementációs terv, nem kész alkalmazás.
> Cél: modern, reszponzív, biztonságos rezsi- és albérlet-elszámoló rendszer, 2022. szeptemberétől visszamenőleges statisztikákkal.

## 0. Projektcél és kötött követelmények

A jelenlegi Excel-alapú havi folyamatot kell kiváltani: mérőóraállások rögzítése → fogyasztáskülönbségek → különböző tarifák és fix díjak → rezsi → lakbér → személyenkénti fizetendő. Az alkalmazás ne egy Excel-klón legyen: elsődlegesen kártyás dashboard, vizuális elemzés és rövid, hibabiztos adatbeviteli folyamat készüljön. A részletes, Excel-szerű elszámolási táblázat megmaradjon ellenőrzéshez.

**Kezdő adatidőszak:** 2022-09 — 2026-11 (a folyamatban lévő hónap külön megjelölésével). Később korlát nélkül bővíthető.

**MVP:** egy ingatlan, alapértelmezés szerint két lakó; a modell legyen több ingatlanra és tetszőleges számú lakóra bővíthető.

**Kötelező funkciók:**
- Havi mérőállások felvétele, javítása, mentése és véglegesítése.
- Víz, villany, T1 és gáz kezelése; több mérő, tarifaszabály és sáv támogatása.
- Egyszeri és ismétlődő díjak: alapdíj, közös költség, építményadó, lakbér, internet, egyéb.
- Költségek személyenkénti megosztása (50/50, százalék, fix összeg, kizárólagos tétel).
- Dashboard, havi és éves statisztika, összehasonlítás, teljes időszak.
- Történeti Excel/CSV import előnézettel és eltérés-ellenőrzéssel.
- PDF/Excel/CSV export, biztonsági mentés, beállítások.
- Asztali, tablet és mobilképernyőn használható, magyar nyelvű felület.

## 1. Technológiai döntések

| Réteg | Technológia | Szerep |
|---|---|---|
| Frontend | Angular 22, TypeScript, standalone components | Webalkalmazás |
| UI | Tailwind CSS 4, saját komponensek, Angular CDK | Reszponzív dashboard |
| Űrlap | Angular Reactive Forms + Signals | Validált adatbevitel és állapot |
| Diagram | Apache ECharts (`echarts`) | Vonal-, oszlop-, donut-, heatmap-grafikon |
| Ikonok | Lucide (Angular-kompatibilis csomag vagy SVG) | Egységes ikonrendszer |
| Backend | NestJS | REST API, elszámolási szabályok |
| Adatbázis | MySQL 8.4 LTS + TypeORM | Tartós, relációs adattárolás |
| Fejlesztői DB | Docker Compose | Helyi MySQL |
| Import | `exceljs` + CSV parser | Régi munkafüzetek és táblázatok |
| Teszt | Angular tesztfuttató, Jest/Nest, Playwright | Unit, integration, E2E |
| Élesítés | Statikus Angular build + HTTPS reverse proxy + NestJS + MySQL | Privát webes elérés |

**Elvek:** Angular standalone és lazy routes; `ChangeDetectionStrategy.OnPush`; szigorú TypeScript; megosztható UI-elemek; számítási logika a szerveren, kliensoldali azonnali előnézettel; pénzügyi értékekhez decimális vagy egész-filléres számolás, nem lebegőpontos összeadás; verziózott díjszabások. SSR nem szükséges egy bejelentkezés mögötti privát dashboardhoz.

## 2. Előkészületek és telepítés — Windows / PowerShell

### 2.1. Követelmények

1. Node.js 22.22.3+ (vagy az Angular 22-vel kompatibilis frissebb támogatott LTS).
2. npm, Git, VS Code, Docker Desktop (a helyi MySQL-hez).
3. Legalább két terminál a frontend és backend futtatásához.
4. A telepítés után ellenőrzés:

```powershell
node -v
npm -v
git --version
docker --version
docker compose version
```

### 2.2. Monorepo gyökér létrehozása

```powershell
mkdir rezsiflow
cd rezsiflow
git init
```

### 2.3. Angular frontend létrehozása

```powershell
npx @angular/cli@22 new web --routing --style=css --standalone --ssr=false --skip-git --package-manager=npm --defaults
cd web
npm install -D tailwindcss @tailwindcss/postcss postcss
npm install echarts @angular/cdk
```

A `web/.postcssrc.json` fájl:

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

A `web/src/styles.css` elejére:

```css
@import "tailwindcss";

@theme {
  --color-brand-500: #2563eb;
  --color-accent-500: #06b6d4;
  --color-success-500: #16a34a;
  --color-warning-500: #f59e0b;
  --color-danger-500: #dc2626;
  --color-surface: #f5f7fb;
  --color-ink: #0f172a;
}
```

**Fontos:** Tailwind v4-hez nem szükséges alapértelmezett `tailwind.config.js` vagy `@tailwind base/components/utilities`; a PostCSS-plugin és az `@import "tailwindcss"` legyen az integráció alapja. `--force` telepítést ne használjunk reflexből; verzióütközés esetén a peer dependency-ket kell összehangolni.

Frontend indítása és ellenőrzése:

```powershell
npm start
# http://localhost:4200
```

### 2.4. NestJS backend létrehozása

Új terminálban a `rezsiflow/` gyökérből:

```powershell
npx @nestjs/cli new api --package-manager npm --skip-git
cd api
npm install @nestjs/config @nestjs/typeorm typeorm mysql2 class-validator class-transformer
npm install @nestjs/jwt argon2 helmet cookie-parser exceljs
npm install -D @types/cookie-parser
```

A backendben konfigurálandó: globális `/api/v1` prefix; DTO-validáció `ValidationPipe`-pal (`whitelist`, `forbidNonWhitelisted`, `transform`); `helmet`; környezeti változók validálása; CORS csak engedélyezett originre; saját hitelesítési guard; egységes hibaválasz; strukturált naplózás.

### 2.5. Lokális MySQL Docker Compose

A gyökérbe `compose.yaml`:

```yaml
services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    ports:
      - "127.0.0.1:3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -u root -p$$MYSQL_ROOT_PASSWORD"]
      interval: 10s
      timeout: 5s
      retries: 10
volumes:
  mysql_data:
```

Gyökér `.env` (csak saját gépen, ne Gitben):

```dotenv
DB_NAME=rezsiflow
DB_USER=rezsiflow_app
DB_PASSWORD=EROS_HELYI_JELSZO
DB_ROOT_PASSWORD=MASIK_EROS_HELYI_JELSZO
```

```powershell
# A rezsiflow gyökérmappából:
docker compose up -d
```

Az `api/.env` külön tartalmazza az API beállításait. A NestJS helyi eléréshez `DB_HOST=127.0.0.1`, `DB_PORT=3307`; `PORT=3000`, `FRONTEND_ORIGIN=http://localhost:4200`, valamint az autentikáció titkai. Mindkét `.env` legyen `.gitignore`-ban, és készüljenek `.env.example` sablonok titkok nélkül. A TypeORM `synchronize` értéke mindig `false`, adatbázis-módosítás kizárólag verziózott migrációval történjen.

### 2.6. Fejlesztői proxy

A `web/proxy.conf.json` fájl:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

A `web/angular.json` fájlban a `serve.options.proxyConfig` mutasson a `proxy.conf.json` fájlra, vagy az alábbi paranccsal indítsuk:

```powershell
# web/ mappából
npx ng serve --proxy-config proxy.conf.json
```

A frontend relatív `/api/v1/...` végpontokat hívjon, ne beégetett hostneveket.

## 3. Vizuális design — prémium, nem Excel-hatású

**Design irány:** modern personal-finance dashboard. Világos, szinte fehér munkaterület; mély tengerészkék oldalsáv; kék/cián akcentusok; visszafogott zöld, narancs, piros státuszok; 12–16 px lekerekítések; finom border és shadow; jó kontraszt, sok whitespace. Később sötét téma. Fontosabb a számok olvashatósága, mint a dekoráció.

**Fő layout desktopon (>=1280 px):**
- Bal oldalt fix, összecsukható navigáció: Dashboard, Havi rögzítés, Előzmények, Statisztikák, Lakók, Díjszabások, Import/Export, Beállítások.
- Felső sáv: oldal címe, ingatlan, év/hónap választó, előző/következő hónap nyilak, aktuális időszak státusza, profil.
- Tartalom: 12 oszlopos rács, maximum 1600 px szélesség, 24–32 px körüli fő rések.
- KPI kártyák 4 oszlopban, nagy pénzösszegek, változásjelzők és apró sparkline trendek.
- Nagy grafikonok kétoszlopos felosztásban; a részletes tételek egy külön, szellős táblázatban.

**Tablet:** a sidebar összehúzható, KPI kártyák 2 oszlopban, grafikonok teljes szélességen. **Mobil:** drawer navigáció, 1–2 oszlopos kártyák, adatbeviteli sorok egymás alatti mezőkkel, táblázatoknál vízszintes görgetés vagy részletkártyák.

**Interakciók:** skeleton loading, üres állapot, inline hibaüzenet, nem tolakodó toast, billentyűzettel navigálható űrlapok, Enter/Tab rögzítés, látható fókuszállapot, állapotjelzések ne csak színnel, hanem szöveggel is.

## 4. Oldalak és részletes funkcionális specifikáció

### 4.1. Dashboard — `/dashboard`

Felső KPI-k a kiválasztott hónapra:
1. **Összesen fizetendő** (rezsi + lakbér + közösen terhelt egyéb tételek).
2. **Rezsi összesen** (lakbér nélkül).
3. **Lakbér** (a teljes ingatlanra).
4. **Személyenként fizetendő** (ha eltérő, külön mini-kártyákkal).
5. **Előző hónaphoz viszonyított változás** Ft-ban és %-ban.
6. **Rögzítési státusz**: hiányos, tervezet, végleges.

Alatta:
- 12 havi költségtrend: halmozott oszlopok (lakbér / rezsi / egyéb), kapcsolható vonaldiagram.
- Donut chart: aktuális hónap költségmegoszlása.
- Víz, villany, gáz kicsi trendkártyák saját mértékegységgel.
- Lakó 1 / Lakó 2 elszámolása, felhasználónként eltérő internet- vagy egyéb díjakkal.
- Közelmúlt: utolsó 6 hónap, státusz, különbség, egykattintásos megnyitás.
- Figyelmeztetések: hiányzó leolvasás, szokatlan fogyasztás, eltérés az importált összegekhez képest.

**Kiemelési szabály:** költségnövekedés piros/narancs, csökkenés zöld csak akkor, ha valóban kedvező; az értékváltozás mértéke mindig szövegesen is látszódjon. A részleges hónapokat ne hasonlítsuk kész hónaphoz figyelmeztetés nélkül.

### 4.2. Havi rögzítés — `/entries/:year/:month`

Fent hónapnavigátor + „Előző havi értékek betöltése” + „Mentés” + „Véglegesítés”.

**Mérőóra kártyák:**
- Víz: előző állás, jelenlegi állás, dátum, különbözet (m³), egységár, összeg.
- Villany főmérő: előző/jelenlegi kWh; kedvezményes sáv és magasabb díjsáv, ha a konfiguráció előírja.
- Villany T1 15.8.1: külön mérő/mérési sor, kapcsolódó tarifa és elszámolási szerep.
- Gáz: előző/jelenlegi m³, alapdíj, konfigurált díjsávok.
- Mérőnként „Megjegyzés” és „Kézzel ellenőrzött” jelző.

**Fix és egyéb díjak:** villanyalapdíj, gázalapdíj, közös költség, építményadó, albérleti díj, internet, egyszeri költségek. Minden díjhoz összeg, érvényesség és megosztási szabály.

**Oldalt vagy alul ragadós összegző panel:** rezsi, lakbér, egyéb, teljes fizetendő, személyenként. Változás azonnal látszik, de a szerver mentéskor újraszámolja.

**Mentési életciklus:** draft → validált → végleges. Draftnál automatikus mentés rövid késleltetéssel és látható mentési állapottal; véglegesítést explicit gomb és megerősítés indítja. Végleges hónap módosítása csak „Újranyitás” indokkal és auditnaplóval. Új hónap alapértékei az adott mérő **legutolsó korábbi érvényes** állásából jönnek; a korábbi díjak nem íródnak át automatikusan.

### 4.3. Előzmények — `/history`

Év- és hónapszűrő (2022-09-től), keresés, státusz. Táblázat:
- Hónap | Rezsi | Lakbér | Egyéb | Teljes összeg | Lakónként | Változás | Státusz.
- Sorra kattintva részletes elszámolás, tényleges állások és díjtételek.
- Összehasonlítás két kijelölt hónap között, export, auditnyom.
- Paginálás opcionális; ~51 hónapnál a teljes adatlista is gyors.

### 4.4. Statisztikák — `/analytics`

Három szintű választó: **Hónap / Év / Teljes időszak**; külön dátumtartomány-szűrő.

- Éves rezsi- és összköltség (2022 részév és 2026 folyamatban külön jelölve).
- 12 hónap összevetése kiválasztott évek között.
- Víz m³, villany kWh, gáz m³ egymástól független diagramokon; ne adjuk össze különböző mértékegységek adatait.
- Havi költségmegoszlás kategória szerint.
- Hőtérkép: év × hónap, a havi rezsi alapján; hiányzó hónap legyen „nincs adat”, ne 0 Ft.
- Legdrágább / legolcsóbb hónap, átlag, medián, minimum, maximum.
- Előző hónap és előző év azonos hónapja szerinti összevetés.
- Költségváltozás felbontása: fogyasztás okozta változás vs egységár/fix díj változás (csak egyértelműen összevethető adatoknál).
- Lakónkénti fizetendő alakulása.
- Választható inflációval korrigált nézet **csak később**, hiteles külső árindex és megnevezett forrás esetén.
- Opcionális egyszerű 3 havi mozgóátlag / becslés; világosan „becslés” címkével.

### 4.5. Lakók — `/residents`

Lakók létrehozása/szerkesztése, beköltözés/kiköltözés dátuma, alap megosztási arány. Lakónként elszámolási lap. Példa: 110 000 Ft lakbér + 67 014 Ft rezsi → két főre 88 507 Ft/fő; ha az egyik félhez további 4 400 Ft internet tartozik, az ő fizetendője 92 907 Ft. A plusz internet **ne emelje meg automatikusan a másik fél részét**. A rendszer számoljon tételszinten, ne csupán felezze a végösszeget.

### 4.6. Díjszabások — `/tariffs`

Tarifák szerkesztése érvényességi idővel: víz Ft/m³, villany díjsávok Ft/kWh, T1, gáz Ft/m³, havi alapdíjak, lakbér, közös költség, adó. Külön tarifa-verziók `effective_from` / `effective_to` dátummal. A régi hónapok eredményei maradjanak változatlanok, kivéve ha a felhasználó kifejezetten újraszámolja őket (előnézet, jóváhagyás, audit).

### 4.7. Import/Export — `/data`

XLSX/CSV történeti import; import-előnézet, oszlopkiosztás, figyelmeztetések, próbaszámítás, ellenőrzött végleges import. Letölthető havi PDF elszámolás, időszakos CSV/Excel, teljes JSON adatarchívum. Importáláskor a jobb oldalon külön szereplő „Személyenként” és „Internet” táblázatokat is kezelni kell.

### 4.8. Beállítások — `/settings`

Ingatlan neve, alapértelmezett pénznem HUF, magyar számformátum, havi leolvasás napja, megosztási alapértékek, megjelenési téma, backup/import alapbeállítások, profil és jelszóváltoztatás.

## 5. Információarchitektúra és Angular mappaszerkezet

```text
rezsiflow/
├── install.md
├── compose.yaml
├── .env.example
├── web/
│   ├── .postcssrc.json
│   ├── proxy.conf.json
│   └── src/app/
│       ├── core/
│       │   ├── auth/
│       │   ├── api/
│       │   ├── guards/
│       │   ├── interceptors/
│       │   └── layout/
│       ├── shared/
│       │   ├── ui/               # card, button, dialog, toast, table
│       │   ├── charts/           # chart-wrapper, trend, donut, heatmap
│       │   ├── pipes/            # HUF, fogyasztás, hónap
│       │   └── utils/
│       ├── features/
│       │   ├── dashboard/
│       │   ├── monthly-entry/
│       │   ├── history/
│       │   ├── analytics/
│       │   ├── residents/
│       │   ├── tariffs/
│       │   ├── data-import-export/
│       │   └── settings/
│       ├── app.routes.ts
│       └── app.config.ts
└── api/
    ├── src/
    │   ├── common/             # guards, errors, filters, validation
    │   ├── config/
    │   ├── database/migrations/
    │   └── modules/
    │       ├── auth/
    │       ├── properties/
    │       ├── residents/
    │       ├── meters/
    │       ├── readings/
    │       ├── tariffs/
    │       ├── billing/
    │       ├── analytics/
    │       ├── imports/
    │       └── exports/
    └── test/
```

**Angular shared komponensek:** `AppShell`, `Sidebar`, `Topbar`, `MonthPicker`, `YearPicker`, `PeriodSwitcher`, `KpiCard`, `TrendBadge`, `ChartCard`, `ReadingCard`, `MoneyInput`, `UnitInput`, `CostBreakdown`, `SplitSummary`, `MonthlyItemsTable`, `DataState`, `ConfirmDialog`, `StatusChip`, `ToastContainer`, `ImportPreviewTable`.

**Állapotkezelés:** route-hoz kötött Signals + szolgáltatások; a globális állapot legyen minimális (bejelentkezett felhasználó, aktuális ingatlan, időszak). NgRx nem kötelező az első verzióhoz. Nagy chart könyvtár és admin feature lazy loadinggal töltődjön.

## 6. Adatmodell — MySQL migrációkkal

| Tábla | Fő mezők | Kötöttség / cél |
|---|---|---|
| `users` | id, email, password_hash, role | Privát belépés; jelszó csak hash-ként |
| `properties` | id, name, timezone, currency | Lakás / ingatlan |
| `residents` | id, property_id, name, active_from, active_to | Lakók és időbeli tagság |
| `meters` | id, property_id, code, label, type, unit, billing_role | Víz/villany/T1/gáz; számlázott vagy tájékoztató |
| `meter_readings` | id, meter_id, period_id, reading_date, previous_value, current_value, consumption | Havi állások és különbözet |
| `billing_periods` | id, property_id, year, month, status, version, finalized_at | Egy havi elszámolás |
| `tariff_versions` | id, property_id, category, valid_from, valid_to, rules_json | Időben változó díjszabási szabály |
| `recurring_charges` | id, property_id, code, amount, valid_from, valid_to, allocation_rule | Fix díjak időbeli verziózása |
| `billing_items` | id, period_id, source_type, source_id, category, label, quantity, unit_price, amount, origin | Egyes elszámolási tételek és ár-snapshot |
| `resident_allocations` | id, billing_item_id, resident_id, amount, rule_snapshot | A tétel lakónkénti része |
| `adjustments` | id, period_id, label, amount, allocation_rule | Egyszeri jóváírások/terhek |
| `import_batches` | id, source_filename, imported_at, status, mapping_json | Importálási esemény |
| `import_rows` | id, batch_id, period_id, row_ref, original_json, parsed_json, warnings_json | Auditálható forrásrekordok |
| `audit_logs` | id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at | Visszakövethetőség |

**Kötelező adatbázis-szabályok:**
- `UNIQUE(property_id, year, month)` a havi perióduson.
- `UNIQUE(meter_id, period_id)` a havi mérőálláson (több leolvasás/hónap később külön raw-readings modellben).
- `DECIMAL` mezők mérőállásra, mennyiségre, árra; a pénzügyi végösszeg konzisztensen kerekített HUF, a kerekítés módja konfigurált és tesztelt.
- Minden összegnél jelölni kell: számolt, kézzel korrigált vagy importált (`origin`).
- Végleges elszámolás tárolja a tarifa és megosztási szabály snapshotját, ne függjön a később szerkesztett beállításoktól.
- Idegen kulcsok és indexek `property_id`, `period_id`, `meter_id`, `resident_id` mezőkre.
- Migrációkhoz TypeORM DataSource és `migration:generate` / `migration:run` npm-scriptek kialakítása; `synchronize: false`.

## 7. Elszámolási üzleti szabályok (kritikus)

### 7.1. Mérőállás

`fogyasztás = jelenlegi - előző`, azonos mérő és mértékegység mellett. Előző állás automatikus átvétele a legutolsó valid, korábbi leolvasásból. Negatív fogyasztás alapértelmezésben blokkolt; mérőcsere/óraátfordulás külön eseménnyel kezelhető. Ha nincs előző adat, kézi nyitóállást kér a rendszer.

### 7.2. Tarifák

- **Egyszerű tarifa:** `fogyasztás × egységár`.
- **Kedvezményes és emelt sáv:** a konfigurált szabály szerinti fogyasztásfelosztás × az adott sáv tarifája. A képernyőn szereplő „210 kWh” és „144 m³” **nem tekinthető automatikusan minden időszakra érvényes jogszabályi limitnek**: legyen külön szerkeszthető, dátumfüggő szabály, és lehessen az Excelből ténylegesen elszámolt sávokat rögzíteni.
- **Fix díj:** havi tétel, mennyiségi mérőállástól függetlenül.
- **T1 mérő:** konfigurálható „számlázott külön mérő” vagy „főmérő része / csak információ”. Tilos kétszer felszámolni ugyanazt a kWh-t.
- **Korrekció:** bármely historikus hónapnál külön sor, indok és előzetes/jóváhagyott összeg.

### 7.3. Havi összesítés

`rezsi = víz + villany + gáz + alapdíjak + közös költség + építményadó + egyéb rezsitételek`

`közös teljes fizetendő = rezsi + lakbér + közös egyéb költségek`

`lakónkénti fizetendő = az adott lakóra allokált összes tétel`

A személyre szabott, csak egy lakót terhelő internet vagy egyéb tétel **külön allokáció**, nem automatikusan része a közös költségeknek. Ellenőrzés: minden tételnél az összes lakói részesedés összege egyezzen a tétel végösszegével. Páratlan forintok felosztása determinisztikus szabállyal történjen (pl. a kijelölt első lakó kapja a maradék 1 Ft-ot).

### 7.4. Kerekítés, ellenőrzés, importálás

**A kapott minta nem feltétlenül következetes:** például `373 kWh × 70 Ft = 26 110 Ft`, míg az Excelben `26 147 Ft` szerepel. A látható sorösszegek összege 67 013 Ft, a fejlécben 67 014 Ft van. Ezért:
- Az eredeti cellaérték **soha nem vesszen el**.
- Tároljunk `original_amount`, `calculated_amount`, `difference` mezőket vagy auditált megfelelőjüket.
- A különbséget mutassa egy „Eltérés az eredeti Excelhez képest” figyelmeztetés.
- Az importáló ne javítsa automatikusan a korábbi számlákat; lehessen elfogadni az eredeti összeget vagy jóváhagyni az újraszámítást.
- Minden utólagos korrekcióhoz indok és auditnapló tartozzon.

## 8. REST API-terv (`/api/v1`)

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me
GET    /properties
GET    /properties/:id/residents
POST   /properties/:id/residents
PATCH  /residents/:id
GET    /properties/:id/meters
POST   /properties/:id/meters
GET    /properties/:id/periods?year=2026
POST   /properties/:id/periods
GET    /periods/:id
PUT    /periods/:id/readings
PUT    /periods/:id/items
POST   /periods/:id/preview       # mentés nélküli szerveroldali elszámolás
POST   /periods/:id/finalize
POST   /periods/:id/reopen         # indok kötelező
GET    /periods/:id/allocations
GET    /properties/:id/tariffs
POST   /properties/:id/tariffs
GET    /analytics/overview?propertyId=...&from=2022-09&to=2026-11
GET    /analytics/consumption?propertyId=...&meterType=...
GET    /analytics/yearly?propertyId=...
POST   /imports/preview
POST   /imports/commit
GET    /exports/monthly/:periodId.pdf
GET    /exports/periods.csv?from=...&to=...
GET    /exports/periods.xlsx?from=...&to=...
GET    /exports/backup.json
```

**API-szabályok:** autentikáció minden privát végponton; azonos ingatlanhoz való hozzáférés ellenőrzése szerveroldalon; `PUT`-ok idempotensek; szerkesztéshez verziószám / optimistic locking; véglegesítés tranzakcióban; stabil validációs hibaformátum; listáknál lapozás; OpenAPI leírás opcionálisan `/api/docs` fejlesztői környezetben.

## 9. Régi Excel-adatok betöltése (2022.09 → jelen)

1. Összegyűjteni minden eredeti munkafüzetet, munkalapot és hónapot, valamint a hónapok tényleges dátumát.
2. Beolvasni a munkalapok neveit és tartalmát (`exceljs`); az import nem futtathat makrót.
3. A minta alapján oszlop-hozzárendelés: **Tétel | Alap | Jelenlegi | Különbözet | Egységár | Ár**, továbbá a jobb oldali személyenkénti / internet mezők.
4. Fejléc- és sornév-normalizálás: `m3`, `m³`, `Kwh`, `kWh`, magyar szóközös ezres tagolás, vesszős tizedes, „Ft” eltávolítása csak parse-oláskor.
5. Hónap felismerése a sheet nevéből, fájlnévből vagy felhasználói hozzárendeléssel. Ne találgassunk hónapot, ha nem egyértelmű.
6. Mérők és díjtételek kategorizálása; ismeretlen sorok „kézi hozzárendelésre vár” státuszba kerüljenek.
7. `preview` nézet: eredeti érték, értelmezett érték, újraszámolt összeg, eltérés, hiányzó mezők, duplikált hónapok.
8. „Csak hibátlan sorok” vagy javítás utáni teljes import; a mentés tranzakciós és megismételhető, duplikált időszakot nem ír felül csendben.
9. Beimportált hónapok ellenőrzése: rezsi, lakbér, végösszeg, lakónkénti összeg, mérőállások, sávok.
10. Importösszefoglaló és visszaállítási lehetőség import batch szinten, amíg a rekordokat nem véglegesítették / függetlenül nem módosították.

**Különbség a 0 és a hiányzó adat között:** null = nem áll rendelkezésre; 0 = mért/elszámolt nulla. Az éves grafikonok ezt szigorúan külön kezeljék. A 2022-es év részévként, a folyó év hiányzó/félkész hónapokkal jelenjen meg.

## 10. Statisztikai számítások és vizualizációk

**Közös backend aggregátumok:** `month_total`, `utility_total`, `rent_total`, `resident_total`, `consumption_by_meter`, `category_breakdown`, `year_total`, `month_over_month`, `year_over_year`, `rolling_average`, `completeness`.

**Grafikonok:**
- **Area/line:** teljes havi rezsi (2022.09-től), tooltip és zoom.
- **Stacked bars:** rezsi + lakbér + közös egyéb havi bontásban.
- **Donut:** aktuális hónap számlatípusok szerinti arányai.
- **Grouped bars:** azonos hónap összevetése több év között.
- **Heatmap:** 2022–2026, év × hónap, színskála és legenda.
- **Sparklines:** KPI kártyák utolsó 6–12 időszaka.
- **Lakói bontás:** két vagy több személy fizetendője havonta.

**Adatértelmezés:** Minden grafikonon egyértelmű mértékegység, Ft magyar formátumban, hiányzó és tervezett adatok jelölése. Összehasonlításban azonos típusú, lehetőleg lezárt hónapokat használjunk. Éves átlag számításakor jelezni kell, hány elszámolt hónapot vettünk figyelembe.

## 11. Implementációs fázisok — végrehajtandó checklist

### Fázis A — alapok és design system
- [ ] Git repository, frontend/backend/DB indul.
- [ ] Tailwind v4 működik, globális tématokenek.
- [ ] Alkalmazás-shell, sidebar, topbar, routing, auth guard.
- [ ] Kártya, gomb, input, modal, táblázat, tooltip, toast, skeleton komponensek.
- [ ] 360 px, 768 px, 1280 px, 1920 px reszponzív teszt.
**Kész, ha:** az összes oldal skeletonja navigálható, nincs vízszintes overflow a teljes layouton.

### Fázis B — backend + adatbázis + hitelesítés
- [ ] Env validáció, TypeORM config és migrációk.
- [ ] Property, resident, meter, billing period, charge, tariff entitások.
- [ ] Első admin felhasználó biztonságos bootstrap parancsból (ne legyen hardcoded jelszó).
- [ ] Bejelentkezés, kijelentkezés, auth guard, jogosultságvizsgálat.
- [ ] Health endpoint, hibakezelés, API DTO validáció.
**Kész, ha:** a migrációk tiszta DB-re futnak és a bejelentkezett kliens olvassa a saját ingatlanát.

### Fázis C — elszámolómotor
- [ ] Mértékegységek, mérőállás-különbségek.
- [ ] Tarifaverzió és sávos elszámolás paraméterezhető szabályokból.
- [ ] Fix, egyedi és korrekciós tételek.
- [ ] Lakónkénti tételszintű felosztás, maradék forint szabály.
- [ ] Preview/finalize/reopen tranzakciók és audit.
- [ ] Golden testek ismert mintaértékekkel, kerekítési esetekkel.
**Kész, ha:** ugyanabból a bemenetből determinisztikusan ugyanaz a havi fizetendő készül, a felosztások összege egyezik a tételek összegével.

### Fázis D — havi rögzítés és előzmények
- [ ] Havi szerkesztő oldal, alapállás automatikus betöltése.
- [ ] Azonnali kliensoldali kalkuláció és szerveroldali preview egyeztetés.
- [ ] Mentési státusz és hiba-visszaállítás.
- [ ] Havi lezárás, újranyitás indokkal.
- [ ] Előzménylista, hónap részletei, szűrés és összehasonlítás.
**Kész, ha:** egy teljes havi folyamat végigvihető adatvesztés és hibás duplázás nélkül.

### Fázis E — történeti import
- [ ] Excel és CSV parser, magyar számformátumok.
- [ ] Forrásfájl/munkalap/hónap hozzárendelés.
- [ ] Eltérés- és duplikációfigyelő import preview.
- [ ] Jobb oldali személyenkénti és internet adatok értelmezése.
- [ ] Import batch mentés, összegzés és kontrollált visszavonás.
**Kész, ha:** a 2022.09-től származó összes elérhető hónap importálható, és minden eltérés listázott / feloldott.

### Fázis F — dashboard és elemzések
- [ ] KPI-k, trendek, donut, stacked bar, fogyasztási chartok.
- [ ] Hónap/év/teljes időszak választás.
- [ ] Éves összehasonlítás, heatmap, extrém hónapok, átlagok.
- [ ] Lakónkénti költségtrend és anomáliafigyelés.
- [ ] Üres/részleges év helyes megjelenítése.
**Kész, ha:** bármely év és hónap megnyitható, a grafikonok összege egyezik a részletes elszámolásokkal.

### Fázis G — export, beállítás, biztonság és élesítés
- [ ] Lakók / megosztás / tarifák beállítófelülete.
- [ ] PDF/CSV/XLSX export és JSON backup.
- [ ] Naplózás, jogosultsági és inputbiztonsági tesztek.
- [ ] Backend unit/integration + frontend unit + Playwright E2E.
- [ ] Production build, HTTPS, DB backup, restore próba.
- [ ] Élesítési és helyreállítási dokumentáció.
**Kész, ha:** a teljes rendszer használható, reprodukálhatóan telepíthető és adatvesztés esetén visszaállítható.

## 12. Tesztelési forgatókönyvek (minimum)

1. Víz 483 → 493 m³, 752 Ft/m³ → 10 m³, **7 520 Ft**.
2. Villany 20 200 → 20 783 kWh → **583 kWh** összfogyasztás; a 210/373 felosztás csak megadott elszámolási szabállyal érvényes.
3. 210 kWh × 36 Ft = **7 560 Ft**.
4. 373 kWh × 70 Ft = **26 110 Ft**; Excel minta 26 147 Ft → importeltérés, **nem csendes felülírás**.
5. T1 9 650 → 10 067 kWh → **417 kWh**; 417 × 23,54 = 9 816,18 Ft, kerekítési szabály ellenőrzése.
6. Két lakó: 177 014 Ft közös teljes összeg → **88 507 Ft/fő**; csak egyik lakónál +4 400 Ft internet → **92 907 Ft / 88 507 Ft**.
7. Két külön mérő ne legyen véletlenül duplán számlázva.
8. 2022 szeptember előtt nincs adat, hiányzó hónap nem 0 Ft.
9. Régi tarifát később módosítunk → korábban véglegesített hónap nem változhat automatikusan.
10. Duplikált Excel import → figyelmeztetés, nem jön létre újabb havi rekord.
11. Végleges hónap írása API-n keresztül → tiltás újranyitás nélkül.
12. Két gyors egymás utáni mentés → nincs elveszett frissítés (verzióütközés kezelése).
13. Nem bejelentkezett kérés / más ingatlan adatai → 401/403.
14. HUF formátum: `67 014 Ft`; mértékegységek és vesszős tizedesek megmaradnak.
15. Importált részösszegek és összesen közötti 1 Ft eltérés látható figyelmeztetésként.

**E2E user journey:** bejelentkezés → hónap kiválasztása → új óraállások → fix díjak → személyenkénti bontás → mentés → véglegesítés → dashboard → történeti összehasonlítás → PDF-export.

## 13. Biztonság, adatvédelem, backup

- HTTPS kötelező az éles rendszeren.
- Jelszó `argon2` hash; session / token HttpOnly + Secure + SameSite cookie-val, a változtató kéréseken CSRF- vagy originvédelemmel.
- Ne tároljunk auth tokent localStorage-ban.
- Bejelentkezési próbálkozások korlátozása, erős jelszó, logout, titokkezelés.
- REST végpontok szerveroldali ingatlan-hozzáférés ellenőrzése; input- és fájlfeltöltés-limitek, MIME/struktúra-ellenőrzés.
- Könyvelési adatokhoz auditlog; a véglegesített adat ne legyen csendesen módosítható.
- Napi DB-backup legalább egy külön helyre; retenció és rendszeres restore-teszt.
- Adatok exportálhatók; törlésnél/hibás javításnál legyen tudatos megerősítés.
- Éles MySQL ne legyen publikus porton; csak a backend férjen hozzá.

## 14. Production build és üzembe helyezés

1. **Frontend:** `cd web && npm ci && npx ng build --configuration production`. Az aktuális Angular builder kimeneti mappáját az `angular.json` alapján ellenőrizni kell (tipikusan `dist/web/browser`).
2. **Backend:** `cd api && npm ci && npm run build`. Futtatás Node process managerrel vagy Docker containerben, restart policy mellett.
3. **DB:** éles MySQL adatbázis külön felhasználóval; minden induló verzió előtt migráció és mentés.
4. **Reverse proxy:** Nginx vagy Caddy; `/` → Angular statikus fájlok, `/api/` → NestJS, HTTPS és SPA route fallback.
5. **Környezeti konfiguráció:** frontend publikus API base path, backend DB secrets, cookie domain, engedélyezett origin.
6. **Élesítési teszt:** login, új hónap, mentés, részösszeg, export, mobilnézet, logout, DB backup és restore.
7. **Rollback:** korábbi backend/frontend release visszaállítható; DB-migrációkhoz dokumentált visszaállítási stratégia.

**Fejlesztés indítása három terminálban:**

```powershell
# 1) rezsiflow gyökér
docker compose up -d

# 2) rezsiflow/api
npm run start:dev

# 3) rezsiflow/web
npx ng serve --proxy-config proxy.conf.json
```

**Fejlesztői alap URL-ek:** frontend `http://localhost:4200`, backend `http://localhost:3000/api/v1`; a DB host felől `127.0.0.1:3307`.

## 15. A projekt elfogadási feltételei — Definition of Done

- [ ] Az alkalmazás magyar nyelvű, modern és valóban reszponzív.
- [ ] Az összes főoldal működik, nincs nem funkcionális dekoratív gomb.
- [ ] Havi leolvasásból automatikus és ellenőrizhető elszámolás készül.
- [ ] A kedvezményes/emelt sávok és az eltérő tarifaverziók kezelhetők.
- [ ] Személyenként minden tétel helyesen és visszakövethetően oszlik fel.
- [ ] A régi Excel-hónapok beimportálhatók és az eredeti adatok megmaradnak.
- [ ] A történeti grafikonok 2022 szeptemberétől működnek.
- [ ] A végleges és hiányos hónapok nem keverednek.
- [ ] Működik PDF/Excel/CSV export és teljes adatmentés.
- [ ] Unit, integration és E2E tesztek futnak, pénzügyi számításokra külön tesztcsomag van.
- [ ] Az éles oldal HTTPS alatt védett, a DB nem publikus, backup visszaállítás kipróbált.
- [ ] `README.md` tartalmazza a futtatást, környezeti változókat, migrációkat, restore-t és release lépéseket.

## 16. Fejlesztési sorrend és munkavégzési szabály AI-kódoláshoz

**Ezt a fájlt használjuk a fejlesztés elsődleges terveként.** A feladatokat az A → G fázissorrendben kell megvalósítani. Minden fázis után:
1. Implementáció, majd típusellenőrzés, lint (ha konfigurált), unit/integration tesztek.
2. Az új felületek kézi/reszponzív ellenőrzése.
3. Eltérés esetén javítás; nem lépünk tovább törött builddel vagy hibás számszaki eredménnyel.
4. A checklist kipipálása kizárólag igazoltan elkészült elemeknél.
5. Külön commit, rövid változásnapló és szükség szerint migráció.

**Prioritás:** az elszámolás helyessége és a történeti adatok sértetlensége fontosabb, mint a grafikonok látványa. A UI lehet prémium, de valós adatot mutasson; ne maradjanak demo/mock összegek az éles rendszerben.

## 17. Hasznos hivatalos dokumentáció

- Angular telepítés: https://angular.dev/installation
- Angular verziók: https://angular.dev/reference/releases
- Angular + Tailwind: https://tailwindcss.com/docs/installation/framework-guides/angular
- NestJS: https://docs.nestjs.com/
- NestJS + TypeORM: https://docs.nestjs.com/techniques/database
- TypeORM migrációk: https://typeorm.io/migrations
- Apache ECharts: https://echarts.apache.org/
- Tailwind CSS: https://tailwindcss.com/docs

---

**Végállapot:** a havi Excel helyett egy saját, gyors rezsinyilvántartó webalkalmazás működik, amelyben a leolvasás pár perc, minden összeg visszakövethető, minden hónap és év összehasonlítható, a személyenkénti fizetendő világos, és a 2022. szeptember óta meglévő adatok nem vesznek el.
