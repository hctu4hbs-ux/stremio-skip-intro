# ⏩ stremio-skip-intro

> A self-hosted server that provides skip intro/outro functionality for Stremio streams via VTT subtitle tracks. This enables the "Skip Intro" button or automatic skipping based on Stremio's player settings.

---

## ✨ Features

| | |
|---|---|
| ⏩ **Skip Intro/Outro via VTT** | Adds a subtitle track with `{skip}` cues, enabling Stremio's native skip functionality. |
| 🔀 **Multi-source aggregator** | Pulls timestamps from your local database, TheIntroDB, and AniSkip simultaneously |
| 🗂️ **Segment management** | Full REST API to add, edit, and delete timestamps by IMDB ID |
| ✅ **Validation** | Catch bad timestamps and duplicates before publishing |
| 🌐 **Import / Export** | Standard catalog.json format compatible with other community tools |

---

## ☁️ Hosting

| Level | Platform | Why |
|---|---|---|
| 🟢 **Beginner** | [Render](https://render.com) | Free tier, zero config, deploys straight from GitHub in minutes |
| 🔵 **Intermediate** | [Hugging Face Spaces](https://huggingface.co/spaces) | Free compute, great for community-shared tools, supports Node.js via Docker |
| 🔴 **Professional** | [Oracle Cloud](https://www.oracle.com/cloud/free) | Always-free tier with real server resources — best performance and full control |

Set `BASE_URL` in your environment to the public URL after deploying so stream proxy links resolve correctly from any device.

---

## 🚀 Quick start

```
git clone https://github.com/hctu4hbs-ux/stremio-skip-intro
npm install
cp .env.example .env
npm run seed
npm start
```

Set `UPSTREAM_ADDON_URL` in `.env` to any Stremio add-on that provides HLS streams, for example:

`UPSTREAM_ADDON_URL=https://torrentio.strem.fun/sort=qualitysize`

Then install in Stremio by pasting into the Add-ons search bar:

`http://localhost:7000/manifest.json`

---

## ⚠️ Important Stremio Settings

For the best experience with automatic skipping and seamless playback to the next episode, ensure the following settings are enabled in your Stremio application:

*   **Player Settings:**
    *   `Skip intro automatically`
*   **General Settings:**
    *   `Auto-play next episode`

---

## 📡 Data sources

Skip segments are aggregated automatically from three sources, merged and deduplicated:

| Source | Content | Auth |
|---|---|---|
| 🗂️ Local catalog | Your own managed timestamps | None |
| 🌐 TheIntroDB | Community DB — movies + TV shows | None (public reads) |
| 🎌 AniSkip | Anime openings/endings | None |

---

## 🔌 API

### Stremio add-on

| Endpoint | Description |
|---|---|
| `GET /manifest.json` | Paste this URL into Stremio to install |
| `GET /stream/:type/:id.json` | Streams with skip subtitle tracks |

### Segments

| Method | Endpoint | Description |
|---|---|
| `GET` | `/api/segments` | List all segments (`?imdbId=` `?label=`) |
| `GET` | `/api/segments/stats` | Counts by show and label |
| `POST` | `/api/segments` | Add a segment |
| `PATCH` | `/api/segments/:id` | Update a segment |
| `PUT` | `/api/segments/:videoId` | Replace all segments for an episode |
| `DELETE` | `/api/segments/:id` | Delete a segment |
| `GET` | `/api/segments/aniskip/:malId/:episode` | Look up anime timestamps |

### Catalog

| Method | Endpoint | Description |
|---|---|
| `GET` | `/api/catalog` | Full catalog.json |
| `GET` | `/api/catalog/:imdbId` | One show with all segments |
| `POST` | `/api/catalog/shows` | Add a show |
| `DELETE` | `/api/catalog/shows/:imdbId` | Delete a show and its segments |
| `POST` | `/api/catalog/import` | Import an existing catalog (`mode`: `merge` or `overwrite`) |

---

## ⚙️ Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7000` | Server port |
| `BASE_URL` | auto-detected | Public URL for proxy links |
| `UPSTREAM_ADDON_URL` | — | Stremio add-on to pull streams from (e.g. Torrentio) |
| `ANISKIP_ENABLED` | `true` | Enable anime timestamp lookups |
| `DATA_DIR` | `./data` | Where catalog.json is stored |

---

## 🛠️ Scripts

| Command | Description |
|---|---|
| `npm run seed` | Load example data |
| `npm run validate` | Check catalog.json for errors |
| `npm run export` | Export catalog.json to stdout or a file |
| `npm test` | Run all tests |

---

## 🤝 Contributing

1. Fork this repo
2. Run `npm install`
3. Add timestamps via the API or by editing `data/catalog.json` directly
4. Run `npm run validate` to verify your data
5. Open a pull request

---

## 📬 Contact

Questions or contributions — **hctu4hbs@gmail.com**

---

## 📄 License

MIT
