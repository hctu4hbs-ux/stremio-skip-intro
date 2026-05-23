/**
 * addon.js
 *
 * Stremio add-on integration using stremio-addon-sdk.
 *
 * Install in Stremio by visiting:
 *   http://localhost:7000/manifest.json
 * and clicking "Install".
 *
 * This add-on provides skip-intro/outro data as subtitle cues (VTT format)
 * that Stremio's player can display and act on.
 */

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { getShow, getCatalog } = require('./services/catalog');

const MANIFEST = {
    id: 'community.stremio-skip-intro',
    version: require('../package.json').version,
    name: 'Skip Intro',
    description: 'Community-powered intro/outro skip markers for TV shows and movies. Shows skip prompts at the right timestamp so you never sit through an intro again.',
    logo: 'https://i.imgur.com/MZnGMzp.png',
    background: 'https://i.imgur.com/pjSSGAU.jpg',
    catalogs: [],
    resources: ['subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['tt', 'kitsu:'],
    behaviorHints: {
        configurable: false,
        configurationRequired: false,
    },
};

const builder = new addonBuilder(MANIFEST);

/**
 * Subtitles handler.
 *
 * Stremio calls this with { type, id } where id is:
 *   - "tt1234567:1:2" for series (IMDB:season:episode)
 *   - "tt1234567"     for movies
 *
 * We return a WebVTT subtitle track with skip markers embedded as cues.
 * Each cue fires at the start of an intro/outro so Stremio shows a "Skip" button.
 */
builder.defineSubtitlesHandler(async ({ type, id, extra }) => {
    // Parse the video ID
    const parts = id.split(':');
    const imdbId = parts[0].startsWith('kitsu') ? `${parts[0]}:${parts[1]}` : parts[0];

    const show = getShow(imdbId);
    if (!show) return { subtitles: [] };

    const segments = (show.segments || []).filter(seg => {
        // Match exact episode OR applyToSeries segments
        return seg.videoId === id || seg.applyToSeries;
    });

    if (segments.length === 0) return { subtitles: [] };

    // Build WebVTT content with one cue per segment
    const vttLines = ['WEBVTT', ''];
    for (const seg of segments) {
        vttLines.push(
            `${seg.id}`,
            `${toVTTTime(seg.start)} --> ${toVTTTime(seg.end)}`,
            `{ad}skip:${seg.label.toLowerCase()}`,
            '',
        );
    }

    const vttContent = vttLines.join('\n');
    const dataUri = `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`;

    return {
        subtitles: [
            {
                id: `skip-intro-${id}`,
                url: dataUri,
                lang: 'skip',
            },
        ],
    };
});

/**
 * Convert seconds → WebVTT timestamp (HH:MM:SS.mmm)
 */
function toVTTTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

module.exports = { builder, MANIFEST };
