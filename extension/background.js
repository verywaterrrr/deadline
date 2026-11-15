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
  if (next <= now.getTime()) next += 86400000;
  await chrome.alarms.create('zinc-daily', {when:next,periodInMinutes:1440});
}
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'zinc-daily') return;
  const tabs = await chrome.tabs.query({url:DASHBOARD+'*'});
  let tab=tabs[0];
  if(!tab){tab=await chrome.tabs.create({url:DASHBOARD,active:false});await waitForLoad(tab.id)}
  if (tab?.id) await chrome.tabs.sendMessage(tab.id,{type:'DAILY_ZINC'}).catch(()=>{});
});
