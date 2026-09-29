const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const LIST_URL = 'https://frontend.cfx-services.net/api/servers/streamRedir/';
const dec = new TextDecoder();

function readVarint(b, p) {
  let r = 0, s = 0, x;
  do { x = b[p++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80);
  return [r, p];
}

// Minimal protobuf reader -> { fieldNumber: [values] } (varints as numbers, length-delimited as Uint8Array)
function readFields(b) {
  const out = {};
  let p = 0;
  while (p < b.length) {
    let tag; [tag, p] = readVarint(b, p);
    const f = tag >>> 3, t = tag & 7;
    let v;
    if (t === 0) [v, p] = readVarint(b, p);
    else if (t === 2) { let l; [l, p] = readVarint(b, p); v = b.subarray(p, p + l); p += l; }
    else if (t === 1) { p += 8; continue; }
    else if (t === 5) { p += 4; continue; }
    else break;
    (out[f] ||= []).push(v);
  }
  return out;
}
const str = (a) => (a ? dec.decode(a[0]) : '');

function parseServer(msg) {
  const top = readFields(msg);
  const id = str(top[1]);
  if (!top[2]) return null;
  const d = readFields(top[2][0]);
  const vars = {};
  for (const e of d[12] || []) {
    const kv = readFields(e);
    vars[str(kv[1])] = str(kv[2]);
  }
  return {
    id,
    name: str(d[4]),
    clients: d[2] ? d[2][0] : 0,
    max: d[1] ? d[1][0] : 0,
    gametype: str(d[5]),
    map: str(d[6]),
    server: str(d[9]),
    locale: vars.locale || '',
    tags: vars.tags || '',
    project: vars.sv_projectName || '',
    banner: vars.banner_detail || vars.banner_connecting || '',
    game: vars.gamename || 'gta5',
  };
}

async function fetchServers() {
  const res = await fetch(LIST_URL, { headers: { 'User-Agent': 'Mozilla/5.0 FiveMBrowser' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const list = [];
  let p = 0;
  while (p + 4 <= buf.length) {
    const len = dv.getUint32(p, true); p += 4;
    if (p + len > buf.length) break;
    try { const s = parseServer(buf.subarray(p, p + len)); if (s && s.name) list.push(s); } catch {}
    p += len;
  }
  return list;
}

ipcMain.handle('servers:fetch', async () => {
  try { return { ok: true, servers: await fetchServers() }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
});

ipcMain.handle('servers:connect', (_e, id) => {
  if (!/^[a-z0-9]{4,10}$/i.test(id)) return false;
  shell.openExternal(`fivem://connect/cfx.re/join/${id}`);
  return true;
});

if (process.argv.includes('--selftest')) {
  fetchServers().then((l) => { console.log('parsed', l.length); console.log(l.slice(0, 3)); app.quit(); });
} else {
  app.whenReady().then(() => {
    const win = new BrowserWindow({
      width: 1200, height: 800, backgroundColor: '#0f1115', autoHideMenuBar: true,
      title: 'FiveM Browser',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    });
    win.loadFile('index.html');
  });
  app.on('window-all-closed', () => app.quit());
}
