# Morkahja Admin

**Author:** Babuni.dev

Local-only admin console for Morkahja — online players, moderation, live activity, and game content.

## Features

- **Dashboard** — online counts + live activity feed (5s refresh)
- **Players** — online list (5s refresh), timeout, ban, unban
- **Content** — browse/add encounters, solutions, expansions, frames, portraits
- **Settings** — connection info for VPS + game data paths

## Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5180 (local only). Override with `DEV_PORT` in `.env.local`.

## `.env.local` example

```env
# VPS admin API (moderation + activity)
VITE_USE_MOCK_DATA=false
VITE_API_BASE_URL=/api
API_PROXY_TARGET=https://YOUR_VPS:PORT
ADMIN_API_KEY=your-key

# Game JSON + images from MorkahjaWebApp (while client dev server runs)
VITE_GAME_DATA_URL=/game
GAME_DATA_PROXY=http://127.0.0.1:5174
```

Game files live under `MorkahjaWebApp/client/public/game/`:

- `encountersdata.json`, `encounterimages/`
- `solutiondata.json`, `solutionimages/`
- `expansiondata.json`, `frames.json`, `portraits.json`

## VPS admin API

Live server path: `/game-data/admin` (matches existing nginx — set `VITE_API_BASE_URL=/game-data/admin`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/server` | Server status |
| GET | `/dashboard` | Stats |
| GET | `/players/online` | Online players |
| GET | `/players` | All players |
| GET | `/activity` | Live feed entries |
| POST | `/players/timeout` | `{ playerId, durationMinutes, reason? }` |
| POST | `/players/ban` | `{ playerId, reason? }` |
| POST | `/players/unban` | `{ playerId }` |
| GET/POST | `/content/encounters` | Game encounters |
| GET/POST | `/content/solutions` | Game solutions |
| GET/POST | `/content/expansions` | Expansions |
| GET/POST | `/content/frames` | Avatar frames |
| GET/POST | `/content/portraits` | Avatar portraits |

Types: `src/types/index.ts`, `src/types/gameContent.ts`.

Without VPS routes, use `VITE_USE_MOCK_DATA=true` to test moderation UI locally.
