/* Radici – dashboard del titolare */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SALONE = 'radici';
const fbApp = initializeApp({ apiKey: 'AIzaSyCUhd6pXSheUQ6gPhT5OfvprM5dYI2uxz4', authDomain: 'radici-app.firebaseapp.com', projectId: 'radici-app', storageBucket: 'radici-app.firebasestorage.app', messagingSenderId: '602201707324', appId: '1:602201707324:web:88d8681280de279b81c439' });
const auth = getAuth(fbApp), db = getFirestore(fbApp);
const SAL = doc(db, 'saloni', SALONE), colP = collection(db, 'saloni', SALONE, 'prenotazioni'), colB = collection(db, 'saloni', SALONE, 'busy'), colC = collection(db, 'saloni', SALONE, 'clienti'), colA = collection(db, 'saloni', SALONE, 'avvisi'), colR = collection(db, 'saloni', SALONE, 'rubrica'), colG = collection(db, 'saloni', SALONE, 'galleria'), colGF = collection(db, 'saloni', SALONE, 'galleriaFoto');

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
let C = cp(window.RADICI_SEED), D = null, sporco = false, P = [], CL = [], BK = [], AV = [], RB = [], GA = [], vista = 'agenda', giorno = iso(new Date()), filtroCl = '', soloRitardatari = false;
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
  const vive = ['agenda', 'clienti', 'ritardatari', 'statistiche'], ridisegna = () => { if (vive.includes(vista) && $('mod').hidden && !(document.activeElement && document.activeElement.matches('input[type=search],#cQ,#sQ'))) render(); };
  unsub.push(onSnapshot(colP, s => { P = s.docs.map(d => d.data()); ridisegna(); collega(); }));
  unsub.push(onSnapshot(colC, s => { CL = s.docs.map(d => Object.assign({ uid: d.id }, d.data())); ridisegna(); collega(); }));
  unsub.push(onSnapshot(colB, s => { BK = s.docs.map(d => Object.assign({ id: d.id }, d.data())); if (vista === 'agenda' && $('mod').hidden) render(); }));
  unsub.push(onSnapshot(colG, s => { GA = s.docs.map(d => Object.assign({ id: d.id }, d.data())); if (vista === 'galleria' && $('mod').hidden) render(); }, () => {}));
  unsub.push(onSnapshot(colR, s => { RB = s.docs.map(d => Object.assign({ id: d.id }, d.data())); ridisegna(); }, () => {}));
  unsub.push(onSnapshot(colA, s => { AV = s.docs.map(d => d.data()); if (vista === 'comunicazioni') render(); }, () => {}));
});
$('lIn').onclick = async () => { $('lErr').textContent = ''; try { await signInWithEmailAndPassword(auth, $('lMail').value.trim(), $('lPass').value); } catch (e) { $('lErr').textContent = e.code === 'auth/too-many-requests' ? 'Troppi tentativi, riprova più tardi.' : 'Email o password non corretti.'; } };
$('lPass').onkeydown = e => { if (e.key === 'Enter') $('lIn').click(); };
$('esci').onclick = () => signOut(auth);

