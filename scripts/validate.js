/**
 * validate.js
 *
 * Validates the current catalog.json for correctness.
 * Reports: missing fields, invalid timestamps, duplicate segments.
 *
 * Usage: node scripts/validate.js [path/to/catalog.json]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(process.env.DATA_DIR || './data', 'catalog.json');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
let errors = 0;
let warnings = 0;

console.log(`Validating ${filePath}...\n`);

for (const [imdbId, show] of Object.entries(catalog.media || {})) {
    if (!show.title) { console.error(`  [ERROR] ${imdbId}: missing title`); errors++; }
    if (!show.type)  { console.warn(`  [WARN]  ${imdbId}: missing type`); warnings++; }

    const seen = new Set();
    for (const seg of (show.segments || [])) {
        if (seg.start == null || seg.end == null) {
            console.error(`  [ERROR] ${imdbId} seg ${seg.id}: missing start or end`); errors++;
        } else if (seg.end <= seg.start) {
            console.error(`  [ERROR] ${imdbId} seg ${seg.id}: end (${seg.end}) must be > start (${seg.start})`); errors++;
        }
        const key = `${seg.videoId}:${seg.label}:${seg.start}`;
        if (seen.has(key)) {
            console.warn(`  [WARN]  ${imdbId}: duplicate segment ${key}`); warnings++;
        }
        seen.add(key);
    }
}

const totalShows = Object.keys(catalog.media || {}).length;
const totalSegs = Object.values(catalog.media || {}).reduce((n, s) => n + (s.segments?.length || 0), 0);

console.log(`\nSummary: ${totalShows} shows, ${totalSegs} segments`);
if (errors > 0)   console.error(`${errors} error(s) found.`);
if (warnings > 0) console.warn(`${warnings} warning(s) found.`);
if (errors === 0 && warnings === 0) console.log('All good!');

process.exit(errors > 0 ? 1 : 0);
