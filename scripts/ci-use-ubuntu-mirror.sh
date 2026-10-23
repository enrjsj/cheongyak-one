#!/usr/bin/env bash
set -euo pipefail

# GitHub's Azure mirror stalled during WebKit dependency installation (CI #351).
# Keep suites, priorities, signatures and other mirrors; use Ubuntu's official HTTPS archive.
mirror_list=/etc/apt/apt-mirrors.txt
if [[ -f "$mirror_list" ]]; then
  sed -i 's|https\?://azure\.archive\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$mirror_list"
  echo 'Ubuntu archive mirror configured for browser dependencies.'
else
  echo 'Ubuntu mirror list is absent; retaining this runner image default sources.'
fi
