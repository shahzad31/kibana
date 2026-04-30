#!/usr/bin/env bash

set -euo pipefail

# Fan out remaining FTR configs into parallel Buildkite jobs after a preemption.
# Called by ftr_configs.sh when a retry is detected with multiple configs remaining.
#
# Usage: ftr_fan_out_remaining.sh <config1> <config2> [config3 ...]

remaining_configs=("$@")

if [[ ${#remaining_configs[@]} -lt 2 ]]; then
  echo "Expected at least 2 remaining configs, got ${#remaining_configs[@]}"
  exit 1
fi

FTR_AGENT_QUEUE="${FTR_AGENT_QUEUE:-n2-4-spot}"
FTR_CONFIGS_SCRIPT="${FTR_CONFIGS_SCRIPT:-.buildkite/scripts/steps/test/ftr_configs.sh}"
FTR_CONFIG_GROUP_KEY="${FTR_CONFIG_GROUP_KEY:-}"
FTR_EXTRA_ARGS="${FTR_EXTRA_ARGS:-}"

IFS='-' read -r kind cores addition <<< "$FTR_AGENT_QUEUE"

machine_type="${kind}-standard-${cores}"
zones_to_use="southamerica-east1-c,asia-south2-a,us-central1-f"

# Build agent properties matching expandAgentQueue() output.
# The image/project may differ for FIPS builds but fan-out steps inherit
# the same pipeline env so Buildkite will apply the correct image automatically.
agent_props="provider: gcp"
agent_props+="\n      image: family/kibana-ubuntu-2404"
agent_props+="\n      imageProject: elastic-images-prod"
agent_props+="\n      machineType: ${machine_type}"
agent_props+="\n      diskSizeGb: 105"

if [[ "$addition" == "spot" ]]; then
  agent_props+="\n      preemptible: true"
  agent_props+="\n      spotZones: ${zones_to_use}"
elif [[ "$addition" == "virt" ]]; then
  agent_props+="\n      enableNestedVirtualization: true"
  agent_props+="\n      spotZones: ${zones_to_use}"
fi

pipeline_yaml="steps:"
for config in "${remaining_configs[@]}"; do
  # Use the last two path segments for a readable but unique label
  parent_dir="$(basename "$(dirname "$config")")"
  filename="$(basename "$config")"
  short_label="${parent_dir}/${filename}"

  env_lines="      FTR_CONFIG: \"${config}\""
  if [[ -n "$FTR_CONFIG_GROUP_KEY" ]]; then
    env_lines+=$'\n'"      FTR_CONFIG_GROUP_KEY: \"${FTR_CONFIG_GROUP_KEY}\""
  fi
  if [[ -n "$FTR_EXTRA_ARGS" ]]; then
    env_lines+=$'\n'"      FTR_EXTRA_ARGS: \"${FTR_EXTRA_ARGS}\""
  fi

  pipeline_yaml+="
  - label: \"[retry-split] ${short_label}\"
    command: \"${FTR_CONFIGS_SCRIPT}\"
    timeout_in_minutes: 50
    agents:
      $(echo -e "$agent_props")
    env:
${env_lines}
    retry:
      automatic:
        - exit_status: '-1'
          limit: 3"
done

echo "--- Uploading ${#remaining_configs[@]} parallel fan-out steps"
echo -e "$pipeline_yaml"

echo -e "$pipeline_yaml" | buildkite-agent pipeline upload
