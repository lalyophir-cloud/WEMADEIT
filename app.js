import { AREAS, SCHEDULE, USERS } from './questions.js';

// ---------- שמירה ----------
const KEY = 'wemadeit-v1';
const VERSION = '23.10 · מטרה בכל משימה';
const fresh = () => ({ user: null, answers: {}, qDone: false, goals: [], tasks: [], weeks: {}, planWeeks: null, seq: 1 });
let S = load();
function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return fresh(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* אין מקום או גלישה פרטית */ }
}
const uid = (p) => p + S.seq++;
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- עזרים ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// {נקבה|זכר} לפי המשתמש
const t = (s) => String(s).replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, f, m) => (S.user && S.user.g === 'm' ? m : f));
const me = () => USERS[S.user.id] || S.user;

const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ds(new Date());
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
const weekOf = (s) => addDays(s, -pd(s).getDay());
const END = '2026-12-31';
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const short = (s) => { const d = pd(s); return `${d.getDate()}.${d.getMonth() + 1}`; };
const fmtDay = (s) => { const d = pd(s); return `יום ${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`; };
const weekRange = (w) => `${short(w)} - ${short(addDays(w, 6))}`;

function planWeeks() {
  const out = [];
  const first = weekOf(today());
  let last = weekOf(END);
  if (last < addDays(first, 63)) last = addDays(first, 63); // לפחות 10 שבועות
  for (let w = first; w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}
// במוצ"ש מתכננים את השבוע הבא
const targetWeek = () => (new Date().getDay() === 6 ? addDays(weekOf(today()), 7) : weekOf(today()));

const area = (id) => AREAS.find((a) => a.id === id) || AREAS[AREAS.length - 1];
const areaId = (name) => {
  const n = String(name || '').trim();
  const a = AREAS.find((x) => x.name === n) || AREAS.find((x) => n && (n.includes(x.name) || x.name.includes(n)));
  return a ? a.id : 'other';
};
const goal = (id) => S.goals.find((g) => g.id === id);
const task = (id) => S.tasks.find((x) => x.id === id);
const isLate = (x) => x.status !== 'done' && ((x.date && x.date < today()) || (!x.date && addDays(x.week, 6) < today()));
const pct = (list) => (list.length ? Math.round((list.filter((x) => x.status === 'done').length / list.length) * 100) : 0);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

// ---------- הודעות לקלוד ----------
const fence = '```';
function answersText(a) {
  const ans = S.answers[a.id] || {};
  const lines = [`## ${a.name}`];
  if (a.score) lines.push(`ציון היום: ${ans.score ? ans.score + '/10' : 'לא ענו'}`);
  a.q.forEach((q, i) => lines.push(`- ${t(q)}\n  תשובה: ${(ans.a && ans.a[i] && ans.a[i].trim()) || '(לא ענו)'}`));
  return lines.join('\n');
}

function planPrompt() {
  const weeks = planWeeks();
  S.planWeeks = weeks; save();
  const u = me();
  return t(`היי Claude 💛
אני ${u.name}, {עצמאית|עצמאי}. {פנה אליי בלשון נקבה|פנה אליי בלשון זכר}, בעברית פשוטה, חמה וקצרה.

## מה זה
אני ו${u.partner} ({בן הזוג שלי, גם הוא עצמאי|בת הזוג שלי, גם היא עצמאית}) משתמשים באפליקציה אישית בשם WEMADEIT. המטרה שלה: להזיז קדימה בפועל את הדברים שקל לדחות, בכל תחומי החיים, מהיום (${fmtDay(today())}) ועד 31.12.2026. זה בערך ${weeks.length} שבועות.
מילאתי שאלון על איפה אני {עומדת|עומד} בכל תחום. התשובות שלי מופיעות בסוף ההודעה.

## מה אני {צריכה|צריך} ממך
תוכנית עבודה אישית ומדויקת: לכל תחום, מטרה אחת או שתיים עד סוף השנה, וכל מטרה מפורקת למשימות קטנות שמשובצות לשבועות. את התוכנית אדביק בחזרה באפליקציה, והיא תציג לי מה לעשות בכל שבוע.

## איך עובדים: 4 שלבים, ובסוף כל שלב עוצרים ומחכים לתשובה שלי
**שלב 1: תמונת מצב.** בכמה שורות לכל תחום: איפה אני {עומדת|עומד} היום ומה הכי תקוע, לפי התשובות שלי. ואחר כך עד 5 שאלות הבהרה, רק אם באמת חסר משהו. תחום שלא עניתי עליו, לדלג עליו.
**שלב 2: מטרות.** להציע 1-2 מטרות לכל תחום. מטרה טובה היא ספציפית ואפשר לבדוק אם הגעתי אליה עד 31.12 (למשל "5 לקוחות חדשים" ולא "להשתפר בשיווק"). ליד כל מטרה, משפט קצר: למה היא חשובה לי.
**שלב 3: פירוק למשימות.** להציג את התוכנית שבוע אחרי שבוע, כרשימה רגילה שקל לקרוא (לא קוד). לשאול אותי אם זה מציאותי.
**שלב 4: תוכנית סופית.** רק אחרי שאכתוב "{מאשרת|מאשר}", להוציא את התוכנית בפורמט שבסוף ההודעה. לא לפני.

## איך נראית משימה טובה
- מתחילה בפעולה, ואומרת בדיוק מה עושים: "לשלוח הצעת מחיר ל-3 לקוחות ישנים", ולא "לעבוד על לקוחות".
- אפשר לעשות אותה בישיבה אחת, עד שעתיים. אם זה יותר גדול, לפרק לכמה משימות.
- ברור מתי היא "בוצעה".
- מובנת גם כשקוראים אותה לבד, בלי לראות את המטרה: "לכתוב רשימה של מה חסר באתר", ולא "רשימה של מה חסר".
- דברים שאני דוחה כבר הרבה זמן: לפרק לצעד ראשון קטן במיוחד, כדי שיהיה קל להתחיל.

## כללים לתוכנית
- **לא להעמיס.** לפי מה שכתבתי על הלו"ז שלי (כמה משימות ביום מרגיש לי נכון). שבוע 1 קל יותר, כדי להתחיל בהצלחה.
- לפזר את התחומים לאורך השבועות, לא הכל באותו שבוע.
- להשאיר את השבוע האחרון של דצמבר רגוע יחסית, לסיכום ולהשלמות.
- משימה שחוזרת כמה פעמים בשבוע (אימון, פוסט): לרשום אותה פעם אחת לכל שבוע, ולציין כמה פעמים.
- לסמן משימות שמתאימות ל**יום העבודה המשותף**: פעם בשבוע אני ו${u.partner} יושבים יחד, כל אחד על המשימות שלו. מתאים לשם: עבודה מול מחשב, כתיבה, תכנון, שיווק, כספים.
- **לא לקבוע ימים ושעות.** רק שבועות. את השיבוץ ליומן נעשה בכל מוצ"ש, בתכנון שבועי נפרד.

## מספרי השבועות (להשתמש בדיוק בהם)
${weeks.map((w, i) => `שבוע ${i + 1}: ${weekRange(w)}`).join('\n')}

## שמות התחומים (רק השמות האלה, בדיוק ככה)
${AREAS.map((a) => a.name).join(', ')}

## הפורמט הסופי (רק בשלב 4)
בלוק קוד אחד בלבד, עם JSON תקין, בלי הערות ובלי טקסט נוסף בתוך הבלוק.
- goals: המטרות. id קצר (g1, g2...), area הוא שם תחום מהרשימה, title המטרה, why למה זה חשוב לי.
- tasks: המשימות. goal הוא ה-id של המטרה, title המשימה, week מספר השבוע (1-${weeks.length}), times כמה פעמים באותו שבוע (בדרך כלל 1), together הוא true אם מתאים ליום המשותף.
דוגמה למבנה:
${fence}json
{
  "type": "wemadeit-plan",
  "goals": [
    { "id": "g1", "area": "בריאות", "title": "להתאמן באופן קבוע", "why": "כדי שיהיה לי כוח לעסק" }
  ],
  "tasks": [
    { "goal": "g1", "title": "אימון 30 דקות", "week": 1, "times": 3, "together": false }
  ]
}
${fence}

התשובות שלי לשאלון:

${AREAS.map(answersText).join('\n\n')}

${answersText(SCHEDULE)}`);
}

function weekTasks(w) {
  return S.tasks.filter((x) => x.status !== 'done' && x.week === w);
}
function lateBefore(w) {
  return S.tasks.filter((x) => x.status !== 'done' && x.week < w && isLate(x));
}

function weeklyPrompt(w) {
  const u = me();
  const wk = S.weeks[w] || {};
  const line = (x) => {
    const g = goal(x.goalId);
    return `- [${x.id}] ${x.title} · תחום: ${area(x.area).name}${g ? ` · מטרה: ${g.title}` : ''}${x.together ? ' ⭐' : ''}${x.subs.length ? `\n  צעדים קטנים: ${x.subs.map((s) => s.title).join(', ')}` : ''}`;
  };
  const late = lateBefore(w);
  const sched = (S.answers.schedule && S.answers.schedule.a) || [];
  const together = wk.together && wk.together !== 'none'
    ? `יום העבודה המשותף שלי ושל ${u.partner} השבוע: ${fmtDay(wk.together)}${wk.time ? `, ${wk.time}` : ''}.`
    : `השבוע אין יום עבודה משותף עם ${u.partner}.`;
  return t(`היי Claude, זה התכנון השבועי שלי מאפליקציית WEMADEIT. {פנה אליי בלשון נקבה|פנה אליי בלשון זכר}.

השבוע: ${fmtDay(w)} עד ${fmtDay(addDays(w, 6))}.
${together}

מה לעשות:
1. אם יש לך גישה ליומן Google שלי, תסתכל עליו בשבוע הזה ותמצא זמנים פנויים. אם אין לך גישה, תשאל אותי מה הלו"ז שלי השבוע.
2. תשבץ את המשימות שלמטה בימים ובשעות. בלי להעמיס, ולפי מה שכתבתי על עצמי. משימות עם ⭐ עדיף לשבץ ביום המשותף.
3. תראה לי את ההצעה ונתקן אם צריך.
4. אחרי שאכתוב "{מאשרת|מאשר}": תוסיף כל משימה כאירוע ביומן שלי, עם הכותרת "WEMADEIT · שם המשימה"${wk.together && wk.together !== 'none' ? ', ואת היום המשותף כאירוע "יום עבודה משותף 💛"' : ''}.
5. ובסוף תוציא בלוק קוד אחד בפורמט הזה (id בדיוק כמו בסוגריים המרובעים, time אפשר להשאיר ריק):
${fence}json
{ "type": "wemadeit-week", "week": "${w}", "items": [ { "id": "t12", "date": "${addDays(w, 2)}", "time": "09:00" } ] }
${fence}

המשימות לשבוע:
${weekTasks(w).map(line).join('\n') || '(אין משימות מתוכננות לשבוע הזה)'}
${late.length ? `\nמשימות שנדחו משבועות קודמים (כדאי לשבץ קודם, אולי בגרסה קטנה יותר):\n${late.map(line).join('\n')}\n` : ''}
מה כתבתי על הלו"ז שלי:
${SCHEDULE.q.map((q, i) => `- ${t(q)} ${(sched[i] && sched[i].trim()) || '(לא ענו)'}`).join('\n')}`);
}

function parseBlock(txt) {
  const m = String(txt).match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = m ? m[1] : String(txt);
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1).replace(/[“”]/g, '"'));
}

