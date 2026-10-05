/* Valmo RTO Shield prototype - application logic (vanilla JS, no build step). */
'use strict';
(function(){
/* =========================================================
   1. CONFIG: every business rule lives here, so hubs can tune
      without code changes
   ========================================================= */
const CONFIG = window.VALMO_CONFIG;
const RTO_COST = () => CONFIG.intent.forwardCost + CONFIG.intent.reverseCost;
const ZONES = { standard: 'Standard zone', highRto: 'High-RTO zone', rural: 'Rural / Tier 3+' };

/* =========================================================
   2. SEED DATA
   ========================================================= */
const HOUR = 36e5, DAY = 864e5;
const SIM_START = new Date(2026, 8, 28, 10, 0, 0).getTime(); // Mon 28 Sep 2026, 10:00
const SEED = [
  { id:'MSH-48217', awb:'VM7710482171', name:'Priya', fullName:'Priya Verma', phone:'98XXXXX214', product:'Rayon Kurti', qty:2, price:349, cat:'kurti',
    address:'House No. 12, Near Shiv Mandir, Raj Nagar', city:'Lucknow', pin:'226017', eddDays:2,
    flags:{ firstTime:true, nonStdAddress:true, highRtoPin:false, pastRto:0 }, featurePhone:false, km:6.4, zone:'highRto' },
  { id:'MSH-48233', awb:'VM7710482334', name:'Ravi', fullName:'Ravi Kumar', phone:'97XXXXX803', product:'Wireless Earbuds', qty:1, price:599, cat:'earbuds',
    address:'Ward 7, Behind Govt. School, Bakshi Ka Talab', city:'Lucknow', pin:'226201', eddDays:2,
    flags:{ firstTime:false, nonStdAddress:false, highRtoPin:true, pastRto:2 }, featurePhone:true, km:11.8, zone:'rural' },
  { id:'MSH-48251', awb:'VM7710482510', name:'Anjali', fullName:'Anjali Singh', phone:'99XXXXX562', product:'Banarasi Saree', qty:1, price:899, cat:'saree',
    address:'B-204, Shalimar Garden Apartments, Gomti Nagar', city:'Lucknow', pin:'226010', eddDays:2,
    flags:{ firstTime:false, nonStdAddress:false, highRtoPin:false, pastRto:0 }, featurePhone:false, km:3.2, zone:'standard' },
  { id:'MSH-48262', awb:'VM7710482627', name:'Imran', fullName:'Mohd. Imran', phone:'91XXXXX377', product:'Steel Kitchen Set', qty:1, price:1249, cat:'kitchen',
    address:'Village Kursi, Near Pradhan Ghar', city:'Barabanki', pin:'225001', eddDays:3,
    flags:{ firstTime:false, nonStdAddress:true, highRtoPin:true, pastRto:0 }, featurePhone:false, km:14.5, zone:'rural' },
  { id:'MSH-48270', awb:'VM7710482705', name:'Sunita', fullName:'Sunita Devi', phone:'88XXXXX149', product:'Cotton Bedsheet Set', qty:1, price:829, cat:'bedsheet',
    address:'H-56, Sector 9, Indira Nagar', city:'Lucknow', pin:'226016', eddDays:2,
    flags:{ firstTime:true, nonStdAddress:false, highRtoPin:false, pastRto:0 }, featurePhone:false, km:4.1, zone:'standard' }
];

/* =========================================================
   3. COPY (EN / HI). Channel adapters render these strings.
   ========================================================= */
const DAYS = { en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], hi:['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'] };
const MONTHS = { en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], hi:['जन','फ़र','मार्च','अप्रै','मई','जून','जुल','अग','सित','अक्टू','नव','दिस'] };
const T = {
  en: {
    tpl: (o, d) => `Hi ${o.name} 👋\nYour Meesho order is packed and ready to ship.\n\n*${o.qty} × ${o.product}*\nCash to pay on delivery: *${inr(o.price)}*\nExpected delivery: *${d}*\n\nWill you be available to receive it?`,
    tplSms: (o, d) => `Meesho: ${o.qty} x ${o.product}, COD Rs ${o.price}, delivery ${d}. Will you receive it?`,
    confirm:'Confirm order', change:'Change date', cancel:'Cancel order',
    addrAsk:'Thanks! One quick check so the delivery partner finds you. Is this pin at your door?',
    addrAskSms: o => `Is this your address? ${o.address}, ${o.city} ${o.pin}`,
    addrOk:'Yes, this is right', addrEdit:'Move the pin', addrCall:'Partner should call me',
    addrEditAsk:'Tap the map where your door is, then save.', addrSave:'Save location',
    confirmed: (o, d) => `Order confirmed ✅\nPlease keep *${inr(o.price)}* cash ready on ${d}.`,
    datesAsk:'When should we deliver?', asPlanned:'(as planned)', payday:'Payday window',
    rescheduled: (o, d) => `Done ✅ New delivery date: *${d}*\nPlease keep ${inr(o.price)} cash ready.`,
    reasonsAsk:'What changed? It helps us do better.',
    reasons:{ mistake:'Ordered by mistake', cash:"Won't have cash", late:'Delivery is too late', keep:'Keep my order' },
    upiAsk: (amt, d) => `No cash at home? Pay *${amt}* now with UPI and save ₹${CONFIG.intent.upiDiscount}. Delivery stays on ${d}.`,
    upiPay:'Pay with UPI', upiNo:'Cancel order',
    paid: amt => `Payment received ✅ ${amt}\nNo cash needed at delivery.`,
    cancelled:'Your order is cancelled. No charges apply.',
    reminder:'Reminder: please confirm your order so we can ship it.',
    held:'Your order is paused because we did not hear back. Confirm to ship it.',
    autoCancelled:'We cancelled your order because we could not reach you. No charges apply.',
    smsReply:'Reply', biz:'Business account', today:'Today', msgPh:'Message',
    landmark:'Suggested landmark: Shiv Mandir'
  },
  hi: {
    tpl: (o, d) => `नमस्ते ${o.name} 👋\nआपका Meesho ऑर्डर पैक है और भेजने के लिए तैयार है।\n\n*${o.qty} × ${o.product}*\nडिलीवरी पर नकद: *${inr(o.price)}*\nअनुमानित डिलीवरी: *${d}*\n\nक्या आप ऑर्डर लेने के लिए उपलब्ध रहेंगे?`,
    tplSms: (o, d) => `Meesho: ${o.qty} x ${o.product}, नकद Rs ${o.price}, डिलीवरी ${d}. क्या आप ऑर्डर लेंगे?`,
    confirm:'ऑर्डर पक्का करें', change:'तारीख बदलें', cancel:'ऑर्डर रद्द करें',
    addrAsk:'धन्यवाद! एक छोटी जाँच, ताकि डिलीवरी पार्टनर आप तक आसानी से पहुँचे। क्या यह पिन आपके दरवाज़े पर है?',
    addrAskSms: o => `क्या यह आपका पता है? ${o.address}, ${o.city} ${o.pin}`,
    addrOk:'हाँ, यह सही है', addrEdit:'पिन खिसकाएँ', addrCall:'पार्टनर मुझे कॉल करे',
    addrEditAsk:'मैप पर अपने दरवाज़े की जगह टैप करें, फिर सेव करें।', addrSave:'लोकेशन सेव करें',
    confirmed: (o, d) => `ऑर्डर पक्का ✅\n${d} को *${inr(o.price)}* नकद तैयार रखें।`,
    datesAsk:'हम कब डिलीवर करें?', asPlanned:'(तय तारीख)', payday:'वेतन वाले दिन',
    rescheduled: (o, d) => `हो गया ✅ नई डिलीवरी तारीख: *${d}*\n${inr(o.price)} नकद तैयार रखें।`,
    reasonsAsk:'क्या बदला? बताने से हमें बेहतर बनने में मदद मिलती है।',
    reasons:{ mistake:'गलती से ऑर्डर हुआ', cash:'नकद नहीं होगा', late:'डिलीवरी बहुत देर से', keep:'ऑर्डर रखें' },
    upiAsk: (amt, d) => `घर पर नकद नहीं? अभी UPI से *${amt}* दें और ₹${CONFIG.intent.upiDiscount} बचाएँ। डिलीवरी ${d} को ही होगी।`,
    upiPay:'UPI से भुगतान करें', upiNo:'ऑर्डर रद्द करें',
    paid: amt => `भुगतान मिला ✅ ${amt}\nडिलीवरी पर नकद की ज़रूरत नहीं।`,
    cancelled:'आपका ऑर्डर रद्द कर दिया गया है। कोई शुल्क नहीं लगेगा।',
    reminder:'याद दिलाना: कृपया ऑर्डर पक्का करें ताकि हम इसे भेज सकें।',
    held:'जवाब न मिलने से ऑर्डर रोका गया है। भेजने के लिए ऑर्डर पक्का करें।',
    autoCancelled:'आपसे संपर्क न हो पाने के कारण ऑर्डर रद्द किया गया। कोई शुल्क नहीं लगेगा।',
    smsReply:'जवाब दें', biz:'बिज़नेस अकाउंट', today:'आज', msgPh:'संदेश',
    landmark:'सुझाया गया लैंडमार्क: शिव मंदिर'
  }
};

/* =========================================================
   4. UTILITIES
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const cr = n => '₹' + Math.round(n / 1e7).toLocaleString('en-IN') + ' Cr';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let _uid = 0; const uid = p => (p || 'id') + (++_uid);
function startOfDay(ts){ const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function fmtDay(ts, lang){ const L = lang || 'en'; const d = new Date(ts); return `${DAYS[L][d.getDay()]}, ${d.getDate()} ${MONTHS[L][d.getMonth()]}`; }
function fmtTime(ts){ const d = new Date(ts); let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2,'0')} ${ap}`; }
function fmtClockShort(ts){ const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; }
function fmtDur(ms){ if (ms <= 0) return '0h 00m'; const t = Math.floor(ms / 60000); return `${Math.floor(t/60)}h ${String(t%60).padStart(2,'0')}m`; }
function eddLabel(edd, lang){
  const L = lang || 'en';
  if (edd.endTs){ const a = new Date(edd.ts), b = new Date(edd.endTs); return `${a.getDate()}–${b.getDate()} ${MONTHS[L][b.getMonth()]}`; }
  return fmtDay(edd.ts, L);
}
function waFormat(text){ return esc(text).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function plain(text){ return String(text).replace(/\*(.+?)\*/g, '$1'); }
function getPath(obj, path){ return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, val){ const ks = path.split('.'); const last = ks.pop(); const t = ks.reduce((o, k) => o[k], obj); t[last] = val; }

