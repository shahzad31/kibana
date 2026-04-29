#!/usr/bin/env bash

set -euo pipefail

source .buildkite/scripts/common/util.sh

.buildkite/scripts/bootstrap.sh

# On PRs, run eslint on changed files first for a fast gate signal.
# If issues are found, cancel downstream steps immediately instead of
# waiting ~17 min for the full 90k-file lint to finish.
gate_already_failed=false
if is_pr; then
  echo '--- Lint: quick check (changed files only)'
  set +e
  set_git_merge_base
  merge_base_ok=$?
  set -e

  if [[ "$merge_base_ok" == "0" && -n "${GITHUB_PR_MERGE_BASE:-}" ]]; then
    changed_lint_files=$(git diff --name-only "$GITHUB_PR_MERGE_BASE"...HEAD -- '*.js' '*.mjs' '*.ts' '*.tsx' 2>/dev/null || true)

    if [[ -n "$changed_lint_files" ]]; then
      file_count=$(echo "$changed_lint_files" | wc -l | tr -d ' ')
      echo "Found $file_count changed JS/TS file(s) to quick-check"

      set +e
      echo "$changed_lint_files" | xargs node scripts/eslint --no-cache --fix
      quick_eslint_exit=$?
      set -e

      quick_fix_changes="$(git status --porcelain -- '*.js' '*.mjs' '*.ts' '*.tsx')"

      if [[ "$quick_eslint_exit" != "0" || -n "$quick_fix_changes" ]]; then
        echo "❌ ESLint issues found in changed files — cancelling downstream steps early"
        .buildkite/scripts/steps/gate_failure/cancel.sh || true
        gate_already_failed=true
      else
        echo "quick eslint check passed ✅"
      fi
    else
      echo "No JS/TS files changed, skipping quick check"
    fi
  else
    echo "Could not resolve merge base, skipping quick check"
  fi
fi

echo '--- Lint: stylelint'
node scripts/stylelint
echo "stylelint ✅"

echo '--- Lint: eslint'
# disable "Exit immediately" mode so that we can run eslint, capture it's exit code, and respond appropriately
# after possibly commiting fixed files to the repo
set +e;
if is_pr && ! is_auto_commit_disabled; then
  desc="node scripts/eslint_all_files --no-cache --fix"
  node scripts/eslint_all_files --no-cache --fix
else
  desc="node scripts/eslint_all_files --no-cache"
  node scripts/eslint_all_files --no-cache
fi

eslint_exit=$?
# re-enable "Exit immediately" mode
set -e;

check_for_changed_files "$desc" true

if [[ "${eslint_exit}" != "0" ]]; then
  exit 1
fi

echo "eslint ✅"
