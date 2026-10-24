import {bridge,watchSafeAreas} from '../../public/adapters.js';
const host=bridge();
export const tgData=()=>'';
export const tgUser=()=>null;
export const isTelegram=()=>host.host==='telegram';
export function leaveGame(){window.parent.postMessage({type:'mirozdanie-fishing-back'},location.origin);}
let enabled=true;
export function setHaptics(on:boolean){enabled=on;}
const impact=(kind:string)=>{if(!enabled)return;try{host.sdk?.HapticFeedback?.impactOccurred(kind);}catch{}};
export const haptic={select:()=>{if(enabled)try{host.sdk?.HapticFeedback?.selectionChanged();}catch{}},light:()=>impact('light'),medium:()=>impact('medium'),heavy:()=>impact('heavy'),success:()=>impact('light'),warning:()=>impact('medium'),error:()=>impact('heavy'),colossal:()=>impact('heavy')};
export function tgInit(){
 watchSafeAreas({host:host.host,sdk:host.sdk,root:document.documentElement,embedded:true});
 if(!document.querySelector('.fishing-return')){const b=document.createElement('button');b.className='fishing-return';b.textContent='← Игротека';b.onclick=leaveGame;document.body.append(b);}
 for(const type of ['pointerdown','keydown'])document.addEventListener(type,e=>{if(e.isTrusted)window.parent.postMessage({type:'mirozdanie-fishing-activity'},location.origin);},{capture:true,passive:true});
}
export function openLink(url:string){try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return;host.open(url);}catch{}}
export function shareToStory(_url:string,_params?:Record<string,unknown>){return false;}
export function showAlert(text:string){window.alert(text);}
export function showConfirm(text:string){return Promise.resolve(window.confirm(text));}
export async function copyText(text:string){await navigator.clipboard?.writeText(text);}
export const platform=()=>host.host;
export const viewportHeight=()=>window.innerHeight;
export function fishingLaunchLink(){return host.host==='telegram'?'https://t.me/cyber_sheff_bot?startapp=game-anything-fishing':host.host==='max'?'https://max.ru/se13939169_bot?startapp=game-anything-fishing':'https://prozashitu-digital-immunity.timur-mazitovm.chatgpt.site/#games/anything-fishing';}
export async function shareToMessenger(text:string):Promise<boolean|undefined>{
 try{if(host.host==='max'&&typeof host.sdk?.shareContent==='function'){await host.sdk.shareContent({text,link:fishingLaunchLink()});return true;}
 if(host.host==='telegram'&&typeof host.sdk?.openTelegramLink==='function'){host.sdk.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(fishingLaunchLink())+'&text='+encodeURIComponent(text));return true;}}
 catch{return false;}return undefined;
}
