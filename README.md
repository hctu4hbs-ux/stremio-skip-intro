# ⏩ stremio-skip-intro

> A self-hosted server for managing and serving skip-intro/outro data to Stremio — with a real HLS proxy that physically removes intro segments before they reach the player.

---

## ✨ Features

| | |
|---|---|
| ⏩ **HLS stream proxy** | Rewrites any HLS manifest to physically cut intro and outro segments |
| 🎯 **Stremio add-on** | Installs in one click — shows a Skip button using local + community data |
| 🔀 **Multi-source aggregator** | Pulls from your local database, TheIntroDB, and AniSkip simultaneously |
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

Set `BASE_URL` in your environment to the public URL after deploying so Stremio can reach the VTT and proxy endpoints.

---

## 🚀 Quick start

Self-host locally:

```
git clone https://github.com/hctu4hbs-ux/stremio-skip-intro
npm install
cp .env.example .env
npm run seed
npm start
```

Then install in Stremio by pasting into the Add-ons search bar:

`http://localhost:7000/manifest.json`

---

## ⚙️ How the HLS proxy works

The proxy is the core feature. Instead of just showing a skip button, it surgically removes intro segments from the video stream before the player ever receives them.

```
Your stream source
       │
       └──► GET /proxy/hls?url=<stream>&videoId=tt...:1:1
                   │
                   ├─ Fetches original .m3u8 manifest
                   ├─ Queries skip segments from all sources
                   ├─ Drops segments inside intro/outro time ranges
                   ├─ Inserts EXT-X-DISCONTINUITY markers
                   └─ Rewrites all segment URLs through /proxy/segment
                              │
                              └──► Player receives clean stream, no intro
```

**To wrap any HLS stream:**

Pass the original m3u8 URL (base64url encoded) and the video ID:

`/proxy/hls?url=<base64url_of_m3u8>&videoId=tt0944947:1:1`

Use `/proxy/lookup?videoId=tt0944947:1:1` to debug what segments will be skipped.

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

### Proxy

| Endpoint | Description |
|---|---|
| `GET /proxy/hls?url=&videoId=` | Modified HLS manifest with intros removed |
| `GET /proxy/segment?url=` | Transparent segment proxy (handles CORS) |
| `GET /proxy/lookup?videoId=` | Debug: see all skip segments for a video |

### Stremio add-on

| Endpoint | Description |
|---|---|
| `GET /manifest.json` | Paste this URL into Stremio to install |
| `GET /subtitles/:type/:id.json` | Skip-button subtitle track |
| `GET /vtt/:videoId.vtt` | WebVTT file with `{skip}` cues |

### Segments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/segments` | List all segments (`?imdbId=` `?label=`) |
| `GET` | `/api/segments/stats` | Counts by show and label |
| `POST` | `/api/segments` | Add a segment |
| `PATCH` | `/api/segments/:id` | Update a segment |
| `PUT` | `/api/segments/:videoId` | Replace all segments for an episode |
| `DELETE` | `/api/segments/:id` | Delete a segment |
| `GET` | `/api/segments/aniskip/:malId/:episode` | Look up anime timestamps |

### Catalog

| Method | Endpoint | Description |
|---|---|---|
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
| `BASE_URL` | auto-detected | Public URL for Stremio VTT + proxy links |
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