const P = {
  check:'<polyline points="20 6 9 17 4 12"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  back:'<polyline points="15 18 9 12 15 6"/>',
  list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  wallet:'<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/>',
  award:'<circle cx="12" cy="8" r="6"/><polyline points="8.2 13.9 7 23 12 20 17 23 15.8 13.9"/>',
  mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  truck:'<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  star:'<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  verified:'<path d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7.9-2.9 3 .2z" fill="#25D366" stroke="none"/><polyline points="8.5 12 11 14.5 15.5 9.5" stroke="#fff"/>'
};
const icon = (n, s) => `<svg class="ic" width="${s||16}" height="${s||16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

function productArt(cat){
  const bg = { kurti:'#FCE4F1', earbuds:'#E7ECFB', saree:'#FFF1DC', kitchen:'#E6F4EF', bedsheet:'#EEE8FB' }[cat] || '#EEE';
  const art = {
    kurti:'<path d="M50 14L38 20L26 34L36 42L42 36L42 92L78 92L78 36L84 42L94 34L82 20L70 14Q60 23 50 14Z" fill="#E0218A"/><g fill="#fff" opacity=".6"><circle cx="52" cy="50" r="2.5"/><circle cx="68" cy="50" r="2.5"/><circle cx="60" cy="62" r="2.5"/><circle cx="52" cy="74" r="2.5"/><circle cx="68" cy="74" r="2.5"/></g>',
    earbuds:'<rect x="32" y="26" width="22" height="30" rx="11" fill="#2A2F45"/><rect x="40" y="50" width="7" height="24" rx="3.5" fill="#2A2F45"/><rect x="66" y="26" width="22" height="30" rx="11" fill="#2A2F45"/><rect x="73" y="50" width="7" height="24" rx="3.5" fill="#2A2F45"/><circle cx="43" cy="38" r="4" fill="#6C7BD9"/><circle cx="77" cy="38" r="4" fill="#6C7BD9"/>',
    saree:'<rect x="22" y="28" width="76" height="46" rx="5" fill="#B5179E"/><rect x="22" y="62" width="76" height="12" fill="#F2B705"/><path d="M22 40h76" stroke="#F2B705" stroke-width="3"/><g fill="#F2B705" opacity=".8"><circle cx="40" cy="51" r="2"/><circle cx="60" cy="51" r="2"/><circle cx="80" cy="51" r="2"/></g>',
    kitchen:'<ellipse cx="60" cy="42" rx="34" ry="7" fill="#9AA5B1"/><path d="M26 42h68v22a12 12 0 0 1-12 12H38a12 12 0 0 1-12-12z" fill="#C0C9D2"/><rect x="12" y="46" width="16" height="6" rx="3" fill="#6B7785"/><rect x="92" y="46" width="16" height="6" rx="3" fill="#6B7785"/><rect x="54" y="30" width="12" height="6" rx="3" fill="#6B7785"/>',
    bedsheet:'<rect x="20" y="58" width="80" height="16" rx="3" fill="#7C5CD6"/><rect x="25" y="43" width="70" height="16" rx="3" fill="#A48BEA"/><rect x="30" y="28" width="60" height="16" rx="3" fill="#CDBEF7"/>'
  }[cat] || '';
  return `<svg viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="100" fill="${bg}"/>${art}</svg>`;
}

function toast(text, tone){
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (tone ? ' ' + tone : '');
  el.innerHTML = icon(tone === 'bad' ? 'x' : 'check', 18) + `<span>${esc(text)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.remove(); }, 3800);
  while (box.children.length > 3) box.firstChild.remove();
}

/* =========================================================
   5. STATE
   ========================================================= */
const state = { view:'intent', now:SIM_START, gen:0, selected:null, orders:[], events:[], pilot:null };

function freshOrder(s){
  const o = JSON.parse(JSON.stringify(s));
  Object.assign(o, {
    state:'READY', risk:null, chat:[], lang:'en', channel: s.featurePhone ? 'sms' : 'whatsapp',
    edd:{ ts: startOfDay(SIM_START) + s.eddDays * DAY }, typing:false, deadline:null, holdUntil:null,
    readyAt:null, sentAt:null, respondedAt:null, reminded:false, allocated:false, prepaid:false,
    addressVerified:false, landmarkCall:false, cancelReason:null
  });
  return o;
}
function freshPilot(){
  return {
    screen:'tasks', active:null, result:null, ledger:[], shiftAttemptPaid:0,
    monthly:{ assigned:452, delivered:412, rto:30 },
    sim:{ gps:72, answered:true, reuse:false },
    lastPhotoSeed:null, usedSeeds:[], parcels:{}
  };
}
function reset(){
  stopCall();
  state.gen++; state.now = SIM_START; state.events = [];
  state.orders = SEED.map(freshOrder);
  state.selected = state.orders[0].id;
  state.pilot = freshPilot();
  state.orders.forEach(o => { state.pilot.parcels[o.id] = { status:'pending', attempts:0, attemptPaid:false, distancePaid:false }; });
  const g = $('#sim-gps'); if (g){ g.value = 72; $('#sim-gps-out').textContent = '72 m'; }
  const a = $('#sim-answer'); if (a) a.checked = true;
  const r = $('#sim-reuse'); if (r) r.checked = false;
}
const sel = () => state.orders.find(o => o.id === state.selected) || state.orders[0];

function emit(orderId, name, payload, src){
  state.events.unshift({ id:uid('e'), t:state.now, orderId, name, src: src || 'intent', payload:Object.assign({ orderId, at:new Date(state.now).toISOString() }, payload || {}) });
  if (state.events.length > 400) state.events.length = 400;
}

/* =========================================================
   6. RISK ENGINE
   ========================================================= */
function scoreRisk(o){
  const w = CONFIG.intent.weights, f = o.flags, factors = [];
  if (f.firstTime) factors.push({ label:'First-time buyer', pts:w.firstTime });
  if (f.nonStdAddress) factors.push({ label:'Landmark-only address', pts:w.nonStdAddress });
  if (f.highRtoPin) factors.push({ label:`High-RTO pincode ${o.pin}`, pts:w.highRtoPin });
  if (o.price >= CONFIG.intent.highValueAt) factors.push({ label:`COD of ${inr(CONFIG.intent.highValueAt)} or more`, pts:w.highValue });
  if (f.pastRto > 0){ const n = Math.min(f.pastRto, w.pastRtoMax); factors.push({ label:`${f.pastRto} past RTO${f.pastRto > 1 ? 's' : ''} on this phone`, pts:n * w.pastRtoEach }); }
  const score = Math.min(100, factors.reduce((s, x) => s + x.pts, 0));
  const th = CONFIG.intent.thresholds;
  const tier = score >= th.high ? 'high' : score >= th.medium ? 'medium' : 'low';
  return { score, tier, factors };
}
const TIER_LABEL = { high:'High risk', medium:'Medium risk', low:'Low risk' };
function policyText(tier){
  const c = CONFIG.intent;
  if (tier === 'high') return `Must confirm within ${c.confirmWindowHrs} h. No reply puts the order on hold for ${c.holdHrs} h, then it is cancelled before any linehaul is spent.`;
  if (tier === 'medium') return `Asked to confirm within ${c.confirmWindowHrs} h. No reply still dispatches, flagged so the pilot calls before visiting.`;
  return 'Informed only and allocated straight away. The customer can still cancel or move the date from the same message.';
}

/* =========================================================
   7. INTENT FLOW (channel-agnostic state machine)
   ========================================================= */
const STATES = {
  READY:{ label:'Ready to ship', tone:'neutral' }, AWAITING:{ label:'Awaiting reply', tone:'info' },
  HELD:{ label:'On hold', tone:'warn' }, CONFIRMED:{ label:'Confirmed', tone:'ok' },
  RESCHEDULED:{ label:'Date changed', tone:'ok' }, PREPAID:{ label:'Paid by UPI', tone:'ok' },
  CANCELLED:{ label:'Cancelled by customer', tone:'bad' }, AUTO_CANCELLED:{ label:'Auto-cancelled', tone:'bad' },
  AUTO_CLEARED:{ label:'Auto-cleared', tone:'ok' }, DISPATCH_UNCONFIRMED:{ label:'Dispatched, call first', tone:'warn' }
};
const OPEN = new Set(['AWAITING','HELD','AUTO_CLEARED','DISPATCH_UNCONFIRMED']);
const CANCELLED = new Set(['CANCELLED','AUTO_CANCELLED']);

function pushBot(o, m){ o.chat.push(Object.assign({ id:uid('m'), from:'bot', t:state.now, done:false }, m)); }
function pushUser(o, text){ o.chat.push({ id:uid('m'), from:'user', t:state.now, type:'text', text, done:true }); }
function closeAll(o){ o.chat.forEach(m => { m.done = true; }); }
function tplOptions(t){ return [ { label:t.confirm, act:'confirm' }, { label:t.change, act:'change_date' }, { label:t.cancel, act:'cancel' } ]; }

function markReady(o){
  if (!o || o.state !== 'READY') return;
  const t = T[o.lang];
  o.risk = scoreRisk(o); o.readyAt = state.now;
  emit(o.id, 'seller.order_ready', { seller:'SLR-20931', codAmount:o.price, pincode:o.pin });
  emit(o.id, 'intent.risk_scored', { score:o.risk.score, tier:o.risk.tier, factors:o.risk.factors.map(f => f.label) });
  o.sentAt = state.now;
  pushBot(o, { type:'tpl', text:t.tpl(o, eddLabel(o.edd, o.lang)), sms:t.tplSms(o, eddLabel(o.edd, 'en')), options:tplOptions(t) });
  emit(o.id, 'intent.message_sent', { channel:o.channel, template:'cod_intent_v2', lang:o.lang, actions:['confirm','change_date','cancel'] });
  if (o.risk.tier === 'low'){
    o.state = 'AUTO_CLEARED'; o.allocated = true;
    emit(o.id, 'fm.partner_allocated', { reason:'low_risk_auto_clear', partner:'FM-LKO-07' });
  } else {
    o.state = 'AWAITING'; o.deadline = state.now + CONFIG.intent.confirmWindowHrs * HOUR; o.reminded = false;
    emit(o.id, 'fm.allocation_gated', { until:new Date(o.deadline).toISOString(), tier:o.risk.tier });
  }
}

