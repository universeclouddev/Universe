#!/usr/bin/env bash
# Stop Universe: kill process listening on Hazelcast port 6000.
set -euo pipefail
cd "$(dirname "$0")"

is_windows_msys() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW* | MSYS* | CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

listening_pid_for_port() {
  local port="$1"
  local pid=""

  if is_windows_msys && command -v netstat >/dev/null 2>&1; then
    pid="$(netstat -ano 2>/dev/null | awk -v port=":${port}" '
      $0 ~ /LISTENING/ && ($2 ~ port"$" || $2 ~ port"\\]$") { print $NF; exit }
    ')"
  elif command -v ss >/dev/null 2>&1; then
    pid="$(ss -lntp 2>/dev/null | awk -v port=":${port}" '
      $0 ~ port && match($0, /pid=([0-9]+)/, m) { print m[1]; exit }
    ')"
  elif command -v lsof >/dev/null 2>&1; then
    pid="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | awk "NR==2 { print \$2; exit }")"
  fi

  if [[ -n "${pid}" && "${pid}" != "0" ]]; then
    echo "${pid}"
  fi
}

pid="$(listening_pid_for_port 6000 || true)"
if [[ -z "${pid}" ]]; then
  echo "No listener on port 6000."
  exit 0
fi

echo "Killing PID ${pid} (port 6000)..."
if is_windows_msys; then
  taskkill //PID "${pid}" //T //F 2>/dev/null || taskkill /PID "${pid}" /T /F
else
  kill "${pid}" 2>/dev/null || kill -9 "${pid}"
fi