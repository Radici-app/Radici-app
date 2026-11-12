/* Radici – dashboard del titolare */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SALONE = 'radici';
const fbApp = initializeApp({ apiKey: 'AIzaSyCUhd6pXSheUQ6gPhT5OfvprM5dYI2uxz4', authDomain: 'radici-app.firebaseapp.com', projectId: 'radici-app', storageBucket: 'radici-app.firebasestorage.app', messagingSenderId: '602201707324', appId: '1:602201707324:web:88d8681280de279b81c439' });
const auth = getAuth(fbApp), db = getFirestore(fbApp);
const SAL = doc(db, 'saloni', SALONE), colP = collection(db, 'saloni', SALONE, 'prenotazioni'), colB = collection(db, 'saloni', SALONE, 'busy'), colC = collection(db, 'saloni', SALONE, 'clienti');

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const hm = m => p2(Math.floor(m / 60)) + ':' + p2(m % 60);
const daHm = s => { const [h, m] = String(s).split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const fd = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 : '');
const cp = o => JSON.parse(JSON.stringify(o));
const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const dataLunga = k => new Date(k + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'], ORD = [1, 2, 3, 4, 5, 6, 0];
const ICONE = ['forbici', 'phon', 'rasoio', 'barba', 'spa', 'pennello', 'viso', 'mani', 'piedi', 'smalto', 'ciglia', 'cuore'];
const iniz = n => String(n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const avatar = s => `<span class="av">${s && s.foto ? `<img src="${esc(s.foto)}" alt="">` : esc(iniz(s && s.nome))}</span>`;
function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2500); }
function finestra(html) { $('modIn').innerHTML = html; $('mod').hidden = false; window.riempiIcone($('modIn')); }
const chiudi = () => { $('mod').hidden = true; };
$('mod').addEventListener('click', e => { if (e.target.id === 'mod') chiudi(); });
function conferma(t, p, ok = 'Sì', no = 'No') { return new Promise(r => { finestra(`<h3>${esc(t)}</h3><p class="hint">${esc(p || '')}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt" id="cNo">${esc(no)}</button><button class="bt pri" id="cOk">${esc(ok)}</button></div>`); $('cOk').onclick = () => { chiudi(); r(true); }; $('cNo').onclick = () => { chiudi(); r(false); }; }); }
const numWa = t => { const d = String(t).replace(/\D/g, ''); return String(t).trim().startsWith('+') || d.startsWith('39') && d.length > 10 ? d : '39' + d; };

/* ---------- stato ---------- */
let C = cp(window.RADICI_SEED), D = null, sporco = false, P = [], CL = [], vista = 'agenda', giorno = iso(new Date()), filtroCl = '', soloRitardatari = false;
const unsub = [];

/* ---------- accesso ---------- */
onAuthStateChanged(auth, async u => {
  unsub.splice(0).forEach(f => f());
  $('attesa').hidden = true;
  let ok = false;
  if (u) { try { ok = (await getDoc(doc(db, 'saloni', SALONE, 'admin', u.uid))).exists(); } catch (e) {} }
  if (u && !ok) { $('lErr').textContent = 'Questo account non ha accesso alla gestione di ' + C.nome + '.'; await signOut(auth); return; }
  $('login').hidden = !!u; $('app').hidden = !u;
  if (!u) return;
  unsub.push(onSnapshot(SAL, s => { C = Object.assign(cp(window.RADICI_SEED), s.exists() ? window.fasceDaDb(s.data()) : {}); $('sNome').textContent = C.nome; if (!sporco) { D = cp(C); render(); } }));
  unsub.push(onSnapshot(colP, s => { P = s.docs.map(d => d.data()); if (['agenda', 'clienti'].includes(vista) && $('mod').hidden) render(); }));
  unsub.push(onSnapshot(colC, s => { CL = s.docs.map(d => Object.assign({ uid: d.id }, d.data())); if (vista === 'clienti') render(); }));
});
$('lIn').onclick = async () => { $('lErr').textContent = ''; try { await signInWithEmailAndPassword(auth, $('lMail').value.trim(), $('lPass').value); } catch (e) { $('lErr').textContent = e.code === 'auth/too-many-requests' ? 'Troppi tentativi, riprova più tardi.' : 'Email o password non corretti.'; } };
$('lPass').onkeydown = e => { if (e.key === 'Enter') $('lIn').click(); };
$('esci').onclick = () => signOut(auth);

