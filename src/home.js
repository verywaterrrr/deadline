const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(s,opts)=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',...opts}).format(new Date(`${s}T12:00:00Z`));
const hktDate=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const shift=(s,n)=>{const d=new Date(`${s}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
let allMail=false,allUpcoming=false;
const clean=s=>s.replace(/^\s*(?:[-•]\s*|\d+\.\s*)/,'').trim();
function section(sections,re){return sections.find(s=>re.test(s.heading))}
function clock(str,meridiem){const m=str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);if(!m)return null;let h=Number(m[1]),min=Number(m[2]||0),ap=(m[3]||meridiem||'').toUpperCase();if(h>23||min>59)return null;if(ap){if(h<1||h>12)return null;h=h%12+(ap==='PM'?12:0)}return h*60+min}
function parseEvent(text){
  text=clean(text);const m=text.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*:\s*(.+)$/i);
  if(!m)return null;const ap=(m[2].match(/(AM|PM)/i)||[])[1];let start=clock(m[1],ap),end=clock(m[2],ap);if(start===null||end===null)return null;
  // A late-night event may start in PM and end after midnight in AM.
  if(!/AM|PM/i.test(m[1]) && ap && start>end && start>=720)start-=720;
  if(end<=start)end+=1440;
  const [title,...location]=m[3].split(/\s+[—–]\s+/);return {start,end,title,location:location.join(' — '),label:`${m[1]}–${m[2]}`};
}
function eventCalendar(schedule,items){
  const timed=items.map(parseEvent).filter(Boolean),untimed=items.filter(s=>!parseEvent(s)).map(clean);
  let start=timed.length?Math.max(0,Math.min(9,Math.floor(Math.min(...timed.map(e=>e.start))/60))):9;
  let end=timed.length?Math.min(25,Math.max(24,Math.ceil(Math.max(...timed.map(e=>e.end))/60))):24;
  const hh=58, rows=Array.from({length:end-start},(_,i)=>{const hour=(start+i)%24;return `<div class="day-hour" style="top:${i*hh}px"><span>${hour===0?'12 AM':hour<12?`${hour} AM`:hour===12?'12 PM':`${hour-12} PM`}</span></div>`}).join('');
  const cols=['yellow','blue','red','orange','gray'];
  // Allocate lanes per connected overlap cluster.
  const events=[...timed].sort((a,b)=>a.start-b.start||a.end-b.end);let cluster=[];
  function place(){let laneEnds=[];for(const e of cluster){let lane=laneEnds.findIndex(x=>x<=e.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=e.end;e.lane=lane}for(const e of cluster)e.lanes=laneEnds.length;cluster=[]}
  for(const e of events){if(cluster.length&&e.start>=Math.max(...cluster.map(x=>x.end)))place();cluster.push(e)}if(cluster.length)place();
  const blocks=events.map((e,i)=>`<article class="day-event ${cols[i%cols.length]}" style="top:${(e.start-start*60)/60*hh}px;height:${Math.max(25,(e.end-e.start)/60*hh)}px;left:${e.lane*100/e.lanes}%;width:${100/e.lanes}%" title="${esc(`${e.title} ${e.location} ${e.label}`)}"><strong>${esc(e.title)}</strong>${e.location?`<span>${esc(e.location)}</span>`:''}<span>${esc(e.label)}</span></article>`).join('');
  return `<div class="brief-card day-calendar"><div class="day-calendar-head">${esc(schedule)}</div>${untimed.map(x=>`<div class="upcoming-row">${esc(x)}</div>`).join('')}<div class="day-calendar-scroll" tabindex="0" aria-label="Day schedule"><div class="day-calendar-grid" style="height:${(end-start)*hh}px">${rows}<div class="day-events">${blocks}</div></div></div></div>`;
}
function dateParts(text,year){const m=text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})/i);if(!m)return null;const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].slice(0,3).toLowerCase())+1;return `${year}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`}
export function home(report,tasks){
  const today=hktDate(new Date()),date=report?hktDate(report.generated_at):today;
  const sections=report?.sections||[], sched=section(sections,/^(today|tomorrow)\b/i), evening=/^tomorrow\b/i.test(sched?.heading||'') || (!sched&&report&&Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',hourCycle:'h23'}).format(new Date(report.generated_at)))>=12);
  const scheduleDate=evening?shift(date,1):date;
  const mail=section(sections,/^mail summary/i)?.items||[], todo=section(sections,/^to\s*do/i)?.items||[], coming=section(sections,/^coming soon/i)?.items||[];
  const sources=[];let account='';for(const item of mail){if(/^(gmail|ust|hkust|outlook)\s*:$/i.test(clean(item))){account=clean(item).replace(':','');continue}const content=clean(item);const i=content.indexOf(':');sources.push({source:account.toUpperCase(),title:i>0&&i<55?content.slice(0,i):'Mail',text:i>0&&i<55?content.slice(i+1).trim():content})}
  const upcoming=coming.map(text=>{let d=dateParts(text,Number(date.slice(0,4)));if(d&&date.slice(5,7)==='12'&&d.slice(5,7)==='01')d=String(Number(date.slice(0,4))+1)+d.slice(4);return {date:d,text:clean(text)}}).concat(tasks.filter(t=>t.date&&!t.done&&!t.hidden&&t.date>=today).map(t=>({date:t.date,text:t.title,detail:[t.course,t.source,t.time].filter(Boolean).join(' · ')}))).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const showMail=allMail?sources:sources.slice(0,3),showUpcoming=allUpcoming?upcoming:upcoming.slice(0,7);
  const foot=report?`Report · ${new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',dateStyle:'medium',timeStyle:'short'}).format(new Date(report.generated_at))} HKT`:'Your latest report will appear here after it syncs.';
  return `<div class="brief-head"><div><div class="brief-date">${fmt(date,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}</div><h1>Hi Arvin.</h1><p>${report?(evening?'Here’s tomorrow at a glance.':'Here’s your day at a glance.'):'Your daily brief'}</p></div></div><div class="brief-layout"><div class="brief-column">${report&&sched?`<section class="brief-section"><div class="brief-section-head"><h2>${evening?'Tomorrow':'Today'} <span>· ${fmt(scheduleDate,{month:'short',day:'numeric'})}</span></h2></div>${eventCalendar(fmt(scheduleDate,{weekday:'short',day:'numeric'}),sched.items)}</section>`:''}${todo.length?`<section class="brief-section"><div class="brief-section-head"><h2>To do</h2></div><div class="brief-card action-list">${todo.map((x,i)=>`<label class="brief-action-row"><input class="brief-check" type="checkbox" data-brief-check="${i}" ${(report.checked_items||[]).includes(i)?'checked':''}><span class="brief-action-content"><span class="brief-action-title">${esc(clean(x))}</span></span></label>`).join('')}</div></section>`:''}</div><div class="brief-column">${sources.length?`<section class="brief-section"><div class="brief-section-head"><h2>Mail summary</h2></div><div class="brief-card mail-list">${showMail.map(m=>`<article class="mail-row"><div class="mail-top"><span class="mail-label">${esc(m.title)}</span><span class="mail-source">${esc(m.source)}</span></div><p>${esc(m.text)}</p></article>`).join('')}${sources.length>3?`<button class="brief-more" data-home-toggle="mail">${allMail?'Show less':'Show all mail'} <span>${allMail?'↑':'↓'}</span></button>`:''}</div></section>`:''}${upcoming.length?`<section class="brief-section"><div class="brief-section-head"><h2>Coming soon</h2></div><div class="brief-card upcoming-list">${showUpcoming.map(x=>`<div class="upcoming-row">${x.date?`<div class="date-tile"><span>${fmt(x.date,{month:'short'}).toUpperCase()}</span><strong>${x.date.slice(-2)}</strong></div>`:''}<div><div class="upcoming-title">${esc(x.text)}</div>${x.detail?`<div class="upcoming-detail">${esc(x.detail)}</div>`:''}</div></div>`).join('')}${upcoming.length>7?`<button class="brief-more" data-home-toggle="upcoming">${allUpcoming?'Show less':'Show all'} <span>${allUpcoming?'↑':'↓'}</span></button>`:''}</div></section>`:''}</div></div><div class="brief-footnote">${esc(foot)}</div>`;
}
export function toggleHome(value){if(value==='mail')allMail=!allMail;if(value==='upcoming')allUpcoming=!allUpcoming}
