/**
 * api.test.js — integration tests for the REST API
 */

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
            imdbId: 'tt0944947',
            showTitle: 'Game of Thrones',
            season: 1,
            episode: 1,
            start: 0,
            end: 97,
            label: 'Intro',
        });
        expect(res.status).toBe(201);
        expect(res.body.videoId).toBe('tt0944947:1:1');
        expect(res.body.id).toBeDefined();
    });

    it('rejects missing fields', async () => {
        const res = await request(app).post('/api/segments').send({ imdbId: 'tt0944947' });
        expect(res.status).toBe(400);
    });

    it('rejects invalid imdbId format', async () => {
        const res = await request(app).post('/api/segments').send({
            imdbId: 'invalid',
            showTitle: 'Test',
            start: 0,
            end: 30,
        });
        expect(res.status).toBe(400);
    });

    it('rejects end <= start', async () => {
        const res = await request(app).post('/api/segments').send({
            imdbId: 'tt0944947',
            showTitle: 'Game of Thrones',
            season: 1, episode: 2,
            start: 50, end: 30,
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

describe('GET /api/github/config', () => {
    it('returns config', async () => {
        const res = await request(app).get('/api/github/config');
        expect(res.status).toBe(200);
        expect(res.body.branch).toBeDefined();
    });
});
