/**
 * seed.js
 *
 * Populates data/catalog.json with example skip-intro data.
 * Run with: node scripts/seed.js
 */

require('dotenv').config();
const { addSegment, upsertShow } = require('../src/services/catalog');

const examples = [
    {
        show: { imdbId: 'tt0944947', title: 'Game of Thrones', year: '2011–2019', type: 'series', poster: null },
        segments: [
            { season: 1, episode: 1, start: 0, end: 97,  label: 'Intro' },
            { season: 1, episode: 2, start: 0, end: 97,  label: 'Intro' },
            { season: 1, episode: 1, start: 3180, end: 3240, label: 'Outro' },
        ],
    },
    {
        show: { imdbId: 'tt0903747', title: 'Breaking Bad', year: '2008–2013', type: 'series', poster: null },
        segments: [
            { season: 1, episode: 1, start: 0,  end: 42,  label: 'Intro' },
            { season: 1, episode: 2, start: 0,  end: 42,  label: 'Intro' },
            { season: 2, episode: 1, start: 0,  end: 42,  label: 'Intro' },
        ],
    },
    {
        show: { imdbId: 'tt0409591', title: 'Naruto', year: '2002–2007', type: 'series', poster: null },
        segments: [
            { season: 1, episode: 1, start: 0,   end: 88,  label: 'Intro' },
            { season: 1, episode: 1, start: 1300, end: 1380, label: 'Outro' },
            { season: 1, episode: 2, start: 0,   end: 88,  label: 'Intro', applyToSeries: true },
        ],
    },
];

console.log('Seeding catalog with example data...\n');

for (const { show, segments } of examples) {
    upsertShow(show.imdbId, show);
    for (const seg of segments) {
        const added = addSegment({ ...seg, imdbId: show.imdbId, showTitle: show.title });
        console.log(`  + [${show.title}] S${seg.season}E${seg.episode} ${seg.label} ${seg.start}s–${seg.end}s → ${added.id}`);
    }
}

console.log('\nDone. Run `node src/index.js` to start the server.');
