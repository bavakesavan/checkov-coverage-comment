import { describe, it, expect } from 'vitest';
import { lookupSeverity } from '../src/severity';

describe('lookupSeverity', () => {
  it('returns the severity for a known check ID', () => {
    // CKV_AWS_18 is present in data/policies.json with severity INFO
    expect(lookupSeverity('CKV_AWS_18')).toBe('INFO');
  });

  it('returns null for an unknown check ID', () => {
    expect(lookupSeverity('CKV_DOES_NOT_EXIST_99999')).toBeNull();
  });

  it('is case-sensitive — lowercase ID returns null', () => {
    expect(lookupSeverity('ckv_aws_18')).toBeNull();
  });

  it('returns a valid Severity string (not UNKNOWN or arbitrary)', () => {
    const result = lookupSeverity('CKV_AWS_18');
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(result);
  });
});
