#!/usr/bin/env bash

set -euo pipefail

source .buildkite/scripts/common/util.sh

echo "--- Extract Kibana Distribution"
version="$(jq -r '.version' package.json)"
linuxBuild="$KIBANA_DIR/target/kibana-$version-SNAPSHOT-linux-x86_64.tar.gz"
mkdir -p "$KIBANA_BUILD_LOCATION"
tar -xzf "$linuxBuild" -C "$KIBANA_BUILD_LOCATION" --strip=1

echo '--- Default Saved Object Field Metrics'
node scripts/functional_tests \
  --debug --bail \
  --kibana-install-dir "$KIBANA_BUILD_LOCATION" \
  --config x-pack/platform/test/saved_objects_field_count/config.ts
