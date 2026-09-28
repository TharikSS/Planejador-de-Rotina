'use strict';
// ---------- CONSTANTES E FUNÇÕES DE DATA ----------
const CATS = { Trabalho: '#378ADD', Estudo: '#7F77DD', Casa: '#1D9E75', Pessoal: '#D85A30' };
const DN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], ICSD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const REMS = [[-1, 'Sem lembrete'], [0, 'No horário'], [10, '10 min antes'], [60, '1 hora antes']];
const p2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const pd = s => new Date(s + 'T12:00:00');
const add = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const occ = (t, s) => (t.rep ? s >= t.date && t.rep.split(',').includes(String(pd(s).getDay())) : t.date === s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);

// ---------- BANCO DE DADOS (IndexedDB, dentro do iPhone) ----------
let db;
const S = { tasks: [], habits: [], done: new Set(), hlog: new Set() };
let tab = 'h', sel = today(), mo = today().slice(0, 7), ed = null;
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('planejador', 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    d.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
    d.createObjectStore('habits', { keyPath: 'id', autoIncrement: true });
    d.createObjectStore('done', { keyPath: 'k' });
    d.createObjectStore('hlog', { keyPath: 'k' });
  };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = (st, mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(st, mode), q = fn(t.objectStore(st));
  t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
});
const all = st => tx(st, 'readonly', o => o.getAll());
const put = (st, v) => tx(st, 'readwrite', o => o.put(v));
const del = (st, k) => tx(st, 'readwrite', o => o.delete(k));
async function load() {
  S.tasks = await all('tasks'); S.habits = await all('habits');
  S.done = new Set((await all('done')).map(x => x.k)); S.hlog = new Set((await all('hlog')).map(x => x.k));
}

// ---------- AÇÕES ----------
async function tog(id, d) { const k = id + '|' + d; if (S.done.has(k)) { S.done.delete(k); await del('done', k); } else { S.done.add(k); await put('done', { k }); } render(); }
async function togH(id, d) { const k = id + '|' + d; if (S.hlog.has(k)) { S.hlog.delete(k); await del('hlog', k); } else { S.hlog.add(k); await put('hlog', { k }); } render(); }
function T(k) { tab = k; if (k === 'h') sel = today(); render(); }
function pick(d) { sel = d; render(); }
function go(n) { sel = add(sel, n); render(); }
function gm(n) { const [y, m] = mo.split('-').map(Number), x = new Date(y, m - 1 + n, 1); mo = `${x.getFullYear()}-${p2(x.getMonth() + 1)}`; render(); }
function modal(h) { const m = $('md'); m.innerHTML = h; m.className = h ? 'open' : ''; }
const chip = (t, on, f) => `<button class="chip${on ? ' on' : ''}" onclick="${f}">${t}</button>`;

