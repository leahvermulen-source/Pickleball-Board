# Open Court — Weekly Pickleball Board

A shared weekly availability board. Anyone with the link joins with their name,
taps the time slots they're free, and everyone else's phone updates automatically.

## How it works

- **Backend:** `server.js` — a small Express app with three API routes
  (`/api/state`, `/api/join`, `/api/toggle`, `/api/clear`). It stores data in
  a JSON file, `store.json`, inside a data folder — no database to set up.
- **Frontend:** plain HTML/CSS/JS in `public/`. It polls the server every 4
  seconds so everyone's board stays roughly in sync without needing
  websockets.
- **Persistence:** the data folder's location is controlled by the `DATA_DIR`
  environment variable (defaults to `./data` for local dev). In production,
  you point `DATA_DIR` at a persistent volume/disk mount — see the
  **Deploy** section below — so `store.json` survives every redeploy instead
  of resetting each week.

## Run it locally

You'll need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd pickleball-board
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

## Deploy so people can open it on their phones

Same pattern as The Edit — push this folder to a free host that runs Node
apps. Two easy options:

### Option A: Railway (recommended — volumes are included, no extra cost)

1. Push this folder to a GitHub repo.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Railway auto-detects the Node app and runs `npm install && npm start`.
4. Add a **Volume**: open the service → **Settings → Volumes** → **New Volume**.
   Set the mount path to `/app/data`.
5. Add the matching environment variable: **Settings → Variables** → add
   `DATA_DIR` = `/app/data`.
6. Redeploy once so the app picks up the new variable. From then on,
   `store.json` lives on the volume, so it survives every redeploy —
   including your weekly ones.
7. Go to **Settings → Networking** → **Generate Domain** to get your public
   link to text the group.

### Option B: Render

1. Push this folder to a new GitHub repo (or use Render's "public Git repo" option).
2. Go to [render.com](https://render.com) → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Add a **Disk**: on the service page → **Disks** tab → **Add Disk**. Give it
   1 GB (plenty) and set the mount path to `/opt/render/project/src/data`.
   Note this isn't available on Render's free instance type for web
   services — it requires a paid instance (starts around $7/mo), which is
   the trade-off for guaranteed persistence on Render.
5. Add the matching environment variable: **Environment** tab → add
   `DATA_DIR` = `/opt/render/project/src/data`.
6. Click **Create Web Service** / redeploy. Render gives you a URL like
   `https://open-court.onrender.com` — that's the link to text your group.

**If you'd rather stay fully free:** Railway's free/hobby tier includes
volumes at no extra charge, so Option A is the one to pick if weekly
persistence without added cost matters most.

Either way, once it's live, just share the URL — no app install needed, it
works straight in the phone's browser. You could also add it to a home
screen (Share → Add to Home Screen on iOS, or the browser menu on Android)
so it feels like a real app icon.

## Extending it later

A few things worth knowing if you want to keep building on this:

- **Real-time instead of polling:** swap the 4-second poll for a websocket
  (e.g. `socket.io`) if the group wants instant updates.
- **Real database:** if the board gets popular or the free-tier disk resets
  become annoying, moving `data/store.json` to something like SQLite or a
  hosted Postgres (Render and Railway both offer free Postgres add-ons) is a
  small, contained change — the API routes stay the same, only `readStore`/
  `writeStore` in `server.js` change.
- **Weekly reset:** right now the board is just "this week" forever — add a
  scheduled job or a manual "reset the week" button if you want it to clear
  automatically.