function importPlan(p) {
  const weeks = S.planWeeks || planWeeks();
  S.goals = S.goals.filter((g) => g.manual);
  S.tasks = S.tasks.filter((x) => x.manual);
  const map = {};
  (p.goals || []).forEach((g) => {
    const id = uid('g');
    map[g.id] = id;
    S.goals.push({ id, area: areaId(g.area), title: String(g.title || ''), why: String(g.why || '') });
  });
  (p.tasks || []).forEach((x) => {
    const g = goal(map[x.goal]);
    const n = Math.max(1, Math.min(7, parseInt(x.times, 10) || 1));
    const wi = Math.max(1, Math.min(weeks.length, parseInt(x.week, 10) || 1));
    for (let i = 1; i <= n; i++) {
      S.tasks.push({
        id: uid('t'), goalId: g ? g.id : null, area: g ? g.area : areaId(x.area),
        title: n > 1 ? `${x.title} (${i}/${n})` : String(x.title || ''),
        week: weeks[wi - 1], date: null, time: null, together: !!x.together, status: 'todo', subs: [],
      });
    }
  });
  save();
}

function importWeek(p, w) {
  let n = 0;
  (p.items || []).forEach((it) => {
    const x = task(String(it.id || '').replace(/[\[\]\s]/g, ''));
    if (x && /^\d{4}-\d\d-\d\d$/.test(it.date)) {
      x.date = it.date; x.time = it.time || null; x.week = weekOf(it.date); n++;
    }
  });
  S.weeks[w] = { ...(S.weeks[w] || {}), planned: true };
  save();
  return n;
}

// ---------- העתקה ושליחה ----------
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* נשאר false */ }
    ta.remove();
    return ok;
  }
}

// ---------- מצב תצוגה ----------
const app = document.getElementById('app');
let V = { name: 'home' };
const bankView = { by: 'area', a: 'all' }; // נשמר כשחוזרים ממשימה
let ui = {};
function go(name, params = {}) { V = { name, ...params }; ui = { toast: ui.toast }; render(); window.scrollTo(0, 0); }
let toastTimer;
function toast(msg) {
  ui.toast = msg; render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; const el = document.querySelector('.toast'); if (el) el.remove(); }, 2600);
}

function render() {
  if (!S.user) { app.innerHTML = viewWelcome(); return; }
  const views = { home: viewHome, week: viewWeek, month: viewMonth, bank: viewBank, boost: viewBoost, me: viewMe, quest: viewQuest, plan: viewPlan, weekly: viewWeekly, task: viewTask, add: viewAdd, backup: viewBackup };
  const tabs = ['home', 'week', 'month', 'bank', 'me'];
  const v = views[V.name] ? V.name : 'home';
  app.innerHTML = `<main class="screen${tabs.includes(v) ? ' has-nav' : ''}">${views[v]()}</main>${tabs.includes(v) ? nav(v) : ''}${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ''}`;
  const f = app.querySelector('[data-autofocus]');
  if (f) f.focus();
}

// ---------- רכיבים ----------
const I = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  month: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  bank: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  next: '<path d="M15 5l-7 7 7 7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
};
const icon = (n, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

function nav(v) {
  // החודש יושב בתוך הלשונית של לוח הזמנים
  const b = (id, label) => `<button class="nav-btn${v === id || (id === 'week' && v === 'month') ? ' on' : ''}" data-act="go" data-v="${id}" aria-label="${label}">${icon(id, 24)}<span>${label}</span></button>`;
  return `<nav class="nav">${b('home', 'היום')}${b('week', 'לו"ז')}<button class="nav-plus" data-act="go" data-v="add" aria-label="משימה חדשה">${icon('plus', 26)}</button>${b('bank', 'בנק')}${b('me', 'אני')}</nav>`;
}

const calSwitch = (v) => `<div class="seg"><button class="${v === 'week' ? 'on' : ''}" data-act="go" data-v="week">שבוע</button><button class="${v === 'month' ? 'on' : ''}" data-act="go" data-v="month">חודש</button></div>`;

const topBack = (label = 'חזרה', to = 'home') => `<div class="top"><button class="round dashed" data-act="go" data-v="${to}" aria-label="${label}">${icon('back', 20)}</button></div>`;

function ring(size = 260) {
  const cx = size / 2, r = size / 2 - 20, n = AREAS.length, span = 360 / n, gap = 14;
  const pt = (deg) => { const a = ((deg - 90) * Math.PI) / 180; return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cx + r * Math.sin(a)).toFixed(1)}`; };
  const arc = (s, e) => `M ${pt(s)} A ${r} ${r} 0 0 1 ${pt(e)}`;
  const segs = AREAS.map((a, i) => {
    const list = S.tasks.filter((x) => x.area === a.id);
    const p = list.length ? pct(list) / 100 : 0;
    const s = i * span + gap / 2, e = (i + 1) * span - gap / 2;
    return `<path d="${arc(s, e)}" stroke="${a.color}" stroke-opacity=".35" stroke-width="22" stroke-linecap="round" fill="none"/>${p > 0 ? `<path d="${arc(s, s + Math.max(1, (e - s) * p))}" stroke="${a.color}" stroke-width="22" stroke-linecap="round" fill="none"/>` : ''}`;
  }).join('');
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="התקדמות לפי תחומים">${segs}</svg><div class="ring-in"><b>${pct(S.tasks)}%</b><span>בדרך לסוף השנה</span></div></div>`;
}

function taskRow(x, opts = {}) {
  const a = area(x.area);
  const late = isLate(x);
  const g = goal(x.goalId);
  const meta = [g ? `${a.name}: ${g.title}` : a.name];
  if (opts.showDate && x.date) meta.push(short(x.date));
  if (x.time) meta.push(x.time);
  if (opts.showWeek) meta.push(x.date ? `${DAYS[pd(x.date).getDay()]} ${short(x.date)}` : `שבוע ${weekNum(x.week)} · עוד לא שובץ`);
  if (x.subs.length) meta.push(`${x.subs.filter((s) => s.done).length}/${x.subs.length} צעדים קטנים`);
  return `<div class="trow${x.status === 'done' ? ' done' : ''}${late ? ' late' : ''}">
    <span class="dot" style="background:${a.color}"></span>
    <button class="tbody" data-act="open" data-id="${x.id}">
      <span class="ttl">${x.together ? '⭐ ' : ''}${esc(x.title)}</span>
      <span class="meta">${late ? '<em>נדחה</em> · ' : ''}${esc(meta.join(' · '))}</span>
    </button>
    <button class="check s-${x.status}" data-act="toggle" data-id="${x.id}" aria-label="${x.status === 'done' ? 'לבטל סימון' : 'סימון כבוצע'}">${x.status === 'done' ? icon('check', 16) : ''}</button>
  </div>`;
}

