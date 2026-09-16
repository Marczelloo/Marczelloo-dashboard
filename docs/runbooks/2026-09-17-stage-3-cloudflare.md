# Etap 3 — tunel zarządzany przez Cloudflare API i wszystkie projekty na agencie

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Warunek: etapy 0–2 wdrożone. Każdy krok zmieniający Pi lub Cloudflare wymaga zgody właściciela.

## Dlaczego nowy tunel, a nie migracja starego

Stary tunel `pit` (`e9a074e3-…`) jest zarządzany lokalnie: każda zmiana trasy to edycja
`/etc/cloudflared/config.yml` i restart cloudflared, czyli krótka przerwa dla wszystkich domen
(16.09.2026 restart przy każdym deployu). Cloudflare nie opisuje przejścia lokalnego tunelu na
zarządzanie z API jako odwracalnego, więc powstaje drugi tunel z identycznymi trasami, działa
obok starego, a domeny są przepinane pojedynczo na poziomie DNS (proxied CNAME). Każde
przepięcie cofa jedna zmiana rekordu.

## Token API

Uprawnienia: Account › Cloudflare Tunnel: Edit; Zone › DNS: Edit; Zone › Zone: Read (strefy
`marczelloo.dev`, `nadstrona.pl`). Token trzymany tylko w `.env` dashboardu na Pi (600).

## 1. Nowy tunel i konektor (zgoda) — wykonane 16.09.2026

Na komputerze właściciela (token w zmiennych środowiskowych, nie w historii):

```bash
npx tsx scripts/cloudflare/managed-tunnel.ts create marczelloo-pi-managed e9a074e3-7ca3-427a-ba23-b14efc8241c9
npx tsx scripts/cloudflare/managed-tunnel.ts compare e9a074e3-7ca3-427a-ba23-b14efc8241c9 <NOWE_ID>
npx tsx scripts/cloudflare/managed-tunnel.ts token <NOWE_ID> <plik>
```

Expected: `INGRESS_EQUAL`. Plik z tokenem → Pi `~/.config/marczelloo-tunnel/.env` (700/600),
`infra/cloudflared/docker-compose.yml` → `~/.config/marczelloo-tunnel/docker-compose.yml`, potem
`docker compose up -d` w tym katalogu. Expected w logach: 4 × `Registered tunnel connection`,
`Updated to new configuration`.

Nowy tunel: `marczelloo-pi-managed` `d45b634d-e397-4d3b-950a-ec57032aff58`.

## 2. Przepięcie DNS (zgoda)

Najpierw jedna domena testowa, potem reszta:

```bash
npx tsx scripts/cloudflare/managed-tunnel.ts switch-dns <STARE_ID> <NOWE_ID> demo-dashboard.marczelloo.dev          # dry run
npx tsx scripts/cloudflare/managed-tunnel.ts switch-dns <STARE_ID> <NOWE_ID> --apply demo-dashboard.marczelloo.dev
npx tsx scripts/cloudflare/managed-tunnel.ts switch-dns <STARE_ID> <NOWE_ID> --apply                                 # wszystkie
```

Weryfikacja: kody HTTP domen jak przed zmianą (lista z etapu 0, krok 4) oraz ruch w logach
nowego konektora. Cofnięcie: to samo z zamienionymi ID.

## 3. Tryb API w dashboardzie (zgoda) — dopiero po przepięciu wszystkich domen

