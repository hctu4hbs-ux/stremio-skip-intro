/**
 * sync-github.js
 *
 * Standalone script to push catalog.json to GitHub without starting the server.
 * Usage: node scripts/sync-github.js
 *
 * Requires GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME in .env
 */

require('dotenv').config();
const { syncToGithub, getConfig } = require('../src/services/github');

(async () => {
    const config = getConfig();
    console.log(`Syncing to ${config.repoOwner}/${config.repoName} @ ${config.branch}/${config.filePath}...`);
    const result = await syncToGithub();
    if (result.success) {
        console.log(`✓ ${result.message}`);
        if (result.commitUrl) console.log(`  Commit: ${result.commitUrl}`);
    } else {
        console.error(`✗ ${result.message}`);
        process.exit(1);
    }
})();
