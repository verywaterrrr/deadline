const DASHBOARD = 'https://verywaterrrr.github.io/deadline/';
async function zincTab() {
  const tabs = await chrome.tabs.query({url:'https://zinc.cse.ust.hk/*'});
  if (tabs.length) return tabs[0];
  const tab = await chrome.tabs.create({url:'https://zinc.cse.ust.hk/courses/1',active:false});
  await waitForLoad(tab.id);
  return tab;
}
function waitForLoad(id) {
  return new Promise((resolve,reject) => {
    const timeout=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(onUpdate);reject(new Error('Page load timed out'))},20000);
    function onUpdate(tabId,change) {if(tabId===id&&change.status==='complete'){clearTimeout(timeout);chrome.tabs.onUpdated.removeListener(onUpdate);resolve()}}
    chrome.tabs.onUpdated.addListener(onUpdate);
    chrome.tabs.get(id).then(tab => {if(tab.status==='complete') onUpdate(id,{status:'complete'})}).catch(()=>{});
  });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.tab?.url?.startsWith(DASHBOARD) || message?.type !== 'READ_ZINC') return;
  (async () => {
    const tab = await zincTab();
    const result = await chrome.tabs.sendMessage(tab.id, {type:'READ_ZINC'});
    if (!result?.ok) throw new Error('Zinc refresh failed');
    respond(result);
  })().catch(error => respond({ok:false,error:error.message}));
  return true;
});
async function schedule() {
  const now = new Date();
  const hkt = new Date(now.getTime() + 8*3600000);
  let next = Date.UTC(hkt.getUTCFullYear(),hkt.getUTCMonth(),hkt.getUTCDate(),2);
  let sourceNext=next+5*60000;
  if (next <= now.getTime()) next += 86400000;
  if (sourceNext <= now.getTime()) sourceNext += 86400000;
  await chrome.alarms.create('zinc-daily', {when:next,periodInMinutes:1440});
  await chrome.alarms.create('deadline-sources', {when:sourceNext,periodInMinutes:1440});
}
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener(async alarm => {
  if (!['zinc-daily','deadline-sources'].includes(alarm.name)) return;
  const tabs = await chrome.tabs.query({url:DASHBOARD+'*'});
  let tab=tabs[0];
  if(!tab){tab=await chrome.tabs.create({url:DASHBOARD,active:false});await waitForLoad(tab.id)}
  if (tab?.id) await chrome.tabs.sendMessage(tab.id,{type:alarm.name==='deadline-sources'?'DAILY_SOURCES':'DAILY_ZINC'}).catch(()=>{});
});
const REPORT_URLS = ['https://chatgpt.com/c/6a907813-3f50-83e9-abcf-cc1d4f32871b','https://chatgpt.com/c/6ae54b04-9f24-83e8-b9c8-8326e2f9ec67'];
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || !sender.tab?.url?.startsWith(DASHBOARD) || message?.type!=='READ_BRIEF') return;
  (async()=>{
    const reports=[];
    for(const url of REPORT_URLS){
      let tab,created=false;
      try {
        const existing=await chrome.tabs.query({url:url+'*'});tab=existing[0];
        if(!tab){tab=await chrome.tabs.create({url,active:false});created=true;await waitForLoad(tab.id);}
        for(let attempt=0;attempt<12;attempt++){
          try { const result=await chrome.tabs.sendMessage(tab.id,{type:'READ_BRIEF'}); if(result?.ok){reports.push(result.report);break} } catch (_) {}
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
      } catch (_) {} finally {if(created && tab?.id) await chrome.tabs.remove(tab.id).catch(()=>{});}
    }
    reports.sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt));
    respond(reports.length?{ok:true,report:reports[0]}:{ok:false,error:'Open your report in signed-in Chrome and try again.'});
  })().catch(error=>respond({ok:false,error:error.message}));
  return true;
});
async function scheduleBrief(){
  for(const [name,hour,minute] of [['brief-am',2,10],['brief-am-later',2,30],['brief-pm',14,10],['brief-pm-later',14,30]]){
    const now=new Date(),hkt=new Date(now.getTime()+8*3600000);
    let next=Date.UTC(hkt.getUTCFullYear(),hkt.getUTCMonth(),hkt.getUTCDate(),hour,minute);
    if(next<=Date.now())next+=86400000;
    await chrome.alarms.create(name,{when:next,periodInMinutes:1440});
  }
}
chrome.runtime.onInstalled.addListener(scheduleBrief);
chrome.runtime.onStartup.addListener(scheduleBrief);
chrome.alarms.onAlarm.addListener(async alarm=>{
  if(!alarm.name.startsWith('brief-'))return;
  const tabs=await chrome.tabs.query({url:DASHBOARD+'*'});let tab=tabs[0];
  if(!tab){tab=await chrome.tabs.create({url:DASHBOARD,active:false});await waitForLoad(tab.id)}
  if(tab?.id)await chrome.tabs.sendMessage(tab.id,{type:'DAILY_BRIEF'}).catch(()=>{});
});
