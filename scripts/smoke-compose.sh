#!/usr/bin/env bash
# Smoke-test the Compose happy path against published host ports.
# Prerequisite: docker compose up -d --build (mock provider recommended).
set -euo pipefail

PROCESSOR_BASE="${PROCESSOR_BASE:-http://127.0.0.1:3002}"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-90}"
ALERTS_TIMEOUT_S="${ALERTS_TIMEOUT_S:-180}"
POLL_INTERVAL_S="${POLL_INTERVAL_S:-5}"

log() {
  printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"
}

wait_http_ok() {
  local url="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_S))
  while (( SECONDS < deadline )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "OK $url"
      return 0
    fi
    sleep "$POLL_INTERVAL_S"
  done
  log "FAIL timed out waiting for $url (${HEALTH_TIMEOUT_S}s)"
  return 1
}

wait_alerts() {
  local url="${PROCESSOR_BASE}/alerts"
  local deadline=$((SECONDS + ALERTS_TIMEOUT_S))
  while (( SECONDS < deadline )); do
    local body
    if body=$(curl -fsS "$url" 2>/dev/null); then
      # Accept a non-empty JSON array: [{...}, ...]
      if printf '%s' "$body" | grep -Eq '^\[.+\]$'; then
        local count
        count=$(printf '%s' "$body" | grep -o '"eventId"' | wc -l | tr -d ' ')
        if [[ "${count}" -ge 1 ]]; then
          log "OK ${url} returned ${count} alert(s)"
          return 0
        fi
      fi
      log "waiting for alerts… got: ${body:0:120}"
    else
      log "waiting for alerts… ${url} not reachable yet"
    fi
    sleep "$POLL_INTERVAL_S"
  done
  log "FAIL no alerts at ${url} within ${ALERTS_TIMEOUT_S}s"
  return 1
}

log "Smoke against ${PROCESSOR_BASE}"
wait_http_ok "${PROCESSOR_BASE}/health/live"
wait_http_ok "${PROCESSOR_BASE}/health/ready"
wait_alerts
log "Smoke passed"
