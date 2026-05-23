const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalog');
const { validate, showSchema } = require('../middleware/validate');

/**
 * GET /api/catalog
 * Returns the full catalog.json — compatible with IntroHater's data format.
 */
router.get('/', (_req, res) => {
    res.json(catalogService.getCatalog());
});

/**
 * GET /api/catalog/:imdbId
 * Returns one show with all its segments.
 */
router.get('/:imdbId', (req, res) => {
    const show = catalogService.getShow(req.params.imdbId);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    res.json(show);
});

/**
 * POST /api/catalog/shows
 * Manually add a show to the catalog (without any segments yet).
 */
router.post('/shows', validate(showSchema), (req, res) => {
    const show = catalogService.upsertShow(req.body.imdbId, req.body);
    res.status(201).json(show);
});

/**
 * DELETE /api/catalog/shows/:imdbId
 * Remove a show and all its segments.
 */
router.delete('/shows/:imdbId', (req, res) => {
    const deleted = catalogService.deleteShow(req.params.imdbId);
    if (!deleted) return res.status(404).json({ error: 'Show not found' });
    res.sendStatus(204);
});

/**
 * POST /api/catalog/import
 * Import an existing catalog.json (e.g. from IntroHater).
 * Body: { catalog: <object>, mode: "merge" | "overwrite" }
 * Default mode is "merge" — existing entries are kept, new ones added.
 */
router.post('/import', (req, res) => {
    const { catalog, mode } = req.body;
    if (!catalog || typeof catalog !== 'object') {
        return res.status(400).json({ error: 'Body must contain a "catalog" object' });
    }
    const result = catalogService.importCatalog(catalog, mode || 'merge');
    res.json(result);
});

module.exports = router;
