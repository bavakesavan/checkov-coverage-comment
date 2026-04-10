import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { normalizeReports, groupBySeverity, parseCheckovOutput } from '../src/parse';
import type { CheckRecord, CheckovReport } from '../src/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample-checkov.json');

describe('normalizeReports', () => {
  it('wraps single report in array', () => {
    const report = { check_type: 'terraform' } as CheckovReport;
    expect(normalizeReports(report)).toEqual([report]);
  });

  it('returns array unchanged', () => {
    const reports = [
      { check_type: 'terraform' } as CheckovReport,
      { check_type: 'cloudformation' } as CheckovReport,
    ];
    expect(normalizeReports(reports)).toEqual(reports);
  });
});

describe('groupBySeverity', () => {
  const makeCheck = (id: string, severity: CheckRecord['severity']): CheckRecord => ({
    check_id: id,
    check_name: `Check ${id}`,
    severity,
    resource: 'res',
    file_path: 'main.tf',
    file_line_range: [1, 5],
    check_result: { result: 'FAILED' },
  });

  it('groups checks by severity', () => {
    const checks = [
      makeCheck('CKV1', 'CRITICAL'),
      makeCheck('CKV2', 'HIGH'),
      makeCheck('CKV3', 'CRITICAL'),
    ];
    const result = groupBySeverity(checks);
    expect(result.get('CRITICAL')).toHaveLength(2);
    expect(result.get('HIGH')).toHaveLength(1);
    expect(result.get('MEDIUM')).toBeUndefined();
  });

  it('puts null severity into UNKNOWN bucket', () => {
    const checks = [makeCheck('CKV1', null)];
    const result = groupBySeverity(checks);
    expect(result.get('UNKNOWN')).toHaveLength(1);
  });

  it('removes empty severity buckets', () => {
    const checks = [makeCheck('CKV1', 'LOW')];
    const result = groupBySeverity(checks);
    expect(result.has('CRITICAL')).toBe(false);
    expect(result.has('HIGH')).toBe(false);
    expect(result.has('LOW')).toBe(true);
  });
});

describe('parseCheckovOutput', () => {
  it('parses multi-runner fixture and aggregates totals', () => {
    const result = parseCheckovOutput(FIXTURE);
    expect(result.reports).toHaveLength(2);
    expect(result.totals.failed).toBe(6); // 5 terraform + 1 cfn
    expect(result.totals.passed).toBe(1);
    expect(result.totals.skipped).toBe(1);
  });

  it('correctly groups failed checks by severity', () => {
    const result = parseCheckovOutput(FIXTURE);
    expect(result.failedBySeverity.get('CRITICAL')).toHaveLength(1);
    expect(result.failedBySeverity.get('HIGH')).toHaveLength(2); // 1 tf + 1 cfn
    expect(result.failedBySeverity.get('MEDIUM')).toHaveLength(1);
    expect(result.failedBySeverity.get('LOW')).toHaveLength(1);
    expect(result.failedBySeverity.get('UNKNOWN')).toHaveLength(1); // null severity
  });

  it('throws on missing file', () => {
    expect(() => parseCheckovOutput('/nonexistent/path.json')).toThrow('not found');
  });
});
