import {createGameVerifier} from './proxy-auth.mjs';
export const verifyProxy=createGameVerifier({secret:process.env.FISHING_PROXY_SECRET||'',allowedOrigins:(process.env.FISHING_ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
export function identityFor(req:any){return verifyProxy({method:req.method,path:req.originalUrl||req.url,body:req.rawBody||'',headers:req.headers});}
export function proxyGate(req:any,res:any,next:any){
 try{req.gameIdentity=identityFor(req);if(['/api/stars/invoice','/api/telegram/webhook','/api/share/card'].includes(req.path))return res.status(404).json({error:'feature_unavailable'});next();}
 catch{return res.status(401).json({error:'unauthorized'});}
}
