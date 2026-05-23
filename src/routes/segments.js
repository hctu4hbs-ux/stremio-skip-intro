const express = require('express');
const router = express.Router();
const catalog = require('../services/catalog');
const aniskip = require('../services/aniskip');
const { validate, segmentSchema, segmentUpdateSchema } = require('../middleware/validate');

/**
 * GET /api/segments
 * List all segments. Filter by ?imdbId=tt1234567 and/or ?label=Intro
 */
router.get('/', (req, res) => {
    const { imdbId, label } = req.query;
    const segments = catalog.listSegments({ imdbId, label });
    res.json(segments);
});

/**
 * GET /api/segments/stats
 * Overall statistics — total shows, segments, label breakdown.
 */
router.get('/stats', (_req, res) => {
    res.json(catalog.getStats());
});

/**
 * POST /api/segments
 * Add a new skip segment.
 *
 * Body: { imdbId, showTitle, season?, episode?, start, end, label?, applyToSeries? }
 */
router.post('/', validate(segmentSchema), (req, res) => {
    const { start, end } = req.body;
    if (end <= start) {
        return res.status(400).json({ error: 'end must be greater than start' });
    }
    const segment = catalog.addSegment(req.body);
    res.status(201).json(segment);
});

/**
 * PATCH /api/segments/:id
 * Update start/end/label of an existing segment.
 */
router.patch('/:id', validate(segmentUpdateSchema), (req, res) => {
    const segment = catalog.updateSegment(req.params.id, req.body);
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    res.json(segment);
});

/**
 * PUT /api/segments/:videoId
 * Replace ALL segments for a specific videoId (e.g. tt1234567:1:3).
 * Body: array of { start, end, label?, season?, episode? }
 */
router.put('/:videoId', (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Body must be an array of segment objects' });
    }
    const segments = catalog.replaceSegmentsForVideo(req.params.videoId, req.body);
    if (segments === null) {
        return res.status(404).json({ error: `Show not found for videoId: ${req.params.videoId}` });
    }
    res.json(segments);
});

/**
 * DELETE /api/segments/:id
 * Delete a segment by its UUID.
 */
router.delete('/:id', (req, res) => {
    const deleted = catalog.deleteSegment(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Segment not found' });
    res.sendStatus(204);
});

/**
 * GET /api/segments/aniskip/:malId/:episode
 * Fetch skip times from AniSkip for a MAL anime ID + episode number.
 * These can be reviewed and then added via POST /api/segments.
 */
router.get('/aniskip/:malId/:episode', async (req, res) => {
    if (process.env.ANISKIP_ENABLED === 'false') {
        return res.status(403).json({ error: 'AniSkip integration is disabled' });
    }
    const malId = parseInt(req.params.malId, 10);
    const episode = parseInt(req.params.episode, 10);
    if (isNaN(malId) || isNaN(episode)) {
        return res.status(400).json({ error: 'malId and episode must be integers' });
    }
    const times = await aniskip.getSkipTimes(malId, episode);
    res.json({
        malId,
        episode,
        results: times.map(t => ({
            ...t,
            suggestedLabel: aniskip.typeToLabel(t.type),
        })),
    });
});

module.exports = router;
