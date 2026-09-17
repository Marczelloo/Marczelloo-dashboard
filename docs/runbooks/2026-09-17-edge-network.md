# Sieć `mz-edge` — trasy tunelu po nazwie kontenera

Plan zaakceptowany 2026-09-17. `cloudflared` przestaje działać w trybie sieci
hosta i łączy się z kontenerami w sieci Dockera `mz-edge`
(`http://marczelloo-tools:3000` zamiast `http://127.0.0.1:3202`). Strony
statyczne i proxy MewBit przechodzą z systemowego Caddy do kontenera `mz-static`.

## Jak to działa

- `EDGE_NETWORK=mz-edge` w `.env` dashboardu: każde zadanie agenta (deploy,
  rollback, zastosowanie zmiennych) dostaje listę usług projektu, do których
  prowadzą trasy tunelu (po porcie `127.0.0.1` albo nazwie kontenera). Agent
  dołącza je do `mz-edge` w override, zachowując ich własne sieci, i zawsze
  dołącza usługę publikującą port tunelu projektu. Sieć tworzy, gdy jej brak.
- `TUNNEL_ORIGIN=edge`: nowe i aktualizowane trasy wskazują kontener
  (ustalany z portów opublikowanych przez Dockera), nie port loopback.
- Porty `127.0.0.1` zostają opublikowane jako zapas i do użytku lokalnego.
- `mz-static` (`infra/static`): Caddy z tym samym Caddyfile co wcześniej, `/srv/www`
  tylko do odczytu, `/api` MewBit przez sieć `neobeatbuddy_default`. Strony
  publikuje się jak dotąd, kopiując pliki do `/srv/www`.

## Przełączenie

1. `.env` dashboardu: `EDGE_NETWORK=mz-edge`, `TUNNEL_ORIGIN=loopback`; deploy dashboardu.
2. Każdy projekt odtworzony na bieżącym wydaniu z usługami w `mz-edge` (zadanie
   `rollback` do działającego SHA — bez builda, z bramką zdrowia).
3. `infra/static` → `~/.config/marczelloo-static`, `docker compose up -d`.
4. Sprawdzenie celów z wnętrza `mz-edge` (tymczasowy kontener).
5. `infra/cloudflared/docker-compose.yml` → `~/.config/marczelloo-tunnel`,
   `docker compose up -d`, od razu
   `managed-tunnel.ts edge <tunnelId> bindings.json --extra 8080=http://mz-static:8080 --backup <plik> --apply`
   (`bindings.json` = `publishedPorts` z `GET /host` agenta).
6. `.env` dashboardu: `TUNNEL_ORIGIN=edge`; odtworzenie dashboardu.
7. Wszystkie domeny odpowiadają → `sudo systemctl disable --now caddy`.

## Wykonanie (2026-09-17)

- Wszystkie 6 projektów odtworzone z usługami w `mz-edge` (bramki zdrowia OK);
  w sieci: dashboard, demo, Portainer, Tools, Portfolio, Drive, AtlasHub
  (dashboard, gateway, minio) i `mz-static`. MewBit bez zmian (ruch idzie przez `mz-static`).
- Test z wnętrza sieci: kody wszystkich 19 domen identyczne jak przez porty loopback.
- Przełączenie: `cloudflared` w `mz-edge` + 20 tras na kontenery w 8 s; publiczne
  kody wszystkich domen przed i po identyczne, webhook GitHuba działa, 0 tras loopback.
- `TUNNEL_ORIGIN=edge` ustawione, dashboard odtworzony; aktualizacja trasy po
  zadaniu zostawia cel kontenerowy.
- Systemowy Caddy wyłączony (`disabled`); `/api` MewBit trafia do bota przez `mz-static`.
- Kopie: `~/backups/edge-cutover-20260917/ingress-before-edge.json` (trasy sprzed
  zmiany) i `tunnel-docker-compose.host.yml`.

## Cofnięcie

1. Przywrócić poprzedni `docker-compose.yml` tunelu (`network_mode: host`) i `docker compose up -d`.
2. `managed-tunnel.ts restore <tunnelId> <plik z --backup>`.
3. `TUNNEL_ORIGIN=loopback` w `.env` dashboardu i jego odtworzenie.
4. Jeśli Caddy był wyłączony: `sudo systemctl enable --now caddy`.
