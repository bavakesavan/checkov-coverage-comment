"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCheckovFile = readCheckovFile;
exports.normalizeReports = normalizeReports;
exports.groupBySeverity = groupBySeverity;
exports.parseCheckovOutput = parseCheckovOutput;
const fs = __importStar(require("fs"));
const severity_1 = require("./severity");
function splitJsonObjects(raw) {
    const results = [];
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
        if (inString)
            continue;
        if (ch === '{') {
            if (depth === 0)
                start = i;
            depth++;
        }
        else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                results.push(JSON.parse(raw.slice(start, i + 1)));
                start = -1;
            }
        }
    }
    return results;
}
const SEVERITY_ORDER = [
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'INFO',
    'UNKNOWN',
];
function readCheckovFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Checkov output file not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) {
        throw new Error(`Checkov output file is empty: ${filePath}`);
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        // checkov-action may write multiple JSON objects back-to-back (one per
        // framework) rather than a valid JSON array. Try splitting on object
        // boundaries and parsing each chunk individually.
        try {
            const objects = splitJsonObjects(raw);
            if (objects.length === 0) {
                throw new Error();
            }
            return objects;
        }
        catch {
            throw new Error(`failed to parse checkov JSON output from: ${filePath}`);
        }
    }
}
function normalizeReports(raw) {
    if (Array.isArray(raw)) {
        return raw;
    }
    return [raw];
}
function groupBySeverity(failed) {
    const map = new Map();
    for (const key of SEVERITY_ORDER) {
        map.set(key, []);
    }
    for (const check of failed) {
        if (!check.severity) {
            check.severity = (0, severity_1.lookupSeverity)(check.check_id);
        }
        const key = check.severity ?? 'UNKNOWN';
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
function parseCheckovOutput(filePath) {
    const raw = readCheckovFile(filePath);
    const reports = normalizeReports(raw);
    const allFailed = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalParsingErrors = 0;
    for (const report of reports) {
        if (!report.results || !report.summary)
            continue;
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
