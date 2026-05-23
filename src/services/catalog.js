/**
 * catalog.js
 *
 * In-memory + file-backed catalog store.
 * The catalog mirrors the IntroHater catalog.json schema so it is fully
 * compatible with existing IntroHater add-on installations.
 *
 * Schema (catalog.json):
 * {
 *   "lastUpdated": "<ISO date>",
 *   "media": {
 *     "<imdbId>": {
 *       "title": "...",
 *       "year": "...",
 *       "poster": "...",
 *       "type": "series|movie",
 *       "sources": { "local": true, "aniskip": false, "animeSkip": false },
 *       "episodes": {
 *         "<season>:<episode>": { "season": 1, "episode": 1, "count": 2 }
 *       },
 *       "segments": [
 *         { "id": "<uuid>", "videoId": "tt...:1:1", "start": 30, "end": 90, "label": "Intro" }
 *       ],
 *       "addedAt": "<ISO date>",
 *       "lastUpdated": "<ISO date>",
 *       "totalSegments": 2
 *     }
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');

// ─── Persistence ──────────────────────────────────────────────────────────────

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
    ensureDataDir();
    if (!fs.existsSync(CATALOG_PATH)) {
        return { lastUpdated: new Date().toISOString(), media: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    } catch {
        return { lastUpdated: new Date().toISOString(), media: {} };
    }
}

function save(catalog) {
    ensureDataDir();
    catalog.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildVideoId(imdbId, season, episode) {
    if (season != null && episode != null) return `${imdbId}:${season}:${episode}`;
    return imdbId;
}

function rebuildEpisodes(segments) {
    const episodes = {};
    for (const seg of segments) {
        if (seg.season != null && seg.episode != null) {
            const key = `${seg.season}:${seg.episode}`;
            if (!episodes[key]) {
                episodes[key] = { season: seg.season, episode: seg.episode, count: 0 };
            }
            episodes[key].count++;
        }
    }
    return episodes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full catalog object.
 */
function getCatalog() {
    return load();
}

/**
 * Returns all segments across all shows, optionally filtered.
 * @param {{ imdbId?: string, label?: string }} filters
 */
function listSegments(filters = {}) {
    const catalog = load();
    const results = [];
    for (const [imdbId, show] of Object.entries(catalog.media)) {
        if (filters.imdbId && imdbId !== filters.imdbId) continue;
        for (const seg of (show.segments || [])) {
            if (filters.label && seg.label !== filters.label) continue;
            results.push({ ...seg, imdbId, showTitle: show.title });
        }
    }
    return results;
}

/**
 * Get one show's detail with all its segments.
 */
function getShow(imdbId) {
    const catalog = load();
    const show = catalog.media[imdbId];
    if (!show) return null;
    return { imdbId, ...show };
}

/**
 * Add or update a show entry.
 */
function upsertShow(imdbId, { title, year, type, poster }) {
    const catalog = load();
    if (!catalog.media[imdbId]) {
        catalog.media[imdbId] = {
            title,
            year: year || '',
            poster: poster || null,
            type: type || 'series',
            sources: { local: true, aniskip: false, animeSkip: false },
            episodes: {},
            segments: [],
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalSegments: 0,
        };
    } else {
        if (title) catalog.media[imdbId].title = title;
        if (year) catalog.media[imdbId].year = year;
        if (poster !== undefined) catalog.media[imdbId].poster = poster;
        if (type) catalog.media[imdbId].type = type;
        catalog.media[imdbId].lastUpdated = new Date().toISOString();
    }
    save(catalog);
    return catalog.media[imdbId];
}

/**
 * Add a skip segment.
 * @param {object} data
 */
function addSegment({ imdbId, showTitle, season, episode, start, end, label, applyToSeries }) {
    const catalog = load();

    // Auto-create show entry if it does not exist
    if (!catalog.media[imdbId]) {
        catalog.media[imdbId] = {
            title: showTitle || imdbId,
            year: '',
            poster: null,
            type: season != null ? 'series' : 'movie',
            sources: { local: true, aniskip: false, animeSkip: false },
            episodes: {},
            segments: [],
            addedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalSegments: 0,
        };
    }

    const show = catalog.media[imdbId];
    const videoId = buildVideoId(imdbId, season, episode);

    const segment = {
        id: randomUUID(),
        videoId,
        season: season ?? null,
        episode: episode ?? null,
        start: parseFloat(start),
        end: parseFloat(end),
        label: label || 'Intro',
        applyToSeries: !!applyToSeries,
        createdAt: new Date().toISOString(),
    };

    show.segments.push(segment);
    show.episodes = rebuildEpisodes(show.segments);
    show.totalSegments = show.segments.length;
    show.lastUpdated = new Date().toISOString();

    save(catalog);
    return { ...segment, imdbId, showTitle: show.title };
}

