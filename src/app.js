require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { builder, buildVtt } = require('./addon');

const segmentsRouter = require('./routes/segments');
const catalogRouter = require('./routes/catalog');
const proxyRouter = require('./routes/proxy');

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
app.use('/proxy/', rateLimit({ windowMs: 60 * 1000, max: 500 }));

// ─── Stremio Add-on routes ────────────────────────────────────────────────────
const addonInterface = builder.getInterface();

app.get('/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(addonInterface.manifest);
});

app.get('/subtitles/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await addonInterface.get({ resource: 'subtitles', type, id: decodeURIComponent(id), extra: req.query });
        res.json(result);
    } catch {
        res.status(500).json({ subtitles: [] });
    }
});

app.get('/:resource/:type/:id.json', async (req, res, next) => {
    const { resource, type, id } = req.params;
    if (!['subtitles', 'catalog', 'meta', 'stream'].includes(resource)) return next();
    try {
        const result = await addonInterface.get({ resource, type, id: decodeURIComponent(id), extra: req.query });
        res.json(result);
    } catch {
        next();
    }
});

// ─── VTT files — real hosted URLs that Stremio loads for skip button ─────────
app.get('/vtt/:videoId.vtt', (req, res) => {
    const videoId = decodeURIComponent(req.params.videoId);
    const vtt = buildVtt(videoId);
    if (!vtt) {
        res.status(404).send('WEBVTT\n\n# No skip segments found for: ' + videoId);
        return;
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vtt);
});

// ─── HLS proxy — strips intro/outro segments from any stream ─────────────────
app.use('/proxy', proxyRouter);

// ─── Management API routes ────────────────────────────────────────────────────
app.use('/api/segments', segmentsRouter);
app.use('/api/catalog', catalogRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: require('../package.json').version });
});

// ─── API index ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
    const host = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    res.json({
        name: 'stremio-skip-intro',
        version: require('../package.json').version,
        stremio: {
            installUrl: `stremio://${host.replace(/^https?:\/\//, '')}/manifest.json`,
            manifestUrl: `${host}/manifest.json`,
        },
        proxy: {
            hls: `${host}/proxy/hls?url=<base64url_m3u8>&videoId=<videoId>`,
            segment: `${host}/proxy/segment?url=<base64url_segment>`,
            lookup: `${host}/proxy/lookup?videoId=<videoId>`,
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
