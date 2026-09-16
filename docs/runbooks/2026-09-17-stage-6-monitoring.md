# Etap 6 — monitoring v2

Projekt: `docs/superpowers/specs/2026-09-17-monitoring-v2-design.md`.

## Co działa

- Jedna pętla monitoringu co `MONITORING_INTERVAL_MS` (domyślnie 60 s) w
  kontenerze dashboardu; `/api/cron/monitoring` i przycisk na stronie
  Monitoring wołają tę samą pętlę (nigdy równolegle).
- Cele: agent, dysk Pi, kontenery każdego projektu agenta, każda domena z tunelu
  i z adresów serwisów, certyfikat każdej domeny (co 12 h).
- Alert na Discordzie tylko przy zmianie stanu; awaria po 2 nieudanych
  sprawdzeniach (certyfikat i dysk po 1); cisza w trakcie deployu projektu i
  2 min po nim.
- Stan: tabela `monitor_state`; incydenty: `monitor_incidents` (zamknięte
  usuwane po `MONITOR_INCIDENT_RETENTION_DAYS`, domyślnie 90 dni).
- Agent: `GET /status` (token) — kontenery, aktywne zadania, dysk, build cache.

## Wdrożenie (wykonane 2026-09-17)

1. Tabele: `scripts/migrations/2026-09-17-monitoring-tables.ts` (tak jak w
   runbooku etapu 1, z `ATLASHUB_*` z działającego kontenera).
2. Push kodu agenta → deploy dashboardu → `docker compose build && up -d` w
   `~/projects/Marczelloo-dashboard/agent` (przed kodem dashboardu, żeby nowy
   monitoring nie zgłosił awarii agenta bez `/status`).
3. Push kodu dashboardu → deploy agentem.

Pierwszy cykl na Pi: 48 celów, wszystkie `ok`, 0 incydentów.

## Sprawdzenie ręczne

```bash
docker exec marczelloo-dashboard node -e 'fetch("http://mz-agent:8790/status",{headers:{authorization:"Bearer "+process.env.AGENT_TOKEN}}).then(r=>r.json()).then(j=>console.log(Object.keys(j.projects), j.disk))'
docker logs --since 10m marczelloo-dashboard 2>&1 | grep Scheduler
```

Test alertu: zatrzymać kontener projektu agenta poza deployem
(`docker stop <kontener>`), po ~2 min przychodzi „Kontenery …: awaria”;
`docker start <kontener>` → „znowu działa” i zamknięty incydent.

## Odłożone

Build obrazów w GitHub Actions (osobny etap).
