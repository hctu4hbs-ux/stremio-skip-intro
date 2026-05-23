# ⏩ stremio-skip-intro

> A self-hosted tool for building and publishing community skip-intro/outro timestamp databases — designed for Stremio add-on developers.

Never sit through another intro again. This tool lets you manage a database of precise timestamps, then serve them directly to Stremio as a working add-on that shows a **Skip** button right when playback reaches the intro or outro.

---

## ✨ What it does

| Feature | Description |
|---|---|
| 🗂️ **Manage timestamps** | Add, edit, and delete intro/outro markers for any show or movie by IMDB ID |
| ⏩ **Stremio add-on** | Installs directly into Stremio — shows a skip button at the exact moment |
| 🔄 **GitHub sync** | Push your `catalog.json` to any GitHub repo with one command |
| 📥 **Import / Export** | Import existing timestamp databases or export yours for sharing |
| ✅ **Validation** | Catch bad timestamps, duplicates, and missing fields before publishing |
| 🌐 **REST API** | Integrate into any automation pipeline or add-on project |
| 🎌 **Anime support** | Optional lookup from community anime timestamp databases |

---

## 🚀 Quick start

```bash
git clone https://github.com/your-username/stremio-skip-intro
cd stremio-skip-intro
npm install
cp .env.example .env
# Fill in your GitHub token and repo details in .env
npm run seed   # Load example data (Game of Thrones, Breaking Bad, Naruto)
npm start      # Start on http://localhost:7000
```

Then open Stremio → **Add-ons** → paste in the search bar:

```
http://localhost:7000/manifest.json
```

Click **Install** — done. 🎉 Stremio will now show a **Skip Intro / Skip Outro** button automatically.

---

## 📦 How Stremio integration works

```
Stremio player
     │
     ├─ reads  GET /manifest.json          ← add-on registration
     │
     └─ calls  GET /subtitles/:type/:id.json  ← during every playback
                    │
                    └─ returns URL → GET /vtt/tt1234567:1:1.vtt
                                         │
                                         └─ WebVTT cues with {skip} markers
                                            → player shows "Skip Intro" button
```

The `/vtt/:videoId.vtt` endpoint serves a standard [WebVTT](https://www.w3.org/TR/webvtt1/) file. Cues use the `{skip}` metadata format that Stremio's built-in player recognises to render the skip overlay.

> 💡 **For remote/public use:** set `BASE_URL=https://your-server.com` in `.env` so the VTT URLs resolve correctly when Stremio is on a different machine.

---

## 🗂️ Data format

The `data/catalog.json` file follows a standard schema that any Stremio add-on can read:

```json
{
  "lastUpdated": "2025-01-01T00:00:00.000Z",
  "media": {
    "tt0903747": {
      "title": "Breaking Bad",
      "year": "2008–2013",
      "type": "series",
      "segments": [
        {
          "id": "uuid",
          "videoId": "tt0903747:1:1",
          "season": 1,
          "episode": 1,
          "start": 0,
          "end": 42,
          "label": "Intro",
          "applyToSeries": false
        }
      ]
    }
  }
}
```

**Video ID format**

| Content | Format | Example |
|---|---|---|
| TV episode | `tt{id}:{season}:{episode}` | `tt0944947:1:3` |
| Movie | `tt{id}` | `tt0111161` |
| Anime (Kitsu) | `kitsu:{id}:{season}:{episode}` | `kitsu:12345:1:1` |

**Labels:** `Intro` · `Outro` · `Recap` · `Credits`

---

## ⚙️ Environment variables

```env
# Server
PORT=7000
BASE_URL=http://localhost:7000   # set to public URL for remote installs

# GitHub sync
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-repo
GITHUB_BRANCH=main
GITHUB_FILE_PATH=data/catalog.json

# Optional
ANISKIP_ENABLED=true             # anime timestamp lookups
DATA_DIR=./data                  # where catalog.json is stored
```

---

## 🔌 API reference

### Segments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/segments` | List all — filter by `?imdbId=` or `?label=` |
| `GET` | `/api/segments/stats` | Total shows, segment counts, label breakdown |
| `POST` | `/api/segments` | Add a new segment |
| `PATCH` | `/api/segments/:id` | Update start/end/label |
| `PUT` | `/api/segments/:videoId` | Replace all segments for an episode |
| `DELETE` | `/api/segments/:id` | Delete a segment |
| `GET` | `/api/segments/aniskip/:malId/:episode` | Look up anime timestamps |

**Add a segment:**
```json
POST /api/segments
{
  "imdbId": "tt0944947",
  "showTitle": "Game of Thrones",
  "season": 1,
  "episode": 1,
  "start": 0,
  "end": 97,
  "label": "Intro"
}
```

### Catalog

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/catalog` | Full `catalog.json` |
| `GET` | `/api/catalog/:imdbId` | One show with all its segments |
| `POST` | `/api/catalog/shows` | Add a show entry |
| `DELETE` | `/api/catalog/shows/:imdbId` | Delete show and all segments |
| `POST` | `/api/catalog/import` | Import an existing catalog |

**Import:**
```json
POST /api/catalog/import
{
  "catalog": { "lastUpdated": "...", "media": { ... } },
  "mode": "merge"
}
```
`mode`: `merge` (default — keeps existing data) or `overwrite`

### GitHub sync

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github/config` | Current config |
| `POST` | `/api/github/config` | Save repo settings |
| `GET` | `/api/github/preview` | Preview before pushing |
| `POST` | `/api/github/sync` | Push `catalog.json` to GitHub |
| `POST` | `/api/github/fetch` | Pull from GitHub and merge |

### Stremio

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/manifest.json` | Add-on manifest (install this in Stremio) |
| `GET` | `/subtitles/:type/:id.json` | Skip markers for playback |
| `GET` | `/vtt/:videoId.vtt` | Raw WebVTT file served to player |

---

## 🛠️ Scripts

```bash
npm run seed                          # Load example data
npm run validate                      # Check catalog.json for errors
npm run export                        # Print catalog.json to stdout
node scripts/export.js ./out.json     # Export to a file
node scripts/sync-github.js           # Push to GitHub without starting server
```

---

## 🧪 Tests

```bash
npm test              # Run all 16 tests
npm test -- --watch   # Watch mode
```

---

## 🔗 Using catalog.json in your own add-on

Once you've pushed your data to GitHub, any add-on can consume it with a simple fetch:

```js
async function getSkipSegments(imdbId, season, episode) {
  const res = await fetch(
    'https://raw.githubusercontent.com/your-username/your-repo/main/data/catalog.json'
  );
  const catalog = await res.json();
  const show = catalog.media[imdbId];
  if (!show) return [];
  const videoId = `${imdbId}:${season}:${episode}`;
  return show.segments.filter(s => s.videoId === videoId || s.applyToSeries);
}
```

Or point directly at the live API:

```js
const res = await fetch(`http://your-server/api/segments?imdbId=${imdbId}`);
const segments = await res.json();
```

---

## 🤝 Contributing

1. Fork this repo
2. `npm install`
3. Add timestamps via the API or by editing `data/catalog.json`
4. Run `npm run validate` to verify your data
5. Open a pull request

---

## 📄 License

MIT
