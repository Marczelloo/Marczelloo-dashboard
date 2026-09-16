FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Docker CLI and the Compose plugin are copied from the Raspberry Pi host by the
# runbook (agent/vendor). The agent must use the same Compose version as the
# host, otherwise Compose computes different config hashes and recreates
# containers that did not change.
COPY vendor/docker /usr/local/bin/docker
COPY vendor/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src

USER 1000:1000
ENV NODE_ENV=production HOME=/tmp/agent-home
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/main.ts"]
