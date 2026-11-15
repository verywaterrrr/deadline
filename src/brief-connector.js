import {client} from './store.js';
export async function loadBrief(){
  const {data,error}=await client.from('daily_briefs').select('*').maybeSingle();
  if(error)throw error;return data;
}
export async function syncBrief(){
  const requestId=crypto.randomUUID();
  const result=await new Promise(resolve=>{
    const timeout=setTimeout(()=>{window.removeEventListener('message',receive);resolve(null)},70000);
    function receive(event){
      if(event.source!==window||event.origin!==location.origin||event.data?.type!=='DEADLINE_BRIEF_RESULT'||event.data.requestId!==requestId)return;
      clearTimeout(timeout);window.removeEventListener('message',receive);resolve(event.data.result);
    }
    window.addEventListener('message',receive);
    window.postMessage({type:'DEADLINE_READ_BRIEF',requestId},location.origin);
  });
  if(!result?.ok)throw Error(result?.error||'Report connector unavailable');
  const r=result.report;
  const {error}=await client.rpc('save_daily_brief',{p_message_id:r.messageId,p_generated_at:r.generatedAt,p_sections:r.sections});
  if(error)throw error;
  return loadBrief();
}

export async function checkBrief(messageId,index,checked){
  const {error}=await client.rpc('check_brief_item',{p_message_id:messageId,p_index:index,p_checked:checked});
  if(error)throw error;
}
