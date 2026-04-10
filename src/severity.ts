import type { Severity } from './types'
import policies from '../data/policies.json'

const VALID_SEVERITIES = new Set<string>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])

type PoliciesJson = Record<string, { severity: string; [key: string]: unknown }>

const _db: Record<string, Severity> = (() => {
  const result: Record<string, Severity> = {}
  for (const [id, entry] of Object.entries(policies as PoliciesJson)) {
    const sev = entry.severity?.toUpperCase()
    if (sev && VALID_SEVERITIES.has(sev)) {
      result[id] = sev as Severity
    }
  }
  return result
})()

/**
 * Look up a check ID in data/policies.json.
 * Returns the known severity, or null if the check is not found.
 */
export function lookupSeverity(checkId: string): Severity | null {
  return _db[checkId] ?? null
}