/* ---------- navigazione ---------- */
const TITOLI = { agenda: 'Agenda', clienti: 'Clienti', servizi: 'Servizi', orari: 'Orari', chiusure: 'Giorni di chiusura', staff: 'Staff', negozio: 'Negozio', regole: 'Regole di prenotazione' };
const IMPOSTAZIONI = ['servizi', 'orari', 'chiusure', 'staff', 'negozio', 'regole'];
$('nav').querySelectorAll('[data-v]').forEach(b => b.onclick = async () => {
  if (sporco && !await conferma('Modifiche non salvate', 'Vuoi uscire senza salvare?', 'Esci senza salvare', 'Resta')) return;
  sporco = false; D = cp(C); vista = b.dataset.v; $('side').classList.remove('open'); render(); scrollTo(0, 0);
});
$('menuBtn').onclick = () => $('side').classList.toggle('open');
$('side').addEventListener('click', e => { if (e.target.id === 'side') $('side').classList.remove('open'); });
addEventListener('beforeunload', e => { if (sporco) { e.preventDefault(); e.returnValue = ''; } });

function render() {
  if (!D) D = cp(C);
  $('titolo').textContent = TITOLI[vista];
  $('nav').querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-current', b.dataset.v === vista));
  $('azioni').innerHTML = '';
  ({ agenda: vAgenda, clienti: vClienti, servizi: vServizi, orari: vOrari, chiusure: vChiusure, staff: vStaff, negozio: vNegozio, regole: vRegole })[vista]();
  if (IMPOSTAZIONI.includes(vista)) $('vista').insertAdjacentHTML('beforeend', `<div class="salva"><span id="stato">${sporco ? 'Modifiche non salvate' : ''}</span><button class="bt" id="annulla">Annulla modifiche</button><button class="bt pri" id="salva">Salva</button></div>`);
  window.riempiIcone($('vista'));
  if ($('salva')) { $('salva').onclick = salva; $('annulla').onclick = () => { D = cp(C); sporco = false; render(); }; }
}
const segna = () => { sporco = true; if ($('stato')) $('stato').textContent = 'Modifiche non salvate'; };
async function salva() {
  const er = valida(D); if (er) { toast(er); return; }
  $('salva').disabled = true;
  try { D.agg = Date.now(); await setDoc(SAL, window.fasceVersoDb(D)); sporco = false; C = cp(D); toast('Salvato ✓'); render(); }
  catch (e) { console.error(e); toast(e.code === 'permission-denied' ? 'Permesso negato: controlla le regole di Firebase e l’accesso admin.' : 'Salvataggio non riuscito (' + (e.code || e.message || 'errore') + ').'); $('salva').disabled = false; }
}
function valida(d) {
  for (const g of ORD) for (const f of d.orari[g] || []) if (!(f[1] > f[0])) return GIORNI[g] + ': l’orario di chiusura deve essere dopo l’apertura.';
  for (const s of d.servizi) { if (!s.nome.trim()) return 'Ogni servizio deve avere un nome.'; if (!(s.durata >= 5)) return '“' + s.nome + '”: durata di almeno 5 minuti.'; }
  for (const c of d.chiusure) if (!c.da || !c.a || c.a < c.da) return 'Controlla le date delle chiusure.';
  if (!d.staff.length) return 'Serve almeno un operatore.';
  return '';
}
/* input generici: data-k="percorso.nel.oggetto" e data-n per i numeri */
function leggi(radice) {
  radice.querySelectorAll('[data-k]').forEach(el => el.oninput = el.onchange = () => {
    const parti = el.dataset.k.split('.'); let o = D; parti.slice(0, -1).forEach(k => o = o[k]);
    o[parti.at(-1)] = el.type === 'checkbox' ? el.checked : el.dataset.n !== undefined ? Number(el.value) : el.value; segna();
  });
}