/* ---------- navigazione ---------- */
const TITOLI = { galleria: 'Galleria', agenda: 'Agenda', clienti: 'Clienti', ritardatari: 'Ritardatari', statistiche: 'Statistiche', comunicazioni: 'Comunicazioni', servizi: 'Servizi', orari: 'Orari', chiusure: 'Giorni di chiusura', staff: 'Staff', negozio: 'Negozio', regole: 'Regole di prenotazione' };
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
  ({ galleria: vGalleria, agenda: vAgenda, clienti: vClienti, ritardatari: vRitardatari, statistiche: vStatistiche, comunicazioni: vComunicazioni, servizi: vServizi, orari: vOrari, chiusure: vChiusure, staff: vStaff, negozio: vNegozio, regole: vRegole })[vista]();
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
const prezzoNum = p => parseFloat(String(p).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const fasceGiorno = k => C.eccezioni.find(e => e.data === k)?.fasce || (C.chiusure.find(c => k >= c.da && k <= c.a) ? [] : C.orari[new Date(k + 'T12:00').getDay()] || []);
const blocchi = (k, st) => BK.filter(x => x.data === k && x.staff === st && (x.tipo === 'blocco' || x.tipo === 'assenza'));
const assente = (k, st) => BK.some(x => x.data === k && x.staff === st && x.tipo === 'assenza');
const ORIG = { app: ['📱', 'Prenotato dall’app'], web: ['💻', 'Prenotato dal sito'], salone: ['🏪', 'Inserito dal salone'] };
const origine = b => ORIG[b.orig] || (b.uid === 'manuale' ? ORIG.salone : ORIG.web);
const ICO_TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
const ICO_WA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.4-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 2.5 2 4.5 4.5 4.5l1-1.5-1.8-.8-.7.8c-.9-.4-1.6-1.1-2-2l.8-.7-.8-1.8z"/></svg>';
/* Pulsanti Chiama e WhatsApp (testo facoltativo già scritto per WhatsApp) */
const contatti = (tel, testo) => !tel ? '' : `<span class="contatti"><a class="az tel" href="tel:${esc(String(tel).replace(/[^\d+]/g, ''))}">${ICO_TEL}<span>Chiama</span></a><a class="az wa" target="_blank" rel="noopener" href="https://wa.me/${numWa(tel)}${testo ? '?text=' + encodeURIComponent(testo) : ''}">${ICO_WA}<span>WhatsApp</span></a></span>`;
let agOp = 'tutti';

function vAgenda() {
  $('azioni').innerHTML = '<button class="bt pri" id="nuovo">+ Nuovo appuntamento</button>';
  $('nuovo').onclick = () => nuovo({ data: giorno, staff: agOp !== 'tutti' ? agOp : '' });
  if (agOp !== 'tutti' && !C.staff.some(s => s.id === agOp)) agOp = 'tutti';
  if (agOp === 'tutti' && innerWidth < 700 && C.staff.length) agOp = C.staff[0].id;
  const L = attive().filter(b => b.data === giorno), inc = L.reduce((a, b) => a + prezzoNum(b.prezzo), 0);
  const fineS = new Date(giorno + 'T12:00'); fineS.setDate(fineS.getDate() + 6);
  const sett = attive().filter(b => b.data >= giorno && b.data <= iso(fineS)).length;
  const oggiK = iso(new Date()), nuove = P.filter(b => b.creata > Date.now() - 864e5 && b.uid !== 'manuale' && b.stato !== 'annullata').length;
  const f = fasceGiorno(giorno);
  const ops = agOp === 'tutti' ? C.staff : C.staff.filter(s => s.id === agOp);
  const ini = Math.floor(Math.min(480, ...f.map(x => x[0]), ...L.map(b => b.ini)) / 10) * 10, fin = Math.ceil(Math.max(1200, ...f.map(x => x[1]), ...L.map(b => b.fine)) / 10) * 10;
  const px = agOp === 'tutti' ? 1.3 : 4.6, aperto = m => f.some(x => m >= x[0] && m < x[1]);
  const h = (fin - ini) * px;
  let g = `<div class="hd" style="width:60px"></div>` + ops.map(s => `<div class="hd">${esc(s.nome)}${assente(giorno, s.id) ? ' <small class="ass">assente</small>' : ''}</div>`).join('');
  let ore = ''; const passoOre = agOp === 'tutti' ? 60 : 10;
  for (let m = Math.ceil(ini / passoOre) * passoOre; m < fin; m += passoOre) ore += `<span style="top:${(m - ini) * px}px">${hm(m)}</span>`;
  g += `<div class="ore" style="height:${h}px">${ore}</div>`;
  ops.forEach(s => {
    let sfondo = '';
    for (let m = ini; m < fin; m += 10) if (!aperto(m)) sfondo += `<div class="chiuso" style="top:${(m - ini) * px}px;height:${10 * px}px"></div>`;
    const ass = assente(giorno, s.id);
    if (ass) sfondo += `<div class="bloccato" style="top:0;height:${h}px"><span>Assente</span></div>`;
    else blocchi(giorno, s.id).forEach(x => { sfondo += `<div class="bloccato" style="top:${(Math.max(x.ini, ini) - ini) * px}px;height:${(Math.min(x.fine, fin) - Math.max(x.ini, ini)) * px}px"></div>`; });
    let righe = '';
    if (agOp !== 'tutti' && !ass) for (let m = ini; m < fin; m += 10) {
      const bl = BK.find(x => x.data === giorno && x.staff === s.id && x.tipo === 'blocco' && x.ini === m);
      righe += `<div class="riga" style="top:${(m - ini) * px}px;height:${10 * px}px"><button class="piu" data-piu="${m}" aria-label="Nuovo alle ${hm(m)}">+</button><button class="blk${bl ? ' on' : ''}" data-blk="${m}" aria-label="${bl ? 'Sblocca' : 'Blocca'} ${hm(m)}" title="${bl ? 'Sblocca' : 'Blocca'} la fascia">⦸</button></div>`;
    }
    const ev = L.filter(b => b.staff === s.id).map(b => { const o = origine(b);
      return `<button class="ev${b.uid === 'manuale' ? ' man' : ''}" data-b="${b.id}" style="top:${(b.ini - ini) * px + 1}px;height:${Math.max(22, b.dur * px - 2)}px"><span class="eh"><b>${hm(b.ini)}–${hm(b.fine)}</b><i title="${o[1]}">${o[0]}</i></span><b class="en">${esc(b.nome)} ${esc(b.cogn || '')}</b><small>${esc(b.servizi.map(x => x.nome).join(', '))}</small></button>`; }).join('');
    g += `<div class="col${agOp !== 'tutti' ? ' singolo' : ''}" style="height:${h}px;background-size:100% ${(agOp === 'tutti' ? 60 : 10) * px}px;background-position:0 ${((Math.ceil(ini / 60) * 60) - ini) * px}px">${sfondo}${righe}${ev}</div>`;
  });
  const sel = C.staff.find(s => s.id === agOp);
  $('vista').innerHTML = `<div class="stat"><div><b>${L.length}</b><span>appuntamenti ${giorno === oggiK ? 'oggi' : 'nel giorno'}</span></div><div><b>${Math.round(inc)} €</b><span>incasso previsto</span></div><div><b>${sett}</b><span>nei prossimi 7 giorni</span></div><div><b>${nuove}</b><span>prenotate online nelle ultime 24 h</span></div></div>
   <div class="bar" style="margin-bottom:10px"><button class="bt" id="gPrev" aria-label="Giorno precedente">‹</button><input type="date" id="gData" value="${giorno}" style="width:auto"><button class="bt" id="gNext" aria-label="Giorno successivo">›</button><button class="bt" id="gOggi">Oggi</button><b style="text-transform:capitalize">${esc(dataLunga(giorno))}</b></div>
   <div class="optabs"><button data-op="tutti" aria-pressed="${agOp === 'tutti'}">Tutti</button>${C.staff.map(s => `<button data-op="${s.id}" aria-pressed="${agOp === s.id}">${esc(s.nome)}</button>`).join('')}</div>
   ${sel ? `<div class="bar presenza"><span class="hint" style="margin:0;flex:1"><b>+</b> nuovo appuntamento · <b>⦸</b> blocca o sblocca la fascia</span><button class="az pres${assente(giorno, sel.id) ? '' : ' on'}" id="pPres">✓ Presente</button><button class="az ass${assente(giorno, sel.id) ? ' on' : ''}" id="pAss">✕ Assente</button></div>` : ''}
   ${f.length ? '' : '<p class="hint">Salone chiuso in questo giorno.</p>'}
   <div class="ag" style="grid-template-columns:60px repeat(${ops.length},minmax(${agOp === 'tutti' ? 140 : 200}px,1fr))">${g}</div>`;
  const sposta = n => { const d = new Date(giorno + 'T12:00'); d.setDate(d.getDate() + n); giorno = iso(d); render(); };
  $('gPrev').onclick = () => sposta(-1); $('gNext').onclick = () => sposta(1); $('gOggi').onclick = () => { giorno = iso(new Date()); render(); };
  $('gData').onchange = e => { if (e.target.value) { giorno = e.target.value; render(); } };
  $('vista').querySelectorAll('[data-op]').forEach(b => b.onclick = () => { agOp = b.dataset.op; render(); });
  $('vista').querySelectorAll('[data-b]').forEach(b => b.onclick = () => dettaglio(P.find(x => x.id === b.dataset.b)));
  $('vista').querySelectorAll('[data-piu]').forEach(b => b.onclick = () => nuovo({ data: giorno, staff: agOp, ora: +b.dataset.piu }));
  $('vista').querySelectorAll('[data-blk]').forEach(b => b.onclick = () => bloccaFascia(agOp, giorno, +b.dataset.blk));
  if (sel) { $('pPres').onclick = () => presenza(sel, false); $('pAss').onclick = () => presenza(sel, true); }
}
/* Fasce bloccate e assenze: stanno tra gli orari occupati, così l'app non le propone ai clienti */
async function bloccaFascia(st, k, m) {
  const id = 'k_' + st + '_' + k + '_' + m, c = BK.find(x => x.id === id);
  try { if (c) await deleteDoc(doc(colB, id)); else await setDoc(doc(colB, id), { data: k, ini: m, fine: m + 10, staff: st, tipo: 'blocco' }); }
  catch (e) { toast(e.code === 'permission-denied' ? 'Permesso negato: aggiorna le regole di Firebase.' : 'Non riuscito. Riprova.'); }
}
async function presenza(s, ass) {
  const id = 'a_' + s.id + '_' + giorno;
  if (ass && attive().some(b => b.data === giorno && b.staff === s.id) && !await conferma(s.nome + ' ha appuntamenti in questo giorno', 'Segnandolo assente i clienti non potranno più prenotarlo, ma gli appuntamenti già presi restano: spostali o annullali tu.', 'Segna assente', 'Annulla')) return;
  try { if (ass) await setDoc(doc(colB, id), { data: giorno, ini: 0, fine: 1440, staff: s.id, tipo: 'assenza' }); else await deleteDoc(doc(colB, id)); }
  catch (e) { toast(e.code === 'permission-denied' ? 'Permesso negato: aggiorna le regole di Firebase.' : 'Non riuscito. Riprova.'); }
}
function dettaglio(b) {
  if (!b) return;
  const st = C.staff.find(s => s.id === b.staff) || { nome: b.staffNome }, o = origine(b), cl = CL.find(c => c.uid === b.uid);
  finestra(`<div class="li" style="border:0;padding:0 0 6px">${avatar(cl ? { nome: b.nome, foto: cl.foto } : { nome: b.nome })}<div class="t"><h3 style="margin:0">${esc(b.nome)} ${esc(b.cogn || '')}</h3><small>${o[0]} ${o[1]}${b.uid !== 'manuale' ? ' · vede l’appuntamento nell’app' : ''}</small></div></div>
   <p class="hint" style="text-transform:capitalize">${esc(dataLunga(b.data))}, ${hm(b.ini)}–${hm(b.fine)} · ${esc(st.nome)}</p>
   <div class="card" style="box-shadow:none">${b.servizi.map(s => `<div class="li"><div class="t"><b>${esc(s.nome)}</b><small>${fd(s.durata)}</small></div><b>${esc(s.prezzo)}</b></div>`).join('')}<div class="li"><div class="t"><b>Totale</b></div><b>${esc(b.prezzo)}</b></div></div>
   ${b.note ? `<p><b>Note:</b> ${esc(b.note)}</p>` : ''}
   ${b.tel ? `<p style="margin:0 0 6px">${esc(b.tel)}</p>${contatti(b.tel)}` : ''}
   <p class="hint" style="margin-top:12px">${b.uid === 'manuale' ? 'Inserito dalla gestione' : 'Prenotato il ' + new Date(b.creata).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
   <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="bt" id="dX">Chiudi</button><button class="bt no" id="dAnn">Annulla appuntamento</button></div>`);
  $('dX').onclick = chiudi;
  $('dAnn').onclick = async () => {
    if (!await conferma('Annullare l’appuntamento?', b.nome + ' – ' + dataLunga(b.data) + ' ' + hm(b.ini), 'Sì, annulla')) return;
    try { const w = writeBatch(db); w.update(doc(colP, b.id), { stato: 'annullata', annullataIl: Date.now(), annullataDa: 'salone' }); w.delete(doc(colB, b.id)); await w.commit(); toast('Appuntamento annullato'); }
    catch (e) { toast('Non riuscito. Riprova.'); }
  };
}
/* Nuovo appuntamento: si può scegliere un cliente registrato, così lo vede nella sua app */
const telN = t => String(t || '').replace(/\D/g, '').replace(/^(0039|39)(?=\d{9,})/, '');
function nuovo(pre = {}) {
  const vis = C.servizi.filter(s => s.visibile !== false); let scelto = null;
  finestra(`<h3>Nuovo appuntamento</h3>
   <label>Cerca cliente (facoltativo)<input id="nCerca" placeholder="Cerca per nome o telefono" autocomplete="off"></label>
   <div id="nRis" class="ris"></div><div id="nSel"></div>
   <div class="grid2" style="margin-top:10px"><label>Nome<input id="nNome"></label><label>Cognome<input id="nCogn"></label></div>
   <label style="margin-top:10px">Telefono<input id="nTel" type="tel"></label>
   <p class="hint" style="margin:12px 0 4px">Servizi</p><div class="svl">${C.categorie.map(c => { const l = vis.filter(s => s.cat === c.id); return l.length ? `<b style="display:block;margin-top:6px">${esc(c.nome)}</b>` + l.map(s => `<label><input type="checkbox" value="${s.id}">${esc(s.nome)} <small style="color:var(--mute)">· ${fd(s.durata)}</small></label>`).join('') : ''; }).join('')}</div>
   <div class="grid3" style="margin-top:10px"><label>Operatore<select id="nSt">${C.staff.map(s => `<option value="${s.id}" ${pre.staff === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label><label>Giorno<input type="date" id="nData" value="${pre.data || giorno}"></label><label>Ora<input type="time" id="nOra" step="300" value="${hm(pre.ora != null ? pre.ora : 540)}"></label></div>
   <label style="margin-top:10px">Note<input id="nNote"></label>
   <p class="err" id="nErr"></p>
   <div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt" id="nNo">Annulla</button><button class="bt pri" id="nOk">Salva</button></div>`);
  const mostraSel = () => {
    $('nSel').innerHTML = scelto ? `<div class="scelto">${avatar(scelto)}<div class="t"><b>${esc(scelto.nome)} ${esc(scelto.cogn || '')}</b><small>Vedrà l’appuntamento nella sua app</small></div><button class="ib" id="nTogli" aria-label="Togli cliente">✕</button></div>` : '';
    if (scelto) $('nTogli').onclick = () => { scelto = null; mostraSel(); };
  };
  $('nCerca').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    const tutti = CL.map(c => Object.assign({ k: 'u:' + c.uid }, c)).concat(RB.filter(r => !accountDi(r)).map(r => Object.assign({ k: 'r:' + r.id }, r)));
    const l = q.length < 2 ? [] : tutti.filter(c => ((c.nome || '') + ' ' + (c.cogn || '') + ' ' + (c.tel || '')).toLowerCase().includes(q) || (telN(q) && telN(c.tel).includes(telN(q)))).slice(0, 6);
    $('nRis').innerHTML = l.map(c => `<button class="ri" data-u="${esc(c.k)}">${avatar(c)}<span><b>${esc(c.nome || '')} ${esc(c.cogn || '')}${c.uid ? ' <span class="tag">app</span>' : ''}</b><small>${esc(c.tel || c.mail || '')}</small></span></button>`).join('') || (q.length >= 2 ? '<p class="hint" style="margin:4px 0">Nessun cliente con questo nome: compila i campi qui sotto.</p>' : '');
    $('nRis').querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
      const c = tutti.find(x => x.k === b.dataset.u); scelto = c.uid ? c : null; $('nNome').value = c.nome || ''; $('nCogn').value = c.cogn || ''; $('nTel').value = c.tel || '';
      $('nRis').innerHTML = ''; $('nCerca').value = ''; mostraSel();
    });
  };
  $('nNo').onclick = chiudi;
  $('nOk').onclick = async () => {
    const ids = [...$('modIn').querySelectorAll('.svl input:checked')].map(x => x.value), sv = ids.map(id => C.servizi.find(s => s.id === id));
    const nome = $('nNome').value.trim(), data = $('nData').value, ini = daHm($('nOra').value), st = C.staff.find(s => s.id === $('nSt').value), tel = $('nTel').value.trim();
    if (!nome) return $('nErr').textContent = 'Inserisci il nome o scegli un cliente.'; if (!sv.length) return $('nErr').textContent = 'Scegli almeno un servizio.'; if (!data || ini == null) return $('nErr').textContent = 'Scegli giorno e ora.';
    const dur = sv.reduce((a, s) => a + (+s.durata || 0), 0), fine = ini + dur;
    const sovr = attive().find(b => b.data === data && b.staff === st.id && ini < b.fine && b.ini < fine);
    if (sovr && !await conferma('Orario occupato', st.nome + ' ha già ' + sovr.nome + ' alle ' + hm(sovr.ini) + '. Inserire comunque?', 'Inserisci comunque', 'No')) return;
    const blk = BK.find(x => x.data === data && x.staff === st.id && (x.tipo === 'blocco' || x.tipo === 'assenza') && ini < x.fine && x.ini < fine);
    if (blk && !await conferma(blk.tipo === 'assenza' ? st.nome + ' è segnato assente' : 'Fascia bloccata', 'Inserire comunque l’appuntamento?', 'Inserisci comunque', 'No')) return;
    if (!scelto && telN(tel)) scelto = CL.find(c => telN(c.tel) && telN(c.tel) === telN(tel)) || null;
    const id = nid('m'), tot = sv.reduce((a, s) => a + prezzoNum(s.prezzo), 0);
    const rec = { id, uid: scelto ? scelto.uid : 'manuale', orig: 'salone', nome, cogn: $('nCogn').value.trim(), tel, mail: scelto ? scelto.mail || '' : '', note: $('nNote').value.trim(), data, ini, fine, dur, staff: st.id, staffNome: st.nome, servizi: sv.map(s => ({ id: s.id, nome: s.nome, prezzo: s.prezzo, durata: s.durata })), prezzo: tot + ' €', stato: 'ok', creata: Date.now() };
    try { const w = writeBatch(db); w.set(doc(colP, id), rec); w.set(doc(colB, id), { data, ini, fine, staff: st.id }); await w.commit(); chiudi(); giorno = data; toast(scelto ? 'Salvato: ' + scelto.nome + ' lo vede nella sua app' : 'Appuntamento salvato'); render(); }
    catch (e) { $('nErr').textContent = 'Salvataggio non riuscito.'; }
  };
}
/* Collega da solo gli appuntamenti inseriti a mano al cliente che si registra con lo stesso numero */
let collegando = false;
async function collega() {
  if (collegando || !P.length || !CL.length) return;
  const oggiK = iso(new Date()), w = writeBatch(db); let n = 0;
  P.forEach(b => { if (b.uid !== 'manuale' || b.stato === 'annullata' || b.data < oggiK || !telN(b.tel)) return;
    const c = CL.find(x => telN(x.tel) === telN(b.tel)); if (c) { w.update(doc(colP, b.id), { uid: c.uid, mail: c.mail || '' }); n++; } });
  if (!n) return;
  collegando = true; try { await w.commit(); toast(n === 1 ? '1 appuntamento collegato all’app del cliente' : n + ' appuntamenti collegati all’app dei clienti'); } catch (e) {} collegando = false;
}