function allocate(o, reason){
  if (o.allocated) return;
  o.allocated = true;
  emit(o.id, 'fm.partner_allocated', { reason, partner:'FM-LKO-07' });
}
function finishConfirm(o, newState){
  const t = T[o.lang];
  closeAll(o); o.state = newState || 'CONFIRMED'; o.respondedAt = state.now;
  pushBot(o, { type:'text', text:t.confirmed(o, eddLabel(o.edd, o.lang)) });
  emit(o.id, 'intent.confirmed', { edd:eddLabel(o.edd), addressVerified:o.addressVerified, landmarkCall:o.landmarkCall });
  allocate(o, 'customer_confirmed');
  toast(`${o.fullName} confirmed. First-mile partner allocated.`, 'ok');
}
function finishCancel(o, reason){
  const t = T[o.lang];
  closeAll(o); o.state = 'CANCELLED'; o.cancelReason = reason; o.respondedAt = state.now;
  pushBot(o, { type:'text', text:t.cancelled });
  emit(o.id, 'intent.cancelled', { reason, stage:'pre_dispatch', rtoCostAvoided:RTO_COST() });
  if (o.allocated) emit(o.id, 'fm.allocation_released', { reason:'customer_cancelled' });
  toast(`${o.fullName} cancelled before dispatch. ${inr(RTO_COST())} RTO cost avoided.`, 'ok');
}
function dateOptions(o){
  const t = T[o.lang], L = o.lang, d0 = startOfDay(o.edd.ts), d = new Date(d0);
  let ws, we;
  if (d.getDate() > 5){ ws = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); we = new Date(d.getFullYear(), d.getMonth() + 1, 5).getTime(); }
  else { ws = d0; we = new Date(d.getFullYear(), d.getMonth(), 5).getTime(); }
  return [
    { label:`${fmtDay(d0, L)} ${t.asPlanned}`, act:'date', edd:{ ts:d0 }, same:true },
    { label:fmtDay(d0 + DAY, L), act:'date', edd:{ ts:d0 + DAY } },
    { label:fmtDay(d0 + 3 * DAY, L), act:'date', edd:{ ts:d0 + 3 * DAY } },
    { label:`${t.payday} (${eddLabel({ ts:ws, endTs:we }, L)})`, act:'date', edd:{ ts:ws, endTs:we } }
  ];
}

function runAction(o, opt, msg){
  const t = T[o.lang];
  switch (opt.act){
    case 'confirm':
    case 'keep':
      if (o.flags.nonStdAddress && !o.addressVerified){
        if (o.channel === 'sms') pushBot(o, { type:'text', text:t.addrAskSms(o), options:[ { label:t.addrOk, act:'addr_ok' }, { label:t.addrCall, act:'addr_call' } ] });
        else pushBot(o, { type:'addr', text:t.addrAsk, pin:{ x:36, y:66 }, options:[ { label:t.addrOk, act:'addr_ok' }, { label:t.addrEdit, act:'addr_edit' } ] });
        emit(o.id, 'address.check_requested', { reason:'landmark_only_address' });
      } else finishConfirm(o);
      break;
    case 'change_date':
      pushBot(o, { type:'text', text:t.datesAsk, list:true, options:dateOptions(o) });
      break;
    case 'date':
      if (opt.same){ finishConfirm(o); break; }
      o.edd = opt.edd;
      closeAll(o); o.state = 'RESCHEDULED'; o.respondedAt = state.now;
      pushBot(o, { type:'text', text:t.rescheduled(o, eddLabel(o.edd, o.lang)) });
      emit(o.id, 'intent.rescheduled', { newEdd:eddLabel(o.edd), paydayWindow:!!o.edd.endTs });
      allocate(o, 'customer_rescheduled');
      toast(`${o.fullName} moved delivery to ${eddLabel(o.edd)}.`, 'ok');
      break;
    case 'cancel':
      pushBot(o, { type:'text', text:t.reasonsAsk, list:true, options:[
        { label:t.reasons.mistake, act:'reason', arg:'mistake' }, { label:t.reasons.cash, act:'reason', arg:'no_cash' },
        { label:t.reasons.late, act:'reason', arg:'too_late' }, { label:t.reasons.keep, act:'keep' } ] });
      break;
    case 'reason':
      if (opt.arg === 'no_cash'){
        const amt = inr(o.price - CONFIG.intent.upiDiscount);
        pushBot(o, { type:'pay', text:t.upiAsk(amt, eddLabel(o.edd, o.lang)) + (o.channel === 'sms' ? (o.lang === 'hi' ? ' UPI 123PAY से किसी भी फ़ोन पर।' : ' Works on any phone with UPI 123PAY.') : ''), options:[ { label:t.upiPay, act:'upi_pay' }, { label:t.upiNo, act:'reason', arg:'no_cash_declined_upi' } ] });
        emit(o.id, 'intent.prepaid_offer_shown', { discount:CONFIG.intent.upiDiscount });
      } else finishCancel(o, opt.arg);
      break;
    case 'upi_pay': {
      const amt = o.price - CONFIG.intent.upiDiscount;
      closeAll(o); o.prepaid = true; o.state = 'PREPAID'; o.respondedAt = state.now;
      pushBot(o, { type:'text', text:t.paid(inr(amt)) });
      emit(o.id, 'payment.cod_converted_to_prepaid', { amount:amt, method:'UPI' });
      allocate(o, 'prepaid');
      toast(`${o.fullName} switched to UPI. No cash risk at the door.`, 'ok');
      break;
    }
    case 'addr_ok':
      o.addressVerified = true;
      emit(o.id, 'address.verified', { method:'customer_confirmed_pin' });
      finishConfirm(o);
      break;
    case 'addr_call':
      o.landmarkCall = true;
      emit(o.id, 'address.callback_requested', { channel:'sms' });
      finishConfirm(o);
      break;
    case 'addr_edit':
      pushBot(o, { type:'addrEdit', text:t.addrEditAsk, pin:Object.assign({}, msg.pin || { x:36, y:66 }), options:[ { label:t.addrSave, act:'addr_save' } ] });
      break;
    case 'addr_save': {
      const from = { x:36, y:66 }, p = msg.pin || from;
      const deltaM = Math.round(Math.hypot((p.x - from.x) * 3, (p.y - from.y) * 1.6));
      o.addressVerified = true;
      emit(o.id, 'address.pin_corrected', { movedMetres:deltaM, newPin:{ x:+p.x.toFixed(1), y:+p.y.toFixed(1) } });
      finishConfirm(o);
      break;
    }
    default: break;
  }
}

function onCustomerAction(msgId, optIdx){
  const o = sel(); if (!o) return;
  const msg = o.chat.find(m => m.id === msgId);
  if (!msg || msg.done || !msg.options) return;
  const opt = msg.options[optIdx];
  if (!opt || !OPEN.has(o.state) || o.typing) return;
  msg.done = true; msg.picked = optIdx;
  pushUser(o, opt.label);
  emit(o.id, 'intent.customer_reply', { channel:o.channel, action:opt.act, arg:opt.arg || null });
  o.typing = true;
  render();
  const gen = state.gen, oid = o.id;
  setTimeout(() => {
    if (gen !== state.gen) return;
    const ord = state.orders.find(x => x.id === oid); if (!ord) return;
    ord.typing = false;
    runAction(ord, opt, msg);
    render();
  }, REDUCED ? 120 : 700);
}

function processClock(){
  const c = CONFIG.intent;
  for (const o of state.orders){
    const t = T[o.lang];
    if (o.state === 'AWAITING'){
      const remindAt = o.deadline - c.reminderBeforeHrs * HOUR;
      if (!o.reminded && state.now >= remindAt && state.now < o.deadline){
        o.reminded = true; pushBot(o, { type:'text', text:t.reminder });
        emit(o.id, 'intent.reminder_sent', { channel:o.channel });
      }
      if (state.now >= o.deadline){
        if (o.risk.tier === 'high'){
          closeAll(o); o.state = 'HELD'; o.holdUntil = o.deadline + c.holdHrs * HOUR;
          pushBot(o, { type:'text', text:t.held, options:[ { label:t.confirm, act:'confirm' }, { label:t.cancel, act:'cancel' } ] });
          emit(o.id, 'intent.hold_placed', { reason:'no_reply_in_window', autoCancelAt:new Date(o.holdUntil).toISOString() });
        } else {
          o.state = 'DISPATCH_UNCONFIRMED';
          emit(o.id, 'intent.window_expired', { action:'dispatch_with_call_first_flag' });
          allocate(o, 'medium_risk_timeout');
        }
      }
    }
    if (o.state === 'HELD' && state.now >= o.holdUntil){
      closeAll(o); o.state = 'AUTO_CANCELLED'; o.respondedAt = state.now;
      pushBot(o, { type:'text', text:t.autoCancelled });
      emit(o.id, 'intent.auto_cancelled', { stage:'pre_dispatch', rtoCostAvoided:RTO_COST() });
      toast(`${o.fullName} auto-cancelled after hold. ${inr(RTO_COST())} saved.`, 'bad');
    }
  }
}
function advance(h){ state.now += h * HOUR; processClock(); render(); }

/* =========================================================
   8. INTENT RENDERING
   ========================================================= */
function renderClock(){
  $('#clock').innerHTML = `${fmtDay(state.now)}, ${fmtTime(state.now)}<small>Simulated clock</small>`;
}
function renderQueue(){
  $('#queue').innerHTML = state.orders.map(o => {
    const r = o.risk || scoreRisk(o), s = STATES[o.state], on = o.id === state.selected;
    return `<li><button class="q-item${on ? ' is-sel' : ''}" data-act="select-order" data-id="${o.id}" aria-pressed="${on}">
      <span class="q-art">${productArt(o.cat)}</span>
      <span><span class="q-name">${esc(o.fullName)}</span><br><span class="q-sub">${esc(o.product)}, ${inr(o.price)} COD</span></span>
      <span class="q-tags"><span class="risk risk-${r.tier}">${TIER_LABEL[r.tier]} ${r.score}</span><span class="pill pill-${s.tone}">${s.label}</span></span>
    </button></li>`;
  }).join('');
  const os = state.orders, n = st => os.filter(o => st.includes(o.state)).length;
  const cancelled = n(['CANCELLED','AUTO_CANCELLED']);
  $('#kpis').innerHTML = `
    <div class="kpi hero"><b>${inr(cancelled * RTO_COST())}</b><span>RTO cost avoided before linehaul (${cancelled} order${cancelled === 1 ? '' : 's'} × ${inr(RTO_COST())})</span></div>
    <div class="kpi"><b>${os.filter(o => o.state !== 'READY').length}/${os.length}</b><span>Orders checked</span></div>
    <div class="kpi"><b>${n(['CONFIRMED','RESCHEDULED'])}</b><span>Confirmed or rescheduled</span></div>
    <div class="kpi"><b>${n(['PREPAID'])}</b><span>Switched to UPI</span></div>
    <div class="kpi"><b>${n(['AWAITING','HELD'])}</b><span>Waiting or on hold</span></div>`;
}