/* ---------- AGENDA ---------- */
const attive = () => P.filter(b => b.stato !== 'annullata');
function vAgenda() {
  $('azioni').innerHTML = '<button class="bt pri" id="nuovo">+ Nuovo appuntamento</button>';
  $('nuovo').onclick = () => nuovo();
  const L = attive().filter(b => b.data === giorno), inc = L.reduce((a, b) => a + (parseFloat(String(b.prezzo).replace(/[^\d.,]/g, '').replace(',', '.')) || 0), 0);
  const settimana = new Date(giorno + 'T12:00'); const fine = new Date(settimana); fine.setDate(fine.getDate() + 6);
  const sett = attive().filter(b => b.data >= giorno && b.data <= iso(fine)).length;
  const oggiK = iso(new Date()), nuove = P.filter(b => b.creata > Date.now() - 864e5 && b.uid !== 'manuale').length;
  const f = C.eccezioni.find(e => e.data === giorno)?.fasce || (C.chiusure.find(c => giorno >= c.da && giorno <= c.a) ? [] : C.orari[new Date(giorno + 'T12:00').getDay()] || []);
  const ini = Math.min(480, ...f.map(x => x[0]), ...L.map(b => b.ini)), fin = Math.max(1200, ...f.map(x => x[1]), ...L.map(b => b.fine)), px = 1.3;
  const h = (fin - ini) * px;
  let g = `<div class="hd" style="width:60px"></div>` + C.staff.map(s => `<div class="hd">${esc(s.nome)}</div>`).join('');
  let ore = ''; for (let m = Math.ceil(ini / 60) * 60; m < fin; m += 60) ore += `<span style="top:${(m - ini) * px}px">${hm(m)}</span>`;
  g += `<div class="ore" style="height:${h}px">${ore}</div>`;
  C.staff.forEach(s => {
    let chiusi = ''; let pos = ini; [...f].sort((a, b) => a[0] - b[0]).forEach(x => { if (x[0] > pos) chiusi += `<div class="chiuso" style="position:absolute;left:0;right:0;top:${(pos - ini) * px}px;height:${(x[0] - pos) * px}px"></div>`; pos = Math.max(pos, x[1]); }); if (pos < fin) chiusi += `<div class="chiuso" style="position:absolute;left:0;right:0;top:${(pos - ini) * px}px;height:${(fin - pos) * px}px"></div>`;
    const ev = L.filter(b => b.staff === s.id).map(b => `<button class="ev${b.uid === 'manuale' ? ' man' : ''}" data-b="${b.id}" style="top:${(b.ini - ini) * px}px;height:${Math.max(22, b.dur * px - 2)}px"><b>${hm(b.ini)} ${esc(b.nome)} ${esc(b.cogn || '')}</b><small>${esc(b.servizi.map(x => x.nome).join(', '))}</small></button>`).join('');
    g += `<div class="col" style="height:${h}px;background-size:100% ${60 * px}px;background-position:0 ${((Math.ceil(ini / 60) * 60) - ini) * px}px">${chiusi}${ev}</div>`;
  });
  $('vista').innerHTML = `<div class="stat"><div><b>${L.length}</b><span>appuntamenti ${giorno === oggiK ? 'oggi' : 'nel giorno'}</span></div><div><b>${Math.round(inc)} €</b><span>incasso previsto</span></div><div><b>${sett}</b><span>nei prossimi 7 giorni</span></div><div><b>${nuove}</b><span>prenotate online nelle ultime 24 h</span></div></div>
   <div class="bar" style="margin-bottom:10px"><button class="bt" id="gPrev">‹</button><input type="date" id="gData" value="${giorno}" style="width:auto"><button class="bt" id="gNext">›</button><button class="bt" id="gOggi">Oggi</button><b style="text-transform:capitalize">${esc(dataLunga(giorno))}</b></div>
   ${f.length ? '' : '<p class="hint">Salone chiuso in questo giorno.</p>'}
   <div class="ag" style="grid-template-columns:60px repeat(${C.staff.length},minmax(140px,1fr))">${g}</div>`;
  const sposta = n => { const d = new Date(giorno + 'T12:00'); d.setDate(d.getDate() + n); giorno = iso(d); render(); };
  $('gPrev').onclick = () => sposta(-1); $('gNext').onclick = () => sposta(1); $('gOggi').onclick = () => { giorno = iso(new Date()); render(); };
  $('gData').onchange = e => { if (e.target.value) { giorno = e.target.value; render(); } };
  $('vista').querySelectorAll('[data-b]').forEach(b => b.onclick = () => dettaglio(P.find(x => x.id === b.dataset.b)));
}
function dettaglio(b) {
  if (!b) return;
  const st = C.staff.find(s => s.id === b.staff) || { nome: b.staffNome };
  finestra(`<h3>${esc(b.nome)} ${esc(b.cogn || '')}</h3>
   <p class="hint" style="text-transform:capitalize">${esc(dataLunga(b.data))}, ${hm(b.ini)}–${hm(b.fine)} · ${esc(st.nome)}</p>
   <div class="card" style="box-shadow:none">${b.servizi.map(s => `<div class="li"><div class="t"><b>${esc(s.nome)}</b><small>${fd(s.durata)}</small></div><b>${esc(s.prezzo)}</b></div>`).join('')}<div class="li"><div class="t"><b>Totale</b></div><b>${esc(b.prezzo)}</b></div></div>
   ${b.note ? `<p><b>Note:</b> ${esc(b.note)}</p>` : ''}
   ${b.tel ? `<p>${esc(b.tel)} · <a href="tel:${esc(b.tel.replace(/[^\d+]/g, ''))}">Chiama</a> · <a target="_blank" rel="noopener" href="https://wa.me/${numWa(b.tel)}">WhatsApp</a></p>` : ''}
   <p class="hint">${b.uid === 'manuale' ? 'Inserito dalla gestione' : 'Prenotato online il ' + new Date(b.creata).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
   <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="bt" id="dX">Chiudi</button><button class="bt no" id="dAnn">Annulla appuntamento</button></div>`);
  $('dX').onclick = chiudi;
  $('dAnn').onclick = async () => {
    if (!await conferma('Annullare l’appuntamento?', b.nome + ' – ' + dataLunga(b.data) + ' ' + hm(b.ini), 'Sì, annulla')) return;
    try { const w = writeBatch(db); w.update(doc(colP, b.id), { stato: 'annullata', annullataIl: Date.now(), annullataDa: 'salone' }); w.delete(doc(colB, b.id)); await w.commit(); toast('Appuntamento annullato'); }
    catch (e) { toast('Non riuscito. Riprova.'); }
  };
}
function nuovo() {
  const vis = C.servizi.filter(s => s.visibile !== false);
  finestra(`<h3>Nuovo appuntamento</h3>
   <div class="grid2"><label>Nome<input id="nNome"></label><label>Cognome<input id="nCogn"></label></div>
   <label style="margin-top:10px">Telefono<input id="nTel" type="tel"></label>
   <p class="hint" style="margin:12px 0 4px">Servizi</p><div class="svl">${C.categorie.map(c => { const l = vis.filter(s => s.cat === c.id); return l.length ? `<b style="display:block;margin-top:6px">${esc(c.nome)}</b>` + l.map(s => `<label><input type="checkbox" value="${s.id}">${esc(s.nome)} <small style="color:var(--mute)">· ${fd(s.durata)}</small></label>`).join('') : ''; }).join('')}</div>
   <div class="grid3" style="margin-top:10px"><label>Operatore<select id="nSt">${C.staff.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select></label><label>Giorno<input type="date" id="nData" value="${giorno}"></label><label>Ora<input type="time" id="nOra" step="300" value="09:00"></label></div>
   <label style="margin-top:10px">Note<input id="nNote"></label>
   <p class="err" id="nErr"></p>
   <div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt" id="nNo">Annulla</button><button class="bt pri" id="nOk">Salva</button></div>`);
  $('nNo').onclick = chiudi;
  $('nOk').onclick = async () => {
    const ids = [...$('modIn').querySelectorAll('.svl input:checked')].map(x => x.value), sv = ids.map(id => C.servizi.find(s => s.id === id));
    const nome = $('nNome').value.trim(), data = $('nData').value, ini = daHm($('nOra').value), st = C.staff.find(s => s.id === $('nSt').value);
    if (!nome) return $('nErr').textContent = 'Inserisci il nome.'; if (!sv.length) return $('nErr').textContent = 'Scegli almeno un servizio.'; if (!data || ini == null) return $('nErr').textContent = 'Scegli giorno e ora.';
    const dur = sv.reduce((a, s) => a + (+s.durata || 0), 0), fine = ini + dur;
    const sovr = attive().find(b => b.data === data && b.staff === st.id && ini < b.fine && b.ini < fine);
    if (sovr && !await conferma('Orario occupato', st.nome + ' ha già ' + sovr.nome + ' alle ' + hm(sovr.ini) + '. Inserire comunque?', 'Inserisci comunque', 'No')) return;
    const id = nid('m'), tot = sv.reduce((a, s) => a + (parseFloat(String(s.prezzo).replace(/[^\d.,]/g, '').replace(',', '.')) || 0), 0);
    const rec = { id, uid: 'manuale', nome, cogn: $('nCogn').value.trim(), tel: $('nTel').value.trim(), mail: '', note: $('nNote').value.trim(), data, ini, fine, dur, staff: st.id, staffNome: st.nome, servizi: sv.map(s => ({ id: s.id, nome: s.nome, prezzo: s.prezzo, durata: s.durata })), prezzo: tot + ' €', stato: 'ok', creata: Date.now() };
    try { const w = writeBatch(db); w.set(doc(colP, id), rec); w.set(doc(colB, id), { data, ini, fine, staff: st.id }); await w.commit(); chiudi(); giorno = data; toast('Appuntamento salvato'); render(); }
    catch (e) { $('nErr').textContent = 'Salvataggio non riuscito.'; }
  };
}

