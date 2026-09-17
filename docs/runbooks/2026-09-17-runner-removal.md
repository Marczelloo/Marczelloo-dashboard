# Usunięcie runnera — dashboard bez dostępu do powłoki hosta

Decyzja właściciela (2026-09-17): terminal, `docker exec`, restart Pi i narzędzia
npm na hoście są usuwane (opcja A), pozostałe funkcje runnera przechodzą do agenta.

## Co zastąpiło runnera

| Funkcja | Wcześniej (runner `/shell` przez SSH) | Teraz |
|---|---|---|
| Deploy projektu, webhook | skrypt `startDeploymentJob`, self-deploy | wyłącznie zadanie agenta (`deployConfiguredProject`) |
| Logi deployu | `tail` pliku w `.dashboard/deploy-logs` | log zadania agenta (`agent:<jobId>`); stare logi niedostępne |
| Odczyt `.env`, lista plików env | `cat`, `ls` | `POST /env-files/list`, `POST /env-files/read` |
| Zapis `.env` | `base64 -d > plik` | tylko projekty agenta: zadanie `apply-env` z bramką zdrowia |
| Preflight przed deployem | skrypt shell (`git ls-remote`, `compose config`) | GitHub App + `POST /preflight` |
| Przydział portu | `ss -ltn` + `docker ps` | porty opublikowane przez kontenery (`GET /host`) i kontenery projektu (`GET /status`) |
| Restart serwisu | `docker restart` | `POST /containers/restart` (tylko kontenery z etykietą Compose, nie agent) |
| Metryki Pi, porty w Settings | `free`, `df`, `ss` | `GET /host` (bez adresu IP hosta) |
| Wersja dashboardu, baner deployu | `git log` w katalogu na Pi | wydania agenta + GitHub API |
| Trasy Cloudflare | edycja `/etc/cloudflared/config.yml` przez sudo | tylko Cloudflare API |
| Import stacków (etap 1) | inspekcja hosta przez runnera | usunięty; zapisane dane (`app_configs`, `app_routes`, wersje env) zostają w bazie |

Usunięte bez zamiennika: terminal hosta, `docker exec` w kontenerach, restart Pi,
zakładka pakietów npm (check/update/rollback/diagnose), allowlista i test runnera.

## Bezpieczeństwo operacji agenta

- Każda trasa poza `/health` wymaga `AGENT_TOKEN`.
- Ścieżki: absolutne, bez `..`, wewnątrz `PROJECTS_DIR`, dodatkowo sprawdzone
  `realpath` (symlink poza katalog projektów → 400). Nazwy plików env: `.env` lub
  `.env.<nazwa>`, limit 1 MB, treść nigdy w logach ani komunikatach błędów.
- Żadna trasa nie wykonuje komend przekazanych przez wywołującego.

Sprawdzone na Pi 2026-09-17: odczyt `.env` portfolio, odrzucenie `../`, `/etc`,
nazwy `../x` i symlinku do `/etc`, preflight istniejącego i brakującego repo,
odmowa restartu agenta i kontenera spoza Compose, 401 bez tokenu.

## Wdrożenie

1. Push commita agenta → deploy dashboardu (bez zmian funkcjonalnych) →
   `docker compose build && up -d` w `~/projects/Marczelloo-dashboard/agent`
   (nowy montaż `/etc/hostname:/etc/host-hostname:ro`).
2. Push zmian dashboardu → deploy przez agenta.
3. Agent nie usuwa osieroconych kontenerów, więc runnera trzeba zatrzymać ręcznie:
   `docker rm -f marczelloo-runner` i usunąć obraz oraz wolumen `marczelloo-dashboard_runner_data`.
4. Z `.env` dashboardu można usunąć `RUNNER_TOKEN`, `RUNNER_URL`, `SSH_*`,
   `DEFAULT_CWD`, `DASHBOARD_PROJECT_NAME`, `CLOUDFLARED_CONFIG_*`.