// ---------- TELAS ----------
function list(s) {
  const L = S.tasks.filter(t => occ(t, s)).sort((a, b) => a.time.localeCompare(b.time));
  const n = L.filter(t => S.done.has(t.id + '|' + s)).length;
  return `<div class="sub">${n} de ${L.length} concluídas</div><div class="bar"><i style="width:${L.length ? n / L.length * 100 : 0}%"></i></div>` +
    (L.length ? '' : '<p class="mut">Nenhuma tarefa neste dia.</p>') +
    L.map(t => { const d = S.done.has(t.id + '|' + s); return `<div class="row"><button class="ck${d ? ' on' : ''}" onclick="tog(${t.id},'${s}')" aria-label="Concluir">${d ? '✓' : ''}</button><div class="tx" onclick="editT(${t.id})"><div class="ti${d ? ' dn' : ''}">${esc(t.title)}</div>${t.descr ? `<div class="mut ell">${esc(t.descr)}</div>` : ''}<div class="mut meta">${t.time}<span class="dot" style="background:${CATS[t.cat]}"></span>${t.cat}${t.rep ? ' · repete' : ''}</div></div>${t.prio == 2 ? '<span class="fl">⚑</span>' : ''}</div>`; }).join('');
}
function view() {
  const td = today();
  if (tab === 'h') { const d = pd(td); return `<h2>${DN[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}</h2>` + list(td); }
  if (tab === 's') {
    const w = Array.from({ length: 7 }, (_, i) => add(sel, i - (pd(sel).getDay() + 6) % 7));
    return `<div class="nav"><button onclick="go(-7)">‹</button><h2>${pd(w[0]).getDate()} a ${pd(w[6]).getDate()} de ${MES[pd(w[6]).getMonth()]}</h2><button onclick="go(7)">›</button></div><div class="strip">` +
      w.map(d => `<div onclick="pick('${d}')"><span class="mut">${DN[pd(d).getDay()]}</span><b class="cir${d === sel ? ' on' : ''}">${pd(d).getDate()}</b><span class="dots">${S.tasks.filter(t => occ(t, d)).slice(0, 3).map(t => `<i class="dot" style="background:${CATS[t.cat]}"></i>`).join('')}</span></div>`).join('') + '</div>' + list(sel);
  }
  if (tab === 'm') {
    const [y, m] = mo.split('-').map(Number), off = (new Date(y, m - 1, 1).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate();
    let c = ''; for (let i = 0; i < off; i++) c += '<div></div>';
    for (let i = 1; i <= nd; i++) { const d = `${y}-${p2(m)}-${p2(i)}`; c += `<div onclick="pick('${d}')"><b class="cir${d === sel ? ' on' : d === td ? ' td' : ''}">${i}</b><span class="dots">${S.tasks.some(t => occ(t, d)) ? '<i class="dot" style="background:var(--ac)"></i>' : ''}</span></div>`; }
    return `<div class="nav"><button onclick="gm(-1)">‹</button><h2>${MES[m - 1]} de ${y}</h2><button onclick="gm(1)">›</button></div><div class="grid mut">${'STQQSSD'.split('').map(x => `<span>${x}</span>`).join('')}</div><div class="grid">${c}</div><h3>${sel.slice(8)}/${sel.slice(5, 7)}</h3>` + list(sel);
  }
  const l7 = Array.from({ length: 7 }, (_, i) => add(td, i - 6));
  return '<h2>Hábitos</h2><div class="sub">Últimos 7 dias. Toque em um círculo para marcar.</div>' + (S.habits.length ? '' : '<p class="mut">Nenhum hábito ainda.</p>') +
    S.habits.map(h => {
      let d = S.hlog.has(h.id + '|' + td) ? td : add(td, -1), n = 0; while (S.hlog.has(h.id + '|' + d)) { n++; d = add(d, -1); }
      return `<div class="hr"><div class="bt"><span class="ti">${esc(h.name)}${h.time ? ' · ' + h.time : ''}</span><span class="mut">Sequência: ${n} ${n === 1 ? 'dia' : 'dias'}</span></div><div class="hc">` +
        l7.map(x => `<div onclick="togH(${h.id},'${x}')"><i class="hd${S.hlog.has(h.id + '|' + x) ? ' on' : ''}"></i>${DN[pd(x).getDay()]}</div>`).join('') +
        `<span class="mut" style="margin-left:auto">${l7.filter(x => S.hlog.has(h.id + '|' + x)).length} de 7</span></div><button class="lk red" onclick="delH(${h.id})">Excluir hábito</button></div>`;
    }).join('') + '<button class="pri" onclick="newH()">+ Novo hábito</button>';
}
function render() {
  $('v').innerHTML = view();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  $('fab').style.display = tab === 'b' ? 'none' : 'flex';
  $('warn').style.display = S.tasks.length && (!localStorage.lb || Date.now() - localStorage.lb > 12096e5) ? 'block' : 'none';
}

// ---------- TAREFAS ----------
function editT(id) {
  const t = S.tasks.find(x => x.id === id);
  ed = t ? { ...t } : { id: null, title: '', descr: '', date: tab === 'h' ? today() : sel, time: '08:00', cat: 'Pessoal', prio: 0, rep: '', rem: 0 };
  drawT();
}
function sync() { ed.title = $('f_t').value; ed.descr = $('f_d').value; ed.date = $('f_da').value; ed.time = $('f_ti').value; }
function setE(k, v) { sync(); ed[k] = v; drawT(); }
function dayE(d) { sync(); const s = new Set(ed.rep ? ed.rep.split(',') : []); s.has(String(d)) ? s.delete(String(d)) : s.add(String(d)); ed.rep = [...s].sort().join(','); drawT(); }
function drawT() {
  const e = ed;
  modal(`<div class="sheet"><h2>${e.id ? 'Editar tarefa' : 'Nova tarefa'}</h2>
<label>Título</label><input id="f_t" value="${esc(e.title)}">
<label>Descrição</label><textarea id="f_d" rows="3">${esc(e.descr)}</textarea>
<div class="two"><div><label>Data</label><input id="f_da" type="date" value="${e.date}"></div><div><label>Horário</label><input id="f_ti" type="time" value="${e.time}"></div></div>
<label>Lembrete (enviado ao Calendário)</label><div class="chips">${REMS.map(([v, n]) => chip(n, e.rem === v, `setE('rem',${v})`)).join('')}</div>
<label>Categoria</label><div class="chips">${Object.keys(CATS).map(c => chip(c, e.cat === c, `setE('cat','${c}')`)).join('')}</div>
<label>Prioridade</label><div class="chips">${['Baixa', 'Média', 'Alta'].map((n, i) => chip(n, e.prio === i, `setE('prio',${i})`)).join('')}</div>
<label>Repetir nos dias (vazio = só na data)</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => chip(DN[d], e.rep.split(',').includes(String(d)), `dayE(${d})`)).join('')}</div>
<div class="act"><button class="lk" onclick="modal('')">Cancelar</button>${e.id ? '<button class="lk red" onclick="delT()">Excluir</button>' : ''}<button class="pri" onclick="saveT()">Salvar</button></div>
${e.rem >= 0 ? '<div class="act"><button class="lk" onclick="saveT(true)">Salvar e adicionar ao Calendário</button></div>' : ''}</div>`);
}
async function saveT(cal) {
  sync(); const e = ed;
  if (!e.title.trim()) return alert('Informe o título');
  if (!e.date || !e.time) return alert('Informe a data e o horário');
  e.title = e.title.trim(); if (e.id == null) delete e.id;
  e.id = await put('tasks', e);
  const i = S.tasks.findIndex(x => x.id === e.id); i < 0 ? S.tasks.push(e) : (S.tasks[i] = e);
  modal(''); render(); if (cal) ics([e]);
}
async function delT() {
  if (!confirm('Excluir esta tarefa?')) return;
  const id = ed.id; await del('tasks', id); S.tasks = S.tasks.filter(t => t.id !== id);
  for (const k of [...S.done]) if (k.startsWith(id + '|')) { S.done.delete(k); await del('done', k); }
  modal(''); render();
}

// ---------- HÁBITOS ----------
function newH() { modal(`<div class="sheet"><h2>Novo hábito</h2><label>Nome</label><input id="h_n"><label>Horário sugerido (opcional, usado nos lembretes do Calendário)</label><input id="h_t" type="time"><div class="act"><button class="lk" onclick="modal('')">Cancelar</button><button class="pri" onclick="saveH()">Salvar</button></div></div>`); }
async function saveH() {
  const n = $('h_n').value.trim(); if (!n) return alert('Informe o nome');
  const h = { name: n, time: $('h_t').value }; h.id = await put('habits', h); S.habits.push(h); modal(''); render();
}
async function delH(id) {
  if (!confirm('Excluir este hábito e o histórico dele?')) return;
  await del('habits', id); S.habits = S.habits.filter(h => h.id !== id);
  for (const k of [...S.hlog]) if (k.startsWith(id + '|')) { S.hlog.delete(k); await del('hlog', k); }
  render();
}

// ---------- BACKUP E CALENDÁRIO ----------
async function save(name, type, text) {
  const f = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return true; } catch (e) { if (e.name === 'AbortError') return false; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = name; a.click(); return true;
}
function bkp() {
  modal(`<div class="sheet"><h2>Backup e lembretes</h2><p class="sub">Último backup: ${localStorage.lb ? new Date(+localStorage.lb).toLocaleDateString('pt-BR') : 'nunca'}</p>
<button class="pri" onclick="exp()">Exportar backup</button>
<label>Restaurar backup (substitui os dados atuais)</label><input type="file" accept=".json,application/json" onchange="imp(this)">
<label>Lembretes</label><button class="pri" style="margin-top:0" onclick="ics(S.tasks,true)">Enviar todos os lembretes ao Calendário</button>
<div class="act"><button class="lk" onclick="modal('')">Fechar</button></div></div>`);
}
async function exp() {
  const j = JSON.stringify({ v: 1, tasks: S.tasks, habits: S.habits, done: [...S.done], hlog: [...S.hlog] });
  if (await save('planejador-backup-' + today() + '.json', 'application/json', j)) { localStorage.lb = Date.now(); bkp(); render(); }
}
async function imp(el) {
  const f = el.files[0]; if (!f) return;
  try {
    const b = JSON.parse(await f.text()); if (!Array.isArray(b.tasks) || !Array.isArray(b.habits)) throw 0;
    if (!confirm('Substituir todos os dados atuais pelo backup?')) return;
    for (const st of ['tasks', 'habits', 'done', 'hlog']) await tx(st, 'readwrite', o => o.clear());
    for (const t of b.tasks) await put('tasks', t); for (const h of b.habits) await put('habits', h);
    for (const k of b.done || []) await put('done', { k }); for (const k of b.hlog || []) await put('hlog', { k });
    await load(); modal(''); render(); alert('Backup restaurado');
  } catch (e) { alert('Arquivo de backup inválido'); }
}
function ics(L, all) {
  const z = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  const q = s => String(s || '').replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
  const alarm = (m, t) => m >= 0 ? `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${q(t)}\r\nTRIGGER:${m ? '-PT' + m + 'M' : 'PT0S'}\r\nEND:VALARM\r\n` : '';
  const ev = (uid, s, title, descr, rule, m) => `BEGIN:VEVENT\r\nUID:${uid}@planejador\r\nDTSTAMP:${z(new Date())}\r\nDTSTART:${z(s)}\r\nDTEND:${z(new Date(+s + 18e5))}\r\nSUMMARY:${q(title)}\r\nDESCRIPTION:${q(descr)}\r\n${rule}${alarm(m, title)}END:VEVENT\r\n`;
  let out = '';
  for (const t of L) { if (all && t.rem < 0) continue; out += ev('t' + t.id, new Date(t.date + 'T' + t.time + ':00'), t.title, t.descr, t.rep ? 'RRULE:FREQ=WEEKLY;BYDAY=' + t.rep.split(',').map(d => ICSD[d]).join(',') + '\r\n' : '', t.rem); }
  if (all) for (const h of S.habits) if (h.time) out += ev('h' + h.id, new Date(today() + 'T' + h.time + ':00'), 'Hábito: ' + h.name, '', 'RRULE:FREQ=DAILY\r\n', 0);
  if (!out) return alert('Nenhuma tarefa com lembrete para enviar');
  save('planejador-lembretes.ics', 'text/calendar', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Planejador//PT\r\nCALSCALE:GREGORIAN\r\n' + out + 'END:VCALENDAR\r\n');
}

// ---------- INÍCIO ----------
(async () => {
  try { db = await openDB(); await load(); } catch (e) { $('v').innerHTML = '<p>Não foi possível abrir o banco de dados neste navegador.</p>'; return; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  render();
})();
