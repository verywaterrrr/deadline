import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { parseCanvasCalendar } from '../../../src/sources/canvas-calendar.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false}});
const owner = Deno.env.get('APP_OWNER_ID');
const feed = Deno.env.get('CANVAS_CALENDAR_URL');
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const schedulerKey = typeof secretKeys.default === 'string' ? secretKeys.default : '';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data), {status, headers:{...cors,'Content-Type':'application/json'}});
function matchesSecret(actual:string, expected:string) {
 if (!actual || !expected || actual.length !== expected.length) return false;
 let difference = 0;
 for (let i=0;i<actual.length;i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
 return difference===0;
}
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST') return reply(405,{error:'method_not_allowed'});
 if(!owner || !feed) return reply(503,{error:'not_configured'});
 if(!matchesSecret(req.headers.get('apikey') || '',schedulerKey)) {
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token) return reply(401,{error:'unauthorized'});
  const {data,error}=await service.auth.getUser(token);
  if(error || data.user?.id!==owner) return reply(403,{error:'forbidden'});
 }
 const attempt=new Date().toISOString();
 const previous=await service.from('source_status').select('last_success_at,coverage').eq('owner_id',owner).eq('source','canvas').maybeSingle();
 if(previous.error) return reply(503,{error:'status_unavailable'});
 const retained={last_success_at:previous.data?.last_success_at ?? null,coverage:previous.data?.coverage ?? null};
 const started=await service.from('source_status').upsert({owner_id:owner,source:'canvas',...retained,last_attempt_at:attempt,outcome:'running'},{onConflict:'owner_id,source'});
 if(started.error) return reply(503,{error:'status_unavailable'});
 try {
  const parsedUrl=new URL(feed);
  if(parsedUrl.protocol!=='https:' || parsedUrl.hostname!=='canvas.ust.hk' || !parsedUrl.pathname.startsWith('/feeds/calendars/')) throw Error('invalid_feed');
  const response=await fetch(parsedUrl,{signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok) throw Error('upstream');
  const result=parseCanvasCalendar(await response.text());
  const records=result.items.map((x:{sourceId:string;title:string;course:string;dueAt:string|null;dueDate:string|null})=>({source_id:x.sourceId,title:x.title,course:x.course,due_at:x.dueAt,due_date:x.dueDate}));
  if(records.length){const {error}=await service.rpc('import_canvas',{p_owner:owner,p_items:records});if(error)throw error;}
  const {error}=await service.from('source_status').upsert({owner_id:owner,source:'canvas',last_attempt_at:attempt,last_success_at:new Date().toISOString(),outcome:'success',error_code:null,coverage:result.coverage},{onConflict:'owner_id,source'});
  if(error)throw error;
  return reply(200,{ok:true,count:records.length,coverage:result.coverage});
 } catch {
  await service.from('source_status').upsert({owner_id:owner,source:'canvas',...retained,last_attempt_at:attempt,outcome:'failed',error_code:'fetch_or_parse_failed'},{onConflict:'owner_id,source'});
  return reply(502,{error:'refresh_failed'});
 }
});
