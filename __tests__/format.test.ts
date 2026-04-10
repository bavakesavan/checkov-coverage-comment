import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildComment, makeWatermark, parseWatermarkId } from '../src/format';
import { parseCheckovOutput } from '../src/parse';
import type { FormatOptions } from '../src/types';

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
    expect(body).toContain('CKV_AWS_18');
    expect(body).toContain('CKV_AWS_111');
  });

  it('respects severities filter — omits LOW section when not in list', () => {
    const data = parseCheckovOutput(FIXTURE);
    const opts: FormatOptions = { ...defaultOpts, severities: ['CRITICAL', 'HIGH'] };
    const body = buildComment(data, opts);
    // Low row should still appear in summary table but no detail section
    expect(body).not.toContain('CKV2_AWS_62');
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
