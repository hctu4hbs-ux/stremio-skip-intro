const express = require('express');
const router = express.Router();
const github = require('../services/github');
const { validate, githubConfigSchema } = require('../middleware/validate');
const { getCatalog } = require('../services/catalog');

/**
 * GET /api/github/config
 * Returns the current GitHub sync configuration.
 */
router.get('/config', (_req, res) => {
    res.json(github.getConfig());
});

/**
 * POST /api/github/config
 * Save GitHub repository config.
 * Body: { repoOwner, repoName, branch?, filePath? }
 */
router.post('/config', validate(githubConfigSchema), (req, res) => {
    const config = github.setConfig(req.body);
    res.json(config);
});

/**
 * GET /api/github/preview
 * Preview the catalog.json that would be pushed to GitHub.
 * Useful to review before committing.
 */
router.get('/preview', (_req, res) => {
    res.json(getCatalog());
});

/**
 * POST /api/github/sync
 * Push the catalog.json to the configured GitHub repository.
 * Requires GITHUB_TOKEN in environment.
 */
router.post('/sync', async (_req, res) => {
    const result = await github.syncToGithub();
    const statusCode = result.success ? 200 : 422;
    res.status(statusCode).json(result);
});

/**
 * POST /api/github/fetch
 * Pull the current catalog.json from GitHub into local storage.
 * Useful to sync down changes made directly in the repo.
 */
router.post('/fetch', async (_req, res) => {
    const result = await github.fetchFromGithub();
    if (!result.success) {
        return res.status(422).json(result);
    }
    // Optionally import into local catalog
    const { importCatalog } = require('../services/catalog');
    const imported = importCatalog(result.data, 'merge');
    res.json({ ...result, imported });
});

module.exports = router;
