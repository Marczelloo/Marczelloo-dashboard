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