function waMap(pin, editable, msgId){
  const px = clamp(pin.x, 3, 97) * 3, py = clamp(pin.y, 5, 97) * 1.3;
  const svg = `<svg viewBox="0 0 300 130" preserveAspectRatio="none" aria-hidden="true">
    <rect width="300" height="130" fill="#E9EFE3"/>
    <rect x="200" y="78" width="80" height="40" rx="6" fill="#CFE5C3"/>
    <path d="M0 52 H300" stroke="#fff" stroke-width="12"/><path d="M120 0 V130" stroke="#fff" stroke-width="10"/>
    <path d="M0 100 Q150 80 300 108" stroke="#fff" stroke-width="7" fill="none"/><path d="M230 0 V52" stroke="#fff" stroke-width="6"/>
    <path d="M0 52 H300" stroke="#F6D77A" stroke-width="2" stroke-dasharray="6 6"/>
    <g transform="translate(186 34)"><rect x="-7" y="-2" width="14" height="10" fill="#E86A3A"/><path d="M-9 -2 L0 -12 L9 -2Z" fill="#C2481C"/></g>
    <text x="198" y="30" font-size="10" fill="#4B5563" font-family="Mukta,sans-serif">Shiv Mandir</text>
    <text x="4" y="47" font-size="9" fill="#6B7280" font-family="Mukta,sans-serif">Raj Nagar Main Rd</text>
    <g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><ellipse cx="0" cy="2" rx="7" ry="2.5" fill="rgba(0,0,0,.2)"/><path d="M0 0 C-10 -12 -10 -24 0 -26 C10 -24 10 -12 0 0Z" fill="#E0218A"/><circle cx="0" cy="-17" r="3.5" fill="#fff"/></g>
  </svg>`;
  if (editable) return `<div class="wa-map map-edit" data-act="pinmap" data-msg="${msgId}" tabindex="0" role="application" aria-label="Map. Click or use arrow keys to move the pin.">${svg}</div>`;
  return `<div class="wa-map">${svg}</div>`;
}

function waMessage(o, m){
  const time = fmtClockShort(m.t);
  const meta = m.from === 'user'
    ? `<span class="meta">${time}<span class="ticks">${icon('check', 12)}${icon('check', 12)}</span></span>`
    : `<span class="meta">${time}</span>`;
  let body = '';
  if (m.type === 'tpl'){
    body = `<div class="bub bot tpl"><div class="tpl-img">${productArt(o.cat)}</div><div class="txt">${waFormat(m.text)}</div><div class="foot">Meesho, delivered by Valmo</div>${meta}</div>`;
  } else if (m.type === 'addr' || m.type === 'addrEdit'){
    const editable = m.type === 'addrEdit' && !m.done;
    body = `<div class="bub bot">${waMap(m.pin, editable, m.id)}<div class="addr-line"><b>${esc(o.address)}</b>, ${esc(o.city)} ${esc(o.pin)}</div><div class="addr-line">${esc(T[o.lang].landmark)}</div><div>${waFormat(m.text)}</div>${meta}</div>`;
  } else if (m.type === 'pay'){
    body = `<div class="bub bot"><div>${waFormat(m.text)}</div><div class="upi"><span>PhonePe</span><span>GPay</span><span>Paytm</span><span>BHIM</span></div>${meta}</div>`;
  } else {
    body = `<div class="bub ${m.from}"><div>${waFormat(m.text)}</div>${meta}</div>`;
  }
  if (m.options && m.from === 'bot'){
    const live = !m.done && OPEN.has(o.state) && !o.typing;
    body += `<div class="wa-btns" role="group">${m.options.map((op, i) => {
      const ic = op.act === 'confirm' || op.act === 'addr_ok' || op.act === 'upi_pay' || op.act === 'addr_save' ? 'check'
        : op.act === 'change_date' || op.act === 'date' ? 'calendar' : op.act === 'cancel' ? 'x' : op.act === 'addr_edit' ? 'pin' : null;
      return `<button class="wa-btn${m.picked === i ? ' picked' : ''}" data-act="wa" data-msg="${m.id}" data-opt="${i}" ${live ? '' : 'disabled'}>${ic ? icon(ic, 15) : ''}${esc(op.label)}</button>`;
    }).join('')}</div>`;
  }
  return body;
}

