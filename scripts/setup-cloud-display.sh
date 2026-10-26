#!/usr/bin/env bash
set -euo pipefail
if command -v Xvfb >/dev/null || test -x /workspace/.tools/usr/bin/Xvfb; then exit 0; fi
gen3d_apt=/workspace/.gen3d-cloud/apt
mkdir -p "$gen3d_apt/lists/partial" "$gen3d_apt/archives/partial" "$gen3d_apt/empty" "$gen3d_apt/downloads" /workspace/.tools
cat > "$gen3d_apt/sources.list" <<'EOF'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
EOF
cat > "$gen3d_apt/config" <<'EOF'
Dir::Etc::main "/dev/null";
Dir::Etc::parts "/workspace/.gen3d-cloud/apt/empty";
Dir::Etc::sourcelist "/workspace/.gen3d-cloud/apt/sources.list";
Dir::Etc::sourceparts "/workspace/.gen3d-cloud/apt/empty";
Dir::State::lists "/workspace/.gen3d-cloud/apt/lists";
Dir::Cache::archives "/workspace/.gen3d-cloud/apt/archives";
APT::Sandbox::User "agent";
EOF
APT_CONFIG="$gen3d_apt/config" http_proxy="${HTTP_PROXY:-}" https_proxy="${HTTPS_PROXY:-}" /usr/bin/apt-get update
cd "$gen3d_apt/downloads"
APT_CONFIG="$gen3d_apt/config" http_proxy="${HTTP_PROXY:-}" https_proxy="${HTTPS_PROXY:-}" /usr/bin/apt-get download xvfb
for package in xvfb_*.deb; do dpkg-deb -x "$package" /workspace/.tools; done
