// Loopback-only relay: authenticated owner requests a refresh, the local connector picks it up.
import http from 'node:http';
const url=process.env.VITE_SUPABASE_URL, key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('Supabase public configuration is required');
let pending=false;
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
http.createServer(async(req,res)=>{
 try{
  if(req.url==='/internal/poll'&&req.method==='GET'){
   const run=pending;pending=false;if(run)console.log('Connector claimed refresh');return send(res,200,{run});
  }
  if(req.url!=='/api/refresh'||req.method!=='POST')return send(res,404,{error:'not_found'});
  const auth=req.headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9._~-]{20,}$/.test(auth))return send(res,401,{error:'unauthorized'});
  const result=await fetch(`${url}/rest/v1/rpc/is_app_owner`,{method:'POST',headers:{authorization:auth,apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!result.ok || await result.json()!==true)return send(res,403,{error:'forbidden'});
  pending=true;console.log('Owner requested refresh');return send(res,202,{queued:true});
 }catch{return send(res,503,{error:'unavailable'})}
}).listen(4765,'127.0.0.1');
