import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

vi.mock('@actions/github', () => ({
  context: { payload: {} as Record<string, unknown> },
}));

import * as githubActions from '@actions/github';
import {
  findExistingComment,
  createComment,
  updateComment,
  upsertComment,
  getPrNumber,
} from '../src/github';

const COMMENT_URL = 'https://github.com/owner/repo/issues/1#issuecomment-123';
const REPO = { owner: 'owner', repo: 'repo' };

function makeComment(id: number, body: string | null) {
  return { id, body };
}

function makeOctokit(pages: Array<Array<{ id: number; body: string | null }>> = [[]]) {
  const createCommentMock = vi.fn().mockResolvedValue({ data: { html_url: COMMENT_URL } });
  const updateCommentMock = vi.fn().mockResolvedValue({ data: { html_url: COMMENT_URL } });

  return {
    paginate: {
      iterator: vi.fn().mockReturnValue(
        (async function* () {
          for (const page of pages) {
            yield { data: page };
          }
        })()
      ),
    },
    rest: {
      issues: {
        listComments: vi.fn(),
        createComment: createCommentMock,
        updateComment: updateCommentMock,
      },
    },
    _mocks: { createCommentMock, updateCommentMock },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockOctokit = ReturnType<typeof makeOctokit> & { _mocks: any };

beforeEach(() => {
  (githubActions.context as { payload: Record<string, unknown> }).payload = {};
});

describe('findExistingComment', () => {
  it('returns the comment ID when the watermark matches', async () => {
    const octokit = makeOctokit([
      [makeComment(10, '<!-- checkov-comment: my-id --> some content')],
    ]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'my-id');
    expect(id).toBe(10);
  });

  it('returns null when no comment matches the watermark', async () => {
    const octokit = makeOctokit([[makeComment(10, '## Some unrelated comment')]]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'my-id');
    expect(id).toBeNull();
  });

  it('returns null when there are no comments', async () => {
    const octokit = makeOctokit([[]]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'my-id');
    expect(id).toBeNull();
  });

  it('searches across multiple pages', async () => {
    const octokit = makeOctokit([
      [makeComment(1, '## Page 1 comment')],
      [makeComment(2, '<!-- checkov-comment: target-id --> body')],
    ]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'target-id');
    expect(id).toBe(2);
  });

  it('skips comments with null body', async () => {
    const octokit = makeOctokit([
      [makeComment(1, null), makeComment(2, '<!-- checkov-comment: my-id -->')],
    ]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'my-id');
    expect(id).toBe(2);
  });

  it('does not match a different unique ID', async () => {
    const octokit = makeOctokit([[makeComment(1, '<!-- checkov-comment: other-id -->')]]);
    const id = await findExistingComment(octokit as never, REPO, 1, 'my-id');
    expect(id).toBeNull();
  });
});

describe('createComment', () => {
  it('returns the html_url of the new comment', async () => {
    const octokit = makeOctokit() as MockOctokit;
    const url = await createComment(octokit as never, REPO, 42, 'body text');
    expect(url).toBe(COMMENT_URL);
    expect(octokit._mocks.createCommentMock).toHaveBeenCalledWith({
      owner: REPO.owner,
      repo: REPO.repo,
      issue_number: 42,
      body: 'body text',
    });
  });
});

describe('updateComment', () => {
  it('returns the html_url of the updated comment', async () => {
    const octokit = makeOctokit() as MockOctokit;
    const url = await updateComment(octokit as never, REPO, 99, 'updated body');
    expect(url).toBe(COMMENT_URL);
    expect(octokit._mocks.updateCommentMock).toHaveBeenCalledWith({
      owner: REPO.owner,
      repo: REPO.repo,
      comment_id: 99,
      body: 'updated body',
    });
  });
});

describe('upsertComment', () => {
  it('updates the existing comment when one is found and forceNew is false', async () => {
    const octokit = makeOctokit([
      [makeComment(55, '<!-- checkov-comment: default -->')],
    ]) as MockOctokit;
    const url = await upsertComment(octokit as never, REPO, 1, 'new body', 'default', false);
    expect(url).toBe(COMMENT_URL);
    expect(octokit._mocks.updateCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 55, body: 'new body' })
    );
    expect(octokit._mocks.createCommentMock).not.toHaveBeenCalled();
  });

  it('creates a new comment when none exists and forceNew is false', async () => {
    const octokit = makeOctokit([[makeComment(1, '## unrelated')]]) as MockOctokit;
    const url = await upsertComment(octokit as never, REPO, 1, 'body', 'my-id', false);
    expect(url).toBe(COMMENT_URL);
    expect(octokit._mocks.createCommentMock).toHaveBeenCalled();
    expect(octokit._mocks.updateCommentMock).not.toHaveBeenCalled();
  });

  it('always creates a new comment when forceNew is true', async () => {
    const octokit = makeOctokit([
      [makeComment(55, '<!-- checkov-comment: default -->')],
    ]) as MockOctokit;
    const url = await upsertComment(octokit as never, REPO, 1, 'body', 'default', true);
    expect(url).toBe(COMMENT_URL);
    expect(octokit._mocks.createCommentMock).toHaveBeenCalled();
    expect(octokit._mocks.updateCommentMock).not.toHaveBeenCalled();
  });
});

describe('getPrNumber', () => {
  it('returns the number from the issue-number input when provided', () => {
    expect(getPrNumber('42')).toBe(42);
  });

  it('falls back to pull_request.number from context when input is empty', () => {
    (githubActions.context as { payload: Record<string, unknown> }).payload = {
      pull_request: { number: 99 },
    };
    expect(getPrNumber('')).toBe(99);
  });

  it('returns null when input is empty and context has no pull_request', () => {
    expect(getPrNumber('')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(getPrNumber('not-a-number')).toBeNull();
  });

  it('ignores invalid input and falls back to context', () => {
    (githubActions.context as { payload: Record<string, unknown> }).payload = {
      pull_request: { number: 7 },
    };
    expect(getPrNumber('abc')).toBe(7);
  });
});