function nextStep() {
  if (!S.qDone) return { n: 1, title: 'למלא את השאלון', text: t('{עני|ענה} על כמה שאלות בכל תחום, כדי להבין איפה {את עומדת|אתה עומד} היום. אפשר לעצור באמצע ולהמשיך אחר כך, הכל נשמר.'), btn: t('{בואי|בוא} נתחיל'), v: 'quest' };
  if (!S.goals.length && !S.tasks.length) return { n: 2, title: 'לבנות תוכנית עם Claude', text: t('האפליקציה הכינה הודעה עם כל התשובות שלך. {תשלחי|תשלח} אותה ל-Claude, תבנו ביחד תוכנית עד סוף השנה, ו{תדביקי|תדביק} אותה בחזרה כאן. אני {אסביר לך|אסביר לך} כל צעד.'), btn: 'לשלב הבא', v: 'plan' };
  const w = targetWeek();
  if (!(S.weeks[w] && S.weeks[w].planned)) {
    const sat = new Date().getDay() === 6;
    return { n: 3, title: sat ? 'מוצ"ש: מתכננים את השבוע הבא' : 'תכנון שבועי', text: t(`בוחרים יום עבודה משותף עם ${me().partner}, ו-Claude משבץ את המשימות של השבוע לפי היומן שלך.`), btn: t('{בואי|בוא} נתכנן'), v: 'weekly' };
  }
  return null;
}

// ---------- מסכים ----------
function viewWelcome() {
  return `<main class="screen welcome">
    <div class="brand">WEMADEIT</div>
    <h1 class="serif">היי 💛</h1>
    <p class="lead">מי נכנס עכשיו?</p>
    <div class="who">
      <button class="big" style="background:#F4B6D2" data-act="pickUser" data-u="lali">ללי</button>
      <button class="big" style="background:#B9CDEB" data-act="pickUser" data-u="omri">עמרי</button>
    </div>
    <p class="muted small">כל אחד משתמש בטלפון שלו, והמידע נשמר אצלו.</p>
  </main>`;
}

function viewHome() {
  const u = me();
  const td = today();
  const step = nextStep();
  const late = S.tasks.filter(isLate);
  const todays = S.tasks.filter((x) => x.date === td).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const wk = S.weeks[weekOf(td)] || {};
  const unscheduled = S.tasks.filter((x) => !x.date && x.week === weekOf(td) && x.status !== 'done');
  return `
  <header class="hello">
    <div><span class="muted small">${fmtDay(td)}</span><h1 class="serif">היי ${esc(u.name)}</h1></div>
    <button class="avatar" data-act="go" data-v="me" aria-label="הדף שלי">${esc(u.name[0])}</button>
  </header>
  ${!isStandalone() ? `<div class="card hint"><b>טיפ חשוב:</b> ${t('{תוסיפי|תוסיף}')} את האפליקציה למסך הבית, ו${t('{תפתחי|תפתח}')} אותה רק משם, כדי שהכל יישמר. בספארי: כפתור השיתוף ${icon('share', 16)} ואז "הוספה למסך הבית".</div>` : ''}
  ${ring()}
  ${S.tasks.some((x) => x.status !== 'done') ? `<button class="boost-btn" data-act="go" data-v="boost">⚡ יש לי זמן ומוטיבציה<small>${t('{בואי|בוא} נראה במה אפשר להתקדם עכשיו')}</small></button>` : ''}
  ${step ? `<section class="card next">
    <span class="label">הצעד הבא · שלב ${step.n}</span>
    <h2>${esc(step.title)}</h2>
    <p>${esc(step.text)}</p>
    <button class="pill dark" data-act="go" data-v="${step.v}">${esc(step.btn)}</button>
  </section>` : ''}
  ${late.length ? `<section class="card late-card">
    <span class="label">נדחה קצת</span>
    <p class="big-text">"${esc(late[0].title)}" עבר את הזמן שלו. ${t('{בואי|בוא}')} נפרק אותו לצעד קטן יותר?</p>
    ${late.length > 1 ? `<p class="small">ועוד ${late.length - 1} משימות שנדחו</p>` : ''}
    <button class="pill dark" data-act="open" data-id="${late[0].id}" data-split="1">${t('{בואי|בוא}')} נפרק</button>
  </section>` : ''}
  ${wk.together === td ? `<div class="card together">💛 היום זה יום העבודה המשותף שלך ושל ${esc(u.partner)}${wk.time ? ` (${esc(wk.time)})` : ''}</div>` : ''}
  <div class="sec-head"><h2 class="serif">מה הצעד הבא?</h2><span class="muted small">${todays.length ? `${todays.filter((x) => x.status === 'done').length}/${todays.length} היום` : ''}</span></div>
  ${todays.length ? `<div class="list">${todays.map((x) => taskRow(x)).join('')}</div>` : `<p class="empty">${S.tasks.length ? 'אין משימות להיום. יום חופשי, או זמן טוב לקדם משהו מהשבוע 🙂' : 'כשתהיה תוכנית, המשימות של היום יופיעו כאן.'}</p>`}
  ${unscheduled.length ? `<button class="link-row" data-act="go" data-v="week">עוד ${unscheduled.length} משימות השבוע שעוד לא שובצו ←</button>` : ''}`;
}

function viewWeek() {
  const w = V.w || weekOf(today());
  const wk = S.weeks[w] || {};
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(w, i));
  const uns = S.tasks.filter((x) => !x.date && x.week === w);
  const inWeek = S.tasks.filter((x) => x.date && x.date >= w && x.date <= addDays(w, 6));
  const canPlan = w >= weekOf(today()) && !wk.planned;
  return `
  <div class="sec-head"><h1 class="serif">לוח זמנים</h1></div>
  ${calSwitch('week')}
  <div class="stepper">
    <button class="round" data-act="week" data-w="${addDays(w, -7)}" aria-label="שבוע קודם">${icon('back', 20)}</button>
    <span><b>${weekRange(w)}</b>${w === weekOf(today()) ? '<small>השבוע</small>' : ''}</span>
    <button class="round" data-act="week" data-w="${addDays(w, 7)}" aria-label="שבוע הבא">${icon('next', 20)}</button>
  </div>
  ${canPlan ? `<section class="card next"><span class="label">הצעד הבא</span><h2>לתכנן את השבוע</h2><p>${t('לבחור יום משותף ולשבץ את המשימות לפי היומן.')}</p><button class="pill dark" data-act="go" data-v="weekly" data-w="${w}">${t('{בואי|בוא} נתכנן')}</button></section>` : ''}
  ${wk.together && wk.together !== 'none' ? `<div class="card together">💛 יום עבודה משותף: ${fmtDay(wk.together)}${wk.time ? `, ${esc(wk.time)}` : ''}</div>` : ''}
  ${days.map((d) => {
    const list = inWeek.filter((x) => x.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    return `<div class="day${d === today() ? ' is-today' : ''}"><div class="day-h"><b>${DAYS[pd(d).getDay()]}</b> <span>${short(d)}</span>${wk.together === d ? ' <span class="chip">💛 יחד</span>' : ''}</div>
    ${list.length ? `<div class="list">${list.map((x) => taskRow(x)).join('')}</div>` : '<p class="muted small pad">-</p>'}</div>`;
  }).join('')}
  ${uns.length ? `<div class="day"><div class="day-h"><b>עוד לא שובץ</b></div><div class="list">${uns.map((x) => taskRow(x)).join('')}</div></div>` : ''}`;
}

