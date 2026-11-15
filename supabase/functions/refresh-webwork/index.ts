import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { parseWebworkSchedule } from '../../../src/sources/webwork.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false}});
const owner = Deno.env.get('APP_OWNER_ID');
const cronSecret = Deno.env.get('CRON_SECRET');
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data), {status, headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST') return reply(405,{error:'method_not_allowed'});
 if(!owner) return reply(503,{error:'not_configured'});
 const scheduled = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
 if(!scheduled){
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token) return reply(401,{error:'unauthorized'});
  const {data,error}=await service.auth.getUser(token);
  if(error || data.user?.id!==owner) return reply(403,{error:'forbidden'});
 }
 const attempt=new Date().toISOString();
 const previous=await service.from('source_status').select('last_success_at,coverage').eq('owner_id',owner).eq('source','webwork').maybeSingle();
 if(previous.error) return reply(503,{error:'status_unavailable'});
 const retained={last_success_at:previous.data?.last_success_at ?? null,coverage:previous.data?.coverage ?? null};
 const started=await service.from('source_status').upsert({owner_id:owner,source:'webwork',...retained,last_attempt_at:attempt,outcome:'running'},{onConflict:'owner_id,source'});
 if(started.error) return reply(503,{error:'status_unavailable'});
 try {
  const response=await fetch('https://webwork.math.ust.hk/due_dates.html',{signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error('upstream');
  const result=parseWebworkSchedule(await response.text());
  const records=result.items.map((x:{source:string;sourceId:string;course:string;title:string;dueAt:string})=>({owner_id:owner,source:x.source,source_id:x.sourceId,title:x.title,course:x.course,due_at:x.dueAt,updated_at:attempt}));
  if(records.length){const {error}=await service.rpc('import_webwork',{p_owner:owner,p_items:records});if(error)throw error;}
  const {error}=await service.from('source_status').upsert({owner_id:owner,source:'webwork',last_attempt_at:attempt,last_success_at:new Date().toISOString(),outcome:'success',error_code:null,coverage:result.coverage},{onConflict:'owner_id,source'});
  if(error)throw error;
  return reply(200,{ok:true,count:records.length,coverage:result.coverage});
 } catch {
  await service.from('source_status').upsert({owner_id:owner,source:'webwork',...retained,last_attempt_at:attempt,outcome:'failed',error_code:'fetch_or_parse_failed'},{onConflict:'owner_id,source'});
  return reply(502,{error:'refresh_failed'});
 }
});
