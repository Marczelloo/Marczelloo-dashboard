# Etap 5 — deploy repozytoriów bez własnego docker-compose

Wdrożone 16.09.2026 (`2a97bb9`, `056183d`). Wymaga agenta wdrożeń (nowe projekty dostają `engine: "agent"`).

## Jak to działa

1. „Deploy z GitHuba” → po wyborze repozytorium dashboard czyta katalog główny przez GitHub App
   (`package.json`, `Dockerfile`, `requirements.txt`, `pyproject.toml`) i proponuje sposób budowania:
   - własny `compose.yaml` / `docker-compose.yml` → dotychczasowa ścieżka,
   - własny `Dockerfile` → compose generowany przez dashboard (port z `EXPOSE`),
   - Node.js (Next.js, Nuxt, SvelteKit, Remix, Express, zwykły Node) → szablon `node:20-alpine`,
   - Vite/Astro bez serwera i czysty `index.html` → build + `nginx:1.27-alpine` z fallbackiem SPA,
   - Python (FastAPI, Flask, skrypt) → szablon `python:3.12-slim`.
   Typ, port, komendy i katalog wynikowy można poprawić w formularzu.
2. Opis builda (`build`) zapisuje się w konfiguracji wdrożenia. Przy każdym zadaniu dashboard renderuje
   compose i przekazuje go agentowi (`target.generatedCompose`); agent zapisuje go w
   `~/projects/.dashboard/agent/overrides/<projekt>.generated.yml` i buduje z katalogiem repozytorium.
   Do repozytorium użytkownika nic nie trafia.

## Bezpieczeństwo i porządek

- Dockerfile kopiuje kontekst z `--exclude=.env --exclude=.env.* --exclude=.git --exclude=node_modules`;
  zmienne trafiają do kontenera przez `env_file` (niewymagany) w czasie uruchomienia, nigdy do obrazu.
- Port tylko `127.0.0.1:<port lokalny>:<port aplikacji>`; limity logów 10m × 3; etykiety `dev.marczelloo.*`.
- `$` w osadzonym Dockerfile jest escapowany (`$$`), bo Compose podstawia zmienne także w `dockerfile_inline`.

## Weryfikacja 16.09.2026 na Pi (przykłady w /tmp, usunięte)

- Node: `compose config` OK, build, odpowiedź z serwera; zmienna z `.env` widoczna w kontenerze,
  brak `.env` i jego treści w obrazie.
- Strona statyczna: build nginx, `/` → 200, dowolna ścieżka SPA → 200 (po poprawce `$$`), w obrazie tylko `index.html`.
