/**
 * export.js
 *
 * Exports the current catalog.json to stdout or a custom path.
 * Usage:
 *   node scripts/export.js                     # prints to stdout
 *   node scripts/export.js ./output.json       # writes to file
 */

require('dotenv').config();
const fs = require('fs');
const { getCatalog } = require('../src/services/catalog');

const catalog = getCatalog();
const json = JSON.stringify(catalog, null, 2);

const outPath = process.argv[2];
if (outPath) {
    fs.writeFileSync(outPath, json, 'utf-8');
    console.log(`Exported to ${outPath} (${Object.keys(catalog.media).length} shows)`);
} else {
    process.stdout.write(json + '\n');
}
