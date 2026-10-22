# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/8darkstar369/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/8darkstar369/PlayGround)

- 🎮 [Open the project](https://omgithub.com/8darkstar369/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=8darkstar369%2FPlayGround).
- 💻 [Explore the source](https://github.com/8darkstar369/PlayGround).
- 🛠️ [Check build runs](https://github.com/8darkstar369/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/8darkstar369/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/8darkstar369).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## Sunset City — open-world driving game with an AI social layer

A browser GTA-style sandbox (Three.js) where the city has residents: walk into a lit
doorway to join a chat room, talk to people on the street one-on-one, and pick up
contracts on the job board that AI crew members join and finish with you.

### Run it

```bash
npm install
npm run build          # bundle the client into dist/
npm start              # serves dist/ + the social hub API on PORT (default 3000)
```

For development run the API and the Vite dev server in separate shells:

```bash
PORT=3001 WEB_ROOT=dist npm run dev:api   # social hub API + SSE on :3001
npm run dev                               # game on :3000, /api proxied to :3001
```

### AI provider

| env | meaning |
| --- | --- |
| `ZEN_API_KEY` / `OPENCODE_ZEN_API_KEY` | OpenCode Zen key. When set, room replies come from a real model. |
| `ZEN_MODEL` | Model id, default `mimo-v2.6-flash-free`. |
| `PORT`, `WEB_ROOT` | API/static port (3000) and the built client folder (`dist`). |

Without a key the hub runs the built-in persona engine (`server/sim.js`): nine
residents with their own voices, room banter, and contract templates. `GET /api/health`
reports which provider is live (`zen` or `sim`). If a Zen call fails, the reply falls
back to the persona engine instead of erroring.

### The social layer

- **7 walk-in venues** (El Rey Diner, Neon Net Cafe, Arcade '98, The Rusty Anchor,
  K-SUN Radio, Sunset Auto Garage, Vinyl & Velvet) with lit doorways, signs, and
  ground glows. Stand at a door and press `E` (or the DOOR button) to join.
- **9 residents** who talk in rooms, on the street one-on-one (`F` next to them), and
  in shared lobbies. Human players in other tabs are visible and talk back.
- **Job board** with contract templates: courier runs, rumour hunts, arcade
  tournaments, night drives, and favours. Steps mix room conversations (`ask`,
  `meet`, `report`, `pickup`), world drives, and collectibles, so different contracts
  play differently. Accept a contract and an AI companion joins and follows you.
- **Shared city state** over SSE: room messages, presence, and mission updates are
  broadcast to every client in the room.

### API

`GET /api/health`, `GET /api/rooms`, `GET /api/room/:id`, `GET /api/personas`,
`GET /api/missions`, `GET /api/stream` (SSE), `POST /api/room/join`,
`POST /api/room/leave`, `POST /api/chat`, `POST /api/talk`,
`POST /api/missions/generate`, `POST /api/missions/accept`,
`POST /api/missions/progress`, `POST /api/missions/abandon`.

### Layout

- `src/data/social.js` — shared residents, rooms, venue geometry, contract templates.
- `server/index.js` — static server, REST API, SSE hub, chat and contract lifecycle.
- `server/llm.js` — OpenCode Zen client. `server/sim.js` — offline persona engine.
- `src/social.js` — chat/DM/board UI, venue list, world speech bubbles.
- `src/main.js`, `src/world.js`, `src/entities.js`, `src/radar.js` — game, city, HUD.
