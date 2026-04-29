#!/usr/bin/env bash

set -euo pipefail

source .buildkite/scripts/steps/functional/common.sh

BUILDKITE_PARALLEL_JOB=${BUILDKITE_PARALLEL_JOB:-}
FTR_CONFIG_GROUP_KEY=${FTR_CONFIG_GROUP_KEY:-}
if [ "$FTR_CONFIG_GROUP_KEY" == "" ] && [ "$BUILDKITE_PARALLEL_JOB" == "" ]; then
  echo "Missing FTR_CONFIG_GROUP_KEY env var"
  exit 1
fi

EXTRA_ARGS=${FTR_EXTRA_ARGS:-}
test -z "$EXTRA_ARGS" || buildkite-agent meta-data set "ftr-extra-args" "$EXTRA_ARGS"

export JOB="$FTR_CONFIG_GROUP_KEY"

FAILED_CONFIGS_KEY="${BUILDKITE_STEP_ID}${FTR_CONFIG_GROUP_KEY}"

exitCode=0
eagerRetryCount=0

configs="${FTR_CONFIG:-}"

# The first retry should only run the configs that failed in the previous attempt
# Any subsequent retries, which would generally only happen by someone clicking the button in the UI, will run everything
if [[ ! "$configs" && "${BUILDKITE_RETRY_COUNT:-0}" == "1" ]]; then
  configs=$(buildkite-agent meta-data get "$FAILED_CONFIGS_KEY" --default '')
  if [[ "$configs" ]]; then
    echo "--- Retrying only failed configs"
    echo "$configs"
  fi
fi

if [ "$configs" == "" ] && [ "$FTR_CONFIG_GROUP_KEY" != "" ]; then
  echo "--- downloading ftr test run order"
  download_artifact ftr_run_order.json .
  configs=$(jq -r '.[env.FTR_CONFIG_GROUP_KEY].names[]' ftr_run_order.json)
fi

if [ "$configs" == "" ]; then
  echo "unable to determine configs to run"
  exit 1
fi

# Eager retry: when enabled and a config fails on the first attempt, a new Buildkite
# step is dynamically uploaded to retry that single config on a fresh agent immediately.
# This allows the current agent to keep running the remaining configs uninterrupted while
# the retry provisions and bootstraps in parallel — saving 5-8 min of sequential wait
# that the standard Buildkite retry.automatic mechanism would incur.
EAGER_RETRY_ENABLED="${FTR_EAGER_RETRY_ENABLED:-true}"

build_agent_yaml() {
  local queue="${FTR_AGENT_QUEUE:-n2-4-spot}"
  local kind cores addition
  IFS='-' read -r kind cores addition <<< "$queue"

  echo "    provider: gcp"
  echo "    image: family/kibana-ubuntu-2404"
  echo "    imageProject: elastic-images-prod"
  echo "    machineType: ${kind}-standard-${cores}"
  echo "    diskSizeGb: 105"

  case "$addition" in
    spot)
      echo "    preemptible: true"
      echo "    zones: southamerica-east1-c,asia-south2-a,us-central1-f"
      ;;
    virt)
      echo "    enableNestedVirtualization: true"
      echo "    spotZones: southamerica-east1-c,asia-south2-a,us-central1-f"
      ;;
  esac
}

upload_eager_retry_step() {
  local failed_config="$1"
  local retry_label="${BUILDKITE_LABEL} [eager-retry: $(basename "$failed_config")]"
  local retry_key="eager_retry_${FTR_CONFIG_GROUP_KEY}_${eagerRetryCount}"

  echo "--- Uploading eager retry step for: $failed_config"

  local agent_yaml
  agent_yaml="$(build_agent_yaml)"

  cat << PIPELINE | buildkite-agent pipeline upload
steps:
  - label: "${retry_label}"
    command: ".buildkite/scripts/steps/test/ftr_configs.sh"
    timeout_in_minutes: 50
    key: "${retry_key}"
    agents:
${agent_yaml}
    env:
      FTR_CONFIG_GROUP_KEY: "${FTR_CONFIG_GROUP_KEY}"
      FTR_CONFIG: "${failed_config}"
      FTR_EAGER_RETRY_ENABLED: "false"
    retry:
      automatic:
        - exit_status: "-1"
          limit: 3
PIPELINE

  eagerRetryCount=$((eagerRetryCount + 1))
}

can_eager_retry() {
  [[ "$EAGER_RETRY_ENABLED" == "true" \
    && "${BUILDKITE_RETRY_COUNT:-0}" == "0" \
    && -z "${KIBANA_FLAKY_TEST_RUNNER_CONFIG:-}" ]]
}