/* ---------- CLIENTI e ritardatari ---------- */
function vClienti() {
  const per = {}; P.filter(b => b.stato !== 'annullata').forEach(b => { const k = b.uid !== 'manuale' ? b.uid : 'm:' + (b.tel || b.nome).toLowerCase(); (per[k] = per[k] || []).push(b); });
  const oggiK = iso(new Date());
  let L = Object.entries(per).map(([k, bs]) => { const c = CL.find(x => x.uid === k) || {}; const pass = bs.filter(b => b.data <= oggiK).sort((a, b) => b.data.localeCompare(a.data)); const b0 = bs[0];
    return { foto: c.foto || '', nome: ((c.nome || b0.nome) + ' ' + (c.cogn || b0.cogn || '')).trim(), tel: c.tel || b0.tel, visite: pass.length, ultima: pass[0] ? pass[0].data : '', prossima: bs.filter(b => b.data > oggiK).map(b => b.data).sort()[0] || '' }; });
  CL.forEach(c => { if (!per[c.uid]) L.push({ foto: c.foto || '', nome: (c.nome + ' ' + (c.cogn || '')).trim(), tel: c.tel, visite: 0, ultima: '', prossima: '' }); });
  const giorniDa = k => k ? Math.round((Date.now() - new Date(k + 'T12:00')) / 864e5) : 9999;
  if (soloRitardatari) L = L.filter(x => !x.prossima && x.ultima && giorniDa(x.ultima) >= (C.regole.ritardoGiorni || 45)).sort((a, b) => a.ultima.localeCompare(b.ultima));
  else L.sort((a, b) => a.nome.localeCompare(b.nome));
  if (filtroCl) L = L.filter(x => (x.nome + ' ' + x.tel).toLowerCase().includes(filtroCl.toLowerCase()));
  $('vista').innerHTML = `<div class="bar"><input id="cQ" placeholder="Cerca per nome o telefono" value="${esc(filtroCl)}" style="max-width:320px"><label class="chk"><input type="checkbox" id="cR" ${soloRitardatari ? 'checked' : ''}>Solo chi non viene da ${C.regole.ritardoGiorni || 45} giorni</label></div>
   <div class="card">${L.length ? L.map(x => `<div class="li">${avatar(x)}<div class="t"><b>${esc(x.nome)}</b><small>${x.visite} visite · ultima: ${x.ultima ? esc(dataLunga(x.ultima)) : '—'}${x.prossima ? ' · prossima: ' + esc(dataLunga(x.prossima)) : ''}</small></div>${x.tel ? `<a class="bt sm" href="tel:${esc(String(x.tel).replace(/[^\d+]/g, ''))}">Chiama</a><a class="bt sm" target="_blank" rel="noopener" href="https://wa.me/${numWa(x.tel)}${soloRitardatari ? '?text=' + encodeURIComponent('Ciao ' + x.nome.split(' ')[0] + ', è da un po’ che non ci vediamo! Ti va di prenotare il prossimo appuntamento da ' + C.nome + '?') : ''}">WhatsApp</a>` : ''}</div>`).join('') : '<p class="hint" style="margin:0">Nessun cliente.</p>'}</div>`;
  $('cQ').oninput = e => { filtroCl = e.target.value; const pos = e.target.selectionStart; render(); $('cQ').focus(); $('cQ').setSelectionRange(pos, pos); };
  $('cR').onchange = e => { soloRitardatari = e.target.checked; render(); };
}