function viewMonth() {
  const m = V.m || today().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const first = `${m}-01`;
  const daysIn = new Date(y, mo, 0).getDate();
  const sel = V.d && V.d.startsWith(m) ? V.d : (today().startsWith(m) ? today() : first);
  const prev = ds(new Date(y, mo - 2, 1)).slice(0, 7), next = ds(new Date(y, mo, 1)).slice(0, 7);
  const cells = [];
  for (let i = 0; i < pd(first).getDay(); i++) cells.push('<span></span>');
  const monthTasks = S.tasks.filter((x) => x.date && x.date.startsWith(m));
  for (let d = 1; d <= daysIn; d++) {
    const day = `${m}-${pad(d)}`;
    const list = monthTasks.filter((x) => x.date === day);
    const tog = (S.weeks[weekOf(day)] || {}).together === day;
    cells.push(`<button class="cell${day === sel ? ' sel' : ''}${day === today() ? ' tdy' : ''}${tog ? ' tog' : ''}" data-act="day" data-d="${day}"><span>${d}</span><i>${list.slice(0, 3).map((x) => `<s style="background:${x.status === 'done' ? '#1C1B19' : area(x.area).color}"></s>`).join('')}</i></button>`);
  }
  const selList = S.tasks.filter((x) => x.date === sel);
  const monthAll = S.tasks.filter((x) => (x.date || x.week).startsWith(m));
  return `
  <div class="sec-head"><h1 class="serif">לוח זמנים</h1></div>
  ${calSwitch('month')}
  <div class="stepper">
    <button class="round" data-act="month" data-m="${prev}" aria-label="חודש קודם">${icon('back', 20)}</button>
    <span><b>${MONTHS[mo - 1]} ${y}</b>${monthAll.length ? `<small>${pct(monthAll)}% בוצע</small>` : ''}</span>
    <button class="round" data-act="month" data-m="${next}" aria-label="חודש הבא">${icon('next', 20)}</button>
  </div>
  <div class="cal">${DAY_LETTERS.map((d) => `<span class="dow">${d}'</span>`).join('')}${cells.join('')}</div>
  <h2 class="serif sm">${fmtDay(sel)}</h2>
  ${selList.length ? `<div class="list">${selList.map((x) => taskRow(x)).join('')}</div>` : '<p class="empty">אין משימות ביום הזה.</p>'}`;
}

// מספר השבוע בתוכנית (שבוע 1 = השבוע שבו נבנתה התוכנית)
function weekNum(w) {
  const first = (S.planWeeks && S.planWeeks[0]) || weekOf(today());
  return Math.round((pd(w) - pd(first)) / (7 * 864e5)) + 1;
}

let boostArea = 'all';
let boostSeed = 1;

const TIMES = [['short', '⏱️', '10 דקות'], ['mid', '☕', 'חצי שעה'], ['long', '🔥', 'שעה ומעלה']];

// מה כדאי לעשות עכשיו: משימות וצעדים קטנים, מדורגים לפי דחיפות והזמן שיש
function suggestions(time) {
  const td = today(), cw = weekOf(td);
  const hash = (str) => { let h = boostSeed; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 9973; return h % 10; };
  const items = [];
  S.tasks.filter((x) => x.status !== 'done' && (boostArea === 'all' || x.area === boostArea)).forEach((x) => {
    const w = weekOf(x.date || x.week);
    let base, why;
    if (isLate(x)) { base = 50; why = t('נדחה קצת. {בואי|בוא} נסגור את זה, זה ישחרר 💪'); }
    else if (x.date === td) { base = 40; why = 'מתוכנן להיום'; }
    else if (w === cw) { base = 25; why = 'מהשבוע הזה'; }
    else { base = 5 - Math.min(4, Math.round((pd(w) - pd(cw)) / (7 * 864e5))); why = `להקדים משבוע ${weekNum(w)}, וככה השבוע ההוא יהיה רגוע יותר`; }
    const subs = x.subs.filter((y) => !y.done);
    subs.forEach((y, k) => items.push({ x, s: y, score: base + (time === 'short' ? 30 : time === 'mid' ? 10 : -5) - k * 3 + hash(y.id),
      why: `${why}. צעד קטן, ${time === 'short' ? 'בדיוק ל-10 דקות' : 'אפשר להתחיל ממנו'}` }));
    if (time === 'short' && subs.length) return; // בזמן קצר מציעים את הצעד הקטן ולא את כל המשימה
    // משימה שכתוב בה כמה דקות היא לוקחת, ולא נכנסת בזמן שיש
    const mins = Number((x.title.match(/(\d+)\s*דקות/) || [])[1] || 0);
    const tooLong = (time === 'short' && mins > 10) || (time === 'mid' && mins > 30);
    items.push({ x, score: base + (time === 'long' ? 15 : time === 'short' ? -10 : 0) + hash(x.id) - (tooLong ? 60 : 0), why });
  });
  return items.sort((a, b) => b.score - a.score);
}

function viewBoost() {
  const chips = `<div class="chips">
    <button class="${boostArea === 'all' ? 'on' : ''}" data-act="boostArea" data-a="all">הכל</button>
    ${AREAS.map((a) => `<button class="${boostArea === a.id ? 'on' : ''}" data-act="boostArea" data-a="${a.id}"><span class="cdot" style="background:${a.color}"></span>${a.name}</button>`).join('')}
  </div>`;
  if (!V.time) {
    return `${topBack()}
    <h1 class="serif">⚡ יאללה, מתקדמים!</h1>
    <p class="lead">${t('כמה זמן יש לך עכשיו? אני {אציע לך|אציע לך} משהו שמתאים בדיוק.')}</p>
    <div class="times">${TIMES.map(([k, e, l]) => `<button data-act="boostTime" data-time="${k}"><span>${e}</span>${l}</button>`).join('')}</div>
    <p class="muted small">${t('רוצה להתמקד בתחום מסוים? (לא חובה)')}</p>
    ${chips}`;
  }
  const list = suggestions(V.time);
  const i = list.length ? (V.i || 0) % list.length : 0;
  const cur = list[i];
  const label = TIMES.find((x) => x[0] === V.time);
  if (!cur) {
    return `${topBack()}<h1 class="serif">⚡ יאללה, מתקדמים!</h1>
    <p class="empty">${boostArea === 'all' ? 'אין משימות פתוחות. וואו! 🎉' : 'אין משימות פתוחות בתחום הזה 🎉'}</p>${chips}`;
  }
  const a = area(cur.x.area);
  const next = [1, 2, 3].map((k) => list[(i + k) % list.length]).filter((y, k, arr) => list.length > k + 1 && y !== cur && arr.indexOf(y) === k);
  return `${topBack()}
  <h1 class="serif">⚡ הצעה בשבילך</h1>
  <button class="link-row tight" data-act="boostReset">יש לי ${label[2]} ${label[1]} · לשנות</button>
  <div class="card suggest" style="border-color:${a.color}">
    <span class="chip" style="background:${a.color}">${a.icon} ${a.name}</span>
    ${goal(cur.x.goalId) ? `<span class="goal-line">🎯 ${esc(goal(cur.x.goalId).title)}</span>` : ''}
    ${cur.s ? `<span class="muted small">צעד קטן מתוך: ${esc(cur.x.title)}</span><h2 class="serif">${esc(cur.s.title)}</h2>` : `<h2 class="serif">${cur.x.together ? '⭐ ' : ''}${esc(cur.x.title)}</h2>`}
    <p class="why-line">💡 ${esc(cur.why)}</p>
    ${!cur.s && cur.x.subs.some((y) => !y.done) ? `<p class="small muted">יש בה ${cur.x.subs.filter((y) => !y.done).length} צעדים קטנים</p>` : ''}
    <button class="pill dark wide" data-act="boostGo" data-id="${cur.x.id}">${t('יאללה, {עושה|עושה} את זה עכשיו')} ⚡</button>
    <div class="row-btns">
      <button class="pill light" data-act="boostDone" data-id="${cur.x.id}" data-sid="${cur.s ? cur.s.id : ''}">✓ כבר ${t('{עשיתי|עשיתי}')}</button>
      <button class="pill light" data-act="boostNext" data-i="${i + 1}">משהו אחר ←</button>
    </div>
  </div>
  ${next.length ? `<h3 class="sm-head">עוד רעיונות</h3><div class="list">${next.map((y) => `<button class="idea" data-act="boostNext" data-i="${list.indexOf(y)}"><span class="dot" style="background:${area(y.x.area).color}"></span><span>${esc(y.s ? y.s.title : y.x.title)}<small>${y.s ? `צעד קטן מתוך: ${esc(y.x.title)}` : esc((goal(y.x.goalId) || {}).title || area(y.x.area).name)}</small></span></button>`).join('')}</div>` : ''}
  ${chips}`;
}

function viewBank() {
  const { by, a: f } = bankView;
  const shown = AREAS.filter((a) => f === 'all' || a.id === f);
  const tasks = S.tasks.filter((x) => f === 'all' || x.area === f);
  const sortT = (a, b) => (a.date || a.week).localeCompare(b.date || b.week) || a.id.localeCompare(b.id, undefined, { numeric: true });
  const chips = `<div class="chips">
    <button class="${f === 'all' ? 'on' : ''}" data-act="bank" data-by="${by}" data-a="all">הכל</button>
    ${AREAS.map((a) => `<button class="${f === a.id ? 'on' : ''}" data-act="bank" data-by="${by}" data-a="${a.id}"><span class="cdot" style="background:${a.color}"></span>${a.name}</button>`).join('')}
  </div>`;
  let body = '';
  if (!S.tasks.length) {
    body = `<p class="empty">${t('כאן יופיע כל הפירוק: כל תחום, כל מטרה וכל המשימות עד סוף השנה. זה יתמלא אחרי ש{תבני|תבנה} את התוכנית עם Claude.')}</p>
      ${S.qDone ? `<button class="pill dark" data-act="go" data-v="plan">לבנות תוכנית</button>` : `<button class="pill dark" data-act="go" data-v="quest">${t('{בואי|בוא} נתחיל מהשאלון')}</button>`}`;
  } else if (by === 'area') {
    body = shown.map((a) => {
      const at = tasks.filter((x) => x.area === a.id);
      if (!at.length) return '';
      const goals = S.goals.filter((g) => g.area === a.id);
      const loose = at.filter((x) => !goal(x.goalId));
      const block = (title, why, list, id) => `<details class="goal"${f !== 'all' ? ' open' : ''}>
        <summary><div class="gs"><b>${esc(title)}</b><span class="muted small">${list.filter((x) => x.status === 'done').length} מתוך ${list.length} משימות</span>
        <div class="bar"><div style="width:${pct(list)}%;background:${a.color}"></div></div></div></summary>
        ${why ? `<p class="why">למה: ${esc(why)}</p>` : ''}
        <div class="list">${list.sort(sortT).map((x) => taskRow(x, { showWeek: true })).join('')}</div>
        ${id ? `<button class="link-row" data-act="addTo" data-g="${id}">+ משימה למטרה הזו</button>` : ''}
      </details>`;
      return `<section class="abank"><div class="ahead"><span class="adot" style="background:${a.color}">${a.icon}</span><h2>${a.name}</h2><span class="apct">${pct(at)}%</span></div>
        ${goals.map((g) => block(g.title, g.why, at.filter((x) => x.goalId === g.id), g.id)).join('')}
        ${loose.length ? block('משימות נוספות', '', loose) : ''}</section>`;
    }).join('');
  } else {
    const weeks = [...new Set(tasks.map((x) => weekOf(x.date || x.week)))].sort();
    body = weeks.map((w) => {
      const list = tasks.filter((x) => weekOf(x.date || x.week) === w).sort(sortT);
      return `<details class="goal"${w === weekOf(today()) ? ' open' : ''}><summary><div class="day-h"><b>שבוע ${weekNum(w)}</b> <span>${weekRange(w)}</span>${w === weekOf(today()) ? ' <span class="chip">השבוע</span>' : ''}<span class="muted small" style="margin-inline-start:auto">${list.filter((x) => x.status === 'done').length}/${list.length}</span></div></summary>
        <div class="list">${list.map((x) => taskRow(x, { showWeek: true })).join('')}</div></details>`;
    }).join('');
  }
  return `
  <div class="sec-head"><h1 class="serif">בנק משימות</h1><span class="muted small">${S.tasks.length ? `${S.tasks.filter((x) => x.status === 'done').length}/${S.tasks.length} בוצעו` : ''}</span></div>
  <p class="muted">כל מה שצריך לעשות עד סוף השנה, במקום אחד.</p>
  <div class="seg"><button class="${by === 'area' ? 'on' : ''}" data-act="bank" data-by="area" data-a="${f}">לפי תחום ומטרה</button><button class="${by === 'week' ? 'on' : ''}" data-act="bank" data-by="week" data-a="${f}">לפי שבועות</button></div>
  ${S.tasks.length ? chips : ''}
  ${body}`;
}

function viewMe() {
  const u = me();
  return `
  <header class="hello"><div><h1 class="serif">${esc(u.name)}</h1><span class="muted small">איפה אני עומד${u.g === 'f' ? 'ת' : ''} בכל תחום</span></div></header>
  <div class="list areas">
  ${AREAS.map((a) => {
    const list = S.tasks.filter((x) => x.area === a.id);
    const p = pct(list);
    const sc = S.answers[a.id] && S.answers[a.id].score;
    const goals = S.goals.filter((g) => g.area === a.id);
    return `<div class="arow"><span class="adot" style="background:${a.color}">${a.icon}</span><div class="agrow"><b>${a.name}</b>
      <div class="bar"><div style="width:${p}%;background:${a.color}"></div></div>
      <span class="muted small">${list.length ? `${list.filter((x) => x.status === 'done').length} מתוך ${list.length} משימות` : 'עוד אין משימות'}${sc ? ` · ציון בהתחלה: ${sc}/10` : ''}</span>
      ${goals.length ? `<ul class="goals">${goals.map((g) => `<li>${esc(g.title)} <span class="muted">(${pct(S.tasks.filter((x) => x.goalId === g.id))}%)</span></li>`).join('')}</ul>` : ''}
      </div><span class="apct">${p}%</span></div>`;
  }).join('')}
  </div>
  <div class="stack">
    <button class="pill light wide" data-act="go" data-v="quest">${S.qDone ? 'לעבור שוב על השאלון' : 'להמשיך את השאלון'}</button>
    ${S.qDone ? '<button class="pill light wide" data-act="go" data-v="plan">לבנות את התוכנית מחדש עם Claude</button>' : ''}
    <button class="pill light wide" data-act="go" data-v="weekly">תכנון שבועי</button>
    <button class="pill light wide" data-act="go" data-v="backup">גיבוי ושחזור</button>
  </div>
  <p class="muted small center">גרסה: ${VERSION}</p>`;
}

function viewQuest() {
  const parts = [...AREAS, SCHEDULE];
  const i = Math.min(V.i || 0, parts.length - 1);
  const a = parts[i];
  const ans = S.answers[a.id] || {};
  return `
  ${topBack('יציאה מהשאלון')}
  <div class="qprog">${parts.map((_, k) => `<s class="${k < i ? 'done' : k === i ? 'on' : ''}"></s>`).join('')}</div>
  <span class="muted small">חלק ${i + 1} מתוך ${parts.length}</span>
  <h1 class="serif">${a.icon} ${a.name}</h1>
  ${a.score ? `<div class="field"><label>${t('כמה {את מרוצה|אתה מרוצה} מהמצב היום?')}</label>
    <div class="scores">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="sc${ans.score === n ? ' on' : ''}" data-act="score" data-a="${a.id}" data-n="${n}" aria-label="ציון ${n}">${n}</button>`).join('')}</div>
    <div class="scale muted small"><span>בכלל לא</span><span>מאוד</span></div></div>` : ''}
  ${a.q.map((q, k) => `<div class="field"><label for="q${k}">${esc(t(q))}</label><textarea id="q${k}" rows="3" data-in="ans" data-a="${a.id}" data-k="${k}">${esc((ans.a && ans.a[k]) || '')}</textarea></div>`).join('')}
  <div class="row-btns">
    ${i > 0 ? `<button class="pill light" data-act="quest" data-i="${i - 1}">הקודם</button>` : '<span></span>'}
    ${i < parts.length - 1 ? `<button class="pill dark" data-act="quest" data-i="${i + 1}">הבא</button>` : `<button class="pill dark" data-act="questDone">${t('סיימתי!')}</button>`}
  </div>`;
}

