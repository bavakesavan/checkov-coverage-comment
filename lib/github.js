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
exports.findExistingComment = findExistingComment;
exports.createComment = createComment;
exports.updateComment = updateComment;
exports.upsertComment = upsertComment;
exports.getPrNumber = getPrNumber;
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const format_1 = require("./format");
async function findExistingComment(octokit, repo, prNumber, uniqueId) {
    const iterator = octokit.paginate.iterator(octokit.rest.issues.listComments, {
        owner: repo.owner,
        repo: repo.repo,
        issue_number: prNumber,
        per_page: 100,
    });
    for await (const page of iterator) {
        for (const comment of page.data) {
            if (comment.body && (0, format_1.parseWatermarkId)(comment.body) === uniqueId) {
                return comment.id;
            }
        }
    }
    return null;
}
async function createComment(octokit, repo, prNumber, body) {
    const response = await octokit.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: prNumber,
        body,
    });
    return response.data.html_url;
}
async function updateComment(octokit, repo, commentId, body) {
    const response = await octokit.rest.issues.updateComment({
        owner: repo.owner,
        repo: repo.repo,
        comment_id: commentId,
        body,
    });
    return response.data.html_url;
}
async function upsertComment(octokit, repo, prNumber, body, uniqueId, forceNew) {
    if (!forceNew) {
        const existing = await findExistingComment(octokit, repo, prNumber, uniqueId);
        if (existing !== null) {
            core.info(`Updating existing comment ${existing}`);
            return updateComment(octokit, repo, existing, body);
        }
    }
    core.info('Creating new PR comment');
    return createComment(octokit, repo, prNumber, body);
}
function getPrNumber(issueNumberInput) {
    if (issueNumberInput) {
        const n = parseInt(issueNumberInput, 10);
        if (!isNaN(n))
            return n;
    }
    const payload = github.context.payload;
    if (payload.pull_request) {
        return payload.pull_request.number;
    }
    return null;
}
