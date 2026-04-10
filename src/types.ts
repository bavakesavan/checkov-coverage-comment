export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type CheckResult = 'passed' | 'failed' | 'skipped'

export interface CheckRecord {
  check_id: string
  check_name: string
  severity: Severity | null
  resource: string
  file_path: string
  file_abs_path?: string
  repo_file_path?: string
  file_line_range: [number, number]
  check_result: {
    result: 'PASSED' | 'FAILED' | 'SKIPPED' | 'UNKNOWN'
    suppress_comment?: string
  }
  code_block?: Array<[number, string]>
  evaluations?: Record<string, unknown>
  check_class?: string
  details?: string[]
}

export interface CheckovSummary {
  passed: number
  failed: number
  skipped: number
  parsing_errors: number
  resource_count?: number
  checkov_version?: string
}

export interface CheckovReport {
  check_type: string
  results: {
    passed_checks: CheckRecord[]
    failed_checks: CheckRecord[]
    skipped_checks: CheckRecord[]
    parsing_errors: string[]
  }
  summary: CheckovSummary
}

// Checkov may output a single report object or an array (multi-runner)
export type CheckovOutput = CheckovReport | CheckovReport[]

export interface ParsedResult {
  reports: CheckovReport[]
  allFailed: CheckRecord[]
  failedBySeverity: Map<Severity | 'UNKNOWN', CheckRecord[]>
  totals: {
    passed: number
    failed: number
    skipped: number
    parsingErrors: number
  }
}

export interface FormatOptions {
  title: string
  hidePassed: boolean
  hideSkipped: boolean
  severities: Array<Severity>
}
