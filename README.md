# Friends Church (Quakers) — Frontend

React + Vite website for the Quaker meeting, built on the Django API in `../../backend`.
Theme: the logo's blue (#1E4167), white and gold. Logo files are in `src/assets/` (`logo-mark.png`, `logo-full.webp`) and `public/` (favicon, app icon, social-share image).

## Pages

| Page | Who | API used |
|---|---|---|
| Home: weekly query, next 3 gatherings, live-stream button | Everyone | `/queries/active/`, `/schedules/upcoming/` |
| Worship & Events: upcoming/past, filter by type | Everyone | `/schedules/` |
| Hymnal: search by number/title/author, printable song page | Everyone | `/songs/` |
| Queries: archive of weekly queries | Everyone | `/queries/` |
| Sign in / out | Everyone | `/auth/login/`, `/auth/logout/`, `/auth/me/` |
| Fellowship: live chat rooms | Members, Recording Clerk, Clerk | `ws /ws/chat/<room>/` |
| Manage: add/edit/delete songs, queries and events | Recording Clerk (hymnal); Clerk (all) | `/songs/`, `/queries/`, `/schedules/` |

## Run in development

```bash
# terminal 1 — backend
cd ../../backend/quaker_church_mangement_system
python manage.py runserver          # http://127.0.0.1:8000

# terminal 2 — frontend
npm install
cp .env.example .env.local          # optional: set the church name, contact details
npm run dev                         # http://localhost:5173
```

Vite proxies `/api` and `/ws` to the backend, so no CORS setup is needed in development.

## Build for production

```bash
VITE_API_URL=https://api.your-meeting.org npm run build   # output in dist/
```

Serve `dist/` as a static site with a fallback to `index.html` (for client-side routes).
Also add the site's domain to the backend's `CORS_ALLOWED_ORIGINS` and `DJANGO_ALLOWED_HOSTS`.
The second one is needed because the chat WebSocket checks the origin.

## Structure

```
src/
  api/client.js        fetch wrapper: JWT, single shared token refresh, readable errors
  auth/AuthContext.jsx current user + role, login/logout
  hooks/useApi.js      data fetching with abort on change (no out-of-order results)
  components/          Layout (header/footer), EventCard, StreamPlayer, States, RequireRole, Logo
  pages/               Home, Worship, Hymnal, Queries, Login, Fellowship, Manage, NotFound
  config.js            church name, roles, labels (edit .env.local rather than this file)
  index.css            theme tokens (colours, type, buttons, forms)
  App.css              layout and page styles
```

Role checks in the UI only hide controls. The API enforces the same rules, so a hidden button is never the only protection.

## Accounts & email (added)

| Page | Purpose |
|---|---|
| `/register`, `/login` | Sign up / sign in with username **or email**, or **Continue with Google** (shown when the backend has `GOOGLE_CLIENT_ID`) |
| `/forgot-password` → `/reset-password/:uid/:token` | Password reset by email (link valid 2 h, single use) |
| `/verify-email/:token` | Confirm email (needed before joining churches, registering one, or messages) |
| `/account` | Name, email, phone, email preferences, change/set password, your churches |
| `/unsubscribe/:token` | One-click opt-out from announcement or reminder emails |
| `/admin-dashboard` | Platform admins only (the **Admin** button in the header): people & roles in any church, churches, accounts. See `backend/quaker_church_mangement_system/docs/PLATFORM_ADMINS.md` |
| `/c/:slug/manage?tab=streaming` | Clerk guide: camcorder → OBS → YouTube Live, with the church's encrypted stream key |

See `backend/quaker_church_mangement_system/docs/SETUP_EMAIL_GOOGLE_STREAMING.md` for configuration.

