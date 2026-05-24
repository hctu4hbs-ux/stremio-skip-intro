/**
 * my-stremio-addon — complete example
 *
 * Shows how to build a Stremio add-on that automatically removes intros
 * and outros using the stremio-skip-intro HLS proxy.
 *
 * How it works:
 *   - The stream handler fetches streams from an upstream source
 *   - Every HLS stream URL is wrapped through the skip-intro proxy
 *   - The proxy rewrites the manifest to remove intro/outro segments
 *   - The player loads a clean stream — the intro never plays
 *   - No button, no overlay, fully automatic
 *
 * Prerequisites:
 *   - stremio-skip-intro server running (set SKIP_INTRO_URL below)
 *   - npm install
 *   - node addon.js
 *
 * Install in Stremio: paste  http://localhost:7001/manifest.json
 */

require('dotenv').config();
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// ─── Config ──────────────────────────────────────────────────────────────────

const SKIP_INTRO_URL = (process.env.SKIP_INTRO_URL || 'http://localhost:7000').replace(/\/$/, '');
const PORT = process.env.PORT || 7001;

// ─── Manifest ─────────────────────────────────────────────────────────────────

const manifest = {
    id: 'com.example.my-addon',
    version: '1.0.0',
    name: 'My Add-on + Skip Intro',
    description: 'Intros and outros removed automatically. No button required.',
    catalogs: [],
    resources: ['stream'],
    types: ['series', 'movie'],
    idPrefixes: ['tt'],
};

const builder = new addonBuilder(manifest);

// ─── Helper: wrap HLS stream through the proxy ────────────────────────────────

/**
 * Returns a proxied stream URL.
 * The proxy removes intro/outro segments from the manifest before
 * the player loads a single frame.
 */
function skipProxy(m3u8Url, videoId) {
    const enc = Buffer.from(m3u8Url).toString('base64url');
    return `${SKIP_INTRO_URL}/proxy/hls?url=${enc}&videoId=${encodeURIComponent(videoId)}`;
}

// ─── Stream handler ────────────────────────────────────────────────────────────

builder.defineStreamHandler(async ({ type, id }) => {
    // Replace this with your actual stream source.
    // This example uses a placeholder HLS URL.
    const originalHlsUrl = `https://example.com/stream/${id}/index.m3u8`;

    return {
        streams: [
            {
                name: '⏩ Auto Skip Intro',
                description: 'Intros and outros removed automatically',
                url: skipProxy(originalHlsUrl, id),
            },
        ],
    };
});

// ─── Start ────────────────────────────────────────────────────────────────────

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`\n[my-stremio-addon] Running on http://localhost:${PORT}`);
console.log(`[my-stremio-addon] Install: stremio://localhost:${PORT}/manifest.json`);
console.log(`[my-stremio-addon] Skip-intro server: ${SKIP_INTRO_URL}\n`);
