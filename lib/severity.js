"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupSeverity = lookupSeverity;
const policies_json_1 = __importDefault(require("../data/policies.json"));
const VALID_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
const _db = (() => {
    const result = {};
    for (const [id, entry] of Object.entries(policies_json_1.default)) {
        const sev = entry.severity?.toUpperCase();
        if (sev && VALID_SEVERITIES.has(sev)) {
            result[id] = sev;
        }
    }
    return result;
})();
/**
 * Look up a check ID in data/policies.json.
 * Returns the known severity, or null if the check is not found.
 */
function lookupSeverity(checkId) {
    return _db[checkId] ?? null;
}
