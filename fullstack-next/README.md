# fullstack-next

Next.js 16 (App Router, React 19, Ant Design 6) application of the `user-kit` monorepo. The edge serves
it on `user-kit.next.local`; locally `pnpm dev` runs it on `http://localhost:3000` and the Next dev
server proxies `/api` to the backend, so the browser talks to a single origin.

## Authorization

The app uses the cookie-based BFF scheme of the monorepo: the Spring backend is the OAuth client and the
JWT resource server, the browser receives only `HttpOnly` cookies and never a token.

- `src/shared/api/http.ts` — `fetch` with `credentials: 'include'` and the `XSRF-TOKEN` → `X-XSRF-TOKEN`
  header on unsafe methods.
- `src/features/auth/` — the `CookieAuthProvider`, the `SessionStore` and `useAuth`, with `refresh()`
  for the state after an edit.
- `src/features/profile-edit/` — `createProfileApi` and the form of `/profile/edit`; the avatar goes
  through the backend, which stores two PNG renditions in the object storage.
- `src/proxy.ts` — optimistic redirect to `/login` when no session cookie is present; the public
  landing page `/` is exempt.
- `src/app/page.tsx` — the public landing page; `src/app/(protected)/` — private routes behind the app
  shell (`admin`, `profile`, `profile/edit`, `games/chess`, `games/checkers`); `src/app/login/` — the
  login screen.
- `src/widgets/app-shell/` — the header with the profile menu and the role-filtered navigation in a
  left sider. `Игры` is a group: it only expands the submenu, its pages are placeholders.

Registration is a separate feature and is not implemented here.

## Scripts

```bash
pnpm dev     # Next dev server on http://localhost:3000
pnpm build   # production build (output: standalone)
pnpm start   # next start, for a local production check
pnpm lint    # eslint
```

The Docker image runs the standalone server with `node .next/standalone/server.js`.

## Configuration

`NEXT_PUBLIC_API_BASE_URL` is inlined at build time and defaults to an empty string: the API is called on
the same origin, where the edge routes `/api` to the backend. Set it only when the API lives on another
origin. Never put secrets in a `NEXT_PUBLIC_*` variable.

## Note on this Next.js version

This release has breaking changes compared to older ones. Read the bundled guides under
`node_modules/next/dist/docs/` before changing application code; `AGENTS.md` restates this rule.
