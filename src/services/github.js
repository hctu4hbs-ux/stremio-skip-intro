/**
 * github.js
 *
 * Handles reading/writing config and pushing catalog.json to a GitHub repo
 * using the GitHub Contents API (no git binary required).
 *
 * The config is stored in data/github-config.json so it persists across restarts.
 */

const fs = require('fs');
const path = require('path');
const { getCatalog } = require('./catalog');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'github-config.json');

// ─── Config ──────────────────────────────────────────────────────────────────

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return {
            repoOwner: process.env.GITHUB_REPO_OWNER || '',
            repoName: process.env.GITHUB_REPO_NAME || '',
            branch: process.env.GITHUB_BRANCH || 'main',
            filePath: process.env.GITHUB_FILE_PATH || 'data/catalog.json',
            lastSyncAt: null,
            lastSyncSha: null,
        };
    }
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
        return { repoOwner: '', repoName: '', branch: 'main', filePath: 'data/catalog.json', lastSyncAt: null, lastSyncSha: null };
    }
}

function saveConfig(config) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getConfig() {
    return loadConfig();
}

function setConfig({ repoOwner, repoName, branch, filePath }) {
    const config = loadConfig();
    if (repoOwner !== undefined) config.repoOwner = repoOwner;
    if (repoName !== undefined) config.repoName = repoName;
    if (branch !== undefined) config.branch = branch;
    if (filePath !== undefined) config.filePath = filePath;
    saveConfig(config);
    return config;
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function githubRequest(method, url, body, token) {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Push catalog.json to the configured GitHub repository.
 * Returns { success, message, sha, commitUrl, filesUpdated }
 */
async function syncToGithub() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return { success: false, message: 'GITHUB_TOKEN is not set in environment.', sha: null, commitUrl: null, filesUpdated: 0 };
    }

    const config = loadConfig();
    if (!config.repoOwner || !config.repoName) {
        return { success: false, message: 'GitHub config is incomplete. Set repoOwner and repoName first.', sha: null, commitUrl: null, filesUpdated: 0 };
    }

    const catalog = getCatalog();
    const content = Buffer.from(JSON.stringify(catalog, null, 2)).toString('base64');
    const apiUrl = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}`;

    // Get current SHA (needed to update existing file)
    let existingSha;
    const getRes = await githubRequest('GET', `${apiUrl}?ref=${config.branch}`, null, token);
    if (getRes.ok && getRes.data.sha) {
        existingSha = getRes.data.sha;
    }

    const putBody = {
        message: `chore: update ${config.filePath} [${new Date().toISOString()}]`,
        content,
        branch: config.branch,
    };
    if (existingSha) putBody.sha = existingSha;

    const putRes = await githubRequest('PUT', apiUrl, putBody, token);
    if (!putRes.ok) {
        return {
            success: false,
            message: `GitHub API error ${putRes.status}: ${typeof putRes.data === 'object' ? putRes.data.message : putRes.data}`,
            sha: null,
            commitUrl: null,
            filesUpdated: 0,
        };
    }

    const sha = putRes.data.commit?.sha ?? null;
    const commitUrl = putRes.data.commit?.html_url ?? null;

    config.lastSyncAt = new Date().toISOString();
    config.lastSyncSha = sha;
    saveConfig(config);

    return { success: true, message: `Successfully pushed ${config.filePath} to ${config.repoOwner}/${config.repoName}@${config.branch}`, sha, commitUrl, filesUpdated: 1 };
}

/**
 * Fetch the current file from GitHub (read-only, no token required for public repos).
 */
async function fetchFromGithub() {
    const token = process.env.GITHUB_TOKEN;
    const config = loadConfig();
    if (!config.repoOwner || !config.repoName) {
        return { success: false, message: 'GitHub config is incomplete.' };
    }

    const apiUrl = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}?ref=${config.branch}`;
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
        return { success: false, message: `GitHub API error ${res.status}` };
    }
    const data = await res.json();
    const decoded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return { success: true, data: decoded, sha: data.sha };
}

module.exports = { getConfig, setConfig, syncToGithub, fetchFromGithub };