function handoff(steps) {
  return `<ol class="steps">${steps.map((s, i) => `<li class="card step"><span class="num">${i + 1}</span><div><h3>${s.title}</h3>${s.body}</div></li>`).join('')}</ol>`;
}
const sendButtons = (kind) => `<div class="btn-row">
  <button class="pill dark" data-act="copy" data-kind="${kind}">${icon('copy', 18)} העתקה</button>
  ${navigator.share ? `<button class="pill light" data-act="share" data-kind="${kind}">${icon('share', 18)} שליחה</button>` : ''}
</div>`;
const openClaude = `<a class="pill light" href="https://claude.ai/new" target="_blank" rel="noopener">${icon('out', 18)} לפתוח את Claude</a>`;

function viewPlan() {
  if (ui.plan) {
    const p = ui.plan;
    return `${topBack()}
    <h1 class="serif">כמעט שם!</h1>
    <p class="lead">${t('זו התוכנית ש-Claude הכין. {תעברי|תעבור} עליה, ואם הכל נכון {תאשרי|תאשר}.')}</p>
    ${AREAS.map((a) => {
      const gs = (p.goals || []).filter((g) => areaId(g.area) === a.id);
      if (!gs.length) return '';
      return `<div class="card"><h3>${a.icon} ${a.name}</h3><ul class="goals">${gs.map((g) => {
        const ts = (p.tasks || []).filter((x) => x.goal === g.id);
        return `<li><b>${esc(g.title)}</b><br><span class="muted small">${ts.length} משימות: ${esc(ts.slice(0, 3).map((x) => x.title).join(', '))}${ts.length > 3 ? '...' : ''}</span></li>`;
      }).join('')}</ul></div>`;
    }).join('')}
    ${S.tasks.some((x) => !x.manual) ? '<p class="warn">שימו לב: זה יחליף את התוכנית הקודמת.</p>' : ''}
    <div class="row-btns"><button class="pill light" data-act="planCancel">לא, לחזור</button><button class="pill dark" data-act="planOk">${t('{מאשרת|מאשר}, להכניס!')}</button></div>`;
  }
  return `${topBack()}
  <span class="label">הצעד הבא · שלב 2</span>
  <h1 class="serif">בונים תוכנית עם Claude</h1>
  <p class="lead">${t('זה לוקח בערך 15 דקות של שיחה. {תעשי|תעשה} את זה כש{יש לך|יש לך} רגע שקט.')}</p>
  ${handoff([
    { title: t('{תעתיקי|תעתיק} את ההודעה'), body: `<p>${t('בהודעה יש את כל התשובות שלך מהשאלון, והסבר ל-Claude מה לעשות.')}</p>${sendButtons('plan')}` },
    { title: t('{תפתחי|תפתח} את Claude ו{תדביקי|תדביק}'), body: `<p>${t('{פתחי|פתח} שיחה חדשה, {לחצי לחיצה ארוכה|לחץ לחיצה ארוכה} על שורת הכתיבה ו{בחרי|בחר} "הדבקה". Claude יעבוד איתך ב-4 שלבים: תמונת מצב, מטרות, פירוק למשימות ותוכנית סופית. אחרי כל שלב הוא יעצור ויחכה לך. אפשר לתקן אותו כמה שרוצים, ובסוף {תכתבי "מאשרת"|תכתוב "מאשר"}.')}</p>${openClaude}` },
    { title: t('{תעתיקי|תעתיק} את התוכנית בחזרה'), body: `<p>${t('בסוף Claude ייתן קוד בתוך מסגרת. {לחצי|לחץ} על כפתור ההעתקה שלו ({הדביקי|הדבק}) כאן:')}</p>
      <textarea rows="5" data-in="paste" placeholder="${t('{הדביקי|הדבק} כאן את מה ש-Claude נתן')}">${esc(ui.paste || '')}</textarea>
      ${ui.err ? `<p class="warn">${esc(ui.err)}</p>` : ''}
      <button class="pill dark" data-act="planCheck">לבדוק את התוכנית</button>` },
  ])}`;
}

