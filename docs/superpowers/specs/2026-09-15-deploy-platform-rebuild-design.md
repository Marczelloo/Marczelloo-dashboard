# Przebudowa systemu wdrożeń i hostingu — decyzje projektowe

Data: 2026-09-15. Źródło: audyt „Audyt systemu wdrożeń i hostingu” (artefakt
https://claude.ai/artifact/XCeoRsbPa72q7UY2f5HzSy) oraz ustalenia z rozmowy.
Identyfikatory problemów (S1, D3, E1…) pochodzą z audytu.

## Cel

Jeden przewidywalny system, który wdraża dowolny projekt z GitHuba (strona
statyczna, framework webowy, bot Node.js, stack wielu usług) na Raspberry Pi,
sam weryfikuje działanie aplikacji i zarządza domeną w Cloudflare. Zachowuje
obecne funkcje: deploy z repo, auto-deploy po pushu do gałęzi, edycję env,
automatyczną trasę Cloudflare Tunnel i wybór domeny.

## Stan wyjściowy (zweryfikowany na Pi 15.09.2026)

- Dashboard `3cf0ba9` na Pi = `origin/main`.
- 6 projektów Compose (17 kontenerów), Caddy na `127.0.0.1:8080` z 9 domenami
  statycznymi, tunel lokalny `e9a074e3-…` z 21 regułami ingress (19 domen).
- Baza dashboardu w AtlasHub: projects 8, services 16, work_items 64,
  env_vars 89, settings 8 (w tym 4 × `deployment-config:*`), brak tabeli
  `general_todos`, `uptime_checks` 279 012 wierszy.
- Env AtlasHuba w bazie dashboardu jest nieaktualny (22/25 wartości różni się
  od działającego pliku). NeoBeat (80 kluczy) i Drive (12) mają env tylko w
  plikach.
- Kopia sprzed migracji: `~/backups/pre-migration-20260915-1744` (3,7 GB,
  SHA256SUMS, zweryfikowana).

## Decyzje

1. **Konfiguracja wdrożenia jest 1:1 z istniejącym rekordem `projects`.**
   Nie powstaje nowa encja „app” z nowymi ID. TODO (`work_items`), deploye i
   audit log nie wymagają migracji.
2. **Nazwa projektu Compose jest niezmienna.** Istniejące stacki zachowują
   obecną nazwę (`atlas-hub`, `marczelloo-drive`, `marczelloo-tools`,
   `neobeatbuddy`, `portfolio-redesign`, `marczelloo-dashboard`). Zmiana nazwy
   tworzy nowe, puste wolumeny. Przynależność do projektu wyrażają etykiety
   `dev.marczelloo.*`, nie prefiks nazwy.
3. **Źródło prawdy dla env przy imporcie:** env działającego kontenera >
   plik env wskazany przez Compose > `environment:` z pliku compose > baza
   dashboardu (tylko podpowiedź, domyślnie wyłączona). Zmienne wbudowane w
   obraz (`docker image inspect … Config.Env`) nie są importowane.
4. **Nowy magazyn env:** wersjonowane, szyfrowane AES-256-GCM (istniejący
   `ENCRYPTION_KEY`) wersje całego zestawu env na projekt. Nazwy kluczy i
   metadane jawne, wartości zaszyfrowane.
5. **Renderer Compose:** `docker compose config --format json` →
   normalizacja → `compose.generated.yml`. Dla projektów importowanych
   zachowuje `container_name` i porty (zmiana dopiero przy przełączeniu w
   etapie 4), przypina nazwy wolumenów, dodaje etykiety i limity logów.
6. **Routing docelowy:** tunel zarządzany przez API Cloudflare, cloudflared
   jako kontener w sieci `mz-edge`, trasy po nazwie kontenera, bez portów
   hosta. Opcjonalny port lokalny z zakresu `127.0.0.1:20000–20999` zapisany
   w bazie. Trasy spoza dashboardu (Caddy) są importowane jako „zewnętrzne”.
7. **Wykonanie:** w etapach 0–1 nadal przez istniejący runner (`/shell`),
   wyłącznie operacje tylko do odczytu w imporcie. Agent z kolejką zastępuje
   runner w etapie 2.
8. **Uwierzytelnianie:** tożsamość wyłącznie z podpisanego
   `Cf-Access-Jwt-Assertion` (JWKS `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`,
   weryfikacja `aud`, `iss`, `exp`). `DEV_USER_EMAIL` i `DEV_SKIP_PIN` działają
   tylko poza produkcją.

## Etapy

| Etap | Zakres | Zmienia działające kontenery? |
|---|---|---|
| 0 | Bezpieczeństwo i higiena (S1–S5, D1, D2, D5, D8, E1, E3, C1, C6, M4, porty na 127.0.0.1) | tak, punktowo i za zgodą |
| 1 | Model, parsery, renderer (dry-run), import tylko do odczytu z ekranem konfliktów | nie |
| 2 | Agent z kolejką, deploy SHA, bramka zdrowia, rollback, webhook → kolejka | tak |
| 3 | Tunel przez API Cloudflare, `mz-edge`, env v2 z „Zastosuj” | tak |
| 4 | Przełączanie projektów: Tools → Portfolio → Drive → NeoBeat/MewBit → AtlasHub → Dashboard | tak |
| 5 | Deploy bez compose (detektor, szablony, ew. Railpack) | nie dotyczy |
| 6 | Monitoring v2, retencja, opcjonalnie build w GitHub Actions | nie |

## Zasady migracji

- Nic nie jest kasowane w trakcie migracji; stare kontenery zatrzymujemy
  dopiero po przejściu sprawdzeń; cofnięcie = uruchomienie starego compose.
- Import zachowuje 1:1 regułę `path: /api/github/webhook` dashboardu oraz
  `originRequest.httpHostHeader: minio:9000` dla storage-atlashub.
- Weryfikacja przełączenia: skróty env nowego kontenera = snapshot, te same
  montowania, domena odpowiada publicznie, liczba `work_items` bez zmian.

## Ograniczenia globalne

- Node.js 20 (obrazy `node:20-alpine`), Next.js 16 (`src/proxy.ts` zamiast
  middleware), React 19, TypeScript strict, zod 3.
- Baza wyłącznie przez REST AtlasHub (`/v1/db`, limit 1000 wierszy na
  żądanie); tabele tworzone przez Schema API (`POST /v1/db/schema/tables`,
  `ifNotExists: true`) skryptem w `scripts/migrations/`.
- Tekst interfejsu po polsku; komunikaty commitów po angielsku w konwencji
  `feat:` / `fix:` / `chore:`.
- Wartości sekretów nigdy nie trafiają do logów, odpowiedzi API bez PIN ani
  do komponentów klienckich.
- Każda operacja zmieniająca stan Pi poza deployem z repo wymaga wyraźnej
  zgody właściciela w momencie wykonania.
