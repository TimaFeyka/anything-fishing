const stack:(()=>void)[]=[];
export function registerGameBack(close:()=>void){stack.push(close);return()=>{const index=stack.lastIndexOf(close);if(index>=0)stack.splice(index,1);};}
export function consumeGameBack(){const close=stack[stack.length-1];if(!close)return false;close();return true;}