/* ---------- SERVIZI ---------- */
function vServizi() {
  $('vista').innerHTML = `<p class="hint">Tipo di categoria: <b>base</b> (si prenota da sola), <b>aggiuntivo</b> (solo insieme a un servizio base o a una combo), <b>combo</b> (una sola per prenotazione). Il prezzo è testo libero: “20 €”, “a partire da 10 €”…</p>` +
   D.categorie.map((c, ci) => `<div class="cat"><div class="cath"><svg data-i="${esc(c.icona)}"></svg><input data-k="categorie.${ci}.nome" value="${esc(c.nome)}">
     <select data-k="categorie.${ci}.tipo">${['base', 'aggiuntivo', 'combo'].map(t => `<option ${c.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
     <select data-k="categorie.${ci}.icona">${ICONE.map(t => `<option ${c.icona === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
     <button class="ib" data-c="su" data-i2="${ci}">↑</button><button class="ib" data-c="giu" data-i2="${ci}">↓</button><button class="ib no" data-c="del" data-i2="${ci}">✕</button></div>
     ${D.servizi.map((s, si) => s.cat !== c.id ? '' : `<div class="srow${s.visibile === false ? ' nas' : ''}"><svg data-i="${esc(s.icona)}"></svg><input data-k="servizi.${si}.nome" value="${esc(s.nome)}" aria-label="Nome"><input data-k="servizi.${si}.prezzo" value="${esc(s.prezzo)}" aria-label="Prezzo"><input data-k="servizi.${si}.durata" data-n type="number" min="5" step="5" value="${s.durata}" aria-label="Minuti">
       <div class="az"><select data-k="servizi.${si}.icona" style="width:auto;padding:6px">${ICONE.map(t => `<option ${s.icona === t ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="ib" data-s="vis" data-i2="${si}" title="Visibile ai clienti">${s.visibile === false ? '◌' : '👁'}</button><button class="ib" data-s="su" data-i2="${si}">↑</button><button class="ib" data-s="giu" data-i2="${si}">↓</button><button class="ib no" data-s="del" data-i2="${si}">✕</button></div>
       <input class="descr" data-k="servizi.${si}.descr" value="${esc(s.descr || '')}" placeholder="Descrizione (facoltativa)"></div>`).join('')}
     <div style="padding:10px 14px"><button class="bt sm" data-c="add" data-i2="${ci}">+ Servizio</button></div></div>`).join('') +
   '<button class="bt" id="addCat">+ Nuova categoria</button>';
  leggi($('vista'));
  const sw = (a, i, j) => { if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; };
  $('vista').querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { const i = +b.dataset.i2, c = D.categorie[i];
    if (b.dataset.c === 'su') sw(D.categorie, i, i - 1); else if (b.dataset.c === 'giu') sw(D.categorie, i, i + 1);
    else if (b.dataset.c === 'add') D.servizi.push({ id: nid('v'), cat: c.id, nome: 'Nuovo servizio', prezzo: '0 €', durata: 30, icona: c.icona, descr: '', visibile: true });
    else if (b.dataset.c === 'del') { if (!await conferma('Eliminare la categoria?', '“' + c.nome + '” e tutti i suoi servizi.', 'Elimina')) return; D.servizi = D.servizi.filter(s => s.cat !== c.id); D.categorie.splice(i, 1); }
    segna(); render(); });
  $('vista').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const i = +b.dataset.i2, s = D.servizi[i];
    const vic = d => { for (let j = i + d; j >= 0 && j < D.servizi.length; j += d) if (D.servizi[j].cat === s.cat) return j; return -1; };
    if (b.dataset.s === 'vis') s.visibile = s.visibile === false; else if (b.dataset.s === 'su') sw(D.servizi, i, vic(-1)); else if (b.dataset.s === 'giu') sw(D.servizi, i, vic(1)); else if (b.dataset.s === 'del') D.servizi.splice(i, 1);
    segna(); render(); });
  $('addCat').onclick = () => { D.categorie.push({ id: nid('c'), nome: 'Nuova categoria', icona: 'forbici', tipo: 'base' }); segna(); render(); };
}

/* ---------- ORARI ---------- */
function fasceHtml(arr, base) { return arr.map((f, i) => `<span class="fa"><input type="time" step="300" value="${hm(f[0])}" data-f="${base}|${i}|0"><input type="time" step="300" value="${hm(f[1])}" data-f="${base}|${i}|1"><button class="ib no" data-fd="${base}|${i}">✕</button></span>`).join('') + `<button class="bt sm" data-fa="${base}">+ Fascia</button>`; }
function arrDi(base) { const [t, k] = base.split(':'); return t === 'g' ? (D.orari[k] = D.orari[k] || []) : D.eccezioni[+k].fasce; }
function vOrari() {
  $('vista').innerHTML = `<div class="card"><h3>Orari settimanali</h3><p class="hint">Per l’orario spezzato aggiungi una seconda fascia (es. 9:00–13:00 e 15:00–20:00). Nessuna fascia = chiuso.</p>
    ${ORD.map(g => `<div class="gg"><b>${GIORNI[g]}</b><div class="fasce">${(D.orari[g] || []).length ? '' : '<span class="hint" style="margin:0">Chiuso</span>'}${fasceHtml(D.orari[g] || [], 'g:' + g)}</div></div>`).join('')}</div>
   <div class="card"><h3>Orari eccezionali</h3><p class="hint">Un giorno con orario diverso dal solito (es. vigilia di Natale).</p>
    ${D.eccezioni.map((e, i) => `<div class="gg"><span><input type="date" value="${esc(e.data)}" data-ed="${i}"><button class="bt sm no" data-ex="${i}" style="margin-top:6px">Elimina</button></span><div class="fasce">${fasceHtml(e.fasce, 'e:' + i)}</div></div>`).join('') || '<p class="hint">Nessun orario eccezionale.</p>'}
    <button class="bt" id="addEcc">+ Aggiungi giorno</button></div>`;
  const V = $('vista');
  V.querySelectorAll('[data-f]').forEach(el => el.onchange = () => { const [b, i, j] = el.dataset.f.split('|'); const m = daHm(el.value); if (m != null) { arrDi(b)[+i][+j] = m; segna(); } });
  V.querySelectorAll('[data-fd]').forEach(el => el.onclick = () => { const [b, i] = el.dataset.fd.split('|'); arrDi(b).splice(+i, 1); segna(); render(); });
  V.querySelectorAll('[data-fa]').forEach(el => el.onclick = () => { const a = arrDi(el.dataset.fa), u = a[a.length - 1]; a.push(u ? [Math.min(u[1] + 60, 1320), Math.min(u[1] + 240, 1380)] : [540, 1140]); segna(); render(); });
  V.querySelectorAll('[data-ed]').forEach(el => el.onchange = () => { D.eccezioni[+el.dataset.ed].data = el.value; segna(); });
  V.querySelectorAll('[data-ex]').forEach(el => el.onclick = () => { D.eccezioni.splice(+el.dataset.ex, 1); segna(); render(); });
  $('addEcc').onclick = () => { D.eccezioni.push({ data: iso(new Date()), fasce: [[540, 1080]] }); segna(); render(); };
}

/* ---------- CHIUSURE ---------- */
function vChiusure() {
  $('vista').innerHTML = `<div class="card"><p class="hint">In questi giorni i clienti non possono prenotare e vedono il messaggio nelle informazioni del negozio.</p>
   ${D.chiusure.map((c, i) => `<div class="gg" style="grid-template-columns:minmax(0,1fr)"><div class="grid3"><label>Dal<input type="date" data-k="chiusure.${i}.da" value="${esc(c.da)}"></label><label>Al<input type="date" data-k="chiusure.${i}.a" value="${esc(c.a)}"></label><span style="align-self:end"><button class="bt no" data-del="${i}">Elimina</button></span></div><label style="margin-top:8px">Messaggio ai clienti (facoltativo)<input data-k="chiusure.${i}.msg" value="${esc(c.msg || '')}" placeholder="Es. Ferie estive, ci vediamo il 21 agosto!"></label></div>`).join('') || '<p class="hint">Nessuna chiusura programmata.</p>'}
   <button class="bt" id="addCh">+ Aggiungi chiusura</button></div>`;
  leggi($('vista'));
  $('vista').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { D.chiusure.splice(+b.dataset.del, 1); segna(); render(); });
  $('addCh').onclick = () => { const o = iso(new Date()); D.chiusure.push({ da: o, a: o, msg: '' }); segna(); render(); };
}

/* ---------- STAFF ---------- */
function vStaff() {
  $('vista').innerHTML = D.staff.map((s, i) => `<div class="card"><div class="li" style="border:0;padding:0 0 10px">${avatar(s)}<div class="t"><input data-k="staff.${i}.nome" value="${esc(s.nome)}" style="font-weight:700"></div><label class="bt sm" style="cursor:pointer">Foto<input type="file" accept="image/*" data-foto="${i}" hidden></label>${s.foto ? `<button class="bt sm" data-nofoto="${i}">Togli foto</button>` : ''}<button class="bt sm no" data-del="${i}">Elimina</button></div>
    <p class="hint" style="margin:0 0 6px">Servizi che esegue (nessuno selezionato = tutti)</p>
    <div class="svl">${D.categorie.map(c => { const l = D.servizi.filter(x => x.cat === c.id); return l.length ? `<b style="display:block;margin-top:6px">${esc(c.nome)}</b>` + l.map(x => `<label><input type="checkbox" data-sv="${i}|${x.id}" ${(s.servizi || []).includes(x.id) ? 'checked' : ''}>${esc(x.nome)}</label>`).join('') : ''; }).join('')}</div></div>`).join('') +
   '<button class="bt" id="addSt">+ Nuovo operatore</button><p class="hint" style="margin-top:10px">Le foto delle persone vanno pubblicate solo con il loro consenso.</p>';
  leggi($('vista'));
  const V = $('vista');
  V.querySelectorAll('[data-sv]').forEach(el => el.onchange = () => { const [i, id] = el.dataset.sv.split('|'); const s = D.staff[+i]; s.servizi = s.servizi || []; if (el.checked) s.servizi.push(id); else s.servizi = s.servizi.filter(x => x !== id); segna(); });
  V.querySelectorAll('[data-foto]').forEach(el => el.onchange = async () => { const f = el.files[0]; if (!f) return; D.staff[+el.dataset.foto].foto = await riduci(f, 240); segna(); render(); });
  V.querySelectorAll('[data-nofoto]').forEach(el => el.onclick = () => { D.staff[+el.dataset.nofoto].foto = ''; segna(); render(); });
  V.querySelectorAll('[data-del]').forEach(el => el.onclick = async () => { const s = D.staff[+el.dataset.del]; if (!await conferma('Eliminare ' + s.nome + '?', 'Gli appuntamenti già fissati restano in agenda.', 'Elimina')) return; D.staff.splice(+el.dataset.del, 1); segna(); render(); });
  $('addSt').onclick = () => { D.staff.push({ id: nid('s'), nome: 'Nuovo operatore', foto: '', servizi: [] }); segna(); render(); };
}
/* riduce una foto e la salva dentro le impostazioni (niente servizi esterni) */
function riduci(file, lato) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, lato / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .8)); }; im.onerror = ko; im.src = r.result; }; r.readAsDataURL(file); }); }

/* ---------- NEGOZIO ---------- */
function vNegozio() {
  const img = (k, t, lato) => `<div class="li"><span class="av" style="width:64px;height:64px;border-radius:14px">${D[k] ? `<img src="${esc(D[k])}" alt="">` : ''}</span><div class="t"><b>${t}</b><small>${D[k] ? 'Caricata' : 'Nessuna immagine'}</small></div><label class="bt sm" style="cursor:pointer">Carica<input type="file" accept="image/*" data-img="${k}" data-lato="${lato}" hidden></label>${D[k] ? `<button class="bt sm" data-noimg="${k}">Togli</button>` : ''}</div>`;
  $('vista').innerHTML = `<div class="card"><h3>Dati del negozio</h3><div class="grid2"><label>Nome<input data-k="nome" value="${esc(D.nome)}"></label><label>Sottotitolo<input data-k="sottotitolo" value="${esc(D.sottotitolo || '')}"></label></div>
    <label style="margin-top:10px">Descrizione<textarea data-k="descrizione">${esc(D.descrizione || '')}</textarea></label>
    <label style="margin-top:10px">Indirizzo<input data-k="indirizzo" value="${esc(D.indirizzo || '')}" placeholder="Via, numero, CAP, città"></label>
    <div class="grid3" style="margin-top:10px"><label>Telefono<input data-k="telefono" value="${esc(D.telefono || '')}"></label><label>WhatsApp<input data-k="whatsapp" value="${esc(D.whatsapp || '')}" placeholder="+39…"></label><label>Instagram<input data-k="instagram" value="${esc(D.instagram || '')}" placeholder="@nomeprofilo"></label></div></div>
   <div class="card"><h3>Immagini</h3>${img('logo', 'Logo', 300)}${img('cover', 'Foto di copertina', 1200)}</div>
   <div class="card"><h3>Testi legali</h3><p class="hint">Mostrati ai clienti nel profilo. Fatteli controllare da un professionista.</p><label>Informativa privacy<textarea data-k="privacy">${esc(D.privacy || '')}</textarea></label><label style="margin-top:10px">Termini e condizioni<textarea data-k="termini">${esc(D.termini || '')}</textarea></label></div>`;
  leggi($('vista'));
  $('vista').querySelectorAll('[data-img]').forEach(el => el.onchange = async () => { const f = el.files[0]; if (!f) return; D[el.dataset.img] = await riduci(f, +el.dataset.lato); segna(); render(); });
  $('vista').querySelectorAll('[data-noimg]').forEach(el => el.onclick = () => { D[el.dataset.noimg] = ''; segna(); render(); });
}

/* ---------- REGOLE ---------- */
function vRegole() {
  const R = D.regole; R.ritardoGiorni = R.ritardoGiorni || 45;
  const n = (k, t, h, min, max) => `<label>${t}<input type="number" data-k="regole.${k}" data-n min="${min}" max="${max}" value="${R[k]}"><small style="display:block;margin-top:4px">${h}</small></label>`;
  $('vista').innerHTML = `<div class="card"><div class="grid2">
   ${n('giorniMax', 'Giorni massimi di anticipo', 'Fino a quanti giorni avanti si può prenotare (max 180).', 1, 180)}
   ${n('maxServizi', 'Servizi massimi per prenotazione', 'Quanti servizi può scegliere il cliente insieme.', 1, 10)}
   ${n('passo', 'Un orario ogni (minuti)', 'Distanza tra gli orari proposti ai clienti.', 5, 120)}
   ${n('annulloMin', 'Annullo dall’app fino a (minuti prima)', 'Es. 60: alle 9:00 si annulla entro le 8:00.', 0, 10080)}
   ${n('anticipoMin', 'Prenotazione fino a (minuti prima)', 'Es. 20: per le 9:00 si prenota entro le 8:40.', 0, 1440)}
   ${n('maxAttive', 'Prenotazioni attive per cliente', 'Quante prenotazioni future può avere insieme.', 1, 20)}
   ${n('ritardoGiorni', 'Clienti “da richiamare” dopo (giorni)', 'Usato nella sezione Clienti.', 7, 365)}
   </div><label class="chk" style="margin-top:14px"><input type="checkbox" data-k="regole.tempiDinamici" ${R.tempiDinamici ? 'checked' : ''}>Tempi dinamici: la durata è la somma dei servizi scelti</label></div>`;
  leggi($('vista'));
}
window.riempiIcone(document.getElementById('nav'));