/* ---------- CLIENTI: account dell'app + rubrica del salone (importata o inserita a mano) ---------- */
const mailN = m => String(m || '').trim().toLowerCase();
/* Un cliente della rubrica corrisponde a un account dell'app se ha lo stesso telefono o la stessa email */
const accountDi = r => CL.find(c => (telN(r.tel) && telN(c.tel) === telN(r.tel)) || (mailN(r.mail) && mailN(c.mail) === mailN(r.mail)));
function elencoClienti() {
  const per = {}; P.filter(b => b.stato !== 'annullata').forEach(b => { const k = b.uid !== 'manuale' ? b.uid : 'm:' + (telN(b.tel) || b.nome.toLowerCase()); (per[k] = per[k] || []).push(b); });
  const oggiK = iso(new Date()), usati = new Set();
  const riga = (base, bs) => { bs = bs || []; const pass = bs.filter(b => b.data <= oggiK).sort((a, b) => b.data.localeCompare(a.data));
    return Object.assign(base, { visite: pass.length, ultima: pass[0] ? pass[0].data : '', prossima: bs.filter(b => b.data > oggiK).map(b => b.data).sort()[0] || '' }); };
  const L = [];
  CL.forEach(c => { const bs = (per[c.uid] || []).concat(per['m:' + telN(c.tel)] || []); usati.add(c.uid); if (telN(c.tel)) usati.add('m:' + telN(c.tel));
    const r = RB.find(x => accountDi(x) === c);
    L.push(riga({ app: true, foto: c.foto || '', nome: ((c.nome || '') + ' ' + (c.cogn || '')).trim() || c.mail || 'Cliente', tel: c.tel || (r && r.tel) || '', mail: c.mail || '', dal: r && r.dal }, bs)); });
  RB.forEach(r => { if (accountDi(r)) return; const k = 'm:' + telN(r.tel); if (telN(r.tel)) usati.add(k);
    L.push(riga({ app: false, rubrica: true, foto: '', nome: ((r.nome || '') + ' ' + (r.cogn || '')).trim() || r.mail || 'Cliente', tel: r.tel || '', mail: r.mail || '', dal: r.dal }, telN(r.tel) ? per[k] : [])); });
  Object.entries(per).forEach(([k, bs]) => { if (usati.has(k)) return; const b0 = bs[0];
    L.push(riga({ app: false, foto: '', nome: (b0.nome + ' ' + (b0.cogn || '')).trim(), tel: b0.tel, mail: b0.mail || '' }, bs)); });
  return L;
}
let mostraCl = 150;
function vClienti() {
  $('azioni').innerHTML = '<button class="bt" id="imp">⬆ Importa da CSV</button>';
  $('imp').onclick = importa;
  let L = elencoClienti().sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  if (filtroCl) { const q = filtroCl.toLowerCase(), qt = telN(filtroCl); L = L.filter(x => (x.nome + ' ' + x.mail).toLowerCase().includes(q) || (qt && telN(x.tel).includes(qt))); }
  const nApp = L.filter(x => x.app).length, tot = L.length, vis = L.slice(0, mostraCl);
  $('vista').innerHTML = `<div class="bar"><input id="cQ" type="search" placeholder="Cerca per nome, telefono o email" value="${esc(filtroCl)}" style="max-width:340px"><span class="hint" style="margin:0">${tot} clienti · ${nApp} con l’app</span></div>
   <div class="card">${vis.length ? vis.map(x => `<div class="li">${avatar(x)}<div class="t"><b>${esc(x.nome)}${x.app ? ' <span class="tag">app</span>' : ''}</b><small>${x.visite} visite · ultima: ${x.ultima ? esc(dataLunga(x.ultima)) : '—'}${x.prossima ? ' · prossima: ' + esc(dataLunga(x.prossima)) : ''}${x.dal ? ' · cliente dal ' + new Date(x.dal + 'T12:00').toLocaleDateString('it-IT') : ''}</small></div>${contatti(x.tel)}</div>`).join('') : '<p class="hint" style="margin:0">Nessun cliente. Puoi importarli dal vecchio gestionale con “Importa da CSV”.</p>'}
   ${tot > vis.length ? `<button class="bt" id="altri" style="margin-top:10px">Mostra altri ${Math.min(150, tot - vis.length)} (su ${tot - vis.length})</button>` : ''}</div>`;
  $('cQ').oninput = e => { filtroCl = e.target.value; mostraCl = 150; const pos = e.target.selectionStart; render(); $('cQ').focus(); $('cQ').setSelectionRange(pos, pos); };
  if ($('altri')) $('altri').onclick = () => { mostraCl += 150; render(); };
}

