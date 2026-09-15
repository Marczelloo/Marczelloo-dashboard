# Etap 1 — import na Raspberry Pi

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Warunek: etap 0 wdrożony, logowanie przez Access i PIN działają.

Każdy krok zmieniający dane (migracja, zapis importu) wymaga zgody właściciela
w chwili wykonania. Skan jest tylko do odczytu, ale dotyka produkcji — też za
zgodą.

## 1. Stan „przed” (tylko odczyt)

```bash
docker ps -a --format '{{.Names}} {{.ID}} {{.CreatedAt}}' | sort > /tmp/stage1-before.txt
wc -l /tmp/stage1-before.txt
```

## 2. Migracja tabel (zgoda)

Po wdrożeniu kodu etapu 1 (push do `main`). Zmienne pochodzą z działającego
kontenera dashboardu, więc cudzysłowy w `.env` nie mają znaczenia; wartości
nie są wypisywane.

```bash
cd ~/projects/Marczelloo-dashboard
export ATLASHUB_API_URL="$(docker exec marczelloo-dashboard printenv ATLASHUB_API_URL)"
export ATLASHUB_SECRET_KEY="$(docker exec marczelloo-dashboard printenv ATLASHUB_SECRET_KEY)"
docker run --rm -e ATLASHUB_API_URL -e ATLASHUB_SECRET_KEY -v "$PWD/scripts/migrations:/m:ro" node:20-alpine sh -c 'npx --yes tsx /m/2026-09-16-app-import-tables.ts'
unset ATLASHUB_API_URL ATLASHUB_SECRET_KEY
```

Expected: 4 × `…: ready` (tabele) i 3 × `…: ready` (indeksy).

## 3. Skan i zapis (zgoda na zapis)

1. `https://dashboard.marczelloo.dev/import` → „Skanuj serwer” → PIN.
2. Oczekiwane dopasowania „pewne” dla sześciu stacków: `atlas-hub`, `marczelloo-dashboard`, `marczelloo-drive`, `marczelloo-tools`, `neobeatbuddy`, `portfolio-redesign` — każdy do odpowiadającego projektu w dashboardzie. Stack z dopasowaniem „do potwierdzenia” lub „brak” przypisz ręcznie albo pomiń.
3. Oczekiwane ostrzeżenia: neobeatbuddy „nie jest repozytorium Git” i „Pominięte pliki env … .env.live …”; marczelloo-tools „override z katalogu logów”.
4. Trasy: 21 reguł, 19 domen; reguła `/api/github/webhook` i badge `originRequest` przy storage-atlashub; 9 domen „usługa hosta :8080” (Caddy).
5. Przejrzyj konflikty env (szczególnie `ACTIVITY_ALLOWED_ORIGINS` w neobeatbuddy — kontener ma inną wartość niż plik) i różnice testu na sucho. Zapisz import.
6. Kontrola braku wartości w przeglądarce: DevTools → Network → odpowiedź akcji skanu nie zawiera wartości żadnego sekretu (np. wyszukaj fragment hasła z `.env` AtlasHuba).

## 4. Weryfikacja „po”

```bash
docker ps -a --format '{{.Names}} {{.ID}} {{.CreatedAt}}' | sort > /tmp/stage1-after.txt
diff /tmp/stage1-before.txt /tmp/stage1-after.txt && echo NO_CONTAINER_CHANGES
```

Expected: `NO_CONTAINER_CHANGES`.

```bash
docker exec -i marczelloo-dashboard node - <<'JS'
const base = process.env.ATLASHUB_API_URL, key = process.env.ATLASHUB_SECRET_KEY;
const rows = async (table, query = "") => (await (await fetch(`${base}/v1/db/${table}?limit=1000${query}`, { headers: { "x-api-key": key } })).json()).data;
(async () => {
  const configs = await rows("app_configs");
  const versions = await rows("app_env_versions", "&select=project_id,version,keys");
  const routes = await rows("app_routes");
  const items = await rows("work_items", "&select=id");
  console.log("app_configs", configs.map((c) => c.compose_project).sort().join(","));
  for (const v of versions) console.log("env", v.project_id, "v" + v.version, v.keys.length, "keys");
  console.log("routes", routes.length, "hostnames", new Set(routes.map((r) => r.hostname).filter(Boolean)).size);
  console.log("work_items", items.length);
})();
JS
```

Expected: 6 konfiguracji; wersja 1 env dla każdego zaimportowanego projektu;
`routes 21 hostnames 19`; `work_items 64`.

Powtórny zapis tego samego skanu nie tworzy wersji 2 (wynik „bez zmian”).

## 5. Wycofanie (zgoda)

Import nie zmienia kontenerów ani istniejących tabel. Cofnięcie = usunięcie
wierszy z nowych tabel (`app_configs`, `app_env_versions`, `app_routes`,
`app_snapshots`); tabele mogą zostać.