function renderIntentPhone(){
  const o = sel(), t = T[o.lang], box = $('#iphone');
  const sb = `<div class="statusbar"><span>${fmtClockShort(state.now)}</span><span class="sb-ic">4G <i></i></span></div>`;
  if (o.channel === 'whatsapp'){
    box.className = 'screen wa';
    const msgs = o.chat.map(m => waMessage(o, m)).join('');
    box.innerHTML = `${sb}
      <div class="wa-head">${icon('back', 20)}<div class="wa-avatar">m</div><div><div class="wa-name">Meesho ${icon('verified', 15)}</div><div class="wa-sub">${t.biz}</div></div></div>
      <div class="wa-body" id="chat" aria-live="polite">${o.chat.length ? `<div class="wa-day">${t.today}</div><div class="wa-sys">${icon('shield', 12)} Messages from a verified business</div>${msgs}${o.typing ? '<div class="typing" aria-label="Meesho is typing"><i></i><i></i><i></i></div>' : ''}`
        : `<div class="phone-empty"><div><b>${esc(o.fullName)}'s WhatsApp</b>Nothing here yet. Mark the order ready to ship and the confirmation arrives here.</div></div>`}</div>
      <div class="wa-compose"><span class="wa-input">${t.msgPh}</span><span class="wa-mic">${icon('mic', 18)}</span></div>`;
  } else {
    box.className = 'screen sms';
    let lastOpen = null;
    const msgs = o.chat.map(m => {
      let txt = m.type === 'tpl' ? m.sms : plain(m.text);
      if (m.options && m.from === 'bot') txt += `\n${t.smsReply}: ` + m.options.map((op, i) => `${i + 1} = ${op.label}`).join(', ');
      if (m.options && !m.done) lastOpen = m;
      return `<div class="sms-bub ${m.from}">${esc(txt)}</div>`;
    }).join('');
    const live = lastOpen && OPEN.has(o.state) && !o.typing;
    const keys = [0,1,2,3].map(i => {
      const ok = live && lastOpen.options[i];
      return `<button class="sms-key" ${ok ? `data-act="wa" data-msg="${lastOpen.id}" data-opt="${i}" aria-label="Reply ${i + 1}: ${esc(lastOpen.options[i].label)}"` : 'disabled'}>${i + 1}</button>`;
    }).join('');
    box.innerHTML = `${sb}
      <div class="sms-head">${icon('back', 20)}<div class="sms-avatar">VM</div><div><div class="sms-name">VM-MEESHO</div><div class="sms-sub">SMS fallback for feature phones</div></div></div>
      <div class="sms-body" id="chat" aria-live="polite">${o.chat.length ? `<div class="sms-time">${fmtDay(o.sentAt)}, ${fmtTime(o.sentAt)}</div>${msgs}${o.typing ? '<div class="sms-bub bot">…</div>' : ''}`
        : `<div class="phone-empty"><div><b>${esc(o.fullName)}'s phone</b>Feature phone on 2G. Mark the order ready to send the SMS.</div></div>`}</div>
      <div class="sms-keys"><p>${live ? 'Tap a number to reply' : 'No reply needed right now'}</p><div class="keys">${keys}</div></div>`;
  }
  const chat = $('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
}

function timelineHTML(o){
  const steps = [];
  const at = ts => ts ? `${fmtDay(ts)}, ${fmtTime(ts)}` : '';
  steps.push({ cls: o.readyAt ? 'done' : 'now', t:'Seller marks order ready', d: o.readyAt ? at(o.readyAt) : 'Waiting for seller' });
  steps.push({ cls: o.risk ? 'done' : '', t:'Risk scored', d: o.risk ? `${TIER_LABEL[o.risk.tier]}, score ${o.risk.score}` : 'Runs on the ready event' });
  steps.push({ cls: o.sentAt ? 'done' : '', t:`Message sent on ${o.channel === 'sms' ? 'SMS' : 'WhatsApp'}`, d: o.sentAt ? `${o.lang === 'hi' ? 'Hindi' : 'English'} template, 3 actions` : 'Product, cash amount, date and 3 actions' });
  let r = { cls:'', t:'Customer reply', d:'Not started' };
  const map = {
    AWAITING:{ cls:'now', d:`Due by ${o.deadline ? at(o.deadline) : ''}` },
    HELD:{ cls:'warn', d:`No reply. Auto-cancel at ${o.holdUntil ? at(o.holdUntil) : ''}` },
    CONFIRMED:{ cls:'done', d:`Confirmed${o.addressVerified ? ', pin verified' : ''}${o.landmarkCall ? ', landmark call requested' : ''}` },
    RESCHEDULED:{ cls:'done', d:`Moved to ${eddLabel(o.edd)}` },
    PREPAID:{ cls:'done', d:'Paid by UPI, no cash at the door' },
    CANCELLED:{ cls:'bad', d:`Cancelled: ${String(o.cancelReason || '').replace(/_/g, ' ')}` },
    AUTO_CANCELLED:{ cls:'bad', d:'No reply in window plus hold' },
    AUTO_CLEARED:{ cls:'done', d:'Not required for low risk' },
    DISPATCH_UNCONFIRMED:{ cls:'warn', d:'No reply. Pilot will call before visiting' }
  };
  if (map[o.state]) r = Object.assign(r, map[o.state]);
  steps.push(r);
  if (CANCELLED.has(o.state)) steps.push({ cls:'bad', t:'First-mile partner not allocated', d:`Saved ${inr(CONFIG.intent.forwardCost)} forward linehaul and ${inr(RTO_COST())} total RTO cost` });
  else steps.push({ cls: o.allocated ? 'done' : '', t:'First-mile partner allocated', d: o.allocated ? 'FM-LKO-07, pickup in next wave' : 'Held until intent is clear' });
  return `<ol class="timeline">${steps.map((s, i) => `<li class="${s.cls}"><span class="dot">${s.cls === 'done' ? icon('check', 12) : s.cls === 'bad' ? icon('x', 12) : i + 1}</span><div class="t">${esc(s.t)}</div><div class="d">${esc(s.d)}</div></li>`).join('')}</ol>`;
}

function eventsHTML(list){
  if (!list.length) return '<p class="empty-note">No events yet.</p>';
  return list.slice(0, 40).map(e => `<details><summary><code>${esc(e.name)}</code><time>${fmtTime(e.t)}</time></summary><pre>${esc(JSON.stringify(e.payload, null, 2))}</pre></details>`).join('');
}

function renderIntentConsole(){
  const o = sel(), r = o.risk || scoreRisk(o), s = STATES[o.state], th = CONFIG.intent.thresholds;
  let cd = '';
  if (o.state === 'AWAITING') cd = `<div class="cd">${fmtDur(o.deadline - state.now)}<small>left to confirm</small></div>`;
  else if (o.state === 'HELD') cd = `<div class="cd">${fmtDur(o.holdUntil - state.now)}<small>until auto-cancel</small></div>`;
  const pre = o.state === 'READY';
  $('#iconsole').innerHTML = `
    <div class="con-head">
      <div><h2>${esc(o.fullName)}</h2><div class="sub">${o.id}, ${esc(o.qty + ' × ' + o.product)}, ${inr(o.price)} COD, ${esc(o.city)} ${esc(o.pin)}</div></div>
      <div class="seg" role="group" aria-label="Customer channel">
        <button data-act="channel" data-ch="whatsapp" aria-pressed="${o.channel === 'whatsapp'}" ${pre ? '' : 'disabled'}>${icon('msg', 14)}WhatsApp</button>
        <button data-act="channel" data-ch="sms" aria-pressed="${o.channel === 'sms'}" ${pre ? '' : 'disabled'}>SMS</button>
      </div>
    </div>
    <div class="btn-row" style="margin-top:10px;align-items:center">
      <div class="seg" role="group" aria-label="Message language">
        <button data-act="lang" data-lang="en" aria-pressed="${o.lang === 'en'}" ${pre ? '' : 'disabled'}>English</button>
        <button data-act="lang" data-lang="hi" aria-pressed="${o.lang === 'hi'}" ${pre ? '' : 'disabled'}>हिंदी</button>
      </div>
      ${pre ? `<button class="btn btn-primary" data-act="mark-ready" data-id="${o.id}" style="margin-left:auto">${icon('truck', 16)}Mark ready to ship</button>` : ''}
    </div>
    <div class="status-big"><span class="pill pill-${s.tone}">${s.label}</span><span class="lbl">${o.allocated && !CANCELLED.has(o.state) ? 'Partner allocated' : CANCELLED.has(o.state) ? 'Stopped before dispatch' : 'Not yet allocated'}</span>${cd}</div>
    <h3>Risk ${pre ? 'preview' : 'at ready time'}: <span class="risk risk-${r.tier}">${TIER_LABEL[r.tier]} ${r.score}/100</span></h3>
    <div class="riskbar" role="img" aria-label="Risk score ${r.score} of 100"><span class="fill" style="width:${r.score}%"></span><span class="mk" style="left:${th.medium}%"></span><span class="mk" style="left:${th.high}%"></span></div>
    <div class="risk-scale"><span>0</span><span>Medium from ${th.medium}, high from ${th.high}</span><span>100</span></div>
    <ul class="factors">${r.factors.length ? r.factors.map(f => `<li><span>${esc(f.label)}</span><b>+${f.pts}</b></li>`).join('') : '<li><span>Repeat buyer, standard address, normal pincode</span><b>0</b></li>'}</ul>
    <div class="policy">${esc(policyText(r.tier))}</div>
    <h3>Order journey</h3>
    ${timelineHTML(o)}
    <h3>Events sent to Valmo</h3>
    <div class="events">${eventsHTML(state.events.filter(e => e.orderId === o.id && e.src === 'intent'))}</div>`;
}

/* =========================================================
   9. INCENTIVE ENGINE (pure functions)
   ========================================================= */
function currentTier(){
  const m = state.pilot.monthly;
  const comp = m.delivered / m.assigned * 100, rto = m.rto / m.assigned * 100;
  let t = CONFIG.tiers[0];
  for (const x of CONFIG.tiers) if (comp >= x.minCompletion && rto <= x.maxRto) t = x;
  const idx = CONFIG.tiers.indexOf(t);
  return Object.assign({}, t, { comp, rto, idx, next:CONFIG.tiers[idx + 1] || null });
}
function parcelRisk(o){ return (o.risk || scoreRisk(o)).tier; }
function isDifficult(o){ return o.zone !== 'standard' || parcelRisk(o) === 'high'; }
function distanceBonus(km){ const d = CONFIG.incentive.distance.find(x => km >= x.min && km < x.max); return d ? d.bonus : 0; }

function evaluateAttempt(a){
  const c = CONFIG.incentive, gps = state.pilot.sim.gps;
  const geoOk = gps <= c.geofenceM;
  const callOk = !!a.callAnswered && a.callSec >= c.minCallSec;
  const photoDup = a.photoSeed != null && state.pilot.usedSeeds.includes(a.photoSeed);
  const photoOk = a.photoSeed != null && !photoDup;
  const proofOk = c.proofMode === 'all' ? (callOk && photoOk) : (callOk || photoOk);
  return { gps, geoOk, callOk, photoOk, photoDup, proofOk, verified: geoOk && proofOk };
}
function missingText(g){
  const c = CONFIG.incentive, miss = [];
  if (!g.geoOk) miss.push(`get within ${c.geofenceM} m of the pin`);
  if (!g.proofOk){
    const call = `a connected call of ${c.minCallSec} s`, photo = g.photoDup ? 'a new doorway photo (this one was used before)' : 'a doorway photo';
    miss.push(c.proofMode === 'all' ? [!g.callOk && call, !g.photoOk && photo].filter(Boolean).join(' and ') : `${photo} or ${call}`);
  }
  return miss.join(', then ');
}
function computeIncentive(o, p, g, outcome){
  const c = CONFIG.incentive, tier = currentTier(), lines = [], notes = [];
  const delivered = outcome === 'delivered';
  if (delivered){
    lines.push({ k:'success', label:`Delivery bonus, ${ZONES[o.zone]}`, base:c.success[o.zone] || 0 });
  } else if (g.verified){
    if (!isDifficult(o)) notes.push('Standard parcel: the attempt bonus is only for high-risk or long-distance parcels.');
    else if (p.attemptPaid) notes.push('Attempt bonus already paid on this parcel. Re-attempts are logged without a bonus.');
    else lines.push({ k:'attempt', label:'Verified attempt bonus', base:c.attemptBonus });
  } else {
    notes.push(`Not verified, so no bonus. Needed: ${missingText(g)}.`);
  }
  if ((delivered || g.verified) && !p.distancePaid){
    const b = distanceBonus(o.km);
    if (b) lines.push({ k:'distance', label:`Distance bonus, ${o.km} km`, base:b });
  }
  lines.forEach(l => { l.amt = Math.round(l.base * tier.mult); });
  let capCut = 0;
  const att = lines.find(l => l.k === 'attempt');
  if (att){
    const remaining = Math.max(0, c.shiftAttemptCap - state.pilot.shiftAttemptPaid);
    if (att.amt > remaining){ capCut = att.amt - remaining; notes.push(`Shift cap of ${inr(c.shiftAttemptCap)} on attempt bonuses reached.`); }
  }
  const gross = lines.reduce((s, l) => s + l.amt, 0);
  return { lines, notes, capCut, mult:tier.mult, tierName:tier.name, total:gross - capCut, attemptPaidNow: att ? att.amt - capCut : 0 };
}

/* =========================================================
   10. PILOT APP
   ========================================================= */
let callTimer = null;
function stopCall(){
  if (callTimer){ clearInterval(callTimer); callTimer = null; }
  const a = state.pilot && state.pilot.active;
  if (a) a.calling = false;
}
function startCall(){
  const a = state.pilot.active; if (!a || a.calling) return;
  stopCall();
  a.calling = true; a.callSec = 0; a.callAnswered = state.pilot.sim.answered; a.callEnded = false;
  const gen = state.gen;
  callTimer = setInterval(() => {
    if (gen !== state.gen || !state.pilot.active){ stopCall(); return; }
    const x = state.pilot.active;
    x.callSec++;
    if (!x.callAnswered && x.callSec >= CONFIG.incentive.unansweredRingSec){ stopCall(); x.callEnded = true; }
    if (state.view === 'pilot') renderPilotPhone();
  }, 1000 / CONFIG.incentive.callSpeed);
  renderPilotPhone();
}
function capturePhoto(){
  const a = state.pilot.active; if (!a) return;
  const reuse = state.pilot.sim.reuse && state.pilot.lastPhotoSeed != null;
  a.photoSeed = reuse ? state.pilot.lastPhotoSeed : Math.floor(Math.random() * 1e6) + 1;
  a.photoAt = state.now;
  renderPilotPhone();
}
function openAttempt(id){
  stopCall();
  const o = state.orders.find(x => x.id === id); if (!o) return;
  state.pilot.active = { orderId:id, callSec:0, calling:false, callAnswered:false, callEnded:false, photoSeed:null, photoAt:null, outcome:null };
  state.pilot.screen = 'attempt';
}
function submitAttempt(){
  const pl = state.pilot, a = pl.active; if (!a || !a.outcome) return;
  const o = state.orders.find(x => x.id === a.orderId), p = pl.parcels[a.orderId];
  if (!o || !p) return;
  const g = evaluateAttempt(a);
  if (!g.geoOk) return;
  stopCall();
  const res = computeIncentive(o, p, g, a.outcome);
  p.attempts++;
  if (res.lines.some(l => l.k === 'attempt')) p.attemptPaid = true;
  if (res.lines.some(l => l.k === 'distance')) p.distancePaid = true;
  pl.shiftAttemptPaid += Math.max(0, res.attemptPaidNow);
  if (a.photoSeed != null){ if (!pl.usedSeeds.includes(a.photoSeed)) pl.usedSeeds.push(a.photoSeed); pl.lastPhotoSeed = a.photoSeed; }
  if (a.outcome === 'delivered'){ p.status = 'delivered'; pl.monthly.delivered++; }
  else if (a.outcome === 'refused'){ p.status = 'rto'; pl.monthly.rto++; }
  else p.status = 'attempted';
  const flags = [];
  if (!g.verified && a.outcome !== 'delivered') flags.push('Unverified attempt sent to hub review');
  if (g.photoDup) flags.push('Duplicate photo hash detected');
  if (a.callSec > 0 && !g.callOk) flags.push(a.callAnswered ? `Call under ${CONFIG.incentive.minCallSec} s` : 'Call not answered');
  if (res.capCut > 0) flags.push('Shift cap applied');
  const entry = { id:uid('l'), t:state.now, orderId:o.id, awb:o.awb, name:o.fullName, outcome:a.outcome, verified:g.verified, total:res.total, res, flags, gps:g.gps, callSec:a.callSec, photo:a.photoSeed };
  pl.ledger.unshift(entry);
  emit(o.id, 'attempt.submitted', {
    awb:o.awb, outcome:a.outcome, gpsMetresFromPin:g.gps, geofenceOk:g.geoOk,
    call:{ seconds:a.callSec, answered:!!a.callAnswered, ok:g.callOk },
    photo:{ hash: a.photoSeed != null ? 'img_' + a.photoSeed.toString(16) : null, duplicate:g.photoDup },
    verified:g.verified, incentive:{ total:res.total, multiplier:res.mult, lines:res.lines.map(l => ({ type:l.k, amount:l.amt })) }, flags
  }, 'pilot');
  if (res.total > 0) emit(o.id, 'payout.ledger_credited', { pilotId:'PLT-LKO-1182', amount:res.total, settles:'daily' }, 'pilot');
  pl.result = entry; pl.screen = 'result'; pl.active = null;
  state.now += CONFIG.incentive.minutesPerStop * 60000;
  processClock();
}

function pilotMap(g){
  const c = CONFIG.incentive, s = 0.5, cx = 150, cy = 85;
  const r = c.geofenceM * s, d = Math.min(g.gps * s, 118), ang = -2.4;
  const px = cx + Math.cos(ang) * d, py = cy + Math.sin(ang) * d * 0.62;
  const col = g.geoOk ? '#0B7F57' : '#C2410C';
  return `<svg viewBox="0 0 300 170" role="img" aria-label="Map: you are ${g.gps} metres from the customer pin">
    <rect width="300" height="170" fill="#E8EEE4"/>
    <rect x="12" y="110" width="70" height="46" rx="6" fill="#CFE5C3"/><rect x="214" y="16" width="70" height="40" rx="6" fill="#D6E4F0"/>
    <path d="M0 70 H300 M190 0 V170 M60 0 V170" stroke="#fff" stroke-width="11"/><path d="M0 128 Q150 112 300 140" stroke="#fff" stroke-width="7" fill="none"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.62}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-dasharray="5 4" stroke-width="1.5"/>
    <line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${cx}" y2="${cy}" stroke="${col}" stroke-width="2" stroke-dasharray="3 4"/>
    <g transform="translate(${cx} ${cy})"><path d="M0 0 C-10 -12 -10 -24 0 -26 C10 -24 10 -12 0 0Z" fill="#D81B7F"/><circle cx="0" cy="-17" r="3.5" fill="#fff"/></g>
    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="11" fill="#2453B8" fill-opacity=".2"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="#2453B8" stroke="#fff" stroke-width="2"/>
    <rect x="${g.geoOk ? 174 : 154}" y="140" width="${g.geoOk ? 118 : 138}" height="22" rx="11" fill="#fff"/><text x="${g.geoOk ? 184 : 164}" y="155" font-size="11.5" font-weight="700" fill="${col}" font-family="Mukta,sans-serif">${g.geoOk ? `Inside ${c.geofenceM} m geofence` : `${g.gps} m away, outside fence`}</text>
  </svg>`;
}
function doorPhoto(seed, ts){
  const walls = ['#E9D8B4','#CFE0E8','#F1C9B8','#D9E7C7','#E7D3EA'], doors = ['#7A4B2A','#2F5D8A','#6B2F6E','#3E6B48','#8A2F2F'];
  const w = walls[seed % 5], d = doors[(seed >> 3) % 5], no = (seed % 88) + 11;
  return `<svg viewBox="0 0 300 150" role="img" aria-label="Doorway photo, house ${no}">
    <rect width="300" height="150" fill="${w}"/><rect y="128" width="300" height="22" fill="#B9AFA3"/>
    <rect x="120" y="34" width="62" height="94" fill="${d}"/><rect x="128" y="42" width="46" height="36" fill="rgba(255,255,255,.15)"/><circle cx="170" cy="86" r="3" fill="#E7C66B"/>
    <rect x="30" y="44" width="56" height="40" fill="#9CC2D6" stroke="#fff" stroke-width="4"/><rect x="214" y="44" width="56" height="40" fill="#9CC2D6" stroke="#fff" stroke-width="4"/>
    <rect x="192" y="40" width="22" height="16" rx="2" fill="#1E3A8A"/><text x="203" y="52" font-size="10" fill="#fff" text-anchor="middle" font-family="Mukta,sans-serif">${no}</text>
    <rect x="0" y="0" width="300" height="20" fill="rgba(0,0,0,.45)"/>
    <text x="8" y="14" font-size="10" fill="#fff" font-family="ui-monospace,Menlo,monospace">${fmtDay(ts)} ${fmtTime(ts)}  26.85N 80.95E  img_${seed.toString(16)}</text>
  </svg>`;
}

function pilotHeader(){
  const pl = state.pilot, tier = currentTier(), earned = pl.ledger.reduce((s, l) => s + l.total, 0);
  const capPct = CONFIG.incentive.shiftAttemptCap > 0 ? clamp(pl.shiftAttemptPaid / CONFIG.incentive.shiftAttemptCap * 100, 0, 100) : 100;
  return `<div class="statusbar"><span>${fmtClockShort(state.now)}</span><span class="sb-ic">5G <i></i></span></div>
  <div class="pa-top">
    <div class="pa-row"><div class="pa-logo">valmo<span>Pilot</span></div><span class="pa-tier">${icon('star', 12)}${tier.name} ${tier.mult}×</span></div>
    <div class="pa-hello">Suresh Yadav, Lucknow Chinhat hub</div>
    <div class="pa-earn"><div><small>Incentives today</small><br><b>${inr(earned)}</b></div><small>Attempt cap ${inr(pl.shiftAttemptPaid)} of ${inr(CONFIG.incentive.shiftAttemptCap)}</small></div>
    <div class="pa-cap" role="progressbar" aria-label="Attempt bonus cap used" aria-valuenow="${Math.round(capPct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${capPct}%"></i></div>
  </div>`;
}
function pilotNav(cur){
  const it = [['tasks','list','Parcels'],['earnings','wallet','Earnings'],['tier','award','My tier']];
  return `<nav class="pa-nav">${it.map(([k, ic, l]) => `<button data-act="p-nav" data-screen="${k}" ${cur === k ? 'aria-current="page"' : ''}>${icon(ic, 20)}${l}</button>`).join('')}</nav>`;
}
function intentChip(o){
  switch (o.state){
    case 'CONFIRMED': case 'RESCHEDULED': return '<span class="chip g">Customer confirmed</span>';
    case 'PREPAID': return '<span class="chip g">Paid by UPI</span>';
    case 'AUTO_CLEARED': return '<span class="chip g">Low risk</span>';
    case 'DISPATCH_UNCONFIRMED': return '<span class="chip y">No reply: call first</span>';
    default: return '<span class="chip">Intent not checked</span>';
  }
}
function pilotTasks(){
  const pl = state.pilot;
  const live = state.orders.filter(o => !CANCELLED.has(o.state));
  const gone = state.orders.length - live.length;
  const order = { pending:0, attempted:1, delivered:2, rto:3 };
  live.sort((a, b) => order[pl.parcels[a.id].status] - order[pl.parcels[b.id].status]);
  const cards = live.map(o => {
    const p = pl.parcels[o.id], db = distanceBonus(o.km), diff = isDifficult(o);
    const closed = p.status === 'delivered' || p.status === 'rto';
    const st = { pending:'', attempted:'<span class="chip y">Re-attempt</span>', delivered:'<span class="chip g">Delivered</span>', rto:'<span class="chip r">Refused, RTO</span>' }[p.status];
    return `<div class="task${closed ? ' done' : ''}">
      <div class="task-h"><b>${esc(o.fullName)}</b><span>${o.awb.slice(-6)}</span></div>
      <div class="task-a">${esc(o.address)}, ${esc(o.city)}</div>
      <div class="chips">${st}${intentChip(o)}${o.zone !== 'standard' ? `<span class="chip ${o.zone === 'rural' ? 'p' : 'r'}">${ZONES[o.zone]}</span>` : ''}<span class="chip b">${o.km} km${db ? `, +₹${db}` : ''}</span>${diff && !p.attemptPaid ? `<span class="chip p">Attempt bonus +₹${CONFIG.incentive.attemptBonus}</span>` : ''}</div>
      <div class="task-f"><span class="cod">${o.prepaid ? 'Prepaid' : inr(o.price)}<small>${o.prepaid ? 'no cash' : 'collect cash'}</small></span>
      ${closed ? '' : `<button class="pa-btn" data-act="p-open" data-id="${o.id}">${icon('pin', 15)}${p.status === 'attempted' ? 'Try again' : 'Start'}</button>`}</div>
    </div>`;
  }).join('');
  return `${pilotHeader()}<div class="pa-body">
    ${gone ? `<div class="pa-banner">${icon('shield', 16)}<span>${gone} parcel${gone > 1 ? 's' : ''} removed from your route. The customer cancelled in Pakka Check, so no trip is wasted.</span></div>` : ''}
    <div class="pa-sec">Today's parcels (${live.length})</div>${cards || '<p class="empty-note">No parcels left on this route.</p>'}</div>${pilotNav('tasks')}`;
}
function pilotAttempt(){
  const a = state.pilot.active, o = state.orders.find(x => x.id === a.orderId), c = CONFIG.incentive;
  const g = evaluateAttempt(a);
  const mm = String(Math.floor(a.callSec / 60)).padStart(2, '0') + ':' + String(a.callSec % 60).padStart(2, '0');
  const callSub = a.calling ? (a.callAnswered ? `Connected ${mm}` : `Ringing ${mm}`) : a.callSec ? (a.callAnswered ? `Call lasted ${mm}` : 'No answer') : `Masked number, ${c.minCallSec} s or more counts`;
  const photoSub = a.photoSeed == null ? 'Door or building only, no people' : g.photoDup ? 'Same image as an earlier attempt' : 'Geo-tagged and time-stamped';
  const out = [['delivered','Delivered'],['unavailable','Not available'],['refused','Refused']];
  let gate, canSubmit = !!a.outcome && g.geoOk;
  if (!g.geoOk) gate = `<div class="gate stop">${icon('alert', 16)}<span>You are ${g.gps} m from the pin. Reach within ${c.geofenceM} m to record an attempt.</span></div>`;
  else if (a.outcome === 'delivered') gate = `<div class="gate ok">${icon('check', 16)}<span>Location verified. Delivery bonus for ${ZONES[o.zone]} applies.</span></div>`;
  else if (g.verified) gate = `<div class="gate ok">${icon('shield', 16)}<span>Attempt verified. ${isDifficult(o) ? 'Eligible for the attempt bonus.' : 'Standard parcel, so no attempt bonus.'}</span></div>`;
  else gate = `<div class="gate no">${icon('alert', 16)}<span>To earn the bonus, add ${esc(missingText(g))}.</span></div>`;
  const btnLabel = !g.geoOk ? 'Reach the address first' : !a.outcome ? 'Choose what happened' : a.outcome === 'delivered' ? `Mark delivered${o.prepaid ? '' : `, ${inr(o.price)} collected`}` : g.verified ? 'Submit verified attempt' : 'Submit without bonus';
  return `<div class="statusbar" style="background:#4A0E4E;color:#fff"><span>${fmtClockShort(state.now)}</span><span class="sb-ic">5G <i></i></span></div>
  <div class="pa-bar"><button data-act="p-back" aria-label="Back to parcels">${icon('back', 18)}</button><div><b>Delivery attempt</b><small>AWB ${o.awb}</small></div></div>
  <div class="pa-body">
    <div class="cust"><div class="n">${esc(o.fullName)} ${intentChip(o)}</div><div class="a">${esc(o.address)}, ${esc(o.city)} ${esc(o.pin)}</div><div class="a">${o.prepaid ? 'Prepaid' : 'Collect ' + inr(o.price) + ' cash'}, ${o.km} km from hub</div></div>
    <div class="pmap">${pilotMap(g)}</div>
    <div class="checks">
      <div class="chk ${g.geoOk ? 'ok' : 'bad'}"><span class="st">${icon(g.geoOk ? 'check' : 'x', 14)}</span><span class="l">Location<small>${g.gps} m from pin, limit ${c.geofenceM} m</small></span><span class="act"></span></div>
      <div class="chk ${g.callOk ? 'ok' : (a.callSec && !a.calling) ? 'bad' : ''}"><span class="st">${icon(g.callOk ? 'check' : 'phone', 14)}</span><span class="l">Call customer<small>${callSub}</small></span>
        <span class="act">${a.calling ? `<button class="live" data-act="p-endcall">End</button>` : `<button data-act="p-call">${icon('phone', 13)}${a.callSec ? 'Redial' : 'Call'}</button>`}</span></div>
      <div class="chk ${g.photoOk ? 'ok' : g.photoDup ? 'bad' : ''}"><span class="st">${icon(g.photoOk ? 'check' : 'camera', 14)}</span><span class="l">Doorway photo<small>${photoSub}</small></span>
        <span class="act"><button data-act="p-photo">${icon('camera', 13)}${a.photoSeed == null ? 'Capture' : 'Retake'}</button></span></div>
      ${a.photoSeed != null ? `<div class="photo">${doorPhoto(a.photoSeed, a.photoAt)}</div>` : ''}
    </div>
    <div class="pa-sec">What happened?</div>
    <div class="outc" role="group" aria-label="Attempt outcome">${out.map(([k, l]) => `<button data-act="p-outcome" data-o="${k}" aria-pressed="${a.outcome === k}">${l}</button>`).join('')}</div>
    ${gate}
  </div>
  <div class="pa-foot"><button class="pa-btn block" data-act="p-submit" ${canSubmit ? '' : 'disabled'}>${esc(btnLabel)}</button></div>`;
}
function pilotResult(){
  const e = state.pilot.result, r = e.res;
  const outTxt = { delivered:'Delivered', unavailable:'Customer not available', refused:'Refused at door' }[e.outcome];
  return `${pilotHeader()}<div class="pa-body">
    <div class="res-hero"><div class="big${e.total ? '' : ' zero'}">${e.total ? '+' + inr(e.total) : 'Attempt saved'}</div><p>${esc(outTxt)} for ${esc(e.name)}${e.verified || e.outcome === 'delivered' ? ', verified' : ', not verified'}</p></div>
    ${r.lines.length ? `<div class="lines">${r.lines.map(l => `<div><span>${esc(l.label)}</span><span>${inr(l.base)}${r.mult !== 1 ? ` × ${r.mult} = ${inr(l.amt)}` : ''}</span></div>`).join('')}
      ${r.capCut ? `<div><span>Shift cap</span><span class="neg">−${inr(r.capCut)}</span></div>` : ''}
      <div class="tot"><span>Credited to today's payout</span><span>${inr(e.total)}</span></div></div>` : ''}
    ${r.mult !== 1 && r.lines.length ? `<div class="pa-banner">${icon('star', 16)}<span>Your ${esc(r.tierName)} tier adds ${Math.round((r.mult - 1) * 100)}% to every incentive.</span></div>` : ''}
    ${r.notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}
    <button class="pa-btn block" data-act="p-nav" data-screen="tasks" style="margin-top:8px">Back to parcels</button>
  </div>${pilotNav('tasks')}`;
}
function pilotEarnings(){
  const pl = state.pilot, total = pl.ledger.reduce((s, l) => s + l.total, 0);
  return `${pilotHeader()}<div class="pa-body">
    <div class="pa-sec">Today's ledger, settles tonight</div>
    ${pl.ledger.length ? pl.ledger.map(l => `<div class="ledger-item"><span><b>${esc(l.name)}</b><small>${fmtTime(l.t)}, ${l.outcome === 'delivered' ? 'Delivered' : l.outcome === 'refused' ? 'Refused' : 'Attempt'}${l.verified ? ', verified' : ''}</small></span><b>${l.total ? '+' + inr(l.total) : '₹0'}</b></div>`).join('')
      : `<p class="empty-note">No incentives yet. Verified attempts and deliveries show up here as you complete them.</p>`}
    <div class="lines"><div class="tot"><span>Total incentives</span><span>${inr(total)}</span></div></div>
  </div>${pilotNav('earnings')}`;
}
function pilotTier(){
  const t = currentTier(), m = state.pilot.monthly;
  const n = t.next;
  return `${pilotHeader()}<div class="pa-body">
    <div class="tier-card"><small>This month you are</small><br><b>${t.name}</b> <span>${t.mult}× on all incentives</span>
      <div class="meter"><div class="row"><span>Completion rate</span><span>${t.comp.toFixed(1)}%</span></div><div class="bar"><i style="width:${clamp(t.comp, 0, 100)}%"></i></div></div>
      <div class="meter"><div class="row"><span>RTO rate</span><span>${t.rto.toFixed(1)}%</span></div><div class="bar"><i style="width:${clamp(t.rto * 5, 0, 100)}%"></i></div></div>
      <small>${n ? `Reach ${n.minCompletion}% completion with RTO at ${n.maxRto}% or less for ${n.name} (${n.mult}×).` : 'Top tier reached.'} ${m.delivered} of ${m.assigned} parcels delivered.</small>
    </div>
    <div class="pa-sec">Monthly tiers</div>
    <div class="tiers">${CONFIG.tiers.map(x => `<div class="${x.name === t.name ? 'cur' : ''}"><b>${x.name}</b><span class="m">${x.mult}×</span><span class="c">${x.minCompletion ? `${x.minCompletion}%+ completion, RTO ${x.maxRto}% or less. ` : ''}${esc(x.perk)}</span></div>`).join('')}</div>
  </div>${pilotNav('tier')}`;
}
function renderPilotPhone(){
  const pl = state.pilot, box = $('#pphone');
  if (pl.screen === 'attempt' && !pl.active) pl.screen = 'tasks';
  if (pl.screen === 'result' && !pl.result) pl.screen = 'tasks';
  const prevBody = box.querySelector('.pa-body'), keep = prevBody ? prevBody.scrollTop : 0, prevScreen = box.dataset.screen;
  box.innerHTML = pl.screen === 'attempt' ? pilotAttempt() : pl.screen === 'result' ? pilotResult() : pl.screen === 'earnings' ? pilotEarnings() : pl.screen === 'tier' ? pilotTier() : pilotTasks();
  const nb = box.querySelector('.pa-body');
  if (nb && prevScreen === pl.screen) nb.scrollTop = keep;
  box.dataset.screen = pl.screen;
}
function renderPilotAudit(){
  const pl = state.pilot, L = pl.ledger;
  const attempts = L.filter(l => l.outcome !== 'delivered');
  const ver = attempts.filter(l => l.verified).length;
  const paid = L.reduce((s, l) => s + l.total, 0);
  const flags = L.flatMap(l => l.flags.map(f => ({ f, who:l.name, t:l.t })));
  $('#paudit').innerHTML = `<h2>Hub audit</h2><p class="hint">Live view for the hub captain. Flags route to review before payout settles.</p>
    <div class="kpis">
      <div class="kpi hero"><b>${inr(paid)}</b><span>Incentives credited today, ${L.length} submission${L.length === 1 ? '' : 's'}</span></div>
      <div class="kpi"><b>${attempts.length ? Math.round(ver / attempts.length * 100) + '%' : '–'}</b><span>Failed attempts verified</span></div>
      <div class="kpi"><b>${L.filter(l => l.outcome === 'delivered').length}</b><span>Delivered</span></div>
      <div class="kpi"><b>${flags.length}</b><span>Audit flags</span></div>
      <div class="kpi"><b>${inr(pl.shiftAttemptPaid)}</b><span>Attempt cap used of ${inr(CONFIG.incentive.shiftAttemptCap)}</span></div>
    </div>
    <h3>Flags</h3>
    ${flags.length ? `<ul class="flags">${flags.slice(0, 8).map(x => `<li>${icon('alert', 15)}<span>${esc(x.f)}: ${esc(x.who)}, ${fmtTime(x.t)}</span></li>`).join('')}</ul>`
      : `<ul class="flags"><li class="okf">${icon('check', 15)}<span>No flags. Try submitting from outside the fence or reusing a photo to see the checks work.</span></li></ul>`}`;
  $('#plog').innerHTML = eventsHTML(state.events.filter(e => e.src === 'pilot'));
}

/* =========================================================
   11. IMPACT MODEL
   ========================================================= */
const IMP = { orders:588, rate:23.5, cost:170, red:20, msg:0.12, elig:12, inc:7 };
function impactCalc(red){
  const orders = IMP.orders * 1e6, fails = orders * IMP.rate / 100, avoided = fails * red / 100;
  const gross = avoided * IMP.cost, msg = orders * IMP.msg, inc = orders * IMP.elig / 100 * IMP.inc;
  const net = gross - msg - inc, breakeven = fails * IMP.cost > 0 ? (msg + inc) / (fails * IMP.cost) * 100 : 0;
  return { orders, fails, avoided, gross, msg, inc, net, breakeven };
}
const IMP_FMT = { orders:v => `${v} M`, rate:v => `${v}%`, cost:v => inr(v), red:v => `${v}%`, msg:v => `₹${(+v).toFixed(2)}`, elig:v => `${v}%`, inc:v => inr(v) };
function renderImpact(){
  document.querySelectorAll('[data-imp]').forEach(i => { const k = i.dataset.imp; if (document.activeElement !== i) i.value = IMP[k]; });
  document.querySelectorAll('[data-out]').forEach(o => { o.textContent = IMP_FMT[o.dataset.out](IMP[o.dataset.out]); });
  document.querySelectorAll('[data-act="scenario"]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.r === IMP.red)));
  const r = impactCalc(IMP.red), max = Math.max(r.gross, 1);
  const scen = [['Conservative', 10], ['Moderate', 20], ['Aggressive', 25], ['Infographic target', 45]];
  const per100Base = IMP.rate, per100New = IMP.rate * (1 - IMP.red / 100);
  $('#imp-out').innerHTML = `
    <div class="panel">
      <div class="net"><div class="big">${cr(r.net)}</div><div class="cap">net saving a year after messaging and pilot incentives, at ${IMP.red}% fewer RTOs</div></div>
      <div class="stats">
        <div><b>${(r.avoided / 1e6).toFixed(1)} M</b><span>Failed deliveries avoided</span></div>
        <div><b>${cr(r.gross)}</b><span>Gross logistics saving</span></div>
        <div><b>${cr(r.msg + r.inc)}</b><span>Programme cost</span></div>
        <div><b>${r.breakeven.toFixed(1)}%</b><span>RTO cut needed to break even</span></div>
      </div>
      <h3>Where the money goes</h3>
      <div class="compare">
        <div class="cmp-row"><span>Gross saving</span><span class="bar"><i style="width:100%;background:var(--ok)"></i></span><b>${cr(r.gross)}</b></div>
        <div class="cmp-row"><span>Pilot incentives</span><span class="bar"><i style="width:${clamp(r.inc / max * 100, 0, 100)}%;background:var(--magenta)"></i></span><b>${cr(r.inc)}</b></div>
        <div class="cmp-row"><span>WhatsApp and SMS</span><span class="bar"><i style="width:${clamp(r.msg / max * 100, 0, 100)}%;background:var(--orchid)"></i></span><b>${cr(r.msg)}</b></div>
        <div class="cmp-row"><span>Net saving</span><span class="bar"><i style="width:${clamp(r.net / max * 100, 0, 100)}%;background:var(--plum)"></i></span><b>${cr(r.net)}</b></div>
      </div>
      <p class="hint" style="margin-top:12px">Per 100 COD orders, failed deliveries drop from ${per100Base.toFixed(1)} to ${per100New.toFixed(1)}.</p>
    </div>
    <div class="panel">
      <h2>Scenarios</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Scenario</th><th>RTO cut</th><th>Failures avoided</th><th>Gross</th><th>Net</th></tr></thead><tbody>
        ${scen.map(([n, v]) => { const x = impactCalc(v); return `<tr class="${v === IMP.red ? 'on' : ''}"><td>${n}</td><td>${v}%</td><td>${(x.avoided / 1e6).toFixed(1)} M</td><td>${cr(x.gross)}</td><td>${cr(x.net)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="callout">The infographic's ₹900–1,200 Cr equals a 40–50% cut at ₹170 per RTO on this base. The written plan's 10–25% range is the conservative case, so both are shown side by side.</div>
    </div>
    <div class="panel">
      <h2>30-60-90 day rollout</h2>
      <div class="road">
        <div><span class="n">Days 1–30</span><h4>Foundation and pilot</h4><ul><li>3 hubs: one metro, one Tier-2, one rural</li><li>Ship WhatsApp bot and Pilot app photo and geofence capture</li><li>Set control and treatment groups, soft launch on capped volume</li></ul></div>
        <div><span class="n">Days 31–60</span><h4>Calibrate</h4><ul><li>Measure drop-off, payout latency and route gaming</li><li>Tune shift caps and auto-cancel rules</li><li>Track pilot and captain satisfaction</li></ul></div>
        <div><span class="n">Days 61–90</span><h4>Scale decision</h4><ul><li>Pincode matched-pair A/B evaluation</li><li>Test rural distance-tiered bonuses</li><li>National rollout plan to leadership</li></ul></div>
      </div>
    </div>`;
}

/* =========================================================
   12. TOP-LEVEL RENDER + EVENTS
   ========================================================= */
function render(){
  ['intent','pilot','impact'].forEach(v => {
    $('#view-' + v).hidden = v !== state.view;
    $('#tab-' + v).setAttribute('aria-selected', String(v === state.view));
    $('#tab-' + v).tabIndex = v === state.view ? 0 : -1;
  });
  if (state.view === 'intent'){ renderClock(); renderQueue(); renderIntentPhone(); renderIntentConsole(); }
  else if (state.view === 'pilot'){ renderPilotPhone(); renderPilotAudit(); }
  else renderImpact();
}
function syncConfigInputs(){
  document.querySelectorAll('[data-cfg]').forEach(i => { i.value = getPath(CONFIG, i.dataset.cfg); });
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act;
  switch (act){
    case 'tab':
      if (state.view === 'pilot' && el.dataset.view !== 'pilot') stopCall();
      state.view = el.dataset.view; render(); window.scrollTo({ top:0, behavior: REDUCED ? 'auto' : 'smooth' }); break;
    case 'select-order': state.selected = el.dataset.id; render(); break;
    case 'mark-ready': markReady(state.orders.find(o => o.id === el.dataset.id)); render(); break;
    case 'ready-all': state.orders.forEach(markReady); render(); toast('All ready orders scored and messaged.'); break;
    case 'ff': advance(+el.dataset.h); break;
    case 'reset': reset(); render(); toast('Demo reset.'); break;
    case 'channel': { const o = sel(); if (o.state === 'READY'){ o.channel = el.dataset.ch; render(); } break; }
    case 'lang': { const o = sel(); if (o.state === 'READY'){ o.lang = el.dataset.lang; render(); } break; }
    case 'wa': onCustomerAction(el.dataset.msg, +el.dataset.opt); break;
    case 'pinmap': {
      const o = sel(), m = o.chat.find(x => x.id === el.dataset.msg); if (!m || m.done) break;
      const rc = el.getBoundingClientRect();
      m.pin = { x: clamp((e.clientX - rc.left) / rc.width * 100, 3, 97), y: clamp((e.clientY - rc.top) / rc.height * 100, 8, 97) };
      renderIntentPhone(); const nm = document.querySelector(`[data-act="pinmap"][data-msg="${m.id}"]`); if (nm) nm.focus(); break;
    }
    case 'p-nav': stopCall(); state.pilot.screen = el.dataset.screen; if (el.dataset.screen !== 'attempt') state.pilot.active = null; renderPilotPhone(); break;
    case 'p-open': openAttempt(el.dataset.id); renderPilotPhone(); break;
    case 'p-back': stopCall(); state.pilot.active = null; state.pilot.screen = 'tasks'; renderPilotPhone(); break;
    case 'p-call': startCall(); break;
    case 'p-endcall': { const a = state.pilot.active; stopCall(); if (a) a.callEnded = true; renderPilotPhone(); break; }
    case 'p-photo': capturePhoto(); break;
    case 'p-outcome': if (state.pilot.active){ state.pilot.active.outcome = el.dataset.o; renderPilotPhone(); } break;
    case 'p-submit': submitAttempt(); renderPilotPhone(); renderPilotAudit(); { const r = state.pilot.result; if (r) toast(r.total ? `${inr(r.total)} credited to Suresh's payout.` : 'Attempt logged without bonus.', r.total ? 'ok' : ''); } break;
    case 'scenario': IMP.red = +el.dataset.r; renderImpact(); break;
    default: break;
  }
});

document.addEventListener('keydown', e => {
  const el = e.target;
  if (el && el.dataset && el.dataset.act === 'pinmap'){
    const step = { ArrowLeft:[-3,0], ArrowRight:[3,0], ArrowUp:[0,-5], ArrowDown:[0,5] }[e.key];
    if (!step) return;
    e.preventDefault();
    const o = sel(), m = o.chat.find(x => x.id === el.dataset.msg); if (!m || m.done) return;
    m.pin = { x:clamp(m.pin.x + step[0], 3, 97), y:clamp(m.pin.y + step[1], 8, 97) };
    renderIntentPhone();
    const nm = document.querySelector(`[data-act="pinmap"][data-msg="${m.id}"]`); if (nm) nm.focus();
  }
  if (el && el.getAttribute && el.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')), i = tabs.indexOf(el);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); n.click();
  }
});

document.addEventListener('change', e => {
  const i = e.target;
  if (i.dataset && i.dataset.cfg){
    const path = i.dataset.cfg, cur = getPath(CONFIG, path);
    let v = i.type === 'number' ? Number(i.value) : i.value;
    if (i.type === 'number'){
      const lo = Number(i.min), hi = Number(i.max);
      if (!Number.isFinite(v)) v = cur;
      v = clamp(Math.round(v), Number.isFinite(lo) ? lo : -Infinity, Number.isFinite(hi) ? hi : Infinity);
    }
    if (path === 'intent.thresholds.medium' && v >= CONFIG.intent.thresholds.high) v = CONFIG.intent.thresholds.high - 1;
    if (path === 'intent.thresholds.high' && v <= CONFIG.intent.thresholds.medium) v = CONFIG.intent.thresholds.medium + 1;
    setPath(CONFIG, path, v); i.value = v;
    render();
  }
});

document.addEventListener('input', e => {
  const i = e.target;
  if (i.id === 'sim-gps'){ state.pilot.sim.gps = +i.value; $('#sim-gps-out').textContent = i.value + ' m'; if (state.pilot.screen === 'attempt') renderPilotPhone(); }
  else if (i.id === 'sim-answer'){ state.pilot.sim.answered = i.checked; }
  else if (i.id === 'sim-reuse'){ state.pilot.sim.reuse = i.checked; }
  else if (i.dataset && i.dataset.imp){ IMP[i.dataset.imp] = +i.value; renderImpact(); }
});
// checkboxes fire 'change' reliably on all browsers
document.addEventListener('change', e => {
  const i = e.target;
  if (i.id === 'sim-answer') state.pilot.sim.answered = i.checked;
  if (i.id === 'sim-reuse') state.pilot.sim.reuse = i.checked;
});

reset();
syncConfigInputs();
render();
})();
