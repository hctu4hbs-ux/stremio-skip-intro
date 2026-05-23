/**
 * routes/proxy.js
 *
 * Stream proxy routes.
 *
 * GET /proxy/hls?url=<base64url_encoded_m3u8>&videoId=<videoId>
 *   Returns a modified HLS manifest with intro/outro segments removed.
 *
 * GET /proxy/segment?url=<base64url_encoded_segment_url>
 *   Transparently proxies a .ts / .mp4 / .aac segment.
 *
 * GET /proxy/lookup?videoId=<videoId>[&malId=<malId>]
 *   Returns all skip segments from all sources (JSON).
 *   Useful for debugging or building a custom player UI.
 */

const express = require('express');
const router = express.Router();
const { buildProxiedM3u8 } = require('../services/proxy');
const { getSegments, parseVideoId } = require('../services/sources');

function serverBase(req) {
    const base = process.env.BASE_URL;
    if (base) return base.replace(/\/$/, '');
    return `${req.protocol}://${req.get('host')}`;
}

// ─── HLS manifest proxy ───────────────────────────────────────────────────

/**
 * GET /proxy/hls?url=<base64url>&videoId=tt...:1:1
 *
 * Fetches the original m3u8, strips intro/outro segments, rewrites all
 * segment URLs through /proxy/segment so the player only gets modified data.
 *
 * To use this in your Stremio add-on, wrap any HLS stream URL:
 *   const proxyUrl = `${serverBase}/proxy/hls?url=${btoa(originalM3u8)}&videoId=${videoId}`;
 */
router.get('/hls', async (req, res) => {
    const { url, videoId } = req.query;
    if (!url || !videoId) {
        return res.status(400).json({ error: 'url and videoId are required' });
    }

    let originalUrl;
    try {
        originalUrl = Buffer.from(url, 'base64url').toString('utf-8');
    } catch {
        return res.status(400).json({ error: 'url must be base64url encoded' });
    }

    try {
        const m3u8 = await buildProxiedM3u8(originalUrl, videoId, serverBase(req));
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(m3u8);
    } catch (err) {
        res.status(502).json({ error: `Proxy error: ${err.message}` });
    }
});

// ─── Segment proxy ────────────────────────────────────────────────────────

/**
 * GET /proxy/segment?url=<base64url>
 *
 * Transparent proxy for HLS media segments (.ts, .mp4, .aac).
 * Handles CORS so Stremio's web player can load cross-origin segments.
 */
router.get('/segment', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url is required' });

    let originalUrl;
    try {
        originalUrl = Buffer.from(url, 'base64url').toString('utf-8');
    } catch {
        return res.status(400).json({ error: 'url must be base64url encoded' });
    }

    try {
        const upstream = await fetch(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; stremio-skip-intro/1.0)',
                Range: req.headers.range || '',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!upstream.ok && upstream.status !== 206) {
            return res.status(upstream.status).send('Upstream error');
        }

        // Forward relevant headers
        const forward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
        for (const h of forward) {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(upstream.status);

        // Stream the body
        const reader = upstream.body.getReader();
        res.on('close', () => reader.cancel());
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        res.end();
    } catch (err) {
        if (!res.headersSent) res.status(502).json({ error: `Proxy error: ${err.message}` });
    }
});

// ─── Lookup endpoint ─────────────────────────────────────────────────────

/**
 * GET /proxy/lookup?videoId=tt...:1:1[&malId=12345]
 *
 * Returns all skip segments from all sources for a given video.
 * Useful for debugging, building custom UIs, or testing what the proxy will skip.
 */
router.get('/lookup', async (req, res) => {
    const { videoId, malId } = req.query;
    if (!videoId) return res.status(400).json({ error: 'videoId is required' });

    const { imdbId, season, episode } = parseVideoId(videoId);
    const segments = await getSegments({
        imdbId, season, episode,
        malId: malId ? parseInt(malId) : undefined,
    });

    res.json({
        videoId,
        imdbId,
        season,
        episode,
        segments,
        proxyUrl: `${serverBase(req)}/proxy/hls?url=<base64url_of_m3u8>&videoId=${encodeURIComponent(videoId)}`,
    });
});

module.exports = router;
