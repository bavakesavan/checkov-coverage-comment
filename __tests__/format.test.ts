import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildComment, makeWatermark, parseWatermarkId } from '../src/format';
import { parseCheckovOutput } from '../src/parse';
import type { CheckRecord, FormatOptions, ParsedResult, Severity } from '../src/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample-checkov.json');

const defaultOpts: FormatOptions = {
  title: 'Checkov Security Scan',
  hidePassed: false,
  hideSkipped: false,
  severities: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
};

describe('makeWatermark / parseWatermarkId', () => {
  it('round-trips the unique ID', () => {
    const wm = makeWatermark('my-unique-id');
    expect(parseWatermarkId(wm)).toBe('my-unique-id');
  });

  it('returns null for non-watermark text', () => {
    expect(parseWatermarkId('## Some random comment')).toBeNull();
  });
});

describe('buildComment', () => {
  it('contains watermark', () => {
    const data = parseCheckovOutput(FIXTURE);
    const body = buildComment(data, defaultOpts, 'test-id');
    expect(body).toContain('<!-- checkov-comment: test-id -->');
  });

  it('contains the title', () => {
    const data = parseCheckovOutput(FIXTURE);
    const body = buildComment(data, defaultOpts);
    expect(body).toContain('## Checkov Security Scan');
  });

  it('includes severity sections for severities with findings', () => {
    const data = parseCheckovOutput(FIXTURE);
    const body = buildComment(data, defaultOpts);
    expect(body).toContain('Critical');
    expect(body).toContain('High');
    expect(body).toContain('Medium');
    expect(body).toContain('Low');
    // Info has no findings — should not appear as a details section
    expect(body).not.toMatch(/details.*Info/s);
  });

  it('includes check IDs in the table', () => {
    const data = parseCheckovOutput(FIXTURE);
    const body = buildComment(data, defaultOpts);
    // Underscores are escaped in table cells
    expect(body).toContain('CKV\\_AWS\\_18');
    expect(body).toContain('CKV\\_AWS\\_111');
  });

  it('respects severities filter — omits LOW section when not in list', () => {
    const data = parseCheckovOutput(FIXTURE);
    const opts: FormatOptions = { ...defaultOpts, severities: ['CRITICAL', 'HIGH'] };
    const body = buildComment(data, opts);
    // Low row should still appear in summary table but no detail section
    expect(body).not.toContain('CKV2\\_AWS\\_62');
  });

  it('shows passed count unless hidePassed is true', () => {
    const data = parseCheckovOutput(FIXTURE);
    const shown = buildComment(data, { ...defaultOpts, hidePassed: false });
    expect(shown).toContain('Passed');
    // hidePassed does not remove passed row from summary table, only from meta line
    const hidden = buildComment(data, { ...defaultOpts, hidePassed: true });
    // The meta line should not include "Passed" text
    expect(hidden).not.toContain('✅ Passed');
  });

  it('stays under 65536 characters', () => {
    const data = parseCheckovOutput(FIXTURE);
    const body = buildComment(data, defaultOpts);
    expect(body.length).toBeLessThanOrEqual(65536);
  });
});

describe('escapeMarkdown (via buildComment)', () => {
  function makeResult(checkName: string, resource: string): ParsedResult {
    const check: CheckRecord = {
      check_id: 'CKV_TEST_1',
      check_name: checkName,
      severity: 'HIGH',
      resource,
      file_path: 'test.tf',
      file_line_range: [1, 5],
      check_result: { result: 'FAILED' },
    };
    return {
      reports: [],
      allFailed: [check],
      failedBySeverity: new Map<Severity | 'UNKNOWN', CheckRecord[]>([['HIGH', [check]]]),
      totals: { passed: 0, failed: 1, skipped: 0, parsingErrors: 0 },
    };
  }

  it('escapes pipe characters in check names', () => {
    const body = buildComment(makeResult('Check | name', 'res'), defaultOpts);
    expect(body).toContain('Check \\| name');
  });

  it('escapes asterisks', () => {
    const body = buildComment(makeResult('Check *bold* name', 'res'), defaultOpts);
    expect(body).toContain('\\*bold\\*');
  });

  it('escapes underscores', () => {
    const body = buildComment(makeResult('Check _italic_ name', 'res'), defaultOpts);
    expect(body).toContain('\\_italic\\_');
  });

  it('escapes square brackets in resource names', () => {
    const body = buildComment(makeResult('Check name', 'resource[0]'), defaultOpts);
    expect(body).toContain('resource\\[0\\]');
  });

  it('escapes backticks', () => {
    const body = buildComment(makeResult('Use `var` here', 'res'), defaultOpts);
    expect(body).toContain('\\`var\\`');
  });
});

describe('comment truncation', () => {
  function makeLargeResult(): ParsedResult {
    const checks: CheckRecord[] = Array.from({ length: 600 }, (_, i) => ({
      check_id: `CKV_LARGE_${String(i).padStart(4, '0')}`,
      check_name: `A long check name to pad the comment size — finding number ${i} in the list`,
      severity: 'CRITICAL' as Severity,
      resource: `aws_resource.very_long_resource_name_module_${i}`,
      file_path: `/path/to/terraform/module/submodule/file_${Math.floor(i / 20)}.tf`,
      file_line_range: [i * 5 + 1, i * 5 + 5],
      check_result: { result: 'FAILED' },
    }));
    return {
      reports: [],
      allFailed: checks,
      failedBySeverity: new Map<Severity | 'UNKNOWN', CheckRecord[]>([['CRITICAL', checks]]),
      totals: { passed: 0, failed: checks.length, skipped: 0, parsingErrors: 0 },
    };
  }

  it('truncates the comment to at most 65536 characters', () => {
    const data = makeLargeResult();
    const body = buildComment(data, defaultOpts);
    expect(body.length).toBeLessThanOrEqual(65536);
  });

  it('includes a truncation notice when the limit is hit', () => {
    const data = makeLargeResult();
    const body = buildComment(data, defaultOpts);
    expect(body).toContain('too many findings to display');
  });

  it('still includes the summary table after truncation', () => {
    const data = makeLargeResult();
    const body = buildComment(data, defaultOpts);
    expect(body).toContain('| Failed |');
  });
});
