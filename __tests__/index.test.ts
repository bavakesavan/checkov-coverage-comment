import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ParsedResult } from '../src/types';

// --- mocks (hoisted before imports) ---

vi.mock('@actions/core', () => {
  const addRaw = vi.fn();
  const write = vi.fn().mockResolvedValue(undefined);
  addRaw.mockReturnValue({ addRaw, write });
  return {
    getInput: vi.fn(),
    getBooleanInput: vi.fn().mockReturnValue(false),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    setSecret: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    summary: { addRaw, write },
  };
});

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn().mockReturnValue({}),
  context: { repo: { owner: 'owner', repo: 'repo' }, payload: {} },
}));

vi.mock('../src/parse', () => ({
  parseCheckovOutput: vi.fn(),
}));

vi.mock('../src/format', () => ({
  buildComment: vi.fn().mockReturnValue('## Mocked Comment'),
}));

vi.mock('../src/github', () => ({
  upsertComment: vi.fn().mockResolvedValue('https://github.com/comment/1'),
  getPrNumber: vi.fn().mockReturnValue(42),
}));

// --- imports after mocks ---

import * as core from '@actions/core';
import { run } from '../src/index';
import { parseCheckovOutput } from '../src/parse';
import { upsertComment, getPrNumber } from '../src/github';

// --- helpers ---

function makeParsedResult(criticalCount = 0, highCount = 0): ParsedResult {
  const failedBySeverity = new Map();
  if (criticalCount > 0)
    failedBySeverity.set(
      'CRITICAL',
      Array.from({ length: criticalCount }, (_, i) => ({
        check_id: `CKV_CRIT_${i}`,
        check_name: 'Critical check',
        severity: 'CRITICAL',
        resource: 'res',
        file_path: 'main.tf',
        file_line_range: [1, 5],
        check_result: { result: 'FAILED' },
      }))
    );
  if (highCount > 0)
    failedBySeverity.set(
      'HIGH',
      Array.from({ length: highCount }, (_, i) => ({
        check_id: `CKV_HIGH_${i}`,
        check_name: 'High check',
        severity: 'HIGH',
        resource: 'res',
        file_path: 'main.tf',
        file_line_range: [1, 5],
        check_result: { result: 'FAILED' },
      }))
    );
  return {
    reports: [],
    allFailed: [],
    failedBySeverity,
    totals: { passed: 3, failed: criticalCount + highCount, skipped: 1, parsingErrors: 0 },
  };
}

function setupInputs(overrides: Record<string, string | boolean> = {}) {
  vi.mocked(core.getInput).mockImplementation((name: string) => {
    const map: Record<string, string> = {
      'github-token': 'ghs_token',
      'checkov-output-path': 'results_json.json',
      title: 'Checkov Security Scan',
      severities: 'CRITICAL,HIGH,MEDIUM,LOW,INFO',
      'issue-number': '',
      'unique-id-for-comment': 'default',
      ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => typeof v === 'string')),
    };
    return map[name] ?? '';
  });
  vi.mocked(core.getBooleanInput).mockImplementation((name: string) => {
    const boolMap: Record<string, boolean> = {
      'hide-passed': false,
      'hide-skipped': false,
      'soft-fail': false,
      'create-new-comment': false,
      ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => typeof v === 'boolean')),
    };
    return boolMap[name] ?? false;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrNumber).mockReturnValue(42);
  vi.mocked(upsertComment).mockResolvedValue('https://github.com/comment/1');
  setupInputs();
  vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult());
});

// --- tests ---

describe('run()', () => {
  it('sets all severity outputs', async () => {
    vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult(2, 1));
    await run();
    expect(core.setOutput).toHaveBeenCalledWith('critical', '2');
    expect(core.setOutput).toHaveBeenCalledWith('high', '1');
    expect(core.setOutput).toHaveBeenCalledWith('medium', '0');
    expect(core.setOutput).toHaveBeenCalledWith('low', '0');
    expect(core.setOutput).toHaveBeenCalledWith('info', '0');
    expect(core.setOutput).toHaveBeenCalledWith('total-failed', '3');
    expect(core.setOutput).toHaveBeenCalledWith('total-passed', '3');
  });

  it('sets comment-url output after posting a comment', async () => {
    await run();
    expect(core.setOutput).toHaveBeenCalledWith('comment-url', 'https://github.com/comment/1');
  });

  it('calls upsertComment with the correct PR number', async () => {
    vi.mocked(getPrNumber).mockReturnValue(7);
    await run();
    expect(upsertComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      7,
      expect.any(String),
      expect.any(String),
      expect.any(Boolean)
    );
  });

  it('writes to summary and skips upsertComment when there is no PR context', async () => {
    vi.mocked(getPrNumber).mockReturnValue(null);
    await run();
    expect(upsertComment).not.toHaveBeenCalled();
    expect(core.setOutput).not.toHaveBeenCalledWith('comment-url', expect.anything());
    expect(core.summary.addRaw).toHaveBeenCalled();
  });

  it('calls setFailed when critical findings exist and soft-fail is false', async () => {
    vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult(1, 0));
    setupInputs({ 'soft-fail': false });
    await run();
    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('critical'));
  });

  it('does not call setFailed when soft-fail is true', async () => {
    vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult(1, 0));
    setupInputs({ 'soft-fail': true });
    await run();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('does not call setFailed when there are no critical or high findings', async () => {
    vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult(0, 0));
    await run();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('calls setFailed for high severity findings when soft-fail is false', async () => {
    vi.mocked(parseCheckovOutput).mockReturnValue(makeParsedResult(0, 3));
    await run();
    expect(core.setFailed).toHaveBeenCalled();
  });

  it('emits a warning and filters out unrecognized severity values', async () => {
    setupInputs({ severities: 'CRITICAL,BOGUS,HIGH' });
    await run();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('BOGUS'));
  });

  it('calls setFailed when an error is thrown inside run()', async () => {
    vi.mocked(parseCheckovOutput).mockImplementation(() => {
      throw new Error('file not found');
    });
    await run();
    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('file not found'));
  });
});
