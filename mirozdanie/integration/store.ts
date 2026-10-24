import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {MemoryKv,type KvStore,type Doc} from '../server/src/store.js';
const tx=new AsyncLocalStorage<any>();
let current:any;
export const runAtomic=<T,>(fn:()=>Promise<T>):Promise<T>=>current.atomic(fn);
export class GamePgStore implements KvStore {
 readonly kind='postgres';pool:any;guard:any;
 constructor(private url:string){this.pool=new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:10000,options:'-c search_path=anything_fishing',ssl:process.env.PGSSL==='1'?{rejectUnauthorized:true}:undefined});this.pool.on('error',()=>console.error('[db] pool unavailable'));}
 async init(){
  this.guard=await this.pool.connect();const r=await this.guard.query('SELECT pg_try_advisory_lock(18673110) AS held');if(!r.rows[0].held)throw Error('single_game_replica_required');
  await this.pool.query('SELECT bucket,id,doc FROM kv LIMIT 0');current=this;
 }
 async atomic<T>(fn:()=>Promise<T>):Promise<T>{
  if(tx.getStore())return fn();const c=await this.pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(18673111)');const r=await tx.run(c,fn);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 query(q:string,a:any[]=[]){return (tx.getStore()||this.pool).query(q,a);}
 async get<T=Doc>(b:string,id:string):Promise<T|null>{const r=await this.query('SELECT doc FROM kv WHERE bucket=$1 AND id=$2',[b,id]);return r.rows[0]?.doc??null;}
 async put(b:string,id:string,doc:Doc){await this.query('INSERT INTO kv(bucket,id,doc,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(bucket,id) DO UPDATE SET doc=EXCLUDED.doc,updated_at=now()',[b,id,JSON.stringify(doc)]);}
 async del(b:string,id:string){await this.query('DELETE FROM kv WHERE bucket=$1 AND id=$2',[b,id]);}
 async list<T=Doc>(b:string,limit=500):Promise<T[]>{const r=await this.query('SELECT doc FROM kv WHERE bucket=$1 ORDER BY updated_at DESC,id LIMIT $2',[b,limit]);return r.rows.map((x:any)=>x.doc);}
 async count(b:string){const r=await this.query('SELECT count(*)::int AS n FROM kv WHERE bucket=$1',[b]);return r.rows[0].n;}
 async health(){await this.query('SELECT 1');return 'postgres ready';}
 async close(){this.guard?.release();await this.pool.end();}
}
export async function createGameStore():Promise<KvStore>{
 if(process.env.NODE_ENV==='production'){
  if(!process.env.DATABASE_URL)throw Error('database_required');const s=new GamePgStore(process.env.DATABASE_URL);await s.init();return s;
 }
 if(process.env.FISHING_LOCAL_QA!=='true')throw Error('explicit_local_qa_required');
 const s:any=new MemoryKv(process.env.FISHING_QA_STATE||'data/qa-state.json');await s.init();let queue=Promise.resolve();s.atomic=(fn:any)=>{const r=queue.then(fn);queue=r.catch(()=>{});return r;};current=s;return s;
}