/* ---------- IMPORTAZIONE da CSV (es. lista clienti esportata da un altro gestionale) ---------- */
/* Legge un CSV con ; o , come separatore, virgolette, BOM e celle Excel tipo ="+39333..." */
function leggiCsv(testo) {
  testo = testo.replace(/^﻿/, '');
  const prima = testo.split(/\r?\n/)[0] || '', sep = (prima.match(/;/g) || []).length >= (prima.match(/,/g) || []).length ? ';' : ',';
  const righe = []; let riga = [], cella = '', virg = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (virg) { if (ch === '"') { if (testo[i + 1] === '"') { cella += '"'; i++; } else virg = false; } else cella += ch; }
    else if (ch === '"') virg = true;
    else if (ch === sep) { riga.push(cella); cella = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && testo[i + 1] === '\n') i++; riga.push(cella); righe.push(riga); riga = []; cella = ''; }
    else cella += ch;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  const pulisci = v => String(v || '').trim().replace(/^="?(.*?)"?$/, '$1').trim();
  return righe.filter(r => r.some(c => pulisci(c))).map(r => r.map(pulisci));
}
const CAMPI = [['nome', 'Nome', /^nome$|first ?name|^name$/i], ['cogn', 'Cognome', /cognome|last ?name|surname/i], ['tel', 'Telefono', /tel|cell|phone|mobile/i], ['mail', 'Email', /mail/i], ['dal', 'Cliente dal', /cliente dal|registraz|creat|dal$|data/i]];
const dataIso = v => { const m = String(v || '').match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + p2(+m[2]) + '-' + p2(+m[1]); } return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ''; };
/* Doppione solo se coincidono contatto e nome: familiari con lo stesso numero restano clienti distinti */
const idRubrica = r => ('r_' + (telN(r.tel) || mailN(r.mail).replace(/[^a-z0-9]/g, '_') || 'x') + '_' + ((r.nome || '') + '_' + (r.cogn || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')).slice(0, 140);
function importa() {
  finestra(`<h3>Importa clienti da CSV</h3>
   <p class="hint">Carica il file esportato dal vecchio gestionale (Excel → “Salva come CSV” va bene). I clienti vanno nella rubrica del salone; chi si registra poi nell’app con lo stesso telefono o la stessa email viene collegato da solo.</p>
   <label class="bt" style="cursor:pointer;display:inline-flex">Scegli il file CSV<input type="file" id="iF" accept=".csv,text/csv,text/plain" hidden></label>
   <div id="iPrev"></div><p class="err" id="iE"></p>
   <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px"><button class="bt" id="iNo">Chiudi</button><button class="bt pri" id="iOk" hidden>Importa</button></div>`);
  $('iNo').onclick = chiudi;
  let righe = [], mappa = {};
  const anteprima = () => {
    const h = righe[0], dati = righe.slice(1);
    const sceltaCol = (k, t) => `<label>${t}<select data-m="${k}"><option value="">— non importare —</option>${h.map((c, i) => `<option value="${i}" ${mappa[k] === i ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
    const val = (r, k) => mappa[k] === undefined || mappa[k] === '' ? '' : (r[mappa[k]] || '').trim();
    const recs = dati.map(r => ({ nome: val(r, 'nome'), cogn: val(r, 'cogn'), tel: val(r, 'tel').replace(/[^\d+]/g, ''), mail: val(r, 'mail'), dal: dataIso(val(r, 'dal')) })).filter(r => r.nome || r.cogn || r.tel || r.mail);
    const ids = new Set(RB.map(x => x.id)), unici = new Set(recs.map(idRubrica)), nuovi = [...unici].filter(id => !ids.has(id)).length, doppi = recs.length - unici.size;
    const senza = recs.filter(r => !telN(r.tel) && !mailN(r.mail)).length, conApp = recs.filter(r => accountDi(r)).length;
    $('iPrev').innerHTML = `<div class="grid3" style="margin:12px 0">${CAMPI.map(([k, t]) => sceltaCol(k, t)).join('')}</div>
      <div class="stat" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${unici.size}</b><span>clienti da importare</span></div><div><b>${nuovi}</b><span>nuovi (gli altri si aggiornano)</span></div><div><b>${conApp}</b><span>già registrati nell’app</span></div></div>
      ${doppi ? `<p class="hint">${doppi} righe ripetute nel file (stesso nome e stesso contatto): vengono importate una volta sola.</p>` : ''}
      ${senza ? `<p class="hint">${senza} senza telefono né email: si importano lo stesso, ma non si potranno collegare all’app.</p>` : ''}
      <div class="card" style="box-shadow:none;max-height:200px;overflow:auto"><b style="display:block;margin-bottom:6px">Anteprima</b>${recs.slice(0, 5).map(r => `<div class="li"><div class="t"><b>${esc(r.nome)} ${esc(r.cogn)}</b><small>${esc(r.tel || '—')} · ${esc(r.mail || '—')}${r.dal ? ' · dal ' + new Date(r.dal + 'T12:00').toLocaleDateString('it-IT') : ''}</small></div></div>`).join('')}</div>`;
    $('iPrev').querySelectorAll('[data-m]').forEach(s => s.onchange = () => { mappa[s.dataset.m] = s.value === '' ? '' : +s.value; anteprima(); });
    $('iOk').hidden = !recs.length; $('iOk').textContent = 'Importa ' + unici.size + ' clienti';
    $('iOk').onclick = async () => {
      $('iOk').disabled = true; $('iE').textContent = '';
      try {
        const ora = Date.now();
        for (let i = 0; i < recs.length; i += 400) {
          const w = writeBatch(db);
          recs.slice(i, i + 400).forEach(r => { const d = { nome: r.nome, cogn: r.cogn, tel: r.tel, mail: r.mail, fonte: 'import', importato: ora }; if (r.dal) d.dal = r.dal; w.set(doc(colR, idRubrica(r)), d, { merge: true }); });
          await w.commit(); $('iOk').textContent = 'Importati ' + Math.min(i + 400, recs.length) + ' / ' + recs.length + '…';
        }
        chiudi(); toast(unici.size + ' clienti importati'); vista = 'clienti'; render();
      } catch (e) { $('iOk').disabled = false; $('iOk').textContent = 'Riprova'; $('iE').textContent = e.code === 'permission-denied' ? 'Permesso negato: aggiorna le regole di Firebase (sezione rubrica).' : 'Importazione non riuscita (' + (e.code || e.message) + ').'; }
    };
  };
  $('iF').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const buf = await f.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf); if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
      righe = leggiCsv(t);
      if (righe.length < 2) { $('iE').textContent = 'Il file sembra vuoto o non è un CSV.'; return; }
      mappa = {}; CAMPI.forEach(([k, , re]) => { const i = righe[0].findIndex((c, j) => re.test(c) && !Object.values(mappa).includes(j)); if (i >= 0) mappa[k] = i; });
      $('iE').textContent = ''; anteprima();
    } catch (x) { $('iE').textContent = 'Non riesco a leggere il file.'; }
  };
}
/* ---------- RITARDATARI: chi non viene da un po', dal più vecchio ---------- */
function vRitardatari() {
  const gg = C.regole.ritardoGiorni || 45, giorniDa = k => Math.round((Date.now() - new Date(k + 'T12:00')) / 864e5);
  let L = elencoClienti().filter(x => !x.prossima && x.ultima && giorniDa(x.ultima) >= gg).sort((a, b) => a.ultima.localeCompare(b.ultima));
  if (filtroCl) L = L.filter(x => (x.nome + ' ' + x.tel).toLowerCase().includes(filtroCl.toLowerCase()));
  $('vista').innerHTML = `<p class="hint">Clienti che non tornano da almeno <b>${gg} giorni</b> e non hanno appuntamenti in programma (il numero di giorni si cambia in Regole prenotazione).</p>
   <div class="bar"><input id="cQ" type="search" placeholder="Cerca qui" value="${esc(filtroCl)}" style="max-width:340px"><span class="hint" style="margin:0">${L.length} da richiamare</span></div>
   <div class="card tab"><div class="th"><span>Foto</span><span>Nome cliente</span><span>Ultima prenotazione</span><span></span></div>
   ${L.length ? L.map(x => `<div class="tr">${avatar(x)}<b>${esc(x.nome)}</b><span>${new Date(x.ultima + 'T12:00').toLocaleDateString('it-IT')}<small>${giorniDa(x.ultima)} giorni fa</small></span>${contatti(x.tel, 'Ciao ' + x.nome.split(' ')[0] + ', è da un po’ che non ci vediamo! Ti va di prenotare il prossimo appuntamento da ' + C.nome + '?')}</div>`).join('') : '<p class="hint" style="margin:10px 0 0">Nessuno: tutti i clienti sono tornati di recente.</p>'}</div>`;
  $('cQ').oninput = e => { filtroCl = e.target.value; const pos = e.target.selectionStart; render(); $('cQ').focus(); $('cQ').setSelectionRange(pos, pos); };
}
/* ---------- STATISTICHE: prenotazioni per operatore in un periodo ---------- */
let stDa = null, stA = null, stOp = null, stQ = '';
function vStatistiche() {
  const t = new Date(); if (!stDa) { stDa = iso(new Date(t.getFullYear(), t.getMonth(), 1)); stA = iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)); }
  const nel = attive().filter(b => b.data >= stDa && b.data <= stA);
  if (!stOp || !C.staff.some(s => s.id === stOp)) stOp = C.staff[0] && C.staff[0].id;
  const conta = id => nel.filter(b => b.staff === id), sel = C.staff.find(s => s.id === stOp) || {};
  let L = conta(stOp).sort((a, b) => (b.data + p2(b.ini)).localeCompare(a.data + p2(a.ini)));
  if (stQ) L = L.filter(b => (b.nome + ' ' + (b.cogn || '') + ' ' + b.servizi.map(x => x.nome).join(' ')).toLowerCase().includes(stQ.toLowerCase()));
  const inc = conta(stOp).reduce((a, b) => a + prezzoNum(b.prezzo), 0);
  $('vista').innerHTML = `<div class="optabs st">${C.staff.map(s => `<button data-so="${s.id}" aria-pressed="${s.id === stOp}"><b>${esc(s.nome)}</b><small>Prenotazioni: ${conta(s.id).length}</small></button>`).join('')}</div>
   <div class="bar"><label>Da<input type="date" id="sDa" value="${stDa}"></label><label>A<input type="date" id="sA" value="${stA}"></label><input id="sQ" type="search" placeholder="Filtra" value="${esc(stQ)}" style="max-width:260px;align-self:flex-end"></div>
   <div class="stat" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${conta(stOp).length}</b><span>prenotazioni di ${esc(sel.nome || '')}</span></div><div><b>${Math.round(inc)} €</b><span>incasso indicativo</span></div><div><b>${nel.length}</b><span>prenotazioni totali del salone</span></div></div>
   ${grafici(nel)}
   <h2 style="color:var(--acc);font-size:1.6rem;margin:6px 0 10px">${esc(sel.nome || '')}</h2>
   <div class="card tab"><div class="th st"><span>Nome cliente</span><span>Data e ora</span><span>Servizi</span></div>
   ${L.length ? L.map(b => `<div class="tr st" data-b="${b.id}"><b>${esc(b.nome)} ${esc(b.cogn || '')}</b><span>${new Date(b.data + 'T12:00').toLocaleDateString('it-IT')}, ${hm(b.ini)}</span><small>${esc(b.servizi.map(x => x.nome).join(', '))}</small></div>`).join('') : '<p class="hint" style="margin:10px 0 0">Nessuna prenotazione in questo periodo.</p>'}</div>`;
  $('vista').querySelectorAll('[data-so]').forEach(b => b.onclick = () => { stOp = b.dataset.so; render(); });
  $('sDa').onchange = e => { if (e.target.value) { stDa = e.target.value; render(); } };
  $('sA').onchange = e => { if (e.target.value) { stA = e.target.value; render(); } };
  $('sQ').oninput = e => { stQ = e.target.value; const pos = e.target.selectionStart; render(); $('sQ').focus(); $('sQ').setSelectionRange(pos, pos); };
  $('vista').querySelectorAll('[data-b]').forEach(r => r.onclick = () => dettaglio(P.find(x => x.id === r.dataset.b)));
}
/* Grafici delle statistiche: una sola serie per grafico, colore unico, valori al passaggio del dito o del mouse */
function grafici(nel) {
  const giorni = [], d0 = new Date(stDa + 'T12:00'), d1 = new Date(stA + 'T12:00');
  for (let d = new Date(d0); d <= d1 && giorni.length < 93; d.setDate(d.getDate() + 1)) giorni.push(iso(d));
  const perG = giorni.map(k => ({ k, n: nel.filter(b => b.data === k).length })), maxG = Math.max(1, ...perG.map(x => x.n));
  const tick = n => { const p = Math.max(1, Math.ceil(n / 4)); return [0, p, 2 * p, 3 * p, 4 * p].filter(v => v <= Math.max(n, 4 * p)).slice(0, 5); };
  const tk = tick(maxG), top = tk[tk.length - 1];
  const col = perG.map(x => { const dt = new Date(x.k + 'T12:00'), dom = dt.getDay() === 0;
    return `<div class="gc" data-tip="${dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}: ${x.n} ${x.n === 1 ? 'prenotazione' : 'prenotazioni'}"><i style="height:${x.n / top * 100}%"></i><span class="${dt.getDate() === 1 || giorni.length <= 14 || dt.getDay() === 1 ? '' : 'nasc'}${dom ? ' dom' : ''}">${dt.getDate()}</span></div>`; }).join('');
  const barre = (righe, unita) => { const m = Math.max(1, ...righe.map(r => r.v)); return righe.map(r => `<div class="gb" data-tip="${esc(r.l)}: ${r.v} ${unita}"><span class="gl">${esc(r.l)}</span><span class="gt"><i style="width:${r.v / m * 100}%"></i></span><b>${r.v}</b></div>`).join(''); };
  const perOp = C.staff.map(s => ({ l: s.nome, v: nel.filter(b => b.staff === s.id).length })).sort((a, b) => b.v - a.v);
  const sv = {}; nel.forEach(b => b.servizi.forEach(x => { sv[x.nome] = (sv[x.nome] || 0) + 1; }));
  const topSv = Object.entries(sv).map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 6);
  if (!nel.length) return '<div class="card"><p class="hint" style="margin:0">Nessuna prenotazione nel periodo: i grafici compariranno qui.</p></div>';
  return `<div class="card graf"><h3>Prenotazioni al giorno</h3><p class="hint" style="margin:-6px 0 10px">Tutto il salone, dal ${new Date(stDa + 'T12:00').toLocaleDateString('it-IT')} al ${new Date(stA + 'T12:00').toLocaleDateString('it-IT')}</p>
    <div class="gcol"><div class="gy">${tk.map(v => `<span style="bottom:${v / top * 100}%">${v}</span>`).join('')}</div><div class="garea">${tk.map(v => `<em style="bottom:${v / top * 100}%"></em>`).join('')}<div class="gbars">${col}</div></div></div></div>
   <div class="grid2"><div class="card graf"><h3>Per operatore</h3>${barre(perOp, 'prenotazioni')}</div>
   <div class="card graf"><h3>Servizi più richiesti</h3>${topSv.length ? barre(topSv, 'volte') : '<p class="hint">—</p>'}</div></div>`;
}
/* Etichetta che segue il dito o il mouse sui grafici */
(() => { const t = document.createElement('div'); t.className = 'gtip'; t.hidden = true; document.body.appendChild(t);
  const mostra = e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) { t.hidden = true; return; } t.textContent = el.dataset.tip; t.hidden = false;
    const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - t.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - t.offsetWidth / 2)) + 'px'; t.style.top = Math.max(8, r.top - t.offsetHeight - 8) + 'px'; };
  document.addEventListener('pointerover', mostra); document.addEventListener('pointerdown', mostra); addEventListener('scroll', () => { t.hidden = true; }, true); })();
