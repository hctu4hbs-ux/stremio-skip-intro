/**
 * catalog.test.js — unit tests for the catalog service
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Use a temp directory so tests don't touch real data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-intro-test-'));
process.env.DATA_DIR = tmpDir;

const catalog = require('../src/services/catalog');

describe('catalog service', () => {
    beforeEach(() => {
        // Clean slate for each test
        const p = path.join(tmpDir, 'catalog.json');
        if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    test('getCatalog returns empty media on first run', () => {
        const c = catalog.getCatalog();
        expect(c.media).toEqual({});
        expect(typeof c.lastUpdated).toBe('string');
    });

    test('upsertShow creates a show', () => {
        catalog.upsertShow('tt0944947', { title: 'Game of Thrones', year: '2011', type: 'series' });
        const show = catalog.getShow('tt0944947');
        expect(show).not.toBeNull();
        expect(show.title).toBe('Game of Thrones');
        expect(show.segments).toEqual([]);
    });

    test('addSegment creates a segment and auto-creates show', () => {
        const seg = catalog.addSegment({
            imdbId: 'tt0903747',
            showTitle: 'Breaking Bad',
            season: 1,
            episode: 1,
            start: 0,
            end: 42,
            label: 'Intro',
        });
        expect(seg.id).toBeDefined();
        expect(seg.videoId).toBe('tt0903747:1:1');
        expect(seg.start).toBe(0);
        expect(seg.end).toBe(42);

        const show = catalog.getShow('tt0903747');
        expect(show.segments).toHaveLength(1);
        expect(show.totalSegments).toBe(1);
        expect(show.episodes['1:1']).toEqual({ season: 1, episode: 1, count: 1 });
    });

    test('updateSegment modifies timestamps', () => {
        const seg = catalog.addSegment({ imdbId: 'tt0000001', showTitle: 'Test Show', season: 1, episode: 1, start: 0, end: 50, label: 'Intro' });
        const updated = catalog.updateSegment(seg.id, { end: 60 });
        expect(updated.end).toBe(60);
    });

    test('deleteSegment removes by id', () => {
        const seg = catalog.addSegment({ imdbId: 'tt0000002', showTitle: 'Show 2', season: 1, episode: 1, start: 5, end: 40, label: 'Intro' });
        const ok = catalog.deleteSegment(seg.id);
        expect(ok).toBe(true);
        expect(catalog.getShow('tt0000002').segments).toHaveLength(0);
    });

    test('listSegments filters by imdbId', () => {
        catalog.addSegment({ imdbId: 'tt1111111', showTitle: 'Show A', season: 1, episode: 1, start: 0, end: 30, label: 'Intro' });
        catalog.addSegment({ imdbId: 'tt2222222', showTitle: 'Show B', season: 1, episode: 1, start: 0, end: 30, label: 'Intro' });
        const segs = catalog.listSegments({ imdbId: 'tt1111111' });
        expect(segs.every(s => s.imdbId === 'tt1111111')).toBe(true);
    });

    test('getStats returns correct counts', () => {
        catalog.addSegment({ imdbId: 'tt9999991', showTitle: 'Stats Show', season: 1, episode: 1, start: 0, end: 30, label: 'Intro' });
        catalog.addSegment({ imdbId: 'tt9999991', showTitle: 'Stats Show', season: 1, episode: 1, start: 1350, end: 1400, label: 'Outro' });
        const stats = catalog.getStats();
        expect(stats.totalSegments).toBeGreaterThanOrEqual(2);
        expect(stats.labelBreakdown['Intro']).toBeGreaterThanOrEqual(1);
        expect(stats.labelBreakdown['Outro']).toBeGreaterThanOrEqual(1);
    });
});
