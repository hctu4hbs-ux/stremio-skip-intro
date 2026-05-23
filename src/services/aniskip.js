/**
 * aniskip.js
 *
 * Fetches skip timestamps from the AniSkip API (https://api.aniskip.com).
 * AniSkip uses MAL (MyAnimeList) IDs, not IMDB IDs, so this service
 * also provides a helper to resolve a MAL ID from a title search.
 *
 * AniSkip segment types:
 *   op       → Opening (intro)
 *   ed       → Ending (outro)
 *   recap    → Recap
 *   mixed-op → Mixed opening
 *   mixed-ed → Mixed ending
 */

const ANISKIP_BASE = 'https://api.aniskip.com/v2';

/**
 * Fetch skip times for a given MAL anime ID + episode number.
 *
 * @param {number} malId       MyAnimeList anime ID
 * @param {number} episodeNumber
 * @param {number} [episodeLength=0]  Known duration in seconds (0 = any)
 * @returns {Promise<Array>}   Array of skip segment objects
 */
async function getSkipTimes(malId, episodeNumber, episodeLength = 0) {
    const types = ['op', 'ed', 'recap', 'mixed-op', 'mixed-ed'];
    const url = `${ANISKIP_BASE}/skip-times/${malId}/${episodeNumber}?types=${types.join(',')}&episodeLength=${episodeLength}`;

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.found || !data.results) return [];

    return data.results.map(r => ({
        type: r.skipType,
        start: r.interval.startTime,
        end: r.interval.endTime,
        episodeLength: r.episodeLength,
        skipId: r.skipId,
    }));
}

/**
 * Convert AniSkip type string → human-readable label.
 */
function typeToLabel(type) {
    const map = {
        op: 'Intro',
        ed: 'Outro',
        recap: 'Recap',
        'mixed-op': 'Intro',
        'mixed-ed': 'Outro',
    };
    return map[type] || 'Intro';
}

module.exports = { getSkipTimes, typeToLabel };
