#!/usr/bin/env bash

# Detached self-deployment worker. It must run outside the dashboard process,
# because recreating the dashboard container terminates that process.
set -Eeuo pipefail

REPO_PATH=""
BRANCH="main"
STATUS_FILE=""
LOG_FILE=""
COMMIT=""
COMMIT_MESSAGE=""
JOB_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_PATH="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --status-file) STATUS_FILE="$2"; shift 2 ;;
    --log-file) LOG_FILE="$2"; shift 2 ;;
    --commit) COMMIT="$2"; shift 2 ;;
    --message) COMMIT_MESSAGE="$2"; shift 2 ;;
    --job-id) JOB_ID="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$REPO_PATH" || -z "$STATUS_FILE" || -z "$LOG_FILE" || -z "$JOB_ID" ]]; then
  echo "Missing required self-deploy argument" >&2
  exit 2
fi

if [[ ! "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ || "$BRANCH" == -* || "$BRANCH" == *..* ]]; then
  echo "Invalid branch name" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$STATUS_FILE")"
touch "$LOG_FILE"
exec >>"$LOG_FILE" 2>&1

LOCK_DIR="${STATUS_FILE}.lock"
SELF_SCRIPT_PATH="$0"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [[ -f "$LOCK_DIR/pid" ]] && kill -0 "$(cat "$LOCK_DIR/pid" 2>/dev/null || echo 0)" 2>/dev/null; then
    echo "[$(date -u +%FT%TZ)] Another self-deploy is already running; exiting."
    exit 0
  fi
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR"
fi
printf '%s\n' "$$" > "$LOCK_DIR/pid"

cleanup() {
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  if [[ "$SELF_SCRIPT_PATH" =~ ^/tmp/self-[A-Za-z0-9_.-]+\.sh$ ]]; then
    rm -f "$SELF_SCRIPT_PATH"
  fi
}
trap cleanup EXIT

json_escape() {
  printf '%s' "$1" | tr '\r\n' '  ' | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_status() {
  local status="$1"
  local message="$2"
  local progress="$3"
  local step="$4"
  local rollback="${5:-false}"
  local timestamp
  local escaped_message
  local escaped_commit
  local escaped_job_id
  local escaped_log_file
  local temp_file="${STATUS_FILE}.tmp"

  timestamp="$(date -u +%FT%TZ)"
  escaped_message="$(json_escape "$message")"
  escaped_commit="$(json_escape "$COMMIT")"
  escaped_job_id="$(json_escape "$JOB_ID")"
  escaped_log_file="$(json_escape "$LOG_FILE")"

  printf '{"status":"%s","message":"%s","commit":"%s","timestamp":"%s","step":"%s","progress":%s,"jobId":"%s","logFile":"%s","rollback":%s}\n' \
    "$status" "$escaped_message" "$escaped_commit" "$timestamp" "$step" "$progress" "$escaped_job_id" "$escaped_log_file" "$rollback" > "$temp_file"
  mv -f "$temp_file" "$STATUS_FILE"
  echo "[$timestamp] STATUS status=$status progress=$progress step=$step message=$message"
}

fail() {
  local message="$1"
  write_status "failed" "$message" 100 "failed" "${2:-false}"
  echo "[$(date -u +%FT%TZ)] DEPLOY_FAILED: $message"
  exit 1
}

unexpected_error() {
  local code="$?"
  write_status "failed" "Unexpected deploy worker error (line $1)" 100 "failed" "false" || true
  echo "[$(date -u +%FT%TZ)] DEPLOY_FAILED: unexpected error code=$code line=$1"
  exit "$code"
}
trap 'unexpected_error $LINENO' ERR

echo "[$(date -u +%FT%TZ)] SELF_DEPLOY_STARTED job=$JOB_ID repo=$REPO_PATH branch=$BRANCH commit=$COMMIT"
write_status "deploying" "Preparing deployment" 5 "prepare"

if [[ ! -d "$REPO_PATH/.git" || ! -f "$REPO_PATH/docker-compose.yml" ]]; then
  fail "Project directory or docker-compose.yml is not accessible"
fi

if ! git -C "$REPO_PATH" diff --quiet || ! git -C "$REPO_PATH" diff --cached --quiet; then
  fail "Working tree is not clean; deployment was refused"
fi

PREVIOUS_REF="$(git -C "$REPO_PATH" rev-parse HEAD)"
PREVIOUS_BRANCH="$(git -C "$REPO_PATH" symbolic-ref --short -q HEAD || true)"
echo "[$(date -u +%FT%TZ)] Previous commit: $PREVIOUS_REF"

write_status "deploying" "Fetching commit from GitHub" 12 "fetch"
if ! git -C "$REPO_PATH" fetch --prune origin "$BRANCH"; then
  fail "Git fetch failed"
fi

if ! git -C "$REPO_PATH" checkout "$BRANCH" 2>/dev/null; then
  if ! git -C "$REPO_PATH" checkout -b "$BRANCH" --track "origin/$BRANCH"; then
    fail "Could not switch to deployment branch"
  fi
fi

if ! git -C "$REPO_PATH" pull --ff-only origin "$BRANCH"; then
  fail "Git pull failed"
fi

COMMIT="$(git -C "$REPO_PATH" rev-parse --short HEAD)"
TARGET_REF="$(git -C "$REPO_PATH" rev-parse HEAD)"
write_status "deploying" "Building dashboard and runner images" 30 "build"

if ! (cd "$REPO_PATH" && docker compose build dashboard runner); then
  fail "Docker image build failed"
fi

write_status "deploying" "Starting updated dashboard and runner" 65 "restart"
if ! (cd "$REPO_PATH" && docker compose up -d --force-recreate dashboard runner); then
  fail "Failed to start updated containers"
fi

health_check() {
  local attempt
  for attempt in $(seq 1 60); do
    if command -v curl >/dev/null 2>&1; then
      if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3100/api/health >/dev/null; then return 0; fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q --timeout=5 --spider http://127.0.0.1:3100/api/health; then return 0; fi
    fi
    echo "[$(date -u +%FT%TZ)] Health check attempt $attempt/60 failed"
    sleep 2
  done
  return 1
}

write_status "deploying" "Waiting for dashboard health check" 82 "health"
if health_check; then
  write_status "success" "Deployment completed successfully" 100 "complete"
  echo "[$(date -u +%FT%TZ)] DEPLOY_COMPLETE target=$TARGET_REF"
  exit 0
fi

echo "[$(date -u +%FT%TZ)] Health check failed; starting rollback to $PREVIOUS_REF"
write_status "deploying" "New container is unhealthy; rolling back" 88 "rollback" "true"

if [[ -n "$PREVIOUS_BRANCH" ]]; then
  git -C "$REPO_PATH" checkout "$PREVIOUS_BRANCH"
  git -C "$REPO_PATH" reset --hard "$PREVIOUS_REF"
else
  git -C "$REPO_PATH" checkout --detach "$PREVIOUS_REF"
fi

if ! (cd "$REPO_PATH" && docker compose build dashboard runner && docker compose up -d --force-recreate dashboard runner); then
  fail "Rollback failed; manual intervention is required" "true"
fi

if health_check; then
  fail "Deployment failed; previous version was restored" "true"
else
  fail "Deployment and rollback health checks failed" "true"
fi
