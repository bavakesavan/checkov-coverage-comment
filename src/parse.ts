import * as fs from 'fs';
import type { CheckRecord, CheckovOutput, CheckovReport, ParsedResult, Severity } from './types';
import { lookupSeverity } from './severity';

function splitJsonObjects(raw: string): CheckovReport[] {
  const results: CheckovReport[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        results.push(JSON.parse(raw.slice(start, i + 1)) as CheckovReport);
        start = -1;
      }
    }
  }
  return results;
}

const SEVERITY_ORDER: Array<Severity | 'UNKNOWN'> = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
  'UNKNOWN',
];

export function readCheckovFile(filePath: string): CheckovOutput {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Checkov output file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) {
    throw new Error(`Checkov output file is empty: ${filePath}`);
  }
  try {
    return JSON.parse(raw) as CheckovOutput;
  } catch {
    // checkov-action may write multiple JSON objects back-to-back (one per
    // framework) rather than a valid JSON array. Try splitting on object
    // boundaries and parsing each chunk individually.
    try {
      const objects = splitJsonObjects(raw);
      if (objects.length === 0) {
        throw new Error();
      }
      return objects as CheckovOutput;
    } catch {
      throw new Error(`failed to parse checkov JSON output from: ${filePath}`);
    }
  }
}

export function normalizeReports(raw: CheckovOutput): CheckovReport[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  return [raw];
}

export function groupBySeverity(failed: CheckRecord[]): Map<Severity | 'UNKNOWN', CheckRecord[]> {
  const map = new Map<Severity | 'UNKNOWN', CheckRecord[]>();
  for (const key of SEVERITY_ORDER) {
    map.set(key, []);
  }
  for (const check of failed) {
    if (!check.severity) {
      check.severity = lookupSeverity(check.check_id);
    }
    const key: Severity | 'UNKNOWN' = check.severity ?? 'UNKNOWN';
    const bucket = map.get(key) ?? [];
    bucket.push(check);
    map.set(key, bucket);
  }
  // Remove empty buckets for cleaner iteration
  for (const [key, bucket] of map.entries()) {
    if (bucket.length === 0) {
      map.delete(key);
    }
  }
  return map;
}

export function parseCheckovOutput(filePath: string): ParsedResult {
  const raw = readCheckovFile(filePath);
  const reports = normalizeReports(raw);

  const allFailed: CheckRecord[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalParsingErrors = 0;

  for (const report of reports) {
    if (!report.results || !report.summary) continue;
    allFailed.push(...(report.results.failed_checks ?? []));
    totalPassed += report.summary.passed ?? 0;
    totalFailed += report.summary.failed ?? 0;
    totalSkipped += report.summary.skipped ?? 0;
    totalParsingErrors += report.summary.parsing_errors ?? 0;
  }

  return {
    reports,
    allFailed,
    failedBySeverity: groupBySeverity(allFailed),
    totals: {
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      parsingErrors: totalParsingErrors,
    },
  };
}
