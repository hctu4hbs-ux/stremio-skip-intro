const { z } = require('zod');

/**
 * Zod-based request validator middleware factory.
 * Usage:  router.post('/segments', validate(segmentSchema), handler)
 */
function validate(schema, target = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            return res.status(400).json({ error: message });
        }
        req[target] = result.data;
        next();
    };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
    imdbId: z.string().regex(/^(tt\d+|kitsu:\d+)$/, 'imdbId must be a valid IMDB ID (ttXXXXXXX) or Kitsu ID (kitsu:XXX)'),
    showTitle: z.string().min(1),
    season: z.number().int().min(1).nullable().optional(),
    episode: z.number().int().min(1).nullable().optional(),
    start: z.number().min(0),
    end: z.number().min(0),
    label: z.enum(['Intro', 'Outro', 'Recap', 'Credits']).default('Intro'),
    applyToSeries: z.boolean().default(false),
});

const segmentUpdateSchema = z.object({
    start: z.number().min(0).optional(),
    end: z.number().min(0).optional(),
    label: z.enum(['Intro', 'Outro', 'Recap', 'Credits']).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

const githubConfigSchema = z.object({
    repoOwner: z.string().min(1),
    repoName: z.string().min(1),
    branch: z.string().min(1).default('main'),
    filePath: z.string().min(1).default('data/catalog.json'),
});

const showSchema = z.object({
    imdbId: z.string().regex(/^(tt\d+|kitsu:\d+)$/),
    title: z.string().min(1),
    year: z.string().optional(),
    type: z.enum(['series', 'movie']).default('series'),
    poster: z.string().url().nullable().optional(),
});

module.exports = { validate, segmentSchema, segmentUpdateSchema, githubConfigSchema, showSchema };
