const path = require('path');
const os = require('os');
const fs = require('fs');
const request = require('supertest');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-intro-api-test-'));
process.env.DATA_DIR = tmpDir;
process.env.NODE_ENV = 'test';

const app = require('../src/app');

describe('GET /api/health', () => {
    it('returns ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

describe('POST /api/segments', () => {
    it('creates a segment', async () => {
        const res = await request(app).post('/api/segments').send({
            imdbId: 'tt0944947', showTitle: 'Game of Thrones',
            season: 1, episode: 1, start: 0, end: 97, label: 'Intro',
        });
        expect(res.status).toBe(201);
        expect(res.body.videoId).toBe('tt0944947:1:1');
        expect(res.body.id).toBeDefined();
    });

    it('rejects missing fields', async () => {
        const res = await request(app).post('/api/segments').send({ imdbId: 'tt0944947' });
        expect(res.status).toBe(400);
    });

    it('rejects invalid imdbId', async () => {
        const res = await request(app).post('/api/segments').send({
            imdbId: 'invalid', showTitle: 'Test', start: 0, end: 30,
        });
        expect(res.status).toBe(400);
    });

    it('rejects end <= start', async () => {
        const res = await request(app).post('/api/segments').send({
            imdbId: 'tt0944947', showTitle: 'Game of Thrones',
            season: 1, episode: 2, start: 50, end: 30,
        });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/segments', () => {
    it('lists all segments', async () => {
        const res = await request(app).get('/api/segments');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by imdbId', async () => {
        const res = await request(app).get('/api/segments?imdbId=tt0944947');
        expect(res.status).toBe(200);
        expect(res.body.every(s => s.imdbId === 'tt0944947')).toBe(true);
    });
});

describe('GET /api/catalog', () => {
    it('returns the full catalog', async () => {
        const res = await request(app).get('/api/catalog');
        expect(res.status).toBe(200);
        expect(res.body.media).toBeDefined();
        expect(typeof res.body.lastUpdated).toBe('string');
    });
});

describe('GET /manifest.json', () => {
    it('returns Stremio manifest', async () => {
        const res = await request(app).get('/manifest.json');
        expect(res.status).toBe(200);
        expect(res.body.resources).toContain('subtitles');
        expect(res.body.id).toBe('community.stremio-skip-intro');
    });
});

describe('GET /proxy/lookup', () => {
    it('returns 400 without videoId', async () => {
        const res = await request(app).get('/proxy/lookup');
        expect(res.status).toBe(400);
    });

    it('returns segments for a known videoId', async () => {
        // seed a segment first
        await request(app).post('/api/segments').send({
            imdbId: 'tt9999999', showTitle: 'Proxy Test Show',
            season: 1, episode: 1, start: 0, end: 42, label: 'Intro',
        });
        const res = await request(app).get('/proxy/lookup?videoId=tt9999999:1:1');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.segments)).toBe(true);
        const local = res.body.segments.find(s => s.source === 'local');
        expect(local).toBeDefined();
        expect(local.start).toBe(0);
        expect(local.end).toBe(42);
    }, 15000);
});

describe('GET /vtt/:videoId.vtt', () => {
    it('returns 404 for unknown videoId', async () => {
        const res = await request(app).get('/vtt/tt0000000:1:1.vtt');
        expect(res.status).toBe(404);
    });

    it('returns VTT for a seeded videoId', async () => {
        await request(app).post('/api/segments').send({
            imdbId: 'tt8888888', showTitle: 'VTT Test',
            season: 1, episode: 1, start: 10, end: 80, label: 'Intro',
        });
        const res = await request(app).get('/vtt/tt8888888:1:1.vtt');
        expect(res.status).toBe(200);
        expect(res.text).toContain('WEBVTT');
        expect(res.text).toContain('{skip}Intro');
    });
});
