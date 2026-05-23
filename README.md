# stremio-skip-intro

A developer tool for managing, validating, and publishing skip-intro/outro timestamp data to GitHub — fully compatible with the [IntroHater](https://github.com/introhaterapp/IntroHater) catalog format.

Developers use this tool to build and maintain a community-powered database of intro/outro timestamps that any Stremio add-on can consume.

---

## What it does

- **Manage segments** — Add, edit, and delete intro/outro timestamps for any show or movie by IMDB ID
- **AniSkip integration** — Automatically fetch anime timestamps from [AniSkip](https://aniskip.com) (150,000+ episodes)
- **GitHub sync** — Push your `catalog.json` to any GitHub repository with one API call or script
- **Import** — Pull in an existing IntroHater `catalog.json` and merge it into your local database
- **Validate** — Run a validator to catch bad timestamps, missing fields, and duplicates before publishing
- **REST API** — Integrate into any add-on or automation pipeline

---

## Catalog format

The `data/catalog.json` produced by this tool is **100% compatible** with the IntroHater catalog schema:

```json
{
  "lastUpdated": "2025-01-01T00:00:00.000Z",
  "media": {
    "tt0903747": {
      "title": "Breaking Bad",
      "year": "2008–2013",
      "type": "series",
      "poster": null,
      "sources": { "local": true, "aniskip": false, "animeSkip": false },
      "episodes": {
        "1:1": { "season": 1, "episode": 1, "count": 1 }
      },
      "segments": [
        {
          "id": "uuid",
          "videoId": "tt0903747:1:1",
          "season": 1,
          "episode": 1,
          "start": 0,
          "end": 42,
          "label": "Intro",
          "applyToSeries": false,
          "createdAt": "2025-01-01T00:00:00.000Z"
        }
      ],
      "addedAt": "2025-01-01T00:00:00.000Z",
      "lastUpdated": "2025-01-01T00:00:00.000Z",
      "totalSegments": 1
    }
  }
}
```

**Video ID format:**
- TV episodes: `tt1234567:season:episode` (e.g. `tt0944947:1:3`)
- Movies / series-wide: `tt1234567`
- Anime (Kitsu): `kitsu:12345:1:1`

**Segment labels:** `Intro` | `Outro` | `Recap` | `Credits`

---

## Quick start

```bash
git clone https://github.com/your-username/stremio-skip-intro
cd stremio-skip-intro
npm install
cp .env.example .env
# Edit .env with your GitHub token and repo details
npm run seed       # Add example data
npm start          # Start API server on http://localhost:7000
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes (for sync) | GitHub PAT with `repo` scope |
| `GITHUB_REPO_OWNER` | Yes (for sync) | GitHub username or org |
| `GITHUB_REPO_NAME` | Yes (for sync) | Repository name |
| `GITHUB_BRANCH` | No | Target branch (default: `main`) |
| `GITHUB_FILE_PATH` | No | Path inside repo (default: `data/catalog.json`) |
| `PORT` | No | Server port (default: `7000`) |
| `ANISKIP_ENABLED` | No | Enable AniSkip fetching (default: `true`) |
| `DATA_DIR` | No | Local data directory (default: `./data`) |

---

## API reference

### Segments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/segments` | List all segments. Filter: `?imdbId=tt...&label=Intro` |
| `GET` | `/api/segments/stats` | Total shows, segments, label breakdown |
| `POST` | `/api/segments` | Add a segment |
| `PATCH` | `/api/segments/:id` | Update a segment |
| `PUT` | `/api/segments/:videoId` | Replace all segments for a videoId |
| `DELETE` | `/api/segments/:id` | Delete a segment |
| `GET` | `/api/segments/aniskip/:malId/:episode` | Fetch from AniSkip |

**POST /api/segments body:**
```json
{
  "imdbId": "tt0944947",
  "showTitle": "Game of Thrones",
  "season": 1,
  "episode": 1,
  "start": 0,
  "end": 97,
  "label": "Intro",
  "applyToSeries": false
}
```

### Catalog

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/catalog` | Full `catalog.json` |
| `GET` | `/api/catalog/:imdbId` | One show with all segments |
| `POST` | `/api/catalog/shows` | Add a show (no segments) |
| `DELETE` | `/api/catalog/shows/:imdbId` | Delete show + all segments |
| `POST` | `/api/catalog/import` | Import existing `catalog.json` |

**POST /api/catalog/import body:**
```json
{
  "catalog": { "lastUpdated": "...", "media": { ... } },
  "mode": "merge"
}
```
`mode`: `merge` (default — keeps existing, adds new) or `overwrite`

### GitHub sync

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/github/config` | Get current config |
| `POST` | `/api/github/config` | Save config |
| `GET` | `/api/github/preview` | Preview JSON before push |
| `POST` | `/api/github/sync` | Push `catalog.json` to GitHub |
| `POST` | `/api/github/fetch` | Pull from GitHub → merge locally |

**POST /api/github/config body:**
```json
{
  "repoOwner": "your-username",
  "repoName": "your-repo",
  "branch": "main",
  "filePath": "data/catalog.json"
}
```

---

## Scripts

```bash
npm run seed          # Populate catalog.json with example data
npm run validate      # Check catalog.json for errors
npm run export        # Print catalog.json to stdout
node scripts/export.js ./output.json    # Export to a file
node scripts/sync-github.js             # Push to GitHub without starting server
```

---

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```

---

## Adding this to your Stremio add-on

Your add-on just needs to read `catalog.json`. Two options:

**Option A — direct file read (same server):**
```js
const catalog = require('./data/catalog.json');

function getSkipTimes(imdbId, season, episode) {
  const show = catalog.media[imdbId];
  if (!show) return [];
  const videoId = `${imdbId}:${season}:${episode}`;
  return (show.segments || []).filter(s => s.videoId === videoId || s.applyToSeries);
}
```

**Option B — fetch from GitHub raw URL:**
```js
async function getSkipTimes(imdbId, season, episode) {
  const res = await fetch(
    'https://raw.githubusercontent.com/your-username/your-repo/main/data/catalog.json'
  );
  const catalog = await res.json();
  const show = catalog.media[imdbId];
  if (!show) return [];
  const videoId = `${imdbId}:${season}:${episode}`;
  return (show.segments || []).filter(s => s.videoId === videoId || s.applyToSeries);
}
```

**Option C — fetch from this API server:**
```js
const res = await fetch(`http://localhost:7000/api/segments?imdbId=${imdbId}`);
const segments = await res.json();
```

---

## Contributing

1. Fork this repo
2. Clone and `npm install`
3. Add your skip timestamps via the API or by editing `data/catalog.json`
4. Run `npm run validate` to check your data
5. Submit a pull request

---

## License

MIT
