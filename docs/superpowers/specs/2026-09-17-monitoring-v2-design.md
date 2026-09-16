# Monitoring v2 — etap 6

Data: 2026-09-17. Zaakceptowany zakres: M1–M3 z audytu, retencja incydentów.
Build w GitHub Actions odłożony do osobnego etapu. Wygląd strony Monitoring
jest tymczasowy — cały dashboard będzie przebudowany wizualnie później.

## Problem

- Trzy kopie tego samego sprawdzania HTTP (`scheduler.ts`,
  `api/cron/monitoring`, akcja na stronie `/monitoring`, do tego nieużywany
  `monitoring/checker.ts`).
- Boty i workery bez URL nie są monitorowane (M1).
- Discord dostaje alert w każdym cyklu, także w trakcie deployu (M2).
- Sprawdzanie certyfikatu zwraca zawsze `null` (M3).

## Architektura

```
agent GET /status ──┐
                    ├─► runMonitorCycle() ─► ocena (czysta) ─► monitor_state / monitor_incidents
Cloudflare ingress ─┤         (co 60 s)                      └─► Discord przy zmianie stanu
deployment configs ─┘                                          └─► uptime_checks (HTTP, co 5 min)
```

### Agent: `GET /status` (tylko odczyt, token)

Dla każdego projektu Compose: kontenery (`status`, `exitCode`,
`restartCount`, `health`, `oomKilled`, `startedAt`, `finishedAt`), aktywne
zadanie i czas zakończenia ostatniego. Do tego wolne miejsce na dysku
(`statfs(PROJECTS_DIR)`) i rozmiar build cache (`docker system df`, cache 5 min).
Jedno `docker ps` + jedno `docker inspect`; wartości env nigdy nie wychodzą.

### Cele monitoringu (`src/server/monitoring/targets.ts`)

| Rodzaj | Klucz | Źródło | Projekt |
|---|---|---|---|
| `domain` | `domain:<host>` | reguły ingress tunelu (bez catch-all i wildcardów) | `tunnel.hostname` z konfiguracji wdrożenia, potem host `services.url`, potem `app_routes` |
| `containers` | `containers:<composeProject>` | konfiguracje wdrożeń z `engine: "agent"` | projekt konfiguracji |
| `tls` | `tls:<host>` | te same hosty co `domain`, sprawdzane co 12 h | jak domena |
| `disk` | `disk` | agent | — |
| `agent` | `agent` | dostępność `/status` | — |

### Ocena pojedynczego sprawdzenia (czyste funkcje, `evaluate.ts`)

- **domain:** żądanie `GET https://host/` bez podążania za przekierowaniem,
  timeout 10 s. `< 500` = ok (302 z Cloudflare Access to ok). 5xx, 530 lub
  błąd sieci = porażka.
- **containers:** porażka, gdy brak kontenerów, kontener `exited` z kodem ≠ 0,
  `dead`, `restarting`, `unhealthy`, `oomKilled` albo `restartCount` wzrósł od
  poprzedniego cyklu. `exited` z kodem 0 jest ignorowany (jednorazowe zadania).
- **tls:** `tls.connect` z SNI, `valid_to`. ≤ 14 dni = ostrzeżenie, ≤ 3 dni lub
  wygasły = porażka.
- **disk:** wolne < 10% = ostrzeżenie, < 5% = porażka.

### Maszyna stanów (`state-machine.ts`)

Stany: `ok`, `warning`, `down`, `unknown` (jeszcze nie sprawdzony).

- Porażka zwiększa `failCount`; `down` dopiero przy `failCount >= 2`.
- Ostrzeżenie przechodzi w `warning` od razu (sprawdzenia rzadkie i stabilne).
- Sukces zeruje licznik i wraca do `ok`.
- **Wyciszenie:** gdy projekt celu ma aktywne zadanie agenta albo zadanie
  skończyło się < 2 min temu, cykl nie zmienia stanu ani licznika (zapisuje
  tylko `muted_until`/ostatnie sprawdzenie).
- Powiadomienie tylko przy zmianie stanu:
  `ok|unknown → down` (awaria), `down → ok` (powrót, czas trwania),
  `→ warning` (ostrzeżenie), `warning → ok` (rozwiązane). `unknown → ok` bez
  powiadomienia.
- Incydent otwiera się przy wejściu w `down` lub `warning`, zamyka przy
  powrocie do `ok`; `down ↔ warning` aktualizuje incydent.

### Dane (AtlasHub, migracja `scripts/migrations/2026-09-17-monitoring-tables.ts`)

- `monitor_state`: `key` (unikalny), `kind`, `project_id`, `label`, `status`,
  `fail_count`, `since`, `last_checked_at`, `last_error`, `detail` (jsonb:
  liczniki restartów, dni certyfikatu, bajty dysku, latency), `updated_at`.
- `monitor_incidents`: `target_key`, `kind`, `project_id`, `label`,
  `severity` (`down`/`warning`), `reason`, `started_at`, `ended_at`.
  Retencja: zamknięte starsze niż 90 dni (`MONITOR_INCIDENT_RETENTION_DAYS`).
- `uptime_checks`: bez zmian schematu; zapis co 5. cykl dla serwisów, których
  host URL odpowiada sprawdzanej domenie (strony z historią działają dalej).
  Retencja 30 dni bez zmian.

Kolumny jsonb są wysyłane jako tekst JSON (`jsonbColumns`).

### Harmonogram

`scheduler.ts` uruchamia `runMonitorCycle()` co `MONITORING_INTERVAL_MS`
(domyślnie 60 s), bez nakładania się cykli. `api/cron/monitoring` i przycisk na
stronie wołają ten sam cykl. `monitoring/checker.ts` i duplikaty są usuwane.
Tryb demo: bez zmian (scheduler wyłączony, strona na danych demo).

### Powiadomienia

Discord (`sendDiscordNotification`): tytuł z rodzajem i etykietą, kolor
danger/warning/success, pola: projekt, przyczyna, czas trwania. Błąd wysyłki nie
przerywa cyklu i nie cofa zmiany stanu.

### Strona Monitoring

Prosta lista bez dopracowanej wizualnie: stan agenta i dysku, per projekt
domeny (status, latency, dni certyfikatu) i kontenery (stan, restarty), ostatnie
incydenty. Dotychczasowa lista serwisów z historią zostaje.

## Błędy

- Agent niedostępny → cel `agent` przechodzi przez maszynę stanów; cele
  `containers` i `disk` w tym cyklu nie są oceniane (brak danych ≠ awaria).
- Błąd listy tras Cloudflare → domeny z poprzedniego stanu (`monitor_state`),
  bez usuwania celów.
- Cel znikający z konfiguracji → wiersz stanu usuwany, otwarty incydent
  zamykany z przyczyną „cel usunięty”.

## Testy

Czyste funkcje: ocena każdego rodzaju, maszyna stanów (histereza, wyciszenie,
powiadomienia, incydenty), budowanie celów i przypisanie projektów, retencja.
Agent: parser `docker inspect`, parser rozmiarów, trasa `/status`.
Weryfikacja na Pi: zatrzymanie kontenera testowego → alert po 2 cyklach,
start → powrót; deploy nie generuje alertu.
