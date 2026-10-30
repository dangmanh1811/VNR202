#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

WEB_PORT="${WEB_PORT:-5173}"
LAN_PORT="${LAN_PORT:-5174}"
CONDA_SH="${CONDA_SH:-$HOME/miniconda3/etc/profile.d/conda.sh}"
TUNNEL_PID=""
LOG="$(mktemp)"

print_links() {
  local title="$1"
  local base="${2%/}"
  echo
  echo "=============================================="
  echo "  ${title}"
  echo "  HOST (máy chiếu):"
  echo "    ${base}/?host=1"
  echo "  NGƯỜI CHƠI (chọn nhóm):"
  echo "    ${base}/"
  echo "=============================================="
}

lan_bases() {
  echo "http://127.0.0.1:${WEB_PORT}"
  ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | while read -r ip; do
    echo "http://${ip}:${WEB_PORT}"
  done
}

if [[ -f "$CONDA_SH" ]]; then
  # shellcheck disable=SC1090
  source "$CONDA_SH"
  conda activate fpt_env >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Cần Node.js và npm trên PATH (env fpt_env)." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Đang cài npm packages…"
  npm ci
fi

if command -v fuser >/dev/null; then
  fuser -k "${WEB_PORT}/tcp" "${LAN_PORT}/tcp" >/dev/null 2>&1 || true
  sleep 0.4
fi

echo "Mở máy chủ lớp học trên cổng ${WEB_PORT}…"
npm run dev &
DEV_PID=$!

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "Đang tắt máy chủ…"
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  kill "$DEV_PID" >/dev/null 2>&1 || true
  wait "$DEV_PID" 2>/dev/null || true
  command -v fuser >/dev/null && fuser -k "${WEB_PORT}/tcp" "${LAN_PORT}/tcp" >/dev/null 2>&1 || true
  rm -f "$LOG"
}
trap cleanup INT TERM EXIT

for _ in $(seq 1 40); do
  if command -v ss >/dev/null && ss -ltn | grep -q ":${WEB_PORT} "; then
    break
  fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Máy chủ không khởi động được." >&2
    exit 1
  fi
  sleep 0.25
done

while read -r base; do
  print_links "Cùng Wi-Fi" "$base"
done < <(lan_bases)

if command -v cloudflared >/dev/null; then
  echo
  echo "Đang mở link công khai (điện thoại 4G cũng vào được)…"
  cloudflared tunnel --url "http://127.0.0.1:${WEB_PORT}" --no-autoupdate >"$LOG" 2>&1 &
  TUNNEL_PID=$!
  public=""
  for _ in $(seq 1 40); do
    public="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" | head -n 1 || true)"
    if [[ -n "$public" ]]; then
      break
    fi
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "Không mở được tunnel công khai." >&2
      cat "$LOG" >&2 || true
      wait "$DEV_PID"
      exit 1
    fi
    sleep 0.4
  done
  if [[ -z "$public" ]]; then
    echo "Chưa lấy được link Cloudflare. Xem log:" >&2
    cat "$LOG" >&2 || true
  else
    print_links "Link công khai" "$public"
  fi
  echo "Giữ terminal này. Tắt bằng Ctrl+C."
  wait "$TUNNEL_PID"
else
  echo
  echo "Chưa có cloudflared nên chỉ host LAN."
  echo "Giữ terminal này. Tắt bằng Ctrl+C."
  wait "$DEV_PID"
fi
