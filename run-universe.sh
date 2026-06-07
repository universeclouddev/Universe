#!/usr/bin/env bash
# Run Universe master from the repository root (Git Bash / WSL / Linux / macOS).
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

check_cluster_ports() {
  local pid6000 pid7000
  pid6000="$(listening_pid_for_port 6000 || true)"
  pid7000="$(listening_pid_for_port 7000 || true)"

  if [[ -n "${pid6000}" ]]; then
    echo "Universe already running on :6000 — stop it first with \`stop\` in the Universe console or kill PID ${pid6000}." >&2
    echo "  ./stop-universe.sh   or   taskkill //PID ${pid6000} //F   (Git Bash on Windows)" >&2
    exit 1
  fi

  if [[ -n "${pid7000}" ]]; then
    echo "Port 7000 (API) already in use by PID ${pid7000}. Free it before starting Universe." >&2
    exit 1
  fi
}

check_cluster_ports

# Git Bash (not PowerShell $env:JAVA_HOME):
#   export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-25.0.2.10-hotspot"
DEFAULT_WIN_JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-25.0.2.10-hotspot"
DEFAULT_UNIX_JAVA_HOME="/usr/lib/jvm/java-25-openjdk"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if is_windows_msys && [[ -d "${DEFAULT_WIN_JAVA_HOME}" ]]; then
    export JAVA_HOME="${DEFAULT_WIN_JAVA_HOME}"
  elif [[ -d "${DEFAULT_UNIX_JAVA_HOME}" ]]; then
    export JAVA_HOME="${DEFAULT_UNIX_JAVA_HOME}"
  fi
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "JAVA_HOME is not set. Git Bash example:" >&2
  echo '  export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-25.0.2.10-hotspot"' >&2
  echo '  export PATH="$JAVA_HOME/bin:$PATH"' >&2
  exit 1
fi

export PATH="${JAVA_HOME}/bin:${PATH}"

if ! command -v java >/dev/null 2>&1; then
  echo "java not found (JAVA_HOME=${JAVA_HOME}). Fix PATH or unset JAVA_HOME to use the script default." >&2
  exit 1
fi

JAR="loader/build/libs/universe.jar"
if [[ ! -f "${JAR}" ]]; then
  echo "Missing ${JAR}. Build: ./gradlew :loader:shadowJar" >&2
  exit 1
fi

exec java \
  --add-modules=java.se \
  --add-exports=java.base/jdk.internal.ref=ALL-UNNAMED \
  --add-opens=java.base/java.time=ALL-UNNAMED \
  --add-opens=java.base/java.net=ALL-UNNAMED \
  --add-opens=java.base/java.io=ALL-UNNAMED \
  --add-opens=java.base/java.lang=ALL-UNNAMED \
  --add-opens=java.base/java.nio=ALL-UNNAMED \
  --add-opens=java.base/sun.nio.ch=ALL-UNNAMED \
  --add-opens=java.management/sun.management=ALL-UNNAMED \
  --add-opens=jdk.management/com.sun.management.internal=ALL-UNNAMED \
  --enable-native-access=ALL-UNNAMED \
  -jar "${JAR}"
