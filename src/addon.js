/**
 * addon.js
 *
 * Stremio add-on — skip-intro/outro via subtitle cues + HLS proxy.
 *
 * Two complementary mechanisms:
 *
 *   1. SUBTITLE TRACK  (/vtt/:videoId.vtt)
 *      Stremio loads a WebVTT file with {skip} cues.
 *      The player shows a "Skip Intro" / "Skip Outro" button overlay.
 *      Works with ANY stream source. User clicks to skip.
 *
 *   2. HLS PROXY  (/proxy/hls)
 *      For HLS streams developers can route through the proxy.
 *      Intro/outro segments are physically removed from the manifest.
 *      The player never even receives the intro data.
 *
 * Install URL (paste into Stremio → Add-ons):
 *   http://<your-host>/manifest.json
 */

const { addonBuilder } = require('stremio-addon-sdk');
const { getSegments, parseVideoId } = require('./services/sources');

function baseUrl() {
    return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`).replace(/\/$/, '');
}

const MANIFEST = {
    id: 'community.stremio-skip-intro',
    version: require('../package.json').version,
    name: '⏩ Skip Intro',
    description: 'Shows a Skip button for intros, outros, recaps, and credits. Data aggregated from multiple community sources.',
    logo: 'https://i.imgur.com/MZnGMzp.png',
    background: 'https://i.imgur.com/pjSSGAU.jpg',
    catalogs: [],
    resources: ['subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['tt', 'kitsu'],
    behaviorHints: { configurable: false, configurationRequired: false },
};

const builder = new addonBuilder(MANIFEST);

/**
 * Subtitles handler — Stremio calls this during every playback session.
 *
 * We aggregate skip segments from:
 *   - Local catalog
 *   - TheIntroDB (community database, movies + TV)
 *   - AniSkip (anime)
 *
 * Then return a hosted VTT URL. Stremio loads it and shows the skip button.
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
    const { imdbId, season, episode } = parseVideoId(id);
    const malId = parseInt(process.env[`MAL_${imdbId}`] || '') || undefined;

    const segments = await getSegments({ imdbId, season, episode, malId });
    if (segments.length === 0) return { subtitles: [] };

    const encodedId = encodeURIComponent(id);
    const url = `${baseUrl()}/vtt/${encodedId}.vtt`;

    return {
        subtitles: [
            { id: `skip-${id}`, url, lang: 'skip' },
        ],
    };
});

// ─── VTT builder ─────────────────────────────────────────────────────────────

/**
 * Build a WebVTT string for a videoId, using all sources.
 * Returns null if no segments are found.
 */
async function buildVttAsync(videoId) {
    const { imdbId, season, episode } = parseVideoId(videoId);
    const segments = await getSegments({ imdbId, season, episode });
    if (segments.length === 0) return null;

    const lines = ['WEBVTT', ''];
    let i = 0;
    for (const seg of segments) {
        lines.push(
            `cue-${++i}`,
            `${toVTTTime(seg.start)} --> ${toVTTTime(seg.end)}`,
            `{skip}${seg.label}`,
            '',
        );
    }
    return lines.join('\n');
}

/**
 * Synchronous VTT builder from local catalog only (used for fast /vtt endpoint).
 * Falls back to async version only if needed.
 */
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
        lines.push(`cue-${++i}`, `${toVTTTime(seg.start)} --> ${toVTTTime(seg.end)}`, `{skip}${seg.label}`, '');
    }
    return lines.join('\n');
}

function toVTTTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':') + '.' + String(ms).padStart(3, '0');
}

module.exports = { builder, MANIFEST, buildVtt, buildVttAsync };
