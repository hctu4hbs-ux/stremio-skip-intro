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

Clone the repo, install dependencies, copy `.env.example` to `.env`, fill in your GitHub token and repo details, then run `npm run seed` to load example data and `npm start` to start the server on port `7000`.

Then open Stremio → **Add-ons** → paste the following into the search bar and click **Install**:

`http://localhost:7000/manifest.json`

Done. 🎉 Stremio will now show a **Skip Intro / Skip Outro** button automatically during playback.

> 💡 For remote or public use, set `BASE_URL=https://your-server.com` in `.env` so the VTT URLs resolve correctly when Stremio is on a different machine.

---

## 📦 How Stremio integration works

When the add-on is installed, Stremio reads `/manifest.json` once. During every playback session it calls `/subtitles/:type/:id.json` with the video ID. The server responds with a URL pointing to a real WebVTT file at `/vtt/:videoId.vtt`. Stremio loads that file and the player shows a **Skip Intro** or **Skip Outro** button overlay at exactly the right timestamps.

---

## 🗂️ Data format

The `data/catalog.json` file follows a standard schema that any Stremio add-on can read. Each show is keyed by its IMDB ID and contains a list of segments with a `videoId`, `start` and `end` time in seconds, and a `label` (`Intro`, `Outro`, `Recap`, or `Credits`).

**Video ID format**

| Content | Format | Example |
|---|---|---|
| TV episode | `tt{id}:{season}:{episode}` | `tt0944947:1:3` |
| Movie | `tt{id}` | `tt0111161` |
| Anime (Kitsu) | `kitsu:{id}:{season}:{episode}` | `kitsu:12345:1:1` |

---

## ⚙️ Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `7000`) |
| `BASE_URL` | No | Public URL for remote installs |
| `GITHUB_TOKEN` | Yes (for sync) | GitHub PAT with `repo` scope |
| `GITHUB_REPO_OWNER` | Yes (for sync) | GitHub username or org |
| `GITHUB_REPO_NAME` | Yes (for sync) | Repository name |
| `GITHUB_BRANCH` | No | Target branch (default: `main`) |
| `GITHUB_FILE_PATH` | No | Path in repo (default: `data/catalog.json`) |
| `ANISKIP_ENABLED` | No | Anime timestamp lookups (default: `true`) |
| `DATA_DIR` | No | Local data directory (default: `./data`) |

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

### Catalog

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/catalog` | Full `catalog.json` |
| `GET` | `/api/catalog/:imdbId` | One show with all its segments |
| `POST` | `/api/catalog/shows` | Add a show entry |
| `DELETE` | `/api/catalog/shows/:imdbId` | Delete show and all segments |
| `POST` | `/api/catalog/import` | Import an existing catalog (`mode`: `merge` or `overwrite`) |

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
| `GET` | `/manifest.json` | Add-on manifest — paste this URL into Stremio |
| `GET` | `/subtitles/:type/:id.json` | Skip markers for playback |
| `GET` | `/vtt/:videoId.vtt` | WebVTT file served to Stremio player |

---

## 🛠️ Scripts

| Command | Description |
|---|---|
| `npm run seed` | Load example data (Game of Thrones, Breaking Bad, Naruto) |
| `npm run validate` | Check `catalog.json` for errors before publishing |
| `npm run export` | Print `catalog.json` to stdout or a file |
| `node scripts/sync-github.js` | Push to GitHub without starting the server |

---

## 🧪 Tests

Run `npm test` to execute all 16 unit and integration tests. Use `npm test -- --watch` for watch mode during development.

---

## 🔗 Using catalog.json in your own add-on

Once your data is pushed to GitHub, any add-on can fetch it from the raw GitHub URL and use the segments array directly — no dependency on this server required.

---

## 🤝 Contributing

1. Fork this repo
2. Run `npm install`
3. Add timestamps via the API or by editing `data/catalog.json` directly
4. Run `npm run validate` to verify your data is clean
5. Open a pull request

---

## 📬 Contact

Questions, suggestions, or contributions? Reach out at **hctu4hbs@gmail.com**

---

## 📄 License

MIT
