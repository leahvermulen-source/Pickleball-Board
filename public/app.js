const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKEND = ['Sat','Sun'];
const SLOTS = ['6–8 AM','8–10 AM','10–12 PM','12–3 PM','3–6 PM','6–9 PM'];
const NET_AFTER_ROW = 3;
const POLL_MS = 4000;
const NAME_KEY = 'pickleball-board:my-name';

let myName = localStorage.getItem(NAME_KEY) || null;
let store = { players: [], availability: {} };
let pollHandle = null;

function slotId(day, rowIdx){ return day + '|' + rowIdx; }

async function api(path, options){
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if(!res.ok){
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

async function fetchState(){
  store = await api('/api/state');
}

function renderWhoBar(errorMsg){
  const bar = document.getElementById('whoBar');
  if(!myName){
    bar.innerHTML = `
      <input id="nameInput" type="text" placeholder="Your name" maxlength="24" />
      <button class="btn" id="joinBtn">Join the board</button>
      ${errorMsg ? `<div class="error-msg">${escapeHtml(errorMsg)}</div>` : ''}
    `;
    document.getElementById('joinBtn').addEventListener('click', onJoin);
    document.getElementById('nameInput').addEventListener('keydown', e => {
      if(e.key === 'Enter') onJoin();
    });
  } else {
    const me = store.players.find(p => p.name === myName);
    const color = me ? me.color : '#999';
    bar.innerHTML = `
      <div class="me-chip"><span class="dot" style="background:${color}"></span>Playing as <strong>${escapeHtml(myName)}</strong></div>
      <button class="btn secondary" id="clearBtn">Clear my slots</button>
      <button class="link-btn" id="switchBtn">Not you? Switch player</button>
    `;
    document.getElementById('switchBtn').addEventListener('click', onSwitch);
    document.getElementById('clearBtn').addEventListener('click', onClear);
  }
}

async function onJoin(){
  const input = document.getElementById('nameInput');
  const name = (input.value || '').trim();
  if(!name){ input.focus(); return; }
  try{
    const result = await api('/api/join', { method: 'POST', body: JSON.stringify({ name }) });
    myName = result.player.name;
    store = result.store;
    localStorage.setItem(NAME_KEY, myName);
    renderWhoBar();
    renderLegend();
    renderBoard();
  }catch(e){
    renderWhoBar(e.message);
  }
}

function onSwitch(){
  myName = null;
  localStorage.removeItem(NAME_KEY);
  renderWhoBar();
  renderBoard();
}

async function onClear(){
  if(!myName) return;
  await api('/api/clear', { method: 'POST', body: JSON.stringify({ name: myName }) });
  await fetchState();
  renderBoard();
}

function renderLegend(){
  const legend = document.getElementById('legend');
  legend.innerHTML = store.players.map(p =>
    `<span><span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)}</span>`
  ).join('');
}

function buildHead(){
  const headRow = document.getElementById('headRow');
  headRow.innerHTML = '<th style="background:var(--court-dark)"></th>' +
    DAYS.map(d => `<th class="${WEEKEND.includes(d) ? 'weekend' : ''}">${d}</th>`).join('');
}

function buildBody(){
  const body = document.getElementById('bodyRows');
  body.innerHTML = '';
  SLOTS.forEach((label, rowIdx) => {
    const tr = document.createElement('tr');
    if(rowIdx === NET_AFTER_ROW) tr.classList.add('net-row');
    const th = document.createElement('th');
    th.textContent = label;
    tr.appendChild(th);
    DAYS.forEach(day => {
      const td = document.createElement('td');
      td.dataset.day = day;
      td.dataset.row = rowIdx;
      td.tabIndex = 0;
      td.addEventListener('click', () => toggleSlot(day, rowIdx));
      td.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleSlot(day, rowIdx); }
      });
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function renderBoard(){
  const cells = document.querySelectorAll('#bodyRows td');
  cells.forEach(td => {
    const day = td.dataset.day;
    const row = td.dataset.row;
    const id = slotId(day, row);
    const here = store.players.filter(p => (store.availability[p.name] || []).includes(id));
    td.classList.toggle('mine', !!(myName && (store.availability[myName] || []).includes(id)));
    if(here.length === 0){
      td.style.background = '';
      td.innerHTML = '';
    } else {
      const alpha = Math.min(0.10 + here.length * 0.08, 0.34);
      td.style.background = `rgba(30,95,110,${alpha})`;
      td.innerHTML = `<div class="dots">${here.map(p => `<span class="dot" style="background:${p.color}" title="${escapeHtml(p.name)}"></span>`).join('')}</div>`;
    }
  });
}

async function toggleSlot(day, rowIdx){
  if(!myName){
    document.getElementById('nameInput')?.focus();
    return;
  }
  const id = slotId(day, rowIdx);
  const current = store.availability[myName] || [];
  const idx = current.indexOf(id);
  // optimistic update
  if(idx === -1) current.push(id); else current.splice(idx, 1);
  store.availability[myName] = current;
  renderBoard();

  try{
    await api('/api/toggle', { method: 'POST', body: JSON.stringify({ name: myName, slotId: id }) });
  }catch(e){
    // roll back on failure by re-syncing from server
    await fetchState();
    renderBoard();
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function startPolling(){
  if(pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    await fetchState();
    renderLegend();
    renderBoard();
    // in case someone else joined and this device already had a name, keep who-bar accurate
    if(myName) renderWhoBar();
  }, POLL_MS);
}

async function init(){
  buildHead();
  buildBody();
  await fetchState();

  if(myName && !store.players.find(p => p.name === myName)){
    // name was cleared server-side (e.g. fresh deploy) — fall back to join screen
    myName = null;
    localStorage.removeItem(NAME_KEY);
  }

  renderWhoBar();
  renderLegend();
  renderBoard();
  startPolling();
}

init();