W `~/projects/Marczelloo-dashboard/.env`: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_TUNNEL_ID=<NOWE_ID>`, `CLOUDFLARE_LEGACY_TUNNEL_IDS=<STARE_ID>`; odtworzenie
dashboardu (`docker compose up -d --no-build dashboard` albo deploy przez agenta).
Settings → Cloudflare Tunnel pokazuje tunel `marczelloo-pi-managed` i strefy; formularz domeny
w projekcie ma wybór strefy.

## 4. Wyłączenie starego cloudflared (zgoda) — po dobie bez problemów

```bash
sudo systemctl disable --now cloudflared
```

Plik `/etc/cloudflared/config.yml` i poświadczenia zostają do ewentualnego powrotu
(`sudo systemctl enable --now cloudflared` + przepięcie DNS z powrotem).

## 5. Projekty na agencie (zgoda dla każdego)

Kolejność: portfolio → Drive → AtlasHub → NeoBeat → dashboard. Dla każdego: `engine: "agent"`
w konfiguracji wdrożenia, deploy, weryfikacja (kontenery zdrowe, domena odpowiada, tag obrazu
= SHA). Szczegóły i wyniki w sekcji „Wykonanie” poniżej.

- NeoBeat: katalog na Pi nie był repozytorium Git. Konwersja w miejscu: `git init`, obiekty z
  bundla, `git reset` do `origin/main`; pliki runtime (`.env`, `helpers/data`, `logs`, pluginy,
  cookies) są w `.gitignore` i zostają. Compose dostał sekcję `build`.
- Dashboard: webhook przekazuje push agentowi, gdy projekt ma `engine: "agent"`; agent nie
  aktualizuje sam siebie (`docker compose build && up -d` w `agent/` ręcznie).

## Sprzątanie i limity miejsca

- Agent po każdym zadaniu: usuwa tagi w repozytoriach obrazów, które buduje, poza 3 ostatnimi
  wydaniami i obrazami używanymi przez kontenery; `docker image prune -f`; po buildzie
  `docker builder prune --max-used-space $AGENT_BUILD_CACHE_MAX` (10GB); logi zadań usuniętych
  z historii (200 ostatnich).
- Agent nie tworzy kopii projektów: buduje z tego samego katalogu repozytorium.
- Cotygodniowy cron: `docker builder prune -f --max-used-space 10GB`.

## Wykonanie 16.09.2026

- Kod: API Cloudflare (`977d227`), sprzątanie w agencie (`ed449a6`), limit „Zastosuj env” 10 min (`3f03366`),
  stary skrypt tras nie restartuje cloudflared, gdy trasa jest aktualna (`14f1d74`). Wcześniej każdy
  deploy przestawiał kolejność tras i restartował cloudflared: ok. 30 s bez wszystkich domen
  (ostatnio 19:30:22–19:30:53).
- Tunel `marczelloo-pi-managed` (`d45b634d-…`) działa w kontenerze `marczelloo-cloudflared`
  (`~/.config/marczelloo-tunnel`), trasy = stary tunel (`INGRESS_EQUAL`). **DNS nieprzepięty:** token
  nie ma uprawnienia Zone › DNS: Edit (`Authentication error`). Kroki 2–4 czekają na to uprawnienie.
- Agent: portfolio `f40a457`, Drive `4de7154`, AtlasHub `bc9e5ea` (Postgres i MinIO nietknięte),
  NeoBeat `f049e45`, dashboard `14f1d74` (konfiguracja wdrożenia utworzona; serwisy poprawione z
  `marczelloodashboard` na `marczelloo-dashboard`). Wszystkie bramki zdrowia zaliczone, wpisy `success`.
- NeoBeat: repozytorium przemianowane na `Marczelloo/MewBit` (URL w projekcie i remote na Pi
  zaktualizowane). Katalog na Pi zamieniony w checkout Git (treść = `origin/main`, różnice tylko CRLF).
  Compose dostał `build`, usunięty nieużywany plugin `youtube-plugin-1.18.2.jar`. Kopie `.env`,
  compose i `.codex-backups` → `~/backups/neobeatbuddy-pre-agent-20260916.tar.gz` (600).
- Sprzątanie: stare tagi obrazów (agent: 21 NeoBeat, 3 AtlasHub, `latest` portfolio/Drive/Tools),
  obrazy migracji Drive z 11.08, 23 obrazy `mewbit-*:local` i `gradle`. Dysk: 58 GB → 48 GB zajęte.
  Obrazy tar NeoBeat (1,2 GB) w `~/cleanup-pending-20260916` do decyzji właściciela.
- Incydent: bot NeoBeat stał ok. 28 min po teście „Zastosuj env” (Compose przerwany limitem 180 s
  przed startem bota, który czeka na zdrowy Lavalink); uruchomiony ręcznie, limit podniesiony.
