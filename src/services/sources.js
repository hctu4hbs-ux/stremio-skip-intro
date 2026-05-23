/**
 * sources.js
 *
 * Multi-source skip-intro aggregator.
 *
 * Priority order:
 *   1. Local catalog (data/catalog.json) — fastest, always available
 *   2. TheIntroDB  (https://theintrodb.com) — community DB, movies + TV
 *   3. AniSkip     (https://aniskip.com)    — anime only
 *
 * All sources return a normalised array of SkipSegment objects:
 *   { start: number, end: number, label: 'Intro'|'Outro'|'Recap'|'Credits' }
 */

const catalogService = require('./catalog');
const { getSkipTimes, typeToLabel } = require('./aniskip');

const TIDB_BASE = 'https://theintrodb.com/api';

// ─── Normalisation ─────────────────────────────────────────────────────────

function msToSec(ms) { return ms / 1000; }

function tidblabelToLabel(type) {
    const map = { intro: 'Intro', credits: 'Outro', recap: 'Recap', preview: 'Credits' };
    return map[type] || 'Intro';
}

// ─── TheIntroDB ───────────────────────────────────────────────────────────

/**
 * Fetch skip segments from TheIntroDB.
 * Supports imdbId natively; season + episode optional for series.
 * Docs: https://theintrodb.github.io/theintrodb-npm/
 */
async function fetchFromTIDB(imdbId, season, episode) {
    try {
        const params = new URLSearchParams({ imdbId });
        if (season != null) params.set('season', season);
        if (episode != null) params.set('episode', episode);

        const res = await fetch(`${TIDB_BASE}/media?${params}`, {
            headers: { Accept: 'application/json', 'User-Agent': 'stremio-skip-intro/1.0' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];

        const data = await res.json();
        const segments = [];

        // TIDB returns arrays per segment type: intro[], credits[], recap[], preview[]
        for (const [type, items] of Object.entries(data?.segments || {})) {
            for (const item of (items || [])) {
                const start = item.start_ms != null ? msToSec(item.start_ms) : (item.start_sec ?? 0);
                const end   = item.end_ms   != null ? msToSec(item.end_ms)   : (item.end_sec   ?? null);
                if (end == null) continue; // "to end of media" — skip for proxy safety
                segments.push({ start, end, label: tidblabelToLabel(type), source: 'tidb' });
            }
        }
        return segments;
    } catch {
        return [];
    }
}

// ─── AniSkip ──────────────────────────────────────────────────────────────

/**
 * Fetch from AniSkip using a MAL ID.
 * If a malId is not provided but we detect a Kitsu ID, attempt to resolve it.
 */
async function fetchFromAniSkip(malId, episode) {
    if (!malId || !episode) return [];
    try {
        const times = await getSkipTimes(malId, episode);
        return times.map(t => ({
            start: t.start,
            end: t.end,
            label: typeToLabel(t.type),
            source: 'aniskip',
        }));
    } catch {
        return [];
    }
}

// ─── Local catalog ────────────────────────────────────────────────────────

function fetchFromCatalog(imdbId, season, episode) {
    const show = catalogService.getShow(imdbId);
    if (!show) return [];
    const videoId = season != null && episode != null
        ? `${imdbId}:${season}:${episode}`
        : imdbId;
    return (show.segments || [])
        .filter(s => s.videoId === videoId || s.applyToSeries)
        .map(s => ({ start: s.start, end: s.end, label: s.label, source: 'local' }));
}

// ─── Merge + dedup ─────────────────────────────────────────────────────────

/**
 * Merge segments from multiple sources, deduplicating by proximity.
 * Local catalog wins over remote sources on conflicts.
 */
function mergeSegments(all) {
    const out = [];
    for (const seg of all) {
        const dup = out.find(
            s => s.label === seg.label && Math.abs(s.start - seg.start) < 5
        );
        if (!dup) out.push(seg);
        // prefer local over remote
        else if (seg.source === 'local') Object.assign(dup, seg);
    }
    return out.sort((a, b) => a.start - b.start);
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Get all skip segments for a video, aggregated from all available sources.
 *
 * @param {object} opts
 * @param {string} opts.imdbId   IMDB ID (tt...)
 * @param {number} [opts.season]
 * @param {number} [opts.episode]
 * @param {number} [opts.malId]  MAL ID for anime (optional)
 */
async function getSegments({ imdbId, season, episode, malId }) {
    const [local, tidb, aniskip] = await Promise.allSettled([
        Promise.resolve(fetchFromCatalog(imdbId, season, episode)),
        fetchFromTIDB(imdbId, season, episode),
        fetchFromAniSkip(malId, episode),
    ]);

    const all = [
        ...(local.status === 'fulfilled' ? local.value : []),
        ...(tidb.status === 'fulfilled' ? tidb.value : []),
        ...(aniskip.status === 'fulfilled' ? aniskip.value : []),
    ];

    return mergeSegments(all);
}

/**
 * Parse a videoId string into its components.
 * e.g. "tt0944947:1:3" → { imdbId: "tt0944947", season: 1, episode: 3 }
 */
function parseVideoId(videoId) {
    const parts = videoId.split(':');
    if (parts[0] === 'kitsu') {
        return { imdbId: `kitsu:${parts[1]}`, season: parts[2] ? parseInt(parts[2]) : null, episode: parts[3] ? parseInt(parts[3]) : null };
    }
    return {
        imdbId: parts[0],
        season: parts[1] ? parseInt(parts[1]) : null,
        episode: parts[2] ? parseInt(parts[2]) : null,
    };
}

module.exports = { getSegments, parseVideoId, fetchFromTIDB, fetchFromAniSkip, fetchFromCatalog };
