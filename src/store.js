import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const client = url && key ? createClient(url, key, {auth:{flowType:'pkce', detectSessionInUrl:true}}) : null;
export async function signIn(){ if(!client) throw Error('Supabase is not configured'); const {error}=await client.auth.signInWithOAuth({provider:'github',options:{redirectTo:location.origin+import.meta.env.BASE_URL}}); if(error)throw error; }
export async function session(){if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;return data.session}
export async function loadAll(){const owner=await client.rpc('is_app_owner');if(owner.error)throw owner.error;if(!owner.data)throw Error('This account is not authorized');const [a,p,s]=await Promise.all([client.from('assignments').select('*').order('created_at'),client.from('preferences').select('*').maybeSingle(),client.from('source_status').select('*')]);for(const r of [a,p,s])if(r.error)throw r.error;return {assignments:a.data,preferences:p.data,status:s.data}}
export async function createAssignment(record){const {data:{user},error:u}=await client.auth.getUser();if(u||!user)throw u||Error('Please sign in');const {data,error}=await client.from('assignments').insert({...record,source:'manual',owner_id:user.id}).select().single();if(error)throw error;return data}
export async function updateCompletion(id,done){const {data,error}=await client.from('assignments').update({completed_at:done?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id).select('id').single();if(error)throw error;return data}
export async function savePreference(sort,grouping){const {data:{user},error:u}=await client.auth.getUser();if(u||!user)throw u||Error('Please sign in');const {error}=await client.from('preferences').upsert({owner_id:user.id,sort,grouping,updated_at:new Date().toISOString()});if(error)throw error}
export async function saveOrder(ids){const {error}=await client.rpc('reorder_assignments',{p_ids:ids});if(error)throw error}
export async function refreshWebwork(){const {data,error}=await client.functions.invoke('refresh-webwork',{method:'POST'});if(error)throw error;return data}
export async function editManual(id,record){const {data,error}=await client.rpc('edit_manual_assignment',{p_id:id,p_title:record.title,p_course:record.course,p_due_at:record.due_at,p_due_date:record.due_date,p_notes:record.notes,p_source_url:record.source_url||null});if(error)throw error;return data}
export async function removeManual(id){const {data,error}=await client.from('assignments').delete().eq('id',id).select('id').single();if(error)throw error;return data}
export async function setHidden(id,hidden){const {data,error}=await client.from('assignments').update({hidden_at:hidden?new Date().toISOString():null}).eq('id',id).select('id').single();if(error)throw error;return data}
