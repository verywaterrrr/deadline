// The page receives only normalized assignment data, never Zinc credentials.
window.addEventListener('message', event => {
  if (event.source === window && event.origin === location.origin && event.data?.type === 'DEADLINE_CONNECTOR_PING') {
    window.postMessage({type:'DEADLINE_CONNECTOR_PONG',requestId:event.data.requestId},location.origin);
    return;
  }
  if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'DEADLINE_READ_ZINC') return;
  const requestId = event.data.requestId;
  if (typeof requestId !== 'string' || requestId.length > 100) return;
  chrome.runtime.sendMessage({type:'READ_ZINC'}, result => {
    window.postMessage({type:'DEADLINE_ZINC_RESULT',requestId,result:result || {ok:false,error:'Connector unavailable'}},location.origin);
  });
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id === chrome.runtime.id && message?.type === 'DAILY_ZINC') window.postMessage({type:'DEADLINE_ZINC_DAILY'},location.origin);
});
window.addEventListener('message',event=>{
  if(event.source!==window || event.origin!==location.origin || event.data?.type!=='DEADLINE_READ_BRIEF')return;
  const requestId=event.data.requestId;
  if(typeof requestId!=='string'||requestId.length>100)return;
  chrome.runtime.sendMessage({type:'READ_BRIEF'},result=>window.postMessage({type:'DEADLINE_BRIEF_RESULT',requestId,result:result||{ok:false,error:'Connector unavailable'}},location.origin));
});
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(sender.id===chrome.runtime.id&&message?.type==='DAILY_BRIEF')window.postMessage({type:'DEADLINE_BRIEF_DAILY'},location.origin);
});

chrome.runtime.onMessage.addListener((message,sender)=>{
  if(sender.id===chrome.runtime.id&&message?.type==='DAILY_SOURCES')window.postMessage({type:'DEADLINE_SOURCES_DAILY'},location.origin);
});
// Keep the server relay responsive while the dashboard is open on the EC2 desktop.
setInterval(()=>{chrome.runtime.sendMessage({type:'POLL_SERVER_RELAY'},()=>void chrome.runtime.lastError)},15000);
