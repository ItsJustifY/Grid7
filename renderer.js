const $ = (id) => document.getElementById(id);
const PAGE = 100;
let all = [], view = [], shown = 0;

const clean = (s) => (s || '').replace(/\^[0-9]/g, '').replace(/~[a-z]~/gi, '').trim();
const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

async function load() {
  $('status').textContent = 'Loading servers... (downloads ~20MB)';
  $('refresh').disabled = true;
  const r = await window.api.fetchServers();
  $('refresh').disabled = false;
  if (!r.ok) { $('status').textContent = 'Failed to load: ' + r.error; return; }
  all = r.servers.map((s) => ({
    ...s, name: clean(s.name), cname: clean(s.name).toLowerCase(),
    hay: (clean(s.name) + ' ' + s.tags + ' ' + s.gametype + ' ' + s.map + ' ' + s.project + ' ' + s.id).toLowerCase(),
  }));
  const locales = [...new Set(all.map((s) => s.locale).filter(Boolean))].sort();
  const cur = $('locale').value;
  $('locale').innerHTML = '<option value="">All languages</option>' + locales.map((l) => `<option>${esc(l)}</option>`).join('');
  $('locale').value = cur;
  apply();
}

function apply() {
  const q = $('q').value.trim().toLowerCase();
  const loc = $('locale').value, sort = $('sort').value;
  const he = $('hideEmpty').checked, hf = $('hideFull').checked;
  view = all.filter((s) =>
    (!q || s.hay.includes(q)) && (!loc || s.locale === loc) &&
    (!he || s.clients > 0) && (!hf || s.clients < s.max));
  if (sort === 'players') view.sort((a, b) => b.clients - a.clients);
  else if (sort === 'name') view.sort((a, b) => a.cname.localeCompare(b.cname));
  else view.sort((a, b) => (b.max - b.clients) - (a.max - a.clients));
  const players = all.reduce((n, s) => n + s.clients, 0);
  $('status').textContent = `${view.length.toLocaleString()} of ${all.length.toLocaleString()} servers · ${players.toLocaleString()} players online`;
  $('list').innerHTML = ''; shown = 0; more();
}

function more() {
  const frag = document.createDocumentFragment();
  for (const s of view.slice(shown, shown + PAGE)) {
    const pct = s.max ? Math.min(100, (s.clients / s.max) * 100) : 0;
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="banner"></div>
      <div><div class="name">${esc(s.name)}</div>
        <div class="meta">${esc([s.gametype, s.map, s.locale, s.tags].filter(Boolean).join(' · '))}</div></div>
      <div class="players"><b>${s.clients}</b> / ${s.max}<div class="bar"><i style="width:${pct}%"></i></div>
        <button>Connect</button></div>`;
    if (/^https:\/\//.test(s.banner)) el.querySelector('.banner').style.backgroundImage = `url("${encodeURI(s.banner)}")`;
    el.querySelector('button').onclick = () => window.api.connect(s.id);
    frag.append(el);
  }
  $('list').append(frag);
  shown += PAGE;
  $('more').hidden = shown >= view.length;
}

let t;
$('q').oninput = () => { clearTimeout(t); t = setTimeout(apply, 150); };
['locale', 'sort', 'hideEmpty', 'hideFull'].forEach((id) => ($(id).onchange = apply));
$('refresh').onclick = load;
$('more').onclick = more;
load();
