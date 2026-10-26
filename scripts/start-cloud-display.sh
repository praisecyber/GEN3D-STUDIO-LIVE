#!/usr/bin/env bash
set -euo pipefail
export DISPLAY="${DISPLAY:-:99}"
if xdpyinfo >/dev/null 2>&1; then exit 0; fi
if command -v Xvfb >/dev/null; then gen3d_xvfb="$(command -v Xvfb)"; else gen3d_xvfb=/workspace/.tools/usr/bin/Xvfb; fi
mkdir -p /workspace/.gen3d-cloud
nohup "$gen3d_xvfb" "$DISPLAY" -screen 0 1440x1000x24 -nolisten tcp > /workspace/.gen3d-cloud/xvfb.log 2>&1 &
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if xdpyinfo >/dev/null 2>&1; then exit 0; fi
  sleep 0.25
done
cat /workspace/.gen3d-cloud/xvfb.log >&2
exit 1
