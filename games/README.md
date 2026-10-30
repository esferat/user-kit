# games

Standalone browser games of the user-kit monorepo, extracted from `frontend-main`:

| Route      | Game            | Technology |
| ---------- | --------------- | ---------- |
| `/lines`   | Цветные линии   | three.js   |
| `/match3`  | Три в ряд       | Phaser 4   |

Next.js 16 (Turbopack), React 19, antd 6. No backend, no session, no login: the game state
(settings, stats) lives in `localStorage`. The app is published on its own domain
(`https://user-kit.games.local` in the compose stack) and linked from the `Игры` menu of
`frontend-main`.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # type check included, standalone output
pnpm lint
```

Conventions and details — in [`AGENTS.md`](AGENTS.md).
