/**
 * my-stremio-addon — complete example
 *
 * Shows how to build a Stremio add-on that:
 *   1. Serves skip-intro subtitle tracks via stremio-skip-intro
 *   2. Wraps any HLS stream through the skip-intro HLS proxy
 *      so intros are physically removed before the player sees them
 *
 * Prerequisites:
 *   - stremio-skip-intro server running (see SKIP_INTRO_URL below)
 *   - npm install
 *   - node addon.js
 *
 * Install in Stremio: paste  http://localhost:7001/manifest.json
 */

require('dotenv').config();
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// ─── Config ──────────────────────────────────────────────────────────────────

// URL of your running stremio-skip-intro server
const SKIP_INTRO_URL = (process.env.SKIP_INTRO_URL || 'http://localhost:7000').replace(/\/$/, '');

const PORT = process.env.PORT || 7001;

// ─── Manifest ─────────────────────────────────────────────────────────────────

const manifest = {
    id: 'com.example.my-addon',
    version: '1.0.0',
    name: 'My Add-on + Skip Intro',
    description: 'Example add-on with skip-intro support powered by stremio-skip-intro.',
    catalogs: [],
    resources: ['stream', 'subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['tt'],
};

const builder = new addonBuilder(manifest);

// ─── Helper: fetch skip segments ─────────────────────────────────────────────

/**
 * Fetch all skip segments for a video from stremio-skip-intro.
 * Returns an array of { start, end, label, source } objects.
 */
async function getSkipSegments(videoId) {
    try {
        const res = await fetch(`${SKIP_INTRO_URL}/proxy/lookup?videoId=${encodeURIComponent(videoId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.segments || [];
    } catch {
        return [];
    }
}

/**
 * Wrap an HLS stream URL through the skip-intro proxy.
 * The proxy rewrites the manifest to physically cut intro/outro segments.
 *
 * @param {string} originalM3u8  The original .m3u8 stream URL
 * @param {string} videoId       e.g. "tt0944947:1:1"
 */
function proxyStream(originalM3u8, videoId) {
    const encoded = Buffer.from(originalM3u8).toString('base64url');
    return `${SKIP_INTRO_URL}/proxy/hls?url=${encoded}&videoId=${encodeURIComponent(videoId)}`;
}

// ─── Stream handler ────────────────────────────────────────────────────────────

/**
 * Return streams for a given video.
 *
 * We demonstrate two approaches:
 *
 *   Option A — Proxy stream (intros removed automatically, no user action needed)
 *   Option B — Original stream (user sees a "Skip" button from the subtitle track)
 *
 * In a real add-on, replace the example HLS URLs with real ones from your source.
 */
builder.defineStreamHandler(async ({ type, id }) => {
    // Example source stream (replace with your actual stream source)
    const exampleHlsUrl = `https://example.com/stream/${id}/index.m3u8`;

    const streams = [];

    // ── Option A: Proxy stream — intros cut out automatically ──────────────────
    // The HLS manifest is rewritten by stremio-skip-intro.
    // The player never even receives the intro segments.
    streams.push({
        name: '⏩ Skip Intro (Auto)',
        description: 'Intros and outros removed automatically via HLS proxy',
        url: proxyStream(exampleHlsUrl, id),
        behaviorHints: { notWebReady: false },
    });

    // ── Option B: Original stream + skip button ─────────────────────────────────
    // The original stream is served, but a subtitle track is added.
    // Stremio shows a "Skip" button overlay at intro/outro timestamps.
    streams.push({
        name: '▶ Original + Skip Button',
        description: 'Original stream with skip-intro button overlay',
        url: exampleHlsUrl,
        subtitles: [
            {
                id: `skip-${id}`,
                url: `${SKIP_INTRO_URL}/vtt/${encodeURIComponent(id)}.vtt`,
                lang: 'skip',
            },
        ],
    });

    return { streams };
});

// ─── Subtitles handler ─────────────────────────────────────────────────────────

/**
 * Return the skip-intro subtitle track for any video.
 * Stremio calls this for every episode — we just forward to stremio-skip-intro.
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
    const segments = await getSkipSegments(id);
    if (segments.length === 0) return { subtitles: [] };

    return {
        subtitles: [
            {
                id: `skip-intro-${id}`,
                url: `${SKIP_INTRO_URL}/vtt/${encodeURIComponent(id)}.vtt`,
                lang: 'skip',
            },
        ],
    };
});

// ─── Start ────────────────────────────────────────────────────────────────────

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`\n[my-stremio-addon] Running on http://localhost:${PORT}`);
console.log(`[my-stremio-addon] Install URL: stremio://localhost:${PORT}/manifest.json`);
console.log(`[my-stremio-addon] Skip-intro server: ${SKIP_INTRO_URL}\n`);
