# Developer Guide — stremio-skip-intro

Everything a Stremio add-on developer needs to integrate automatic intro removal.

---

## How it works

stremio-skip-intro runs as a separate server alongside your add-on. Your add-on passes stream URLs through the proxy — the proxy rewrites the HLS manifest to remove intro and outro segments before the player loads them. The user never sees the intro. There is no button, no overlay, nothing.

```
Your add-on
    │
    ├── GET /proxy/lookup?videoId=tt...:1:1   ← check what will be removed
    │
    └── GET /proxy/hls?url=<m3u8>&videoId=   ← modified stream, intros removed
```

---

## Quick integration (3 lines)

Add this to any existing stream handler to wrap HLS streams:

```js
const SKIP = 'http://localhost:7000'; // your stremio-skip-intro URL

function skipProxy(m3u8Url, videoId) {
  const enc = Buffer.from(m3u8Url).toString('base64url');
  return `${SKIP}/proxy/hls?url=${enc}&videoId=${encodeURIComponent(videoId)}`;
}

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

That is the entire integration. The player loads the proxied URL and the intro is gone.

---

## What actually happens inside the proxy

1. The proxy fetches the original `.m3u8` manifest from your stream source
2. It queries all skip data sources (local catalog, TheIntroDB, AniSkip) for that video ID
3. It calculates which HLS segments fall inside intro/outro time ranges
4. It drops those segments from the manifest
5. It rewrites all remaining segment URLs through `/proxy/segment` (handles CORS)
6. It returns the rewritten manifest to the player

The player has no idea any of this happened. It loads a normal HLS stream that happens to start after the intro.

---

## Add timestamps for your content

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
    applyToSeries: false,  // true = apply same timestamps to all episodes
  })
});
```

---

## Verify what will be removed (debug)

Before going live, check what segments exist for any video:

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

## API reference

| Method | Endpoint | Use case |
|---|---|---|
| `GET` | `/proxy/lookup?videoId=` | Debug: see all segments for a video |
| `GET` | `/proxy/hls?url=&videoId=` | Wrap an HLS stream — intros removed |
| `GET` | `/proxy/segment?url=` | Proxied segment (called automatically by player) |
| `GET` | `/api/segments?imdbId=` | List your local segments |
| `POST` | `/api/segments` | Add a timestamp |
| `PATCH` | `/api/segments/:id` | Update a timestamp |
| `DELETE` | `/api/segments/:id` | Remove a timestamp |
| `GET` | `/api/catalog` | Full catalog.json |
| `POST` | `/api/catalog/import` | Import an existing catalog |
| `GET` | `/api/segments/stats` | Counts by show and label |

---

## Data sources

Segments are aggregated automatically — no configuration needed:

| Source | Data | Notes |
|---|---|---|
| Local catalog | Your own timestamps | Always highest priority |
| TheIntroDB | Community DB — movies + TV | No auth required |
| AniSkip | Anime openings/endings | Pass `malId` param for best results |

---

## Full example add-on

See [`examples/my-stremio-addon/`](examples/my-stremio-addon/) for a complete working add-on you can clone and run.

```
cd examples/my-stremio-addon
npm install
cp .env.example .env
node addon.js
```

---

## Tips

- Set `BASE_URL` to the public URL of your server so proxy links work from any device.
- CORS is open on all endpoints — no configuration needed.
- Set `applyToSeries: true` for timestamps that repeat every episode (most intros). The proxy applies them to all episodes of that show automatically.
- Rate limits: 300 req/15min on `/api/`, 500 req/min on `/proxy/`. For high traffic, deploy to Oracle Cloud (always-free, see README).

---

## 📬 Contact

**hctu4hbs@gmail.com**
