import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const canonical=join(root,'miniapp/anything-fishing');
function replace(s,a,b){if(!s.includes(a))throw Error('fishing transform missing: '+a.slice(0,90));return s.replace(a,b);}
export async function buildFishing(viewRoot){
 const view=resolve(viewRoot),runtime=join(root,'.build/anything-fishing-runtime');
 const manifest=JSON.parse(await readFile(join(canonical,'provenance.json'),'utf8'));
 for(const [p,h] of Object.entries(manifest.sha256)){if(createHash('sha256').update(await readFile(join(canonical,'upstream',p))).digest('hex')!==h)throw Error('Fishing upstream changed: '+p);}
 await cp(join(canonical,'upstream'),runtime,{recursive:true});
 const lockHash=createHash('sha256').update(await readFile(join(runtime,'package-lock.json'))).digest('hex');let installed='';try{installed=await readFile(join(runtime,'.installed-lock.sha256'),'utf8');await access(join(runtime,'node_modules/express/package.json'));}catch{}
 if(installed!==lockHash){const result=spawnSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit'});if(result.status!==0)throw Error('fishing dependency install failed');await writeFile(join(runtime,'.installed-lock.sha256'),lockHash);}
await cp(join(canonical,'integration'),join(runtime,'integration'),{recursive:true});
 await cp(join(root,'shared/miniapp/anything-fishing-auth.mjs'),join(runtime,'integration/proxy-auth.mjs'));
 await writeFile(join(runtime,'integration/proxy-auth.d.mts'),'export function createGameVerifier(options:any):(input:any)=>any;');
 const tsConfig=JSON.parse(await readFile(join(runtime,'tsconfig.server.json'),'utf8'));tsConfig.compilerOptions.rootDir='.';tsConfig.compilerOptions.noEmit=true;tsConfig.include=['server/src/**/*.ts','integration/store.ts','integration/proxy-middleware.ts','integration/proxy-auth.d.mts'];await writeFile(join(runtime,'tsconfig.integration.json'),JSON.stringify(tsConfig));
 const read=p=>readFile(join(runtime,p),'utf8'),write=(p,s)=>writeFile(join(runtime,p),s);
 let s=await read('server/src/routes.ts');
 s="import {runAtomic} from '../../integration/store.js';\n"+s;
 const begin=s.indexOf('    const initData: string = req.body?.initData'),end=s.indexOf('    const player = await withLock',begin);if(begin<0||end<0)throw Error('auth transform');
 s=s.slice(0,begin)+"    const identity=(req as any).gameIdentity;\n    if(!identity)return res.status(401).json({error:'unauthorized'});\n    const playerId:string=identity.id;\n    const user={id:identity.id,name:identity.name||'Рыбак',username:undefined,photoUrl:undefined};\n"+s.slice(end);
 s=replace(s,'token: signSession(player.id, SESSION_SECRET_ENV()),','token: null,');
 const a=s.indexOf("    const token = (req.get('authorization')"),b=s.indexOf("    const player = await ctx.store.get<PlayerDoc>",a);if(a<0||b<0)throw Error('auth middleware transform');
 s=s.slice(0,a)+"    const playerId=(req as any).gameIdentity?.id;\n    if(!playerId)return res.status(401).json({error:'unauthorized'});\n"+s.slice(b);
 s=replace(s,"try { await fn(req, res); }",`try {
      const pending:any={status:200,payload:undefined};
      const buffered:any={headersSent:false,status(code:number){pending.status=code;return buffered;},json(payload:any){pending.payload=payload;return buffered;}};
      await runAtomic(async()=>{
        if((req as any).player){const fresh=await (req as any).gameStore.get('players',(req as any).player.id);if(fresh)(req as any).player=fresh;}
        await fn(req,buffered);
      });
      res.status(pending.status).json(pending.payload);
    }`);
 s=replace(s,'const api = express.Router();',"const api = express.Router();\n  api.use((req:any,_res,next)=>{req.gameStore=ctx.store;next();});");
 const paidStart=s.indexOf('  // ── Telegram Stars:');const paidEnd=s.indexOf('  return api;',paidStart);if(paidStart<0||paidEnd<0)throw Error('paid routes transform');s=s.slice(0,paidStart)+s.slice(paidEnd);
 s=s.replace("message: err.message","message: 'Не удалось выполнить действие'");
 await write('server/src/routes.ts',s);
 s=await read('server/src/index.ts');
 s="import {createGameStore,runAtomic} from '../../integration/store.js';\nimport {proxyGate,identityFor} from '../../integration/proxy-middleware.js';\n"+s;
 const x=s.indexOf('  let store = await createStore()'),y=s.indexOf('  const app = express();',x);if(x<0||y<0)throw Error('store transform');s=s.slice(0,x)+'  const store=await createGameStore();\n'+s.slice(y);
 s=replace(s,"app.use(express.json({ limit: '1mb' }));","app.get('/healthz',async(_req,res)=>{try{await store.health();res.json({ok:true});}catch{res.status(503).json({ok:false});}});\n  app.use(express.json({limit:'256kb',verify:(req:any,_res,buf)=>{req.rawBody=buf.toString('utf8');}}));\n  app.use(proxyGate);");
 const u=s.indexOf("    const token = url.searchParams.get('token')"),v=s.indexOf("    const player = await store.get<PlayerDoc>",u);if(u<0||v<0)throw Error('ws auth transform');
 s=s.slice(0,u)+"    const castId=url.searchParams.get('castId')??'';\n    const playerId=(req as any).gameIdentity?.id;\n    const send=(o:unknown)=>{try{ws.send(JSON.stringify(o));}catch{}};\n    if(!playerId)return ws.close(4401,'unauthorized');\n"+s.slice(v);
 s=replace(s,"const wss = new WebSocketServer({ server, path: '/ws' });",`const wss = new WebSocketServer({noServer:true,maxPayload:2048});
  const connections=new Map<string,any>();
  server.on('upgrade',(req:any,socket,head)=>{
   try{if(new URL(req.url,'http://local').pathname!=='/ws')throw Error('not_found');req.gameIdentity=identityFor(req);wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));}
   catch{socket.write('HTTP/1.1 401 Unauthorized\\r\\nConnection: close\\r\\n\\r\\n');socket.destroy();}
  });`);
 s=replace(s,"    let session = fightSessions.get(`fight:${castId}`);","    const previous=connections.get(castId);if(previous&&previous.readyState===previous.OPEN)return ws.close(4409,'cast_already_connected');connections.set(castId,ws);\n    let session = fightSessions.get(`fight:${castId}`);");
 s=s.replaceAll("await store.put('casts', castId, cast);","await runAtomic(async()=>{const fresh=await store.get<any>('casts',castId);if(!fresh?.granted)await store.put('casts',castId,cast);});");
 s=replace(s,"    const timer = setInterval(async () => {","    const timer = setInterval(async () => {try{");
 s=replace(s,"    }, PHYS.TICK * 2);","    }catch{clearInterval(timer);ws.close(1011,'storage_unavailable');}}, PHYS.TICK * 2);");
 s=replace(s,"send({ t: 'state', state: theSession.state(), done: !!theSession.outcome, outcome: theSession.outcome });","if(!theSession.outcome)send({ t: 'state', state: theSession.state(), done: false });");
 s=replace(s,"ws.on('close', () => clearInterval(timer));","ws.on('close', () => {clearInterval(timer);if(connections.get(castId)===ws)connections.delete(castId);});");
 s=replace(s,"server.listen(PORT, () =>", "server.listen(PORT, process.env.HOST||'127.0.0.1', () =>");
 s=s.replace('await runSerialSweep(store);','await runAtomic(()=>runSerialSweep(store));').replace('void runSerialSweep(store);','void runAtomic(()=>runSerialSweep(store));');
 s=replace(s,"  server.listen(PORT,", "  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{wss.clients.forEach(ws=>ws.close(1012,'service_restart'));server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),8000).unref();});\n  server.listen(PORT,");
 s=replace(s,'    const started = Date.now();','    const started = Date.now()-theSession.core.t;');
 await write('server/src/index.ts',s);
 // The client only uses the already authenticated parent Mini App's same-origin API.
 s=await read('web/src/state.tsx');const c=s.indexOf("const TOKEN_KEY"),e=s.indexOf('// ─────────────────────────────── состояние');if(c<0||e<0)throw Error('client transport transform');
 s=s.slice(0,c)+`export class ApiError extends Error {constructor(public status:number,public code:string,message:string,public payload?:any){super(message);}}
export async function api<T=any>(path:string,init:RequestInit={}):Promise<T>{
 const res=await fetch('/api/anything-fishing'+path,{...init,credentials:'same-origin',headers:{'content-type':'application/json',...init.headers}});
 const data=await res.json();if(!res.ok)throw new ApiError(res.status,data.error||'error',data.message||data.error||'Игра временно недоступна',data);return data;
}
export const get=<T=any,>(p:string)=>api<T>(p);
export const post=<T=any,>(p:string,body?:unknown)=>api<T>(p,{method:'POST',body:JSON.stringify(body??{})});
export const authenticate=()=>post('/auth');
export function wsUrl(castId:string){return (location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/anything-fishing/ws?castId='+encodeURIComponent(castId);}
`+s.slice(e);
 s=s.replace("'Не удалось авторизоваться. Откройте приложение через Telegram-бота или включите ALLOW_DEV_AUTH=1 для локального теста.'","'Откройте Мироздание заново через бота Telegram или MAX.'");
 s=s.replace('`Сервер недоступен: ${err.message}. Проверьте, что backend запущен (npm start) и переменные окружения заданы.`',"'Не удалось загрузить игру. Проверьте соединение и попробуйте открыть её снова.'");
 const ref=s.indexOf('export function referalLink(): string');if(ref<0)throw Error('share link transform');s=s.slice(0,ref)+"export function referalLink():string{return fishingLaunchLink();}\n";s="import {fishingLaunchLink} from './telegram';\n"+s;
 await write('web/src/state.tsx',s);
 await cp(join(canonical,'integration/game-back.ts'),join(runtime,'web/src/game-back.ts'));
 let components=await read('web/src/components.tsx');components="import {useEffect,useRef} from 'react';\nimport {registerGameBack} from './game-back';\n"+components;components=replace(components,'  if (!open) return null;',"  const closeRef=useRef(onClose);closeRef.current=onClose;useEffect(()=>open?registerGameBack(()=>closeRef.current()):undefined,[open]);\n  if (!open) return null;");await write('web/src/components.tsx',components);
 await cp(join(canonical,'integration/telegram.ts'),join(runtime,'web/src/telegram.ts'));
 // Copy shared host bridge into the generated source tree to keep imports self-contained.
 await mkdir(join(runtime,'public'),{recursive:true});await writeFile(join(runtime,'public/adapters.d.ts'),'export function bridge():any;export function watchSafeAreas(options:any):()=>void;');for(const name of ['adapters.js','navigation.js'])await cp(join(root,'miniapp/public',name),join(runtime,'public',name));
 s=await read('web/src/telegram.ts');s=s.replace("'../../public/adapters.js'","'../../public/adapters.js'");await write('web/src/telegram.ts',s);
 s=await read('web/src/App.tsx');s=s.replace("import React from 'react';","import React,{useEffect} from 'react';\nimport {leaveGame} from './telegram';\nimport {consumeGameBack} from './game-back';");
 s=replace(s,"  if (loading) {",`  useEffect(()=>{const back=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='mirozdanie-fishing-go-back')return;if(consumeGameBack())return;if(showSettings)setShowSettings(false);else if(baseView)setBaseView(null);else if(tab!=='fish')setTab('fish');else leaveGame();};window.addEventListener('message',back);return()=>window.removeEventListener('message',back);},[showSettings,baseView,tab]);
  if (loading) {`);
 s=s.replace('tab, setTab, baseView, showSettings','tab, setTab, baseView, setBaseView, showSettings');
 s=s.replace(/<div className="dim" style=\{\{ fontSize: 13 \}\}>[\s\S]*?<\/div>/, '<div className="dim">Проверьте соединение или откройте игру заново из Игротеки.</div>');s=s.replace(/<a className="btn primary block" href=".\/api\/health"[\s\S]*?<\/a>/,'');
 s=s.replaceAll('ANYTHING FISHING','Рыбалка: что угодно');await write('web/src/App.tsx',s);
 s=await read('web/src/screens/ShopProfile.tsx');s=s.replace('{!baseView', '{!baseView');s=s.replace('<Section title="Оформление за Telegram Stars">','{content?.config?.starsEnabled && <Section title="Оформление за Telegram Stars">');const section=s.indexOf('{content?.config?.starsEnabled && <Section title="Оформление за Telegram Stars">');if(section>=0){const end=s.indexOf('</Section>',section);s=s.slice(0,end)+s.slice(end).replace('</Section>','</Section>}');}s=s.replaceAll('Telegram Mini App','Мироздание');await write('web/src/screens/ShopProfile.tsx',s);
 let fishingUi=await read('web/src/screens/Fishing.tsx');fishingUi=fishingUi.replace('<div className="row between" style={{ marginBottom: 12 }}>','<div className="row between fishing-heading" style={{ marginBottom: 12 }}>');fishingUi=fishingUi.replaceAll('Настройки и ИИ-Ассистент','Настройки и помощник').replaceAll('Antigravity AI:','Подсказка:');fishingUi=fishingUi.replace('● Авторитетный WebSocket','● Соединение активно').replace('● Резервный HTTP','● Восстанавливаем соединение');await write('web/src/screens/Fishing.tsx',fishingUi);
 let baseUi=await read('web/src/screens/Base.tsx');baseUi=baseUi.replace('Купите в магазине за Stars','Дополнительная тема недоступна').replace('Тема не куплена. Оформление продаётся за Telegram Stars в магазине.','Эта тема пока недоступна.');await write('web/src/screens/Base.tsx',baseUi);
 let shareUi=await read('web/src/share.ts');shareUi="import {shareToMessenger} from './telegram';\n"+shareUi;shareUi=replace(shareUi,"  const canvas = renderFindCard(d);","  const shared=await shareToMessenger('Моя находка в игре «Рыбалка: что угодно»');if(shared!==undefined)return shared?'share':'failed';\n  const canvas = renderFindCard(d);");const uploadBegin=shareUi.indexOf('  // Пробуем загрузить карточку'),uploadEnd=shareUi.indexOf('  const blob:',uploadBegin);if(uploadBegin<0||uploadEnd<0)throw Error('share upload transform');shareUi=shareUi.slice(0,uploadBegin)+shareUi.slice(uploadEnd);shareUi=shareUi.replace("catch { /* отменил */ }","catch { return 'failed'; }");await write('web/src/share.ts',shareUi);
 let itemActions=await read('web/src/screens/ItemActions.tsx');itemActions=itemActions.replace("res === 'story' ? 'Карточка отправлена в Stories'","res === 'failed' ? 'Не удалось поделиться карточкой' : res === 'story' ? 'Карточка отправлена в Stories'");await write('web/src/screens/ItemActions.tsx',itemActions);
 let settingsUi=await read('web/src/screens/Settings.tsx');settingsUi=settingsUi.replace('Генерация красивых картинок для публикации в Telegram','Карточки находок и ссылки для друзей');settingsUi=settingsUi.replaceAll('Настройки и ИИ-Ассистент','Настройки и помощник').replaceAll('ИИ-Инструктор Antigravity','Советы рыболову').replaceAll('Google DeepMind','Игровые подсказки').replaceAll('Antigravity AI Fishing Core','Помощник рыболова').replaceAll('● В СЕТИ','● ГОТОВ').replaceAll('Персональный бортовой ИИ-аналитик. Анализирует нагрузку лески, прогнозирует поведение рыбы и подсказывает лучшие тактики вываживания.','Подсказки учитывают снаряжение, нагрузку на леску и поведение улова. Выберите тему, чтобы посмотреть совет.').replaceAll('Спросить совет у Antigravity:','Выберите тему:').replaceAll('Ответ Antigravity','Совет рыболову').replaceAll('Подсказки ИИ','Игровые подсказки').replaceAll('от Antigravity','для рыболова').replaceAll('v1.2.0 (Antigravity AI Edition)','1.0.0 · Мироздание');await write('web/src/screens/Settings.tsx',settingsUi);
 for(const page of ['Settings','ShopProfile','Fishing']){
  let text=await read('web/src/screens/'+page+'.tsx');
  for(const [from,to] of [
   ['v1.2.0 (Antigravity AI Edition)','1.0.0 · Мироздание'],['1.2.0 (Antigravity AI Edition)','1.0.0 · Мироздание'],
   ['Antigravity by Google DeepMind','Игровые подсказки'],['ИИ-Инструктор Antigravity','Советы рыболову'],
   ['Antigravity AI Fishing Core','Помощник рыболова'],['Google DeepMind','Игровые подсказки'],['В СЕТИ','ГОТОВ'],
   ['Персональный бортовой ИИ-напарник: анализ глубин, подсказки по снастям и тактика вываживания.','Подсказки по глубинам, снастям и тактике вываживания.'],['ИИ-Консультант','помощник'],['ИИ-помощник','Помощник'],['ИИ-Ассистент','помощник'],['Antigravity AI:','Подсказка:'],['Antigravity','Помощник'],
   ['Персональный бортовой ИИ-аналитик.','Игровой помощник.'],['Подсказки ИИ','Игровые подсказки']
  ])text=text.replaceAll(from,to);
  await write('web/src/screens/'+page+'.tsx',text);
 }
 const publicDir=join(view,'public/anything-fishing');await mkdir(publicDir,{recursive:true});
 await build({entryPoints:[join(runtime,'web/src/main.tsx')],outfile:join(publicDir,'app.js'),bundle:true,minify:true,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},alias:{'@shared/physics':join(runtime,'server/src/physics.ts')}});
 await cp(join(canonical,'integration/host.css'),join(publicDir,'host.css'));await cp(join(canonical,'upstream/LICENSE'),join(publicDir,'LICENSE'));
 await writeFile(join(publicDir,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07131c"><title>Рыбалка: что угодно · Мироздание</title><link rel="stylesheet" href="./app.css"><link rel="stylesheet" href="./host.css"><div id="root"></div><script type="module" src="./app.js"></script></html>');
 await mkdir(join(view,'anything-fishing/server'),{recursive:true});
 await build({entryPoints:[join(runtime,'server/src/index.ts')],outfile:join(view,'anything-fishing/server/index.mjs'),bundle:true,format:'esm',platform:'node',target:'node24',packages:'external'});
 await cp(join(canonical,'upstream/package.json'),join(view,'anything-fishing/package.json'));await cp(join(canonical,'upstream/package-lock.json'),join(view,'anything-fishing/package-lock.json'));
 await build({entryPoints:['engine','physics','types','content','store'].map(name=>join(runtime,'server/src',name+'.ts')),outdir:join(runtime,'dist'),format:'esm',platform:'node',target:'node24'});
 console.log('Anything Fishing: verified MIT snapshot, Russian UI, signed host proxy, authoritative runtime; deployment remains separate.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildFishing(process.argv[2]||join(root,'.build/fishing-miniapp'));
