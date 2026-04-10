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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const path = __importStar(require("path"));
const parse_1 = require("./parse");
const format_1 = require("./format");
const github_1 = require("./github");
async function run() {
    const token = core.getInput('github-token', { required: true });
    core.setSecret(token);
    const rawPath = core.getInput('checkov-output-path') || 'results_json.json';
    const title = core.getInput('title') || 'Checkov Security Scan';
    const hidePassed = core.getBooleanInput('hide-passed');
    const hideSkipped = core.getBooleanInput('hide-skipped');
    const softFail = core.getBooleanInput('soft-fail');
    const createNew = core.getBooleanInput('create-new-comment');
    const issueNumberInput = core.getInput('issue-number');
    const uniqueId = core.getInput('unique-id-for-comment') || 'default';
    const severitiesInput = core.getInput('severities') || 'CRITICAL,HIGH,MEDIUM,LOW,INFO';
    const valid = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const severities = severitiesInput
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter((s) => {
        if (valid.includes(s))
            return true;
        core.warning(`Ignoring unrecognized severity value: "${s}". Valid values are: ${valid.join(', ')}`);
        return false;
    });
    const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    const filePath = path.isAbsolute(rawPath)
        ? rawPath
        : path.join(workspace, rawPath);
    const data = (0, parse_1.parseCheckovOutput)(filePath);
    const formatOpts = {
        title,
        hidePassed,
        hideSkipped,
        severities,
    };
    const body = (0, format_1.buildComment)(data, formatOpts, uniqueId);
    // Set action outputs
    core.setOutput('total-failed', String(data.totals.failed));
    core.setOutput('total-passed', String(data.totals.passed));
    core.setOutput('critical', String(data.failedBySeverity.get('CRITICAL')?.length ?? 0));
    core.setOutput('high', String(data.failedBySeverity.get('HIGH')?.length ?? 0));
    core.setOutput('medium', String(data.failedBySeverity.get('MEDIUM')?.length ?? 0));
    core.setOutput('low', String(data.failedBySeverity.get('LOW')?.length ?? 0));
    core.setOutput('info', String(data.failedBySeverity.get('INFO')?.length ?? 0));
    const prNumber = (0, github_1.getPrNumber)(issueNumberInput);
    if (prNumber === null) {
        // No PR context — write to step summary
        core.info('No PR context found, writing to step summary.');
        await core.summary.addRaw(body).write();
        return;
    }
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const commentUrl = await (0, github_1.upsertComment)(octokit, { owner, repo }, prNumber, body, uniqueId, createNew);
    core.setOutput('comment-url', commentUrl);
    core.info(`Comment posted: ${commentUrl}`);
    const criticalCount = data.failedBySeverity.get('CRITICAL')?.length ?? 0;
    const highCount = data.failedBySeverity.get('HIGH')?.length ?? 0;
    if (!softFail && (criticalCount + highCount) > 0) {
        core.setFailed(`Checkov found ${criticalCount + highCount} critical/high severity issue(s). Set soft-fail: true to suppress this error.`);
    }
}
run().catch(err => {
    core.setFailed(err.message);
});
