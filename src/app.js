require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { builder, buildVtt } = require('./addon');

const segmentsRouter = require('./routes/segments');
const githubRouter = require('./routes/github');
const catalogRouter = require('./routes/catalog');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

// ─── Stremio Add-on routes ────────────────────────────────────────────────────
// These are the endpoints Stremio calls to install and use the add-on.
//
//   GET /manifest.json          ← Stremio reads this to install the add-on
//   GET /subtitles/:type/:id.json  ← Stremio calls this during playback
//
const addonInterface = builder.getInterface();

app.get('/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(addonInterface.manifest);
});

app.get('/subtitles/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const extra = req.query;
    try {
        const result = await addonInterface.get({ resource: 'subtitles', type, id: decodeURIComponent(id), extra });
        res.json(result);
    } catch (err) {
        res.status(500).json({ subtitles: [] });
    }
});

// VTT endpoint — serves a real WebVTT file for each video ID
// Stremio requires a proper HTTP URL (not a data URI) to load subtitle tracks
app.get('/vtt/:videoId.vtt', (req, res) => {
    const videoId = decodeURIComponent(req.params.videoId);
    const vtt = buildVtt(videoId);
    if (!vtt) {
        res.status(404).send('WEBVTT\n\n# No skip segments found for: ' + videoId);
        return;
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(vtt);
});

// Stremio also calls /:resource/:type/:id.json generically
app.get('/:resource/:type/:id.json', async (req, res, next) => {
    const { resource, type, id } = req.params;
    if (!['subtitles', 'catalog', 'meta', 'stream'].includes(resource)) return next();
    const extra = req.query;
    try {
        const result = await addonInterface.get({ resource, type, id: decodeURIComponent(id), extra });
        res.json(result);
    } catch {
        next();
    }
});

// ─── Management API routes ────────────────────────────────────────────────────
app.use('/api/segments', segmentsRouter);
app.use('/api/github', githubRouter);
app.use('/api/catalog', catalogRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: require('../package.json').version });
});

// ─── API root index ──────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
    const host = req.headers.host || `localhost:${process.env.PORT || 7000}`;
    res.json({
        name: 'stremio-skip-intro',
        version: require('../package.json').version,
        stremio: {
            installUrl: `stremio://${host}/manifest.json`,
            manifestUrl: `http://${host}/manifest.json`,
            note: 'Open installUrl in Stremio or paste manifestUrl into the Add-ons search bar',
        },
        endpoints: {
            'GET  /manifest.json': 'Stremio add-on manifest (install this)',
            'GET  /subtitles/:type/:id.json': 'Skip-intro subtitles (called by Stremio)',
            'GET  /api/segments': 'List all segments',
            'POST /api/segments': 'Add a segment',
            'PATCH /api/segments/:id': 'Update a segment',
            'DELETE /api/segments/:id': 'Delete a segment',
            'GET  /api/catalog': 'Full catalog.json',
            'GET  /api/catalog/:imdbId': 'One show with all segments',
            'POST /api/catalog/import': 'Import existing catalog.json',
            'GET  /api/github/config': 'GitHub sync config',
            'POST /api/github/config': 'Save GitHub sync config',
            'POST /api/github/sync': 'Push catalog.json to GitHub',
            'GET  /api/github/preview': 'Preview before pushing',
        },
    });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[error]', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
