/**
 * proxy.js
 *
 * HLS stream proxy with intro/outro segment removal.
 *
 * How it works:
 *   1. Client requests: GET /proxy/hls?url=<base64_url>&videoId=tt...:1:1
 *   2. We fetch the original .m3u8 from the source CDN
 *   3. Parse every #EXTINF cue and track cumulative playback time
 *   4. Any HLS segment that falls entirely within a skip range is dropped
 *   5. EXT-X-DISCONTINUITY markers are inserted around removed sections
 *   6. All segment URLs are rewritten to go through /proxy/segment so
 *      CORS is handled transparently
 *   7. Stremio's player plays the modified stream — the intro never plays
 *
 * Segment proxy:
 *   GET /proxy/segment?url=<base64_url>
 *   Transparently forwards the .ts / .aac / .mp4 segment to the player.
 */

const { getSegments, parseVideoId } = require('./sources');

// ─── M3U8 parser ──────────────────────────────────────────────────────────

/**
 * Minimal HLS manifest parser.
 * Returns an array of playlist lines annotated with timing info.
 */
function parseM3u8(text) {
    const lines = text.split('\n').map(l => l.trimEnd());
    const items = [];
    let pendingDuration = null;
    let pendingTags = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF:')) {
            pendingDuration = parseFloat(line.slice(8));
            pendingTags.push(line);
        } else if (line.startsWith('#')) {
            pendingTags.push(line);
        } else if (line.trim() && pendingDuration != null) {
            items.push({ url: line.trim(), duration: pendingDuration, tags: pendingTags });
            pendingDuration = null;
            pendingTags = [];
        } else if (line.trim() === '' && pendingTags.length === 0) {
            // keep empty lines in header
        } else {
            pendingTags.push(line);
        }
    }

    return { items, extra: pendingTags };
}

/**
 * Extract the preamble (everything before the first #EXTINF).
 */
function extractPreamble(text) {
    const lines = text.split('\n');
    const preamble = [];
    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) break;
        preamble.push(line);
    }
    return preamble.join('\n');
}

// ─── Skip range helpers ───────────────────────────────────────────────────

function segmentOverlapsSkip(segStart, segEnd, skipRanges) {
    for (const { start, end } of skipRanges) {
        // Segment is fully inside skip range
        if (segStart >= start && segEnd <= end) return true;
        // Majority of segment is inside skip range (>50%)
        const overlap = Math.min(segEnd, end) - Math.max(segStart, start);
        if (overlap > 0 && overlap / (segEnd - segStart) > 0.5) return true;
    }
    return false;
}

// ─── URL rewriting ────────────────────────────────────────────────────────

function resolveUrl(base, relative) {
    if (relative.startsWith('http')) return relative;
    try { return new URL(relative, base).href; } catch { return relative; }
}

function proxySegmentUrl(serverBase, originalUrl) {
    const encoded = Buffer.from(originalUrl).toString('base64url');
    return `${serverBase}/proxy/segment?url=${encoded}`;
}

// ─── Main: build modified m3u8 ───────────────────────────────────────────

/**
 * Fetch an m3u8, remove intro/outro segments, rewrite segment URLs.
 *
 * @param {string} m3u8Url       Original m3u8 URL
 * @param {string} videoId       e.g. "tt0944947:1:1"
 * @param {string} serverBase    e.g. "https://your-server.com"
 * @returns {Promise<string>}    Modified m3u8 content
 */
async function buildProxiedM3u8(m3u8Url, videoId, serverBase) {
    // Fetch original manifest
    const res = await fetch(m3u8Url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stremio-skip-intro/1.0)' },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Failed to fetch m3u8: ${res.status}`);
    const text = await res.text();

    // Handle master playlists (redirect to best variant)
    if (text.includes('#EXT-X-STREAM-INF')) {
        return buildMasterProxy(text, m3u8Url, videoId, serverBase);
    }

    // Get skip segments from all sources
    const { imdbId, season, episode } = parseVideoId(videoId);
    const skipSegments = await getSegments({ imdbId, season, episode });
    const skipRanges = skipSegments.map(s => ({ start: s.start, end: s.end }));

    const preamble = extractPreamble(text);
    const { items, extra } = parseM3u8(text);

    const outputLines = [preamble];
    let currentTime = 0;
    let lastWasSkipped = false;

    for (const item of items) {
        const segStart = currentTime;
        const segEnd = currentTime + item.duration;

        if (skipRanges.length > 0 && segmentOverlapsSkip(segStart, segEnd, skipRanges)) {
            // Skip this segment
            lastWasSkipped = true;
        } else {
            // Add discontinuity marker if we just skipped something
            if (lastWasSkipped) {
                outputLines.push('#EXT-X-DISCONTINUITY');
                lastWasSkipped = false;
            }
            // Add segment with proxied URL
            for (const tag of item.tags) {
                outputLines.push(tag);
            }
            const absoluteUrl = resolveUrl(m3u8Url, item.url);
            outputLines.push(proxySegmentUrl(serverBase, absoluteUrl));
        }

        currentTime = segEnd;
    }

    // Append end tags
    for (const tag of extra) {
        outputLines.push(tag);
    }

    return outputLines.join('\n');
}

/**
 * For master playlists: rewrite each variant stream URL to go through our proxy.
 */
function buildMasterProxy(text, masterUrl, videoId, serverBase) {
    return text.split('\n').map(line => {
        if (line.startsWith('#') || line.trim() === '') return line;
        const absoluteUrl = resolveUrl(masterUrl, line.trim());
        const encoded = Buffer.from(absoluteUrl).toString('base64url');
        return `${serverBase}/proxy/hls?url=${encoded}&videoId=${encodeURIComponent(videoId)}`;
    }).join('\n');
}

module.exports = { buildProxiedM3u8 };