function viewWeekly() {
  const cur = weekOf(today());
  const w = V.w || targetWeek();
  const wk = S.weeks[w] || {};
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(w, i));
  const partner = me().partner;
  return `${topBack()}
  <span class="label">הצעד הבא · תכנון שבועי</span>
  <h1 class="serif">מתכננים את השבוע</h1>
  <div class="seg">
    <button class="${w === cur ? 'on' : ''}" data-act="go" data-v="weekly" data-w="${cur}">השבוע · ${short(cur)}</button>
    <button class="${w === addDays(cur, 7) ? 'on' : ''}" data-act="go" data-v="weekly" data-w="${addDays(cur, 7)}">הבא · ${short(addDays(cur, 7))}</button>
  </div>
  ${handoff([
    { title: 'בוחרים יום עבודה משותף 💛', body: `<p>${t(`{תחליטו|תחליטו} ביחד עם ${partner} איזה יום משריינים השבוע, ושניכם {בוחרים|בוחרים} את אותו יום.`)}</p>
      <div class="daypick">${days.map((d) => `<button class="${wk.together === d ? 'on' : ''}" data-act="together" data-w="${w}" data-d="${d}"><b>${DAYS[pd(d).getDay()]}</b><span>${short(d)}</span></button>`).join('')}
      <button class="none${wk.together === 'none' ? ' on' : ''}" data-act="together" data-w="${w}" data-d="none">אין השבוע</button></div>
      <label class="small" for="ttime">שעות (לא חובה)</label><input id="ttime" type="text" placeholder="למשל 10:00-14:00" value="${esc(wk.time || '')}" data-ch="ttime" data-w="${w}">` },
    { title: t('{תעתיקי|תעתיק} את ההודעה'), body: `<p>${t('בהודעה יש את המשימות של השבוע, היום המשותף ומה {שכתבת|שכתבת} על הלו"ז שלך.')}</p>${wk.together ? sendButtons('week') : '<p class="muted small">קודם בוחרים יום משותף (או "אין השבוע").</p>'}` },
    { title: t('{תפתחי|תפתח} את Claude ו{תדביקי|תדביק}'), body: `<p>${t('Claude יסתכל ביומן Google שלך, יציע איפה לשבץ כל משימה ויכניס אותן ליומן אחרי ש{תאשרי|תאשר}. אם הוא לא רואה את היומן, {תגידי|תגיד} לו מה הלו"ז שלך.')}</p>${openClaude}` },
    { title: t('{תעתיקי|תעתיק} את השיבוץ בחזרה'), body: `<p>${t('בסוף Claude ייתן קוד בתוך מסגרת. {תעתיקי|תעתיק} אותו ו{תדביקי|תדביק} כאן:')}</p>
      <textarea rows="4" data-in="paste" placeholder="${t('{הדביקי|הדבק} כאן')}">${esc(ui.paste || '')}</textarea>
      ${ui.err ? `<p class="warn">${esc(ui.err)}</p>` : ''}
      <button class="pill dark" data-act="weekOk" data-w="${w}">לשבץ באפליקציה</button>` },
  ])}`;
}

function viewTask() {
  const x = task(V.id);
  if (!x) return `${topBack()}<p class="empty">המשימה לא נמצאה.</p>`;
  const a = area(x.area), g = goal(x.goalId);
  const late = isLate(x);
  const tog = togetherFor(x);
  const quick = [['today', 'היום'], ['tomorrow', 'מחר']];
  if (tog) quick.push(['together', `💛 ביום המשותף (${DAYS[pd(tog).getDay()]})`]);
  quick.push(['nextweek', 'לשבוע הבא'], ['none', 'בלי תאריך']);
  const weeks = [...new Set([...(S.planWeeks || []), ...planWeeks(), x.week])].filter((w) => w >= weekOf(today()) || w === x.week).sort();
  if (ui.edit) {
    return `${topBack('חזרה', V.from || 'home')}
    <h1 class="serif">עריכת המשימה</h1>
    <div class="field"><label for="etitle">מה עושים?</label><input id="etitle" type="text" value="${esc(x.series ? x.base : x.title)}"></div>
    <div class="field"><label for="earea">תחום</label><select id="earea">${AREAS.map((y) => `<option value="${y.id}"${y.id === x.area ? ' selected' : ''}>${y.icon} ${y.name}</option>`).join('')}</select></div>
    ${S.goals.length ? `<div class="field"><label for="egoal">מטרה</label><select id="egoal"><option value="">בלי</option>${S.goals.map((y) => `<option value="${y.id}"${y.id === x.goalId ? ' selected' : ''}>${esc(area(y.area).name)}: ${esc(y.title)}</option>`).join('')}</select></div>` : ''}
    <label class="toggle"><input id="etog" type="checkbox" ${x.together ? 'checked' : ''}> מתאים ליום המשותף ⭐</label>
    ${x.series ? `<label class="toggle"><input id="eall" type="checkbox" checked> לשנות גם בכל החזרות הבאות 🔁</label>` : ''}
    <div class="row-btns"><button class="pill light" data-act="editCancel">ביטול</button><button class="pill dark" data-act="editSave">שמירה</button></div>
    <button class="pill light wide danger" data-act="delTask">${x.series ? 'למחוק רק את המשימה הזו' : 'מחיקת המשימה'}</button>
    ${x.series ? '<button class="pill light wide danger" data-act="delSeries">למחוק אותה ואת כל החזרות הבאות</button>' : ''}`;
  }
  return `${topBack('חזרה', V.from || 'home')}
  <div class="card hero" style="background:${a.color}">
    <span class="chip light">${a.icon} ${a.name}</span>
    <h1 class="serif task-title">${x.together ? '⭐ ' : ''}${esc(x.title)}</h1>
    ${g ? `<span class="small">מטרה: ${esc(g.title)}</span>` : ''}
    <span class="when">📅 ${esc(whenText(x))}</span>
    ${x.rep ? `<span class="small">🔁 חוזרת: ${esc(x.rep)}</span>` : ''}
    <button class="pill white" data-act="edit">✏️ עריכה</button>
  </div>
  ${late ? `<div class="card late-card"><b>המשימה הזו נדחתה, וזה בסדר.</b><p>${t('אפשר להזיז אותה למטה, או לפרק אותה: מה הצעד הכי קטן שאפשר לעשות כבר היום?')}</p></div>` : ''}
  <section class="card move">
    <h3>להזיז את המשימה</h3>
    <div class="quick">${quick.map(([k, l]) => `<button data-act="move" data-to="${k}">${l}</button>`).join('')}</div>
    <div class="two">
      <div class="field"><label for="tdate">תאריך אחר</label><input id="tdate" type="date" value="${x.date || ''}" data-ch="date"></div>
      <div class="field"><label for="ttm">שעה</label><input id="ttm" type="time" value="${x.time || ''}" data-ch="time"></div>
    </div>
    ${!x.date ? `<div class="field"><label for="tweek">או רק לבחור שבוע</label><select id="tweek" data-ch="week">${weeks.map((w) => `<option value="${w}"${w === x.week ? ' selected' : ''}>שבוע ${weekNum(w)} · ${weekRange(w)}${w === weekOf(today()) ? ' (השבוע)' : ''}</option>`).join('')}</select></div>` : ''}
  </section>
  <div class="field"><label>מצב</label><div class="seg">
    ${[['todo', 'לא התחיל'], ['doing', 'בתהליך'], ['done', 'בוצע']].map(([k, l]) => `<button class="${x.status === k ? 'on' : ''}" data-act="status" data-s="${k}">${l}</button>`).join('')}
  </div></div>
  <div class="field"><label>צעדים קטנים</label>
    <div class="subs">${x.subs.map((s) => `<div class="sub"><button class="check sm s-${s.done ? 'done' : 'todo'}" data-act="subToggle" data-sid="${s.id}" aria-label="סימון">${s.done ? icon('check', 13) : ''}</button><span class="${s.done ? 'strike' : ''}">${esc(s.title)}</span><button class="x" data-act="subDel" data-sid="${s.id}" aria-label="מחיקה">×</button></div>`).join('')}</div>
    <div class="add-sub"><input id="subin" type="text" placeholder="צעד קטן חדש" ${V.split ? 'data-autofocus' : ''}><button class="pill pink" data-act="subAdd">+ הוספה</button></div>
  </div>
  `;
}

