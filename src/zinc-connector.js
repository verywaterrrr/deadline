import {importZinc,failZinc} from './store.js';

export async function refreshZinc() {
  const requestId = crypto.randomUUID();
  const available = await new Promise(resolve => {
    const timeout = setTimeout(() => {window.removeEventListener('message', receive); resolve(false)}, 5000);
    function receive(event) {
      if(event.source!==window || event.origin!==location.origin || event.data?.type!=='DEADLINE_CONNECTOR_PONG' || event.data.requestId!==requestId) return;
      clearTimeout(timeout);window.removeEventListener('message',receive);resolve(true);
    }
    window.addEventListener('message',receive);
    window.postMessage({type:'DEADLINE_CONNECTOR_PING',requestId},location.origin);
  });
  if(!available){await failZinc().catch(()=>{});throw Error('Zinc connector is unavailable')}
  const result = await new Promise(resolve => {
    const timeout = setTimeout(() => {window.removeEventListener('message', receive); resolve(null)}, 30000);
    function receive(event) {
      if(event.source!==window || event.origin!==location.origin || event.data?.type!=='DEADLINE_ZINC_RESULT' || event.data.requestId!==requestId) return;
      clearTimeout(timeout); window.removeEventListener('message',receive); resolve(event.data.result);
    }
    window.addEventListener('message',receive);
    window.postMessage({type:'DEADLINE_READ_ZINC',requestId},location.origin);
  });
  if(!result?.ok || !Array.isArray(result.items)) {
    // The extension was present, so an error or timeout is a failed check.
    await failZinc();
    throw Error(result?.error || 'Zinc connector is not installed');
  }
  await importZinc(result.items);
}
