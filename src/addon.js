/**
 * addon.js
 *
 * Stremio add-on — serves skip-intro/outro markers as subtitle tracks.
 *
 * How it works:
 *   1. Stremio reads /manifest.json when the add-on is installed
 *   2. During playback, Stremio calls /subtitles/:type/:id.json
 *   3. We return a real hosted URL pointing to a WebVTT file
 *   4. Stremio loads the VTT file; the player shows a "Skip" button
 *      at the exact timestamps defined in the cues
 *
 * Install URL (paste into Stremio → Add-ons search bar):
 *   http://<your-host>/manifest.json
 */

const { addonBuilder } = require('stremio-addon-sdk');
const { getShow } = require('./services/catalog');

// The public base URL of this server.
// Set BASE_URL in .env for production (e.g. https://your-server.com).
// Falls back to localhost for local development.
function baseUrl() {
    return (process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`).replace(/\/$/, '');
}

const MANIFEST = {
    id: 'community.stremio-skip-intro',
    version: require('../package.json').version,
    name: '⏩ Skip Intro',
    description: 'Automatically shows a Skip button at intro and outro timestamps for TV shows and movies.',
    logo: 'https://i.imgur.com/MZnGMzp.png',
    background: 'https://i.imgur.com/pjSSGAU.jpg',
    catalogs: [],
    resources: ['subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['tt', 'kitsu'],
    behaviorHints: {
        configurable: false,
        configurationRequired: false,
    },
};

const builder = new addonBuilder(MANIFEST);

/**
 * Subtitles handler — called by Stremio during playback.
 *
 * id examples:
 *   "tt0944947:1:1"  → Game of Thrones S01E01
 *   "tt0903747"      → Breaking Bad (movie-style / no episode)
 */
builder.defineSubtitlesHandler(async ({ type, id }) => {
    const parts = id.split(':');
    const imdbId = parts[0].startsWith('kitsu') ? `${parts[0]}:${parts[1]}` : parts[0];

    const show = getShow(imdbId);
    if (!show) return { subtitles: [] };

    const segments = (show.segments || []).filter(
        seg => seg.videoId === id || seg.applyToSeries
    );
    if (segments.length === 0) return { subtitles: [] };

    // Return a real hosted URL — Stremio requires HTTP/HTTPS, not data URIs
    const encodedId = encodeURIComponent(id);
    const url = `${baseUrl()}/vtt/${encodedId}.vtt`;

    return {
        subtitles: [
            {
                id: `skip-intro-${id}`,
                url,
                lang: 'skip',
            },
        ],
    };
});

// ─── VTT file builder ─────────────────────────────────────────────────────────

/**
 * Build a WebVTT string for a given video ID.
 * Cue text uses the {skip} metadata format that Stremio's player recognises
 * to render a "Skip Intro" / "Skip Outro" button overlay.
 *
 * @param {string} id  e.g. "tt0944947:1:1"
 * @returns {string|null}  VTT content, or null if no segments found
 */
function buildVtt(id) {
    const parts = id.split(':');
    const imdbId = parts[0].startsWith('kitsu') ? `${parts[0]}:${parts[1]}` : parts[0];

    const show = getShow(imdbId);
    if (!show) return null;

    const segments = (show.segments || []).filter(
        seg => seg.videoId === id || seg.applyToSeries
    );
    if (segments.length === 0) return null;

    const lines = ['WEBVTT', ''];
    for (const seg of segments) {
        lines.push(
            seg.id,
            `${toVTTTime(seg.start)} --> ${toVTTTime(seg.end)}`,
            // {skip} tells Stremio's player to show the skip button overlay
            `{skip}${seg.label}`,
            '',
        );
    }
    return lines.join('\n');
}

/**
 * Convert seconds (float) → WebVTT timestamp HH:MM:SS.mmm
 */
function toVTTTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':') + '.' + String(ms).padStart(3, '0');
}

module.exports = { builder, MANIFEST, buildVtt };