// המשימה הזו וכל החזרות שאחריה שעוד לא בוצעו
function seriesFrom(x) {
  const key = (y) => y.date || y.week;
  return S.tasks.filter((y) => y === x || (x.series && y.series === x.series && y.status !== 'done' && key(y) >= key(x)));
}

function whenText(x) {
  if (x.date) return `${fmtDay(x.date)}${x.time ? `, ${x.time}` : ''}`;
  return `שבוע ${weekNum(x.week)} (${weekRange(x.week)}), עוד לא נקבע יום`;
}

// היום המשותף הקרוב שאפשר להזיז אליו: בשבוע של המשימה, ואם עבר, בשבוע הנוכחי
function togetherFor(x) {
  for (const w of [weekOf(x.date || x.week), weekOf(today()), addDays(weekOf(today()), 7)]) {
    const d = (S.weeks[w] || {}).together;
    if (d && d !== 'none' && d >= today()) return d;
  }
  return null;
}

const REPS = [['once', 'פעם אחת'], ['daily', 'כל יום'], ['days', 'בימים קבועים'], ['weekly', 'כמה פעמים בשבוע'], ['monthly', 'פעם בחודש']];

function viewAdd() {
  const f = ui.add || (ui.add = { title: '', area: AREAS[0].id, goal: V.g || '', together: false, rep: 'once', date: '', time: '', days: [], n: 3, start: today(), end: END });
  const count = repeatDates(f).length;
  return `${topBack()}
  <h1 class="serif">משימה חדשה</h1>
  <div class="field"><label for="ntitle">מה עושים?</label><input id="ntitle" type="text" value="${esc(f.title)}" data-in="add" data-f="title" ${f.title ? '' : 'data-autofocus'}></div>
  <div class="field"><label for="narea">תחום</label><select id="narea" data-in="add" data-f="area">${AREAS.map((a) => `<option value="${a.id}"${f.area === a.id ? ' selected' : ''}>${a.icon} ${a.name}</option>`).join('')}</select></div>
  ${S.goals.length ? `<div class="field"><label for="ngoal">מטרה (לא חובה)</label><select id="ngoal" data-in="add" data-f="goal"><option value="">בלי</option>${S.goals.map((g) => `<option value="${g.id}"${f.goal === g.id ? ' selected' : ''}>${esc(area(g.area).name)}: ${esc(g.title)}</option>`).join('')}</select></div>` : ''}
  <section class="card move">
    <h3>🔁 כל כמה זמן?</h3>
    <div class="quick">${REPS.map(([k, l]) => `<button class="${f.rep === k ? 'on' : ''}" data-act="addRep" data-r="${k}">${l}</button>`).join('')}</div>
    ${f.rep === 'once' ? `<div class="two">
      <div class="field"><label for="ndate">תאריך (לא חובה)</label><input id="ndate" type="date" value="${f.date}" data-in="add" data-f="date"></div>
      <div class="field"><label for="ntime">שעה</label><input id="ntime" type="time" value="${f.time}" data-in="add" data-f="time"></div></div>` : ''}
    ${f.rep === 'days' ? `<div class="field"><label>באילו ימים?</label><div class="daypick seven">${DAYS.map((d, i) => `<button class="${f.days.includes(i) ? 'on' : ''}" data-act="addDay" data-d="${i}" aria-label="יום ${d}"><b>${DAY_LETTERS[i]}'</b></button>`).join('')}</div></div>` : ''}
    ${f.rep === 'weekly' ? `<div class="field"><label>כמה פעמים בשבוע?</label><div class="quick">${[1, 2, 3, 4, 5].map((n) => `<button class="${f.n === n ? 'on' : ''}" data-act="addN" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="muted small">את הימים עצמם בוחרים בתכנון השבועי של מוצ"ש.</p></div>` : ''}
    ${f.rep !== 'once' ? `<div class="two">
      <div class="field"><label for="nstart">מתחילים מ</label><input id="nstart" type="date" value="${f.start}" data-in="add" data-f="start"></div>
      <div class="field"><label for="nend">עד</label><input id="nend" type="date" value="${f.end}" data-in="add" data-f="end"></div></div>
      ${f.rep !== 'weekly' ? `<div class="field"><label for="ntime2">שעה (לא חובה)</label><input id="ntime2" type="time" value="${f.time}" data-in="add" data-f="time"></div>` : ''}
      <p class="count">${count ? `ייווצרו ${count} משימות, ${esc(repText(f))}` : 'עוד לא נבחר מתי'}</p>` : ''}
  </section>
  <label class="toggle"><input type="checkbox" ${f.together ? 'checked' : ''} data-in="add" data-f="together"> מתאים ליום המשותף ⭐</label>
  <button class="pill dark wide" data-act="addTask">הוספה</button>`;
}

// כל המופעים של משימה חוזרת. מופע בלי תאריך מסומן עם week בלבד.
function repeatDates(f) {
  if (f.rep === 'once') return [{ date: f.date || null, week: weekOf(f.date || today()) }];
  const out = [];
  const start = f.start || today(), end = f.end || END;
  if (end < start) return out;
  if (f.rep === 'weekly') {
    for (let w = weekOf(start); w <= end && out.length < 400; w = addDays(w, 7)) {
      for (let i = 1; i <= f.n; i++) out.push({ date: null, week: w, suffix: f.n > 1 ? ` (${i}/${f.n})` : '' });
    }
    return out;
  }
  if (f.rep === 'monthly') {
    const day = pd(start).getDate();
    for (let k = 0; out.length < 400; k++) {
      const m = pd(start); m.setDate(1); m.setMonth(m.getMonth() + k);
      const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      m.setDate(Math.min(day, last));
      const d = ds(m);
      if (d > end) break;
      out.push({ date: d, week: weekOf(d) });
    }
    return out;
  }
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) {
    if (f.rep === 'daily' || f.days.includes(pd(d).getDay())) out.push({ date: d, week: weekOf(d) });
  }
  return out;
}

function repText(f) {
  if (f.rep === 'daily') return 'כל יום';
  if (f.rep === 'days') {
    const names = f.days.slice().sort().map((i) => DAYS[i]);
    return `כל יום ${names.length > 1 ? `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}` : names[0] || ''}`;
  }
  if (f.rep === 'weekly') return `${f.n} ${f.n === 1 ? 'פעם' : 'פעמים'} בשבוע`;
  if (f.rep === 'monthly') return 'פעם בחודש';
  return '';
}

function viewBackup() {
  return `${topBack('חזרה', 'me')}
  <h1 class="serif">גיבוי ושחזור</h1>
  <p class="lead">${t('הכל נשמר בטלפון שלך. כדאי לגבות פעם בשבוע (נגיד בתכנון של מוצ"ש): {לחצי|לחץ} "שליחה" ו{שמרי|שמור} את הגיבוי בפתקים או במייל לעצמך.')}</p>
  ${sendButtons('backup')}
  <h2 class="serif sm">שחזור</h2>
  <p>${t('{הדביקי|הדבק} כאן גיבוי ששמרת:')}</p>
  <textarea rows="4" data-in="paste">${esc(ui.paste || '')}</textarea>
  ${ui.err ? `<p class="warn">${esc(ui.err)}</p>` : ''}
  <button class="pill dark" data-act="restore">לשחזר</button>
  <h2 class="serif sm">החלפת משתמש</h2>
  <p class="muted small">${t('מוחק את כל המידע מהטלפון הזה. כדאי לגבות קודם.')}</p>
  <button class="pill light danger" data-act="reset">מחיקה והתחלה מחדש</button>`;
}

// ---------- פעולות ----------
const CHEERS = ['יש! עוד צעד קדימה 🎉', 'כל הכבוד! 💛', 'וואו, זה זז! ✨', 'ככה בונים חלומות 🚀'];
const promptFor = (kind) => (kind === 'plan' ? planPrompt() : kind === 'week' ? weeklyPrompt(V.w || targetWeek()) : JSON.stringify({ type: 'wemadeit-backup', data: S }));

const ACT = {
  pickUser: (d) => { S.user = { ...USERS[d.u] }; save(); go('home'); },
  go: (d) => go(d.v, d.w ? { w: d.w } : d.more ? { more: true } : {}),
  week: (d) => go('week', { w: d.w }),
  month: (d) => go('month', { m: d.m }),
  day: (d) => { V.d = d.d; render(); },
  bank: (d) => { bankView.by = d.by; bankView.a = d.a; go('bank'); },
  addTo: (d) => go('add', { g: d.g }),
  open: (d) => go('task', { id: d.id, from: V.name === 'task' ? 'home' : V.name, split: !!d.split }),
  toggle: (d) => {
    const x = task(d.id);
    x.status = x.status === 'done' ? 'todo' : 'done';
    save();
    if (x.status === 'done') {
      const g = goal(x.goalId);
      const goalDone = g && S.tasks.filter((y) => y.goalId === g.id).every((y) => y.status === 'done');
      toast(goalDone ? `סגרת מטרה שלמה: ${g.title} 🏆` : CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    } else render();
  },
  score: (d) => { const a = (S.answers[d.a] = S.answers[d.a] || {}); a.score = Number(d.n); save(); keepScroll(); },
  quest: (d) => go('quest', { i: Number(d.i) }),
  questDone: () => { S.qDone = true; save(); go('home'); toast(t('כל הכבוד! עכשיו בונים תוכנית 💪')); },
  copy: async (d) => { const ok = await copyText(promptFor(d.kind)); toast(ok ? t('הועתק! עכשיו {תדביקי|תדביק} ב-Claude') : 'לא הצלחתי להעתיק, נסו "שליחה"'); },
  share: async (d) => { try { await navigator.share({ text: promptFor(d.kind) }); } catch (e) { /* המשתמש ביטל */ } },
  planCheck: () => {
    try {
      const p = parseBlock(ui.paste);
      if (!p.goals || !p.tasks) throw new Error('x');
      ui.plan = p; ui.err = null;
    } catch (e) { ui.err = t('לא הצלחתי לקרוא את זה. {תוודאי|תוודא} שהעתקת את כל הקוד ש-Claude נתן, מהסוגר הראשון עד האחרון.'); }
    render(); window.scrollTo(0, 0);
  },
  planCancel: () => { ui.plan = null; render(); },
  planOk: () => { importPlan(ui.plan); go('home'); toast(`התוכנית נכנסה! ${S.tasks.length} משימות עד סוף השנה 🎉`); },
  together: (d) => { S.weeks[d.w] = { ...(S.weeks[d.w] || {}), together: d.d }; save(); V.w = d.w; keepScroll(); },
  weekOk: (d) => {
    try {
      const p = parseBlock(ui.paste);
      if (!p.items) throw new Error('x');
      const n = importWeek(p, d.w);
      go('week', { w: d.w }); toast(`שובצו ${n} משימות. שבוע מוצלח! 💛`);
    } catch (e) { ui.err = t('לא הצלחתי לקרוא את זה. {תוודאי|תוודא} שהעתקת את כל הקוד ש-Claude נתן.'); render(); }
  },
  status: (d) => { const x = task(V.id); x.status = d.s; save(); if (d.s === 'done') toast(CHEERS[0]); else render(); },
  subAdd: () => {
    const inp = document.getElementById('subin');
    const v = inp && inp.value.trim();
    if (!v) return;
    task(V.id).subs.push({ id: uid('s'), title: v, done: false }); save(); V.split = true; render();
  },
  boostTime: (d) => { boostSeed = Math.floor(Math.random() * 9973) + 1; go('boost', { time: d.time }); },
  boostReset: () => go('boost'),
  boostArea: (d) => { boostArea = d.a; V.i = 0; keepScroll(); },
  boostNext: (d) => { V.i = Number(d.i); render(); window.scrollTo(0, 0); },
  boostGo: (d) => {
    const x = task(d.id);
    x.date = today(); x.week = weekOf(today()); if (x.status === 'todo') x.status = 'doing'; save();
    go('task', { id: x.id, from: 'home' }); toast(t('{בהצלחה|בהצלחה}! 💪'));
  },
  boostDone: (d) => {
    const x = task(d.id);
    if (d.sid) x.subs.find((y) => y.id === d.sid).done = true; else x.status = 'done';
    save(); toast(d.sid ? 'צעד קטן, ניצחון גדול ✨' : CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  },
  subToggle: (d) => { const s = task(V.id).subs.find((y) => y.id === d.sid); s.done = !s.done; save(); if (s.done) toast('צעד קטן, ניצחון גדול ✨'); else render(); },
  subDel: (d) => { const x = task(V.id); x.subs = x.subs.filter((y) => y.id !== d.sid); save(); render(); },
  edit: () => { ui.edit = true; render(); window.scrollTo(0, 0); },
  editCancel: () => { ui.edit = false; render(); },
  editSave: () => {
    const x = task(V.id);
    const title = document.getElementById('etitle').value.trim();
    if (!title) { toast('צריך לכתוב מה עושים 🙂'); return; }
    const gEl = document.getElementById('egoal');
    const allEl = document.getElementById('eall');
    const goalId = (gEl && gEl.value) || null;
    const changes = { goalId, area: goalId ? goal(goalId).area : document.getElementById('earea').value, together: document.getElementById('etog').checked };
    const targets = allEl && allEl.checked ? seriesFrom(x) : [x];
    targets.forEach((y) => { Object.assign(y, changes); y.base = title; y.title = title + (x.series ? y.suffix || '' : ''); });
    save(); ui.edit = false; toast(targets.length > 1 ? `נשמר ב-${targets.length} משימות ✓` : 'נשמר ✓');
  },
  delSeries: () => {
    const ids = new Set(seriesFrom(task(V.id)).map((y) => y.id));
    if (!confirm(`למחוק ${ids.size} משימות?`)) return;
    S.tasks = S.tasks.filter((y) => !ids.has(y.id)); save(); go(V.from || 'home'); toast('נמחקו');
  },

  move: (d) => {
    const x = task(V.id);
    const to = { today: today(), tomorrow: addDays(today(), 1), together: togetherFor(x) }[d.to];
    if (to) { x.date = to; x.week = weekOf(to); }
    else if (d.to === 'nextweek') { x.week = addDays(weekOf(today()), 7); x.date = null; x.time = null; }
    else if (d.to === 'none') { x.date = null; x.time = null; if (x.week < weekOf(today())) x.week = weekOf(today()); }
    save(); toast(`הוזז: ${whenText(x)}`);
  },
  delTask: () => { if (!confirm('למחוק את המשימה?')) return; S.tasks = S.tasks.filter((y) => y.id !== V.id); save(); go(V.from || 'home'); },
  addRep: (d) => { ui.add.rep = d.r; keepScroll(); },
  addDay: (d) => { const f = ui.add, i = Number(d.d); f.days = f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i]; keepScroll(); },
  addN: (d) => { ui.add.n = Number(d.n); keepScroll(); },
  addTask: () => {
    const f = ui.add;
    const title = f.title.trim();
    if (!title) { toast('צריך לכתוב מה עושים 🙂'); return; }
    const list = repeatDates(f);
    if (!list.length) { toast('צריך לבחור מתי 🙂'); return; }
    const g = goal(f.goal);
    const series = f.rep === 'once' ? null : uid('r');
    list.forEach((o) => S.tasks.push({
      id: uid('t'), goalId: g ? g.id : null, area: g ? g.area : f.area, title: title + (o.suffix || ''), base: title, suffix: o.suffix || '',
      week: o.week, date: o.date, time: o.date ? f.time || null : null, together: f.together, status: 'todo', subs: [], manual: true,
      series, rep: series ? repText(f) : undefined,
    }));
    save(); go('home'); toast(series ? `נוספו ${list.length} משימות, ${repText(f)} 🔁` : 'נוסף!');
  },

  restore: () => {
    try {
      const p = parseBlock(ui.paste);
      if (p.type !== 'wemadeit-backup' || !p.data || !p.data.user) throw new Error('x');
      if (!confirm('לשחזר? זה יחליף את מה שיש עכשיו.')) return;
      S = { ...fresh(), ...p.data }; save(); go('home'); toast('שוחזר!');
    } catch (e) { ui.err = 'זה לא נראה כמו גיבוי של WEMADEIT.'; render(); }
  },
  reset: () => { if (!confirm('למחוק את כל המידע מהטלפון הזה?')) return; S = fresh(); save(); go('home'); },
};
function keepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }

const IN = {
  ans: (el) => { const a = (S.answers[el.dataset.a] = S.answers[el.dataset.a] || {}); a.a = a.a || []; a.a[Number(el.dataset.k)] = el.value; save(); },
  paste: (el) => { ui.paste = el.value; },
  add: (el) => { ui.add[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; if (el.type === 'date') keepScroll(); },
};
const CH = {
  ttime: (el) => { const w = el.dataset.w; S.weeks[w] = { ...(S.weeks[w] || {}), time: el.value.trim() }; save(); },
  date: (el) => { const x = task(V.id); x.date = el.value || null; if (x.date) x.week = weekOf(x.date); save(); toast(`הוזז: ${whenText(x)}`); },
  time: (el) => { const x = task(V.id); x.time = el.value || null; save(); if (x.date) toast(`הוזז: ${whenText(x)}`); },
  week: (el) => { const x = task(V.id); x.week = el.value; x.date = null; x.time = null; save(); toast(`הוזז: ${whenText(x)}`); },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el.dataset, el, e);
});
app.addEventListener('input', (e) => { const f = IN[e.target.dataset.in]; if (f) f(e.target); });
app.addEventListener('change', (e) => { const f = CH[e.target.dataset.ch]; if (f) f(e.target); });
app.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'subin') ACT.subAdd(); });

render();

if ('serviceWorker' in navigator) {
  // כשיש גרסה חדשה, טוענים אותה מיד
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
}
