#!/usr/bin/env bash

set -euo pipefail

# node scripts/build rebuilds shared webpack bundles in production mode,
# so skip the dev-mode pre-build during bootstrap.
export KBN_BOOTSTRAP_NO_PREBUILT=true

.buildkite/scripts/bootstrap.sh
.buildkite/scripts/build_kibana.sh
.buildkite/scripts/post_build_kibana.sh

# Extract the build into KIBANA_BUILD_LOCATION for saved_object_field_metrics
# which runs on this same agent and needs the unpacked distribution.
source .buildkite/scripts/common/util.sh
version="$(jq -r '.version' package.json)"
linuxBuild="$KIBANA_DIR/target/kibana-$version-SNAPSHOT-linux-x86_64.tar.gz"
mkdir -p "$KIBANA_BUILD_LOCATION"
tar -xzf "$linuxBuild" -C "$KIBANA_BUILD_LOCATION" --strip=1

.buildkite/scripts/saved_object_field_metrics.sh
