import { backportRun } from 'backport';

// Mirrors the options on-merge/index.ts passes in kibana-github-actions#87,
// plus dryRun/fork:false and no status comments so nothing is written to GitHub.
const cases = [
  { pr: 296087, targets: ['9.5'] },
  { pr: 295668, targets: ['9.5'] },
  { pr: 295480, targets: ['9.5'] },
  { pr: 295614, targets: ['9.4'] }, // expected to fail: 9.4 is missing prerequisite commits
];

let exitCode = 0;
for (const { pr, targets } of cases) {
  const started = Date.now();
  const { results } = await backportRun({
    exitCodeOnFailure: false,
    options: {
      repoOwner: 'elastic',
      repoName: 'kibana',
      githubToken: process.env.TOKEN,
      cloneFilter: 'blob:none',
      interactive: false,
      logFilePath: `/tmp/backport-${pr}.log`,
      pullNumber: pr,
      assignees: ['shahzad31'],
      autoMerge: true,
      autoMergeMethod: 'squash',
      targetBranches: targets,
      publishStatusCommentOnFailure: false,
      publishStatusCommentOnSuccess: false,
      fork: false,
      dryRun: true,
    },
  });
  const failures = results.filter((r) => r.status === 'error');
  const failed = failures.length > 0 || results.length === 0;
  const secs = Math.round((Date.now() - started) / 1000);
  const detail = results.map((r) => `${r.targetBranch}:${r.status}${r.errorMessage ? ` (${r.errorMessage.slice(0, 110)})` : ''}`).join('; ');
  const line = `| #${pr} -> ${targets.join(',')} | action logic: ${failed ? 'FAIL' : 'OK'} | ${secs}s | ${detail} |`;
  console.log(line);
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}
process.exit(exitCode);
