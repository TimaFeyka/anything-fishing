import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const signingText=({method,path,body,identity,at,nonce})=>['mirozdanie-fishing-v1',method,path,digest(body),identity,at,nonce].join('\n');
export function signGameRequest({secret,method,path,body='',user,origin,now=Date.now()}){
 if(typeof secret!=='string'||secret.length<32)throw Error('fishing_not_configured');
 const identity=Buffer.from(JSON.stringify({iss:'mirozdanie',aud:'anything-fishing',id:user.id,name:user.displayName||'Рыбак',platform:user.platform,origin})).toString('base64url');
 const at=String(Math.floor(now/1000)),nonce=randomUUID();
 const signature=createHmac('sha256',secret).update(signingText({method,path,body,identity,at,nonce})).digest('hex');
 return {'x-miro-fishing-identity':identity,'x-miro-fishing-at':at,'x-miro-fishing-nonce':nonce,'x-miro-fishing-signature':signature};
}
export function createGameVerifier({secret,allowedOrigins,now=Date.now}){
 if(!secret||secret.length<32)throw Error('fishing_proxy_secret_required');
 const seen=new Map();
 return ({method,path,body='',headers})=>{
  const get=name=>headers.get?headers.get(name):headers[name];
  const identity=get('x-miro-fishing-identity'),at=get('x-miro-fishing-at'),nonce=get('x-miro-fishing-nonce'),signature=get('x-miro-fishing-signature');
  if(typeof identity!=='string'||identity.length>2048||!/^\d{10}$/.test(at||'')||!/^[-a-f0-9]{36}$/.test(nonce||'')||! /^[a-f0-9]{64}$/.test(signature||''))throw Error('unauthorized');
  const time=now();if(Math.abs(time/1000-Number(at))>30)throw Error('expired_proxy_request');
  const expected=createHmac('sha256',secret).update(signingText({method,path,body,identity,at,nonce})).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('unauthorized');
  const user=JSON.parse(Buffer.from(identity,'base64url').toString());
  if(user.iss!=='mirozdanie'||user.aud!=='anything-fishing'||typeof user.id!=='string'||!user.id||user.id.length>160||!allowedOrigins.includes(user.origin)||!['telegram','max','demo'].includes(user.platform))throw Error('unauthorized');
  for(const [n,t] of seen)if(t<time-60000)seen.delete(n);
  if(seen.has(nonce))throw Error('replayed_proxy_request');
  if(seen.size>10000)throw Error('proxy_capacity');seen.set(nonce,time);
  return user;
 };
}
