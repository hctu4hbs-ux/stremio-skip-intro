/**
 * addon.js
 *
 * Stremio add-on — automatic intro/outro removal via HLS proxy.
 *
 * HOW IT WORKS (no button, fully automatic):
 *
 *   1. STREAM HANDLER  (primary — requires UPSTREAM_ADDON_URL)
 *      Fetches streams from any configured upstream Stremio add-on,
 *      wraps every HLS stream through the local proxy, and returns
 *      the modified URL to Stremio. The proxy physically removes
 *      intro/outro segments from the manifest before the player
 *      loads a single frame. The user sees nothing — the intro
 *      simply does not exist in the stream.
 *
 *   2. SUBTITLE TRACK  (fallback — always active)
 *      When no upstream is configured, or the stream is not HLS,
 *      a VTT subtitle track is attached. Stremio shows a "Skip"
 *      button the user can click.
 *
 * Install URL (paste into Stremio → Add-ons):
 *   http://<your-host>/manifest.json
 *
 * Env vars:
 *   BASE_URL            — public URL of this server (required for proxy links)
 *   UPSTREAM_ADDON_URL  — base URL of a Stremio add-on to pull streams from
 *                         e.g. https://torrentio.strem.fun/sort=qualitysize
 *                         Omit trailing slash.
 */

const { addonBuilder } = require('stremio-addon-sdk');
const { getSegments, parseVideoId } = require('./services/sources');

function baseUrl() {
    return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`).replace(/\/$/, '');
}

function upstreamUrl() {
    return (process.env.UPSTREAM_ADDON_URL || '').replace(/\/$/, '');
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

const MANIFEST = {
    id: 'community.stremio-skip-intro',
    version: require('../package.json').version,
    name: '⏩ Skip Intro',
    description: 'Automatically removes intros, outros, recaps and credits from streams. No button — the intro simply never plays.',
    logo: 'https://i.imgur.com/MZnGMzp.png',
    background: 'https://i.imgur.com/pjSSGAU.jpg',
    catalogs: [],
    resources: ['stream', 'subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['tt', 'kitsu'],
    behaviorHints: { configurable: false, configurationRequired: false },
};

const builder = new addonBuilder(MANIFEST);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the URL points to an HLS manifest.
 */
function isHls(url) {
    if (!url) return false;
    return /\.m3u8(\?|$)/i.test(url) || /application\/vnd\.apple\.mpegurl/i.test(url);
}

/**
 * Wrap an HLS manifest URL through the local proxy.
 * The proxy fetches the upstream manifest, removes intro/outro segments,
 * and rewrites segment URLs so the player gets a clean stream.
 */
function wrapThroughProxy(m3u8Url, videoId) {
    const encoded = Buffer.from(m3u8Url).toString('base64url');
    return `${baseUrl()}/proxy/hls?url=${encoded}&videoId=${encodeURIComponent(videoId)}`;
}

/**
 * Fetch streams from an upstream Stremio add-on.
 * Returns an empty array if the upstream is not configured or unreachable.
 */
async function fetchUpstreamStreams(type, id) {
    const upstream = upstreamUrl();
    if (!upstream) return [];

    const url = `${upstream}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'stremio-skip-intro/1.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.streams) ? data.streams : [];
    } catch {
        return [];
    }
}

// ─── Stream handler ────────────────────────────────────────────────────────────

/**
 * Called by Stremio when a user starts playing a video.
 *
 * If UPSTREAM_ADDON_URL is set:
 *   - Fetches streams from the upstream add-on
 *   - Wraps each HLS stream through the proxy (intro physically removed)
 *   - Non-HLS streams are passed through unchanged with a note
 *
 * If UPSTREAM_ADDON_URL is NOT set:
 *   - Returns an empty streams array (subtitle fallback still runs)
 */
builder.defineStreamHandler(async ({ type, id }) => {
    const upstreamStreams = await fetchUpstreamStreams(type, id);

    if (upstreamStreams.length === 0) return { streams: [] };

    const { imdbId, season, episode } = parseVideoId(id);
    const segments = await getSegments({ imdbId, season, episode });
    const hasSkipData = segments.length > 0;

    const streams = upstreamStreams.map(stream => {
        if (!hasSkipData) return stream;



        return {
            ...stream,
            subtitles: [
                ...(stream.subtitles || []),
                {
                    id: `skip-${id}`,
                    url: `${baseUrl()}/vtt/${encodeURIComponent(id)}.vtt`,
                    lang: 'skip',
                },
            ],
        };
    });

    return { streams };
});

// ─── Subtitles handler ─────────────────────────────────────────────────────────

/**
 * Fallback: attaches a VTT skip-button track to any stream from any add-on.
 * Active regardless of whether UPSTREAM_ADDON_URL is set.
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
    const { imdbId, season, episode } = parseVideoId(id);
    const malId = parseInt(process.env[`MAL_${imdbId}`] || '') || undefined;

    const segments = await getSegments({ imdbId, season, episode, malId });
    if (segments.length === 0) return { subtitles: [] };

    const url = `${baseUrl()}/vtt/${encodeURIComponent(id)}.vtt`;
    return {
        subtitles: [{ id: `skip-${id}`, url, lang: 'skip' }],
    };
});

// ─── VTT builder ─────────────────────────────────────────────────────────────

const { getShow } = require('./services/catalog');

function buildVtt(videoId) {
    const { imdbId, season, episode } = parseVideoId(videoId);
    const show = getShow(imdbId);
    if (!show) return null;

    const vId = season != null && episode != null ? `${imdbId}:${season}:${episode}` : imdbId;
    const segs = (show.segments || []).filter(s => s.videoId === vId || s.applyToSeries);
    if (segs.length === 0) return null;

    const lines = ['WEBVTT', ''];
    let i = 0;
    for (const seg of segs) {
        lines.push(`cue-${++i}`, `${toVttTime(seg.start)} --> ${toVttTime(seg.end)}`, `{skip}${seg.label}`, '');
    }
    return lines.join('\n');
}

async function buildVttAsync(videoId) {
    const { imdbId, season, episode } = parseVideoId(videoId);
    const segments = await getSegments({ imdbId, season, episode });
    if (segments.length === 0) return null;

    const lines = ['WEBVTT', ''];
    let i = 0;
    for (const seg of segments) {
        lines.push(`cue-${++i}`, `${toVttTime(seg.start)} --> ${toVttTime(seg.end)}`, `{skip}${seg.label}`, '');
    }
    return lines.join('\n');
}

function toVttTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':') + '.' + String(ms).padStart(3, '0');
}

module.exports = { builder, MANIFEST, buildVtt, buildVttAsync };
