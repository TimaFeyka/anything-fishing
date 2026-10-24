import {signGameRequest} from './anything-fishing-auth.mjs';
export async function fishingProxy(request,env,user){
 const source=new URL(request.url),prefix='/api/anything-fishing';
 const path=source.pathname.slice(prefix.length);
 if(!/^\/[a-zA-Z0-9_/-]+$/.test(path))return Response.json({error:'not_found'},{status:404});
 if(['/telegram/webhook','/stars/invoice','/share/card'].includes(path))return Response.json({error:'feature_unavailable'},{status:404});
 const ws=path==='/ws';
 if(ws&&request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return Response.json({error:'upgrade_required'},{status:426});
 if(!['GET','POST'].includes(request.method))return Response.json({error:'method_not_allowed'},{status:405});
 if(request.method==='POST'&&request.headers.get('Origin')!==source.origin)return Response.json({error:'origin_rejected'},{status:403});
 if(ws&&request.headers.get('Origin')!==source.origin)return Response.json({error:'origin_rejected'},{status:403});
 let endpoint;try{endpoint=new URL(env.FISHING_BACKEND_URL);}catch{return Response.json({error:'game_unavailable'},{status:503});}
 const localQA=env.FISHING_LOCAL_QA==='true'&&user.platform==='demo'&&['127.0.0.1','localhost'].includes(source.hostname)&&['127.0.0.1','localhost'].includes(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!(localQA&&endpoint.protocol==='http:'))||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!['/','/games/anything-fishing/'].includes(endpoint.pathname))return Response.json({error:'game_unavailable'},{status:503});
 if(!env.FISHING_PROXY_SECRET||env.FISHING_PROXY_SECRET.length<32)return Response.json({error:'game_unavailable'},{status:503});
 let body='';if(request.body){const reader=request.body.getReader(),parts=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();return Response.json({error:'body_too_large'},{status:413});}parts.push(value);}body=Buffer.concat(parts).toString('utf8');}
 const targetPath=(ws?'/ws':'/api'+path)+source.search;
 const headers=new Headers(signGameRequest({secret:env.FISHING_PROXY_SECRET,method:request.method,path:targetPath,body,user,origin:source.origin}));
 if(ws)headers.set('Upgrade','websocket');else headers.set('content-type','application/json');
 const target=new URL(targetPath.slice(1),endpoint);
 try{
  const response=await fetch(target,{method:request.method,headers,redirect:'manual',...(body?{body}:{})});
  if(ws&&response.status===101)return response;
  if(response.status>=300&&response.status<400)return Response.json({error:'game_unavailable'},{status:502});
  const safe=new Headers({'content-type':'application/json','cache-control':'no-store'});
  return new Response(response.body,{status:response.status,headers:safe});
 }catch{return Response.json({error:'game_unavailable'},{status:503});}
}
