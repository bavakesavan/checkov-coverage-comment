import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import { parseCheckovOutput } from './parse';
import { buildComment } from './format';
import { upsertComment, getPrNumber } from './github';
import type { FormatOptions, Severity } from './types';

async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  core.setSecret(token);
  const rawPath = core.getInput('checkov-output-path') || 'results_json.json';
  const title = core.getInput('title') || 'Checkov Security Scan';
  const hidePassed = core.getBooleanInput('hide-passed');
  const hideSkipped = core.getBooleanInput('hide-skipped');
  const softFail = core.getBooleanInput('soft-fail');
  const createNew = core.getBooleanInput('create-new-comment');
  const issueNumberInput = core.getInput('issue-number');
  const uniqueId = core.getInput('unique-id-for-comment') || 'default';
  const severitiesInput = core.getInput('severities') || 'CRITICAL,HIGH,MEDIUM,LOW,INFO';

  const valid: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const severities = severitiesInput
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Severity => {
      if (valid.includes(s as Severity)) return true;
      core.warning(
        `Ignoring unrecognized severity value: "${s}". Valid values are: ${valid.join(', ')}`
      );
      return false;
    });

  const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
  const filePath = path.isAbsolute(rawPath) ? rawPath : path.join(workspace, rawPath);

  const data = parseCheckovOutput(filePath);

  const formatOpts: FormatOptions = {
    title,
    hidePassed,
    hideSkipped,
    severities,
  };

  const body = buildComment(data, formatOpts, uniqueId);

  // Set action outputs
  core.setOutput('total-failed', String(data.totals.failed));
  core.setOutput('total-passed', String(data.totals.passed));
  core.setOutput('critical', String(data.failedBySeverity.get('CRITICAL')?.length ?? 0));
  core.setOutput('high', String(data.failedBySeverity.get('HIGH')?.length ?? 0));
  core.setOutput('medium', String(data.failedBySeverity.get('MEDIUM')?.length ?? 0));
  core.setOutput('low', String(data.failedBySeverity.get('LOW')?.length ?? 0));
  core.setOutput('info', String(data.failedBySeverity.get('INFO')?.length ?? 0));

  const prNumber = getPrNumber(issueNumberInput);

  if (prNumber === null) {
    // No PR context — write to step summary
    core.info('No PR context found, writing to step summary.');
    await core.summary.addRaw(body).write();
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  const commentUrl = await upsertComment(
    octokit,
    { owner, repo },
    prNumber,
    body,
    uniqueId,
    createNew
  );

  core.setOutput('comment-url', commentUrl);
  core.info(`Comment posted: ${commentUrl}`);

  const criticalCount = data.failedBySeverity.get('CRITICAL')?.length ?? 0;
  const highCount = data.failedBySeverity.get('HIGH')?.length ?? 0;
  if (!softFail && criticalCount + highCount > 0) {
    core.setFailed(
      `Checkov found ${criticalCount + highCount} critical/high severity issue(s). Set soft-fail: true to suppress this error.`
    );
  }
}

run().catch((err) => {
  core.setFailed((err as Error).message);
});