failedConfigs=""
results=()

while read -r config; do
  if [[ ! "$config" ]]; then
    continue;
  fi

  FULL_COMMAND="node scripts/functional_tests --bail --config $config $EXTRA_ARGS"

  # see if this config has already been executed successfully
  CONFIG_EXECUTION_KEY="${config}_executed"
  IS_CONFIG_EXECUTION=$(buildkite-agent meta-data get "$CONFIG_EXECUTION_KEY" --default "false" --log-level error)
  # we don't want this optimization for flaky test runs
  IS_FLAKY_TEST_RUN=$(test -z "${KIBANA_FLAKY_TEST_RUNNER_CONFIG:-}" && echo "false" || echo "true")

  if [[ "$IS_CONFIG_EXECUTION" == "true" && "$IS_FLAKY_TEST_RUN" == "false" ]]; then
    echo "--- [ already-tested ] $FULL_COMMAND"
    continue
  else
    echo "--- $ $FULL_COMMAND"
  fi

  start=$(date +%s)

  if [[ "${USE_CHROME_BETA:-}" =~ ^(1|true)$ ]]; then
    echo "USE_CHROME_BETA was set - using google-chrome-beta"
    export TEST_BROWSER_BINARY_PATH="$(which google-chrome-beta)"

    # download the beta version of chromedriver
    export CHROMEDRIVER_VERSION=$(curl https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json -s | jq -r '.channels.Beta.version')
    export DETECT_CHROMEDRIVER_VERSION=false
    node node_modules/chromedriver/install.js --chromedriver-force-download

    # set annotation on the build
    buildkite-agent annotate --style info --context chrome-beta """
  ⚠️This build uses Google Chrome Beta
  Path: ${TEST_BROWSER_BINARY_PATH}
  Version: $($TEST_BROWSER_BINARY_PATH --version)
  Chromedriver version: ${CHROMEDRIVER_VERSION} / $(node node_modules/chromedriver/bin/chromedriver --version)
  """
  fi

  # prevent non-zero exit code from breaking the loop
  set +e;
  node ./scripts/functional_tests \
    --bail \
    --kibana-install-dir "$KIBANA_BUILD_LOCATION" \
    --config="$config" \
    "$EXTRA_ARGS"
  lastCode=$?
  set -e;

  # Scout reporter
  if [[ "${SCOUT_REPORTER_ENABLED:-}" =~ ^(1|true)$ ]]; then
    # Upload events after running each config
    echo "Upload Scout reporter events to AppEx QA's team cluster for config $config"
    node scripts/scout upload-events --dontFailOnError
    echo "Upload successful, removing local events at .scout/reports"
    rm -rf .scout/reports
  else
    echo "SCOUT_REPORTER_ENABLED=$SCOUT_REPORTER_ENABLED, skipping event upload."
  fi

  timeSec=$(($(date +%s)-start))
  if [[ $timeSec -gt 60 ]]; then
    min=$((timeSec/60))
    sec=$((timeSec-(min*60)))
    duration="${min}m ${sec}s"
  else
    duration="${timeSec}s"
  fi

  results+=("- $config
    duration: ${duration}
    result: ${lastCode}")

  if [ $lastCode -eq 0 ]; then
    # Test was successful, so mark it as executed
    buildkite-agent meta-data set "$CONFIG_EXECUTION_KEY" "true"
  else
    echo "FTR exited with code $lastCode"
    echo "^^^ +++"

    if [[ "$failedConfigs" ]]; then
      failedConfigs="${failedConfigs}"$'\n'"$config"
    else
      failedConfigs="$config"
    fi

    if can_eager_retry; then
      upload_eager_retry_step "$config"
    else
      exitCode=10
    fi
  fi
done <<< "$configs"

if [[ "$failedConfigs" ]]; then
  buildkite-agent meta-data set "$FAILED_CONFIGS_KEY" "$failedConfigs"
fi

echo "--- FTR configs complete"
printf "%s\n" "${results[@]}"
echo ""

if [[ $eagerRetryCount -gt 0 ]]; then
  echo "Delegated $eagerRetryCount failed config(s) to eager-retry steps"
fi

# When eager retry steps were uploaded, exit 0 so Buildkite's retry.automatic
# does not fire — the dynamically uploaded steps handle the retries on fresh agents.
if [[ $eagerRetryCount -gt 0 ]]; then
  exit 0
fi

exit $exitCode