/**
 * Update fields of an existing segment by id.
 */
function updateSegment(id, updates) {
    const catalog = load();
    for (const [imdbId, show] of Object.entries(catalog.media)) {
        const idx = (show.segments || []).findIndex(s => s.id === id);
        if (idx === -1) continue;
        const seg = show.segments[idx];
        if (updates.start !== undefined) seg.start = parseFloat(updates.start);
        if (updates.end !== undefined) seg.end = parseFloat(updates.end);
        if (updates.label !== undefined) seg.label = updates.label;
        show.episodes = rebuildEpisodes(show.segments);
        show.lastUpdated = new Date().toISOString();
        save(catalog);
        return { ...seg, imdbId, showTitle: show.title };
    }
    return null;
}

/**
 * Delete a segment by id.
 */
function deleteSegment(id) {
    const catalog = load();
    for (const [imdbId, show] of Object.entries(catalog.media)) {
        const idx = (show.segments || []).findIndex(s => s.id === id);
        if (idx === -1) continue;
        show.segments.splice(idx, 1);
        show.episodes = rebuildEpisodes(show.segments);
        show.totalSegments = show.segments.length;
        show.lastUpdated = new Date().toISOString();
        save(catalog);
        return true;
    }
    return false;
}

/**
 * Delete a show and all its segments.
 */
function deleteShow(imdbId) {
    const catalog = load();
    if (!catalog.media[imdbId]) return false;
    delete catalog.media[imdbId];
    save(catalog);
    return true;
}

/**
 * Replace all segments for a given videoId (e.g. tt1234:1:1).
 */
function replaceSegmentsForVideo(videoId, segmentsData) {
    const parts = videoId.split(':');
    const imdbId = parts[0];
    const catalog = load();
    if (!catalog.media[imdbId]) return null;

    const show = catalog.media[imdbId];
    // Remove old segments for this videoId
    show.segments = (show.segments || []).filter(s => s.videoId !== videoId);

    // Add new segments
    for (const s of segmentsData) {
        show.segments.push({
            id: randomUUID(),
            videoId,
            season: s.season ?? null,
            episode: s.episode ?? null,
            start: parseFloat(s.start),
            end: parseFloat(s.end),
            label: s.label || 'Intro',
            applyToSeries: !!s.applyToSeries,
            createdAt: new Date().toISOString(),
        });
    }

    show.episodes = rebuildEpisodes(show.segments);
    show.totalSegments = show.segments.length;
    show.lastUpdated = new Date().toISOString();
    save(catalog);
    return show.segments.filter(s => s.videoId === videoId);
}

/**
 * Import an entire catalog.json object (merge or overwrite).
 */
function importCatalog(incoming, mode = 'merge') {
    if (mode === 'overwrite') {
        save(incoming);
        return getCatalog();
    }
    // merge: add shows/segments that don't already exist
    const catalog = load();
    let added = 0;
    for (const [imdbId, show] of Object.entries(incoming.media || {})) {
        if (!catalog.media[imdbId]) {
            catalog.media[imdbId] = show;
            added++;
        } else {
            // merge segments by videoId+label uniqueness
            const existing = new Set(
                catalog.media[imdbId].segments.map(s => `${s.videoId}:${s.label}:${s.start}`)
            );
            for (const seg of (show.segments || [])) {
                const key = `${seg.videoId}:${seg.label}:${seg.start}`;
                if (!existing.has(key)) {
                    catalog.media[imdbId].segments.push({ ...seg, id: randomUUID() });
                    added++;
                }
            }
            catalog.media[imdbId].episodes = rebuildEpisodes(catalog.media[imdbId].segments);
            catalog.media[imdbId].totalSegments = catalog.media[imdbId].segments.length;
        }
    }
    save(catalog);
    return { catalog: getCatalog(), added };
}

/**
 * Get overall stats.
 */
function getStats() {
    const catalog = load();
    let totalSegments = 0;
    const labelBreakdown = {};
    for (const show of Object.values(catalog.media)) {
        for (const seg of (show.segments || [])) {
            totalSegments++;
            labelBreakdown[seg.label] = (labelBreakdown[seg.label] || 0) + 1;
        }
    }
    return {
        totalShows: Object.keys(catalog.media).length,
        totalSegments,
        labelBreakdown,
        lastUpdated: catalog.lastUpdated,
    };
}

module.exports = {
    getCatalog,
    listSegments,
    getShow,
    upsertShow,
    addSegment,
    updateSegment,
    deleteSegment,
    deleteShow,
    replaceSegmentsForVideo,
    importCatalog,
    getStats,
};
