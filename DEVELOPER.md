# 👨‍💻 Developer Guide — stremio-skip-intro

Everything a Stremio add-on developer needs to integrate skip-intro functionality.

---

## How it fits into your add-on

stremio-skip-intro runs as a separate server alongside your add-on.
Your add-on asks it for skip data, and either:

- **Serves a subtitle track** → Stremio shows a "Skip" button the user clicks
- **Wraps the stream through the HLS proxy** → Stremio auto-skips, user does nothing

```
Your add-on
    │
    ├── GET /proxy/lookup?videoId=tt...:1:1   ← check what will be skipped
    │
    ├── GET /vtt/tt...:1:1.vtt               ← subtitle track for skip button
    │
    └── GET /proxy/hls?url=<m3u8>&videoId=   ← modified stream, intros removed
```

---

## Quick integration (3 lines)

Add this to any existing stream handler to wrap HLS streams:

```js
const SKIP = 'http://localhost:7000'; // your stremio-skip-intro URL

// Wrap any HLS stream — intros are cut before the player loads the file
function skipProxy(m3u8Url, videoId) {
  const enc = Buffer.from(m3u8Url).toString('base64url');
  return `${SKIP}/proxy/hls?url=${enc}&videoId=${encodeURIComponent(videoId)}`;
}

// In your stream handler:
builder.defineStreamHandler(async ({ type, id }) => {
  const originalUrl = await getStreamUrlFromYourSource(id);
  return {
    streams: [{
      name: '⏩ Skip Intro',
      url: skipProxy(originalUrl, id),
    }]
  };
});
```

---

## Add a skip button to existing streams

If you don't control the stream URL, add a subtitle track instead.
Stremio shows a "Skip Intro" button overlay at the right timestamps:

```js
builder.defineSubtitlesHandler(async ({ type, id }) => {
  const res = await fetch(`http://localhost:7000/proxy/lookup?videoId=${id}`);
  const { segments } = await res.json();
  if (!segments.length) return { subtitles: [] };

  return {
    subtitles: [{
      id: `skip-${id}`,
      url: `http://localhost:7000/vtt/${encodeURIComponent(id)}.vtt`,
      lang: 'skip',
    }]
  };
});
```

---

## Add timestamps for your content

Use the REST API to add skip timestamps before serving them:

```js
await fetch('http://localhost:7000/api/segments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imdbId: 'tt0944947',
    showTitle: 'Game of Thrones',
    season: 1,
    episode: 1,
    start: 0,
    end: 97,
    label: 'Intro',        // Intro | Outro | Recap | Credits
    applyToSeries: false,  // true = apply to all episodes
  })
});
```

---

## Check what will be skipped (debug)

Before going live, verify what segments exist for any video:

```
GET /proxy/lookup?videoId=tt0944947:1:1
```

Response:
```json
{
  "videoId": "tt0944947:1:1",
  "segments": [
    { "start": 0, "end": 97, "label": "Intro", "source": "local" },
    { "start": 3180, "end": 3240, "label": "Outro", "source": "tidb" }
  ],
  "proxyUrl": "http://localhost:7000/proxy/hls?url=<base64url_m3u8>&videoId=tt0944947:1:1"
}
```

Sources: `local` = your catalog, `tidb` = TheIntroDB, `aniskip` = AniSkip

---

## Video ID format

| Content | Format | Example |
|---|---|---|
| TV episode | `tt{id}:{season}:{episode}` | `tt0944947:1:3` |
| Movie | `tt{id}` | `tt0111161` |
| Anime (Kitsu) | `kitsu:{id}:{season}:{episode}` | `kitsu:12345:1:1` |

---

## Manifest requirements

Your add-on manifest must include `subtitles` in resources if you want skip buttons:

```js
const manifest = {
  id: 'com.example.myaddon',
  version: '1.0.0',
  name: 'My Add-on',
  resources: ['stream', 'subtitles'],   // ← subtitles required for skip button
  types: ['series', 'movie'],
  idPrefixes: ['tt'],
  catalogs: [],
};
```

---

## API reference

| Method | Endpoint | Use case |
|---|---|---|
| `GET` | `/proxy/lookup?videoId=` | Debug: see all segments for a video |
| `GET` | `/proxy/hls?url=&videoId=` | Wrap an HLS stream — intros removed |
| `GET` | `/proxy/segment?url=` | Proxied segment (auto-called by player) |
| `GET` | `/vtt/:videoId.vtt` | Skip subtitle track for Stremio player |
| `GET` | `/api/segments?imdbId=` | List your local segments |
| `POST` | `/api/segments` | Add a timestamp |
| `PATCH` | `/api/segments/:id` | Update a timestamp |
| `DELETE` | `/api/segments/:id` | Remove a timestamp |
| `GET` | `/api/catalog` | Full catalog.json |
| `POST` | `/api/catalog/import` | Import an existing catalog |
| `GET` | `/api/segments/stats` | Counts by show and label |

---

## Data sources

Segments are aggregated automatically — you don't need to configure anything:

| Source | Data | Notes |
|---|---|---|
| Local catalog | Your own timestamps | Fastest, always wins on conflict |
| TheIntroDB | Community DB — movies + TV | No auth required for reads |
| AniSkip | Anime openings/endings | Pass `malId` param for best results |

---

## Full example add-on

See [`examples/my-stremio-addon/`](examples/my-stremio-addon/) for a complete working add-on you can clone and run immediately.

```
cd examples/my-stremio-addon
npm install
cp .env.example .env
node addon.js
```

Then paste `http://localhost:7001/manifest.json` into Stremio.

---

## Tips

- **Hosting**: deploy stremio-skip-intro to a public URL (see README hosting section), then set `BASE_URL` so the VTT and proxy links work from any device.
- **CORS**: all endpoints return `Access-Control-Allow-Origin: *` — no configuration needed.
- **Rate limiting**: 300 req/15min on `/api/`, 500 req/min on `/proxy/`. For high traffic, self-host on Oracle Cloud (see README).
- **applyToSeries**: set to `true` for segments that repeat every episode (most intros). The proxy will apply them to all episodes of that show automatically.

---

## 📬 Contact

**hctu4hbs@gmail.com**
