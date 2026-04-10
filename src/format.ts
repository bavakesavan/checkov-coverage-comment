import type { CheckRecord, FormatOptions, ParsedResult, Severity } from './types';

const MAX_COMMENT_LENGTH = 65536;
const WATERMARK_PREFIX = '<!-- checkov-comment:';

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🔵',
  INFO: '⚪',
  UNKNOWN: '⬜',
};

export function makeWatermark(uniqueId: string): string {
  return `${WATERMARK_PREFIX} ${uniqueId} -->`;
}

export function parseWatermarkId(commentBody: string): string | null {
  const match = commentBody.match(/<!-- checkov-comment: (.+?) -->/);
  return match ? match[1] : null;
}

const SEVERITY_ORDER: Array<Severity | 'UNKNOWN'> = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
  'UNKNOWN',
];

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function buildSeverityTable(data: ParsedResult): string {
  const severityCells = SEVERITY_ORDER.map((sev) => {
    const emoji = SEVERITY_EMOJI[sev] ?? '⬜';
    const label = sev.charAt(0) + sev.slice(1).toLowerCase();
    return `${emoji} ${label}`;
  });

  const countCells = SEVERITY_ORDER.map((sev) => {
    const count = data.failedBySeverity.get(sev)?.length ?? 0;
    return `${count}`;
  });

  const header = `| Severity | ${severityCells.join(' | ')} |`;
  const separator = `|----------|${SEVERITY_ORDER.map(() => '------').join('|')}|`;
  const values = `| Failed | ${countCells.join(' | ')} |`;

  return `${header}\n${separator}\n${values}`;
}

function groupByFile(checks: CheckRecord[]): Map<string, CheckRecord[]> {
  const map = new Map<string, CheckRecord[]>();
  for (const check of checks) {
    const file = check.file_path;
    const bucket = map.get(file) ?? [];
    bucket.push(check);
    map.set(file, bucket);
  }
  return map;
}

function severitySummary(checks: CheckRecord[]): string {
  const counts = new Map<Severity | 'UNKNOWN', number>();
  for (const check of checks) {
    const sev: Severity | 'UNKNOWN' = check.severity ?? 'UNKNOWN';
    counts.set(sev, (counts.get(sev) ?? 0) + 1);
  }
  return SEVERITY_ORDER.filter((sev) => (counts.get(sev) ?? 0) > 0)
    .map((sev) => {
      const emoji = SEVERITY_EMOJI[sev] ?? '⬜';
      return `${emoji} ${counts.get(sev)}`;
    })
    .join('  ');
}

function buildCheckTable(checks: CheckRecord[]): string {
  if (checks.length === 0) return '_No findings._';

  const header =
    '| Severity | Check ID | Check Name | Resource | Lines |\n' +
    '|----------|----------|------------|----------|-------|\n';

  const rows = checks
    .slice()
    .sort((a, b) => {
      const aIdx = SEVERITY_ORDER.indexOf(a.severity ?? 'UNKNOWN');
      const bIdx = SEVERITY_ORDER.indexOf(b.severity ?? 'UNKNOWN');
      return aIdx - bIdx;
    })
    .map((c) => {
      const sev: Severity | 'UNKNOWN' = c.severity ?? 'UNKNOWN';
      const emoji = SEVERITY_EMOJI[sev] ?? '⬜';
      const label = sev.charAt(0) + sev.slice(1).toLowerCase();
      const checkId = escapeMarkdown(c.check_id);
      const name = escapeMarkdown(c.check_name);
      const resource = escapeMarkdown(c.resource);
      const [start, end] = c.file_line_range;
      const lines = start === end ? `${start}` : `${start}–${end}`;
      return `| ${emoji} ${label} | \`${checkId}\` | ${name} | \`${resource}\` | ${lines} |`;
    })
    .join('\n');

  return header + rows;
}

function buildFileSection(file: string, checks: CheckRecord[]): string {
  const summary = severitySummary(checks);
  const table = buildCheckTable(checks);
  return (
    `<details>\n` +
    `<summary><strong>${escapeMarkdown(file)}</strong> — ${summary}</summary>\n\n` +
    `${table}\n\n` +
    `</details>`
  );
}

export function buildComment(
  data: ParsedResult,
  opts: FormatOptions,
  uniqueId = 'default'
): string {
  const { totals } = data;
  const watermark = makeWatermark(uniqueId);

  const headerLine = `## ${opts.title}`;

  const summaryTable = buildSeverityTable(data);

  const metaParts = [
    !opts.hidePassed ? `✅ Passed: **${totals.passed}**` : null,
    !opts.hideSkipped ? `⏭ Skipped: **${totals.skipped}**` : null,
    totals.parsingErrors > 0 ? `⚠️ Parsing errors: **${totals.parsingErrors}**` : null,
  ].filter(Boolean);
  const metaLine = metaParts.length > 0 ? `> ${metaParts.join(' · ')}` : '';

  const fileSections: string[] = [];

  const fileGroups = groupByFile(data.allFailed);
  const filteredSeverities = new Set<Severity | 'UNKNOWN'>([...opts.severities, 'UNKNOWN']);

  for (const [file, checks] of fileGroups) {
    const visibleChecks = checks.filter((c) => {
      const sev: Severity | 'UNKNOWN' = c.severity ?? 'UNKNOWN';
      return filteredSeverities.has(sev);
    });
    if (visibleChecks.length === 0) continue;
    fileSections.push(buildFileSection(file, visibleChecks));
  }

  const coverageReport =
    fileSections.length > 0
      ? `<details>\n<summary>📋 Coverage Report (${data.allFailed.length} finding(s) across ${fileSections.length} file(s))</summary>\n\n${fileSections.join('\n\n')}\n\n</details>`
      : '_No findings._';

  const parts = [watermark, headerLine, '', summaryTable, '', metaLine, '', coverageReport];

  let body = parts.join('\n');

  // Truncate if over GitHub's comment size limit, dropping file sections from the report
  if (body.length > MAX_COMMENT_LENGTH) {
    const truncationNote = '> ⚠️ _Comment truncated — too many findings to display in full._';
    const baseLength =
      [watermark, headerLine, '', summaryTable, '', metaLine].join('\n').length +
      truncationNote.length +
      2;

    const keptSections: string[] = [];
    let usedLength = baseLength;

    for (const section of fileSections) {
      if (usedLength + section.length + 2 <= MAX_COMMENT_LENGTH) {
        keptSections.push(section);
        usedLength += section.length + 2;
      } else {
        break;
      }
    }

    const truncatedReport = `<details>\n<summary>📋 Coverage Report (${data.allFailed.length} finding(s) across ${fileSections.length} file(s))</summary>\n\n${keptSections.join('\n\n')}\n\n</details>`;
    body = [
      watermark,
      headerLine,
      '',
      summaryTable,
      '',
      metaLine,
      '',
      truncatedReport,
      truncationNote,
    ].join('\n');
  }

  return body;
}
