import * as github from '@actions/github';
import * as core from '@actions/core';
import { parseWatermarkId } from './format';

type Octokit = ReturnType<typeof github.getOctokit>;

interface RepoContext {
  owner: string;
  repo: string;
}

export async function findExistingComment(
  octokit: Octokit,
  repo: RepoContext,
  prNumber: number,
  uniqueId: string
): Promise<number | null> {
  const iterator = octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner: repo.owner,
    repo: repo.repo,
    issue_number: prNumber,
    per_page: 100,
  });

  for await (const page of iterator) {
    for (const comment of page.data) {
      if (comment.body && parseWatermarkId(comment.body) === uniqueId) {
        return comment.id;
      }
    }
  }
  return null;
}

export async function createComment(
  octokit: Octokit,
  repo: RepoContext,
  prNumber: number,
  body: string
): Promise<string> {
  const response = await octokit.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: prNumber,
    body,
  });
  return response.data.html_url;
}

export async function updateComment(
  octokit: Octokit,
  repo: RepoContext,
  commentId: number,
  body: string
): Promise<string> {
  const response = await octokit.rest.issues.updateComment({
    owner: repo.owner,
    repo: repo.repo,
    comment_id: commentId,
    body,
  });
  return response.data.html_url;
}

export async function upsertComment(
  octokit: Octokit,
  repo: RepoContext,
  prNumber: number,
  body: string,
  uniqueId: string,
  forceNew: boolean
): Promise<string> {
  if (!forceNew) {
    const existing = await findExistingComment(octokit, repo, prNumber, uniqueId);
    if (existing !== null) {
      core.info(`Updating existing comment ${existing}`);
      return updateComment(octokit, repo, existing, body);
    }
  }
  core.info('Creating new PR comment');
  return createComment(octokit, repo, prNumber, body);
}

export function getPrNumber(issueNumberInput: string): number | null {
  if (issueNumberInput) {
    const n = parseInt(issueNumberInput, 10);
    if (!isNaN(n)) return n;
  }
  const payload = github.context.payload;
  if (payload.pull_request) {
    return payload.pull_request.number;
  }
  return null;
}
