# Etap 2 — agent wdrożeń na Raspberry Pi

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Warunek: etapy 0 i 1 wdrożone. Każdy krok wymaga zgody właściciela w chwili wykonania.

## 1. Token i pliki agenta (zgoda)

Po wdrożeniu kodu etapu 2 w `~/projects/Marczelloo-dashboard` (push `main`):

```bash
cd ~/projects/Marczelloo-dashboard
umask 077
if grep -q '^AGENT_TOKEN=' .env; then echo "AGENT_TOKEN już jest w .env — przerwij i sprawdź plik."; else
token="$(openssl rand -hex 32)"
cp .env ".env.backup-stage2-$(date +%Y%m%d-%H%M)"
printf '\nAGENT_TOKEN=%s\n' "$token" >> .env
printf 'AGENT_TOKEN=%s\nDOCKER_GID=%s\nPROJECTS_DIR=%s\n' "$token" "$(getent group docker | cut -d: -f3)" "$HOME/projects" > agent/.env
unset token
fi
grep -c '^AGENT_TOKEN=' .env agent/.env
```

Expected: `.env:1` i `agent/.env:1`.

## 2. Binaria Dockera z hosta i katalog danych (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard/agent
mkdir -p vendor ~/projects/.dashboard/agent
chmod 700 ~/projects/.dashboard/agent
cp "$(command -v docker)" vendor/docker
cp "$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')" vendor/docker-compose
cp "$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "buildx"}}{{.Path}}{{end}}{{end}}')" vendor/docker-buildx
ls -l vendor
```

Expected: trzy pliki wykonywalne. `Dockerfile` nadaje im tryb 0755, bo agent dzia�a jako UID 1000.

## 3. Budowa i start agenta (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard/agent
docker compose build
docker compose up -d
docker exec marczelloo-agent docker version --format '{{.Client.Version}} / {{.Server.Version}}'
docker exec marczelloo-agent docker compose version
docker exec marczelloo-agent docker buildx version
docker exec marczelloo-agent git --version
docker exec marczelloo-dashboard wget -qO- http://mz-agent:8790/health
```

Expected: klient i serwer Dockera odpowiadają, `Docker Compose version v5.0.2`, wersja Git, `{"ok":true}`.
Sprawdzone 16.09.2026: host to Debian 12 (glibc 2.36), `docker` z pakietu `docker-ce-cli` wymaga GLIBC ≤ 2.34, plugin Compose jest statyczny — oba działają w `node:20-bookworm-slim`. Jeśli po aktualizacji systemu `docker version` w kontenerze zgłosi brak bibliotek: w `Dockerfile` zamień `COPY vendor/docker …` na instalację `docker-ce-cli` z repozytorium Docker dla Debiana i zbuduj ponownie (Compose zostaje z `vendor/`).

## 4. Odtworzenie dashboardu z `AGENT_TOKEN` (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard
docker compose up -d --no-build dashboard
docker exec marczelloo-dashboard sh -c 'test -n "$AGENT_TOKEN" && echo AGENT_TOKEN_OK'
```

Expected: `AGENT_TOKEN_OK`.

## 5. Pilotaż: Marczelloo-Tools (zgoda)

1. `https://dashboard.marczelloo.dev/projects/<Tools>` → karta „Silnik wdrożeń” → „Przełącz na agenta” (PIN).
2. „Deploy” → log na żywo: `Git fetch` → `Compose config` → `Build` → `Uruchomienie` → `Bramka zdrowia` → `Wynik: succeeded`.
3. Zamknij kartę przeglądarki przed końcem i sprawdź później, że wpis wdrożenia ma status `success` (dashboard dostał zdarzenie od agenta).

Weryfikacja na Pi:

```bash
docker image ls marczelloo-tools-app --format '{{.Tag}}'
docker inspect marczelloo-tools --format '{{.Config.Image}}'
ss -ltn | grep ':3202 '
curl -s -o /dev/null -w '%{http_code}\n' https://tools.marczelloo.dev/
cat ~/projects/.dashboard/agent/overrides/marczelloo-tools.yml
```

Expected: tag 12-znakowego SHA; kontener używa `marczelloo-tools-app:<sha12>`; port tylko `127.0.0.1:3202`; domena odpowiada jak przed pilotażem; override zawiera `image:` z tym tagiem.

## 6. Auto-deploy i rollback (zgoda)

1. Wypchnij drobny commit do `Marczelloo/Marczelloo-Tools` (`main`). Webhook kolejkuje zadanie z SHA z pusha; po zakończeniu karta pokazuje nową „Aktualną wersję” i poprzednią na liście.
2. Przy poprzedniej wersji kliknij „Przywróć” (PIN) → zadanie `rollback` bez builda → `succeeded`; `docker inspect marczelloo-tools --format '{{.Config.Image}}'` pokazuje tag poprzedniego SHA.
3. Wróć do najnowszej wersji: „Przywróć” przy niej albo „Deploy”.

## 7. Wycofanie pilotażu

„Wróć do skryptu” w karcie projektu. Kolejny deploy użyje starego skryptu i jego override portu. Agent może dalej działać; `docker compose -f ~/projects/Marczelloo-dashboard/agent/docker-compose.yml down` zatrzymuje go bez wpływu na aplikacje.

## Wykonanie 16.09.2026

- Etap 0: trasy tunelu na `127.0.0.1`, self-deploy `3e734e6`, demo i Portainer odtworzone, porty AtlasHub (`bc9e5ea`), portfolio (`f40a457`) i Tools na loopback; migracja `general_todos`, profil AtlasHub `default`; cache builda przycięty, cron cotygodniowy, katalog-sierota w `~/backups/Marczelloo-tools-orphan-20260916`, gałąź `feature/env-manager-file-first-redesign` usunięta. Kopia `pre-migration-20260915-1744` skopiowana na komputer właściciela (`C:\Users\moskw\Backups\raspberrypi`, sumy zgodne; dwa pliki różniące się tylko wielkością liter zapisane pod osobnymi nazwami).
- Etap 1: tabele importu utworzone (poprawka `db35795`: API schematu AtlasHub nie przyjmuje `'[]'::jsonb`).
- Etap 2: agent zbudowany (`98bfc36` — binaria 0755, `de538ea` — buildx), Tools przełączony na agenta. Push `0865e4e` do Tools → webhook → agent: build, bramka zdrowia (sonda 200), `succeeded`, wpis wdrożenia `success` bez otwartej przeglądarki; wydania `0865e4e952de` i bazowe `ae8235d70ffc`.
- Do zrobienia przez właściciela (PIN w UI): test „Zastosuj env” (etap 0, krok 9), skan i zapis importu (etap 1, krok 3), test „Przywróć” (etap 2, krok 6.2).
