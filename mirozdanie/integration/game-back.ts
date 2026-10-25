const stack:(()=>void)[]=[];
export function registerGameBack(close:()=>void){stack.push(close);return()=>{const index=stack.lastIndexOf(close);if(index>=0)stack.splice(index,1);};}
export function consumeGameBack(){const close=stack.pop();if(!close)return false;close();return true;}
