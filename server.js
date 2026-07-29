const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// DATA_DIR lets you point storage at a persistent volume/disk mount in
// production (see README). Defaults to a local ./data folder for dev.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const PALETTE = ['#C65B4E', '#D6E62B', '#5B8FA8', '#E89A3C', '#7FB069', '#B07FC9', '#E8618C', '#4FB3A9'];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify({ players: [], availability: {} }, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return { players: [], availability: {} };
  }
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

// Get the full board state
app.get('/api/state', async (req, res) => {
  const store = await readStore();
  res.json(store);
});

// Join the board (creates the player if new, otherwise just confirms them)
app.post('/api/join', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 24) return res.status(400).json({ error: 'Name is too long' });

  const store = await readStore();
  let player = store.players.find(p => p.name.toLowerCase() === name.toLowerCase());

  if (!player) {
    const color = PALETTE[store.players.length % PALETTE.length];
    player = { name, color };
    store.players.push(player);
    store.availability[name] = [];
    await writeStore(store);
  }

  res.json({ player, store });
});

// Toggle a single time slot for a player
app.post('/api/toggle', async (req, res) => {
  const { name, slotId } = req.body;
  if (!name || !slotId) return res.status(400).json({ error: 'Missing name or slotId' });

  const store = await readStore();
  if (!store.players.find(p => p.name === name)) {
    return res.status(404).json({ error: 'Unknown player — join first' });
  }

  const current = store.availability[name] || [];
  const idx = current.indexOf(slotId);
  if (idx === -1) current.push(slotId); else current.splice(idx, 1);
  store.availability[name] = current;

  await writeStore(store);
  res.json({ availability: current });
});

// Clear a single player's slots for the week
app.post('/api/clear', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const store = await readStore();
  store.availability[name] = [];
  await writeStore(store);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Pickleball board running on http://localhost:${PORT}`);
});