/* ---------- COMUNICAZIONI: avvisi che i clienti vedono nell'app ---------- */
function vComunicazioni() {
  const ora = Date.now(), L = AV.slice().sort((a, b) => b.creato - a.creato);
  const dom = new Date(); dom.setDate(dom.getDate() + 7);
  $('vista').innerHTML = `<div class="card"><h3>Crea comunicazione</h3><p class="hint">I clienti la vedono nell’app, in Profilo → Avvisi, con un pallino finché non la leggono. Sparisce da sola alla scadenza.</p>
    <label>Titolo<input id="cT" maxlength="30" placeholder="Es. Chiusura per ferie"></label><small class="cnt" id="cTn">0 / 30</small>
    <label style="margin-top:8px">Testo<textarea id="cX" maxlength="2000" style="min-height:140px" placeholder="Scrivi il messaggio per i clienti"></textarea></label><small class="cnt" id="cXn">Caratteri: 0/2000</small>
    <div class="grid2" style="margin-top:8px"><label>Data di scadenza<input type="date" id="cD" value="${iso(dom)}"></label><label>Orario di scadenza<input type="time" id="cO" value="23:59"></label></div>
    <p class="err" id="cE"></p><button class="bt pri" id="cInv">Invia a tutti i clienti</button></div>
   <div class="card"><h3>Comunicazioni inviate</h3>${L.length ? L.map(a => `<div class="li"><div class="t"><b>${esc(a.titolo)}</b><small>${a.scade > ora ? 'Visibile fino al ' + new Date(a.scade).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Scaduta'} · inviata il ${new Date(a.creato).toLocaleDateString('it-IT')}</small><p style="margin:6px 0 0;white-space:pre-line">${esc(a.testo)}</p></div><button class="bt sm no" data-del="${esc(a.id)}">Elimina</button></div>`).join('') : '<p class="hint" style="margin:0">Nessuna comunicazione.</p>'}</div>`;
  $('cT').oninput = e => { $('cTn').textContent = e.target.value.length + ' / 30'; };
  $('cX').oninput = e => { $('cXn').textContent = 'Caratteri: ' + e.target.value.length + '/2000'; };
  $('cInv').onclick = async () => {
    const titolo = $('cT').value.trim(), testo = $('cX').value.trim(), scade = new Date($('cD').value + 'T' + ($('cO').value || '23:59')).getTime();
    if (!titolo || !testo) return $('cE').textContent = 'Scrivi titolo e testo.';
    if (!(scade > Date.now())) return $('cE').textContent = 'La scadenza deve essere nel futuro.';
    const id = nid('n');
    try { await setDoc(doc(colA, id), { id, titolo, testo, creato: Date.now(), scade }); toast('Comunicazione inviata'); render(); }
    catch (e) { $('cE').textContent = e.code === 'permission-denied' ? 'Permesso negato: aggiorna le regole di Firebase.' : 'Invio non riuscito. Riprova.'; }
  };
  $('vista').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!await conferma('Eliminare la comunicazione?', 'I clienti non la vedranno più.', 'Elimina')) return; try { await deleteDoc(doc(colA, b.dataset.del)); toast('Eliminata'); } catch (e) { toast('Non riuscito.'); } });
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
    <div class="grid3" style="margin-top:10px"><label>Ragione sociale<input data-k="ragioneSociale" value="${esc(D.ragioneSociale || '')}" placeholder="Es. Radici di Mario Rossi"></label><label>Partita IVA<input data-k="piva" value="${esc(D.piva || '')}"></label><label>Email del salone<input data-k="email" type="email" value="${esc(D.email || '')}"></label></div>
    <div class="grid3" style="margin-top:10px"><label>Telefono<input data-k="telefono" value="${esc(D.telefono || '')}"></label><label>WhatsApp<input data-k="whatsapp" value="${esc(D.whatsapp || '')}" placeholder="+39…"></label><label>Instagram<input data-k="instagram" value="${esc(D.instagram || '')}" placeholder="@nomeprofilo"></label></div></div>
   <div class="card"><h3>Immagini</h3>${img('logo', 'Logo', 300)}${img('cover', 'Foto di copertina', 1200)}</div>
   <div class="card"><h3>Testi legali</h3><p class="hint">Mostrati ai clienti nel profilo. Le parole tra {{ }} si riempiono da sole con i dati qui sopra e con le regole di prenotazione: {{nome}} {{ragione}} {{piva}} {{indirizzo}} {{email}} {{telefono}} {{annullo}} {{anticipo}} {{giorniMax}} {{maxAttive}} {{maxServizi}}. Le righe che iniziano con ## diventano titoli.</p>
    <label>Informativa privacy<textarea data-k="privacy" style="min-height:260px">${esc(D.privacy || window.RADICI_SEED.privacy)}</textarea></label><button class="bt sm" data-std="privacy" style="margin-top:6px">Ripristina il testo standard</button>
    <label style="margin-top:14px">Termini e condizioni<textarea data-k="termini" style="min-height:260px">${esc(D.termini || window.RADICI_SEED.termini)}</textarea></label><button class="bt sm" data-std="termini" style="margin-top:6px">Ripristina il testo standard</button></div>`;
  leggi($('vista'));
  $('vista').querySelectorAll('[data-img]').forEach(el => el.onchange = async () => { const f = el.files[0]; if (!f) return; D[el.dataset.img] = await riduci(f, +el.dataset.lato); segna(); render(); });
  $('vista').querySelectorAll('[data-std]').forEach(b => b.onclick = () => { D[b.dataset.std] = window.RADICI_SEED[b.dataset.std]; segna(); render(); });
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

/* ---------- GALLERIA: album di foto dei lavori, salvate nel database (miniatura + foto grande separata) ---------- */
let albumSel = null;
const albumDi = () => (C.album || []);
function vGalleria() {
  const A = albumDi();
  if (!albumSel || !A.some(a => a.id === albumSel)) albumSel = A[0] ? A[0].id : null;
  const foto = GA.filter(f => f.album === albumSel).sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
  $('vista').innerHTML = `<p class="hint">Le foto compaiono ai clienti in “Informazioni negozio”. Vengono rimpicciolite automaticamente. Pubblica foto di persone solo con il loro consenso.</p>
   <div class="optabs gal">${A.map(a => `<button data-al="${esc(a.id)}" aria-pressed="${a.id === albumSel}">${esc(a.nome)} <small>${GA.filter(f => f.album === a.id).length}</small></button>`).join('')}<button id="alNuovo">+ Nuovo album</button></div>
   ${albumSel ? `<div class="bar"><b style="flex:1;font:400 1.4rem 'Fraunces',serif;color:var(--head)">${esc((A.find(a => a.id === albumSel) || {}).nome || '')}</b><button class="bt sm" id="alRin">✎ Rinomina</button><button class="bt sm no" id="alDel">Elimina album</button>
     <label class="bt pri" style="cursor:pointer">+ Aggiungi foto<input type="file" id="gFile" accept="image/*" multiple hidden></label></div>
     <p class="hint" id="gStato"></p>
     <div class="ggrid">${foto.map((f, i) => `<div class="gfoto"><img src="${f.mini}" alt="" loading="lazy"><div class="gaz"><button class="ib" data-gsu="${i}" title="Sposta prima" ${i ? '' : 'disabled'}>←</button><label class="ib" title="Sostituisci foto" style="cursor:pointer">🖼<input type="file" accept="image/*" data-gsost="${esc(f.id)}" hidden></label><button class="ib no" data-gdel="${esc(f.id)}" title="Elimina">🗑</button><button class="ib" data-ggiu="${i}" title="Sposta dopo" ${i < foto.length - 1 ? '' : 'disabled'}>→</button></div></div>`).join('') || '<p class="hint">Nessuna foto in questo album: tocca “Aggiungi foto”.</p>'}</div>`
   : '<div class="card"><p class="hint" style="margin:0">Crea il primo album con “+ Nuovo album”, per esempio “Tagli uomo” o “Nail art”.</p></div>'}`;
  const salvaAlbum = async l => { try { await setDoc(SAL, { album: l }, { merge: true }); C.album = l; if (D) D.album = cp(l); render(); } catch (e) { toast(e.code === 'permission-denied' ? 'Permesso negato: controlla le regole di Firebase.' : 'Non riuscito.'); } };
  const chiediNome = (t, v) => new Promise(r => { finestra(`<h3>${t}</h3><label>Nome dell’album<input id="alN" maxlength="40" value="${esc(v || '')}"></label><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt" id="alX">Annulla</button><button class="bt pri" id="alOk">Salva</button></div>`); $('alN').focus(); $('alX').onclick = () => { chiudi(); r(null); }; $('alOk').onclick = () => { const n = $('alN').value.trim(); if (!n) return; chiudi(); r(n); }; });
  $('vista').querySelectorAll('[data-al]').forEach(b => b.onclick = () => { albumSel = b.dataset.al; render(); });
  $('alNuovo').onclick = async () => { const n = await chiediNome('Nuovo album'); if (!n) return; const id = nid('al'); albumSel = id; salvaAlbum(albumDi().concat({ id, nome: n })); };
  if (!albumSel) return;
  $('alRin').onclick = async () => { const a = albumDi().find(x => x.id === albumSel), n = await chiediNome('Rinomina album', a.nome); if (!n) return; salvaAlbum(albumDi().map(x => x.id === albumSel ? { id: x.id, nome: n } : x)); };
  $('alDel').onclick = async () => {
    if (!await conferma('Eliminare l’album?', foto.length ? 'Verranno eliminate anche le ' + foto.length + ' foto che contiene.' : '', 'Elimina')) return;
    try { for (let i = 0; i < foto.length; i += 200) { const w = writeBatch(db); foto.slice(i, i + 200).forEach(f => { w.delete(doc(colG, f.id)); w.delete(doc(colGF, f.id)); }); await w.commit(); } } catch (e) { toast('Non riuscito.'); return; }
    const l = albumDi().filter(x => x.id !== albumSel); albumSel = null; salvaAlbum(l);
  };
  const carica = async (file, id, ordine) => {
    const [mini, img] = await Promise.all([riduci(file, 420), riduci(file, 1400)]);
    const w = writeBatch(db); w.set(doc(colG, id), { id, album: albumSel, mini, ordine, creata: Date.now() }, { merge: true }); w.set(doc(colGF, id), { img }); await w.commit();
  };
  $('gFile').onchange = async e => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    let ord = foto.length ? Math.max(...foto.map(f => f.ordine || 0)) + 1 : 0, ok = 0;
    for (const f of files) { $('gStato').textContent = 'Carico la foto ' + (ok + 1) + ' di ' + files.length + '…'; try { await carica(f, nid('g'), ord++); ok++; } catch (x) { toast(x.code === 'permission-denied' ? 'Permesso negato: aggiorna le regole di Firebase.' : 'Una foto non è stata caricata.'); } }
    $('gStato').textContent = ''; if (ok) toast(ok === 1 ? 'Foto aggiunta' : ok + ' foto aggiunte');
  };
  $('vista').querySelectorAll('[data-gsost]').forEach(el => el.onchange = async () => { const f = el.files[0]; if (!f) return; const v = GA.find(x => x.id === el.dataset.gsost); try { await carica(f, v.id, v.ordine || 0); toast('Foto sostituita'); } catch (x) { toast('Non riuscito.'); } });
  $('vista').querySelectorAll('[data-gdel]').forEach(b => b.onclick = async () => { if (!await conferma('Eliminare la foto?', '', 'Elimina')) return; try { const w = writeBatch(db); w.delete(doc(colG, b.dataset.gdel)); w.delete(doc(colGF, b.dataset.gdel)); await w.commit(); } catch (e) { toast('Non riuscito.'); } });
  const scambia = async (i, j) => { const a = foto[i], b = foto[j]; if (!a || !b) return; const w = writeBatch(db), oa = a.ordine || i, ob = b.ordine || j; w.update(doc(colG, a.id), { ordine: ob === oa ? j : ob }); w.update(doc(colG, b.id), { ordine: ob === oa ? i : oa }); try { await w.commit(); } catch (e) { toast('Non riuscito.'); } };
  $('vista').querySelectorAll('[data-gsu]').forEach(b => b.onclick = () => scambia(+b.dataset.gsu, +b.dataset.gsu - 1));
  $('vista').querySelectorAll('[data-ggiu]').forEach(b => b.onclick = () => scambia(+b.dataset.ggiu, +b.dataset.ggiu + 1));
}
