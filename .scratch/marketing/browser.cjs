// Local Chromium / Edge CDP helper. Node 22+ stdlib; no installs or downloads.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
async function serve(){
  const root=path.resolve('[SITE]');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.wav':'audio/wav'};
  const server=http.createServer((req,res)=>{
    let url;try{url=new URL(req.url,'http://local');}catch{res.writeHead(400).end();return;}
    let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
    if(pathname==='/')pathname='/index.html';if(pathname==='/preview')pathname='/preview.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    const script=pathname==='/preview.html'?"'self'":"'none'";
    res.setHeader('Content-Security-Policy',`default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src ${script}; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`);
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
function executable(){
  const choices=[process.env.PREVIEW_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const edge='C:/Program Files (x86)/Microsoft/EdgeCore';
  if(fs.existsSync(edge))for(const v of fs.readdirSync(edge).reverse())choices.push(path.join(edge,v,'msedge.exe'));
  return choices.find(p=>p&&fs.existsSync(p))||(process.platform==='win32'?null:'google-chrome');
}
async function launch(){
  const exe=executable();if(!exe)throw Error('Set PREVIEW_BROWSER to an installed Chrome or Edge executable.');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'jener-preview-'));
  const child=spawn(exe,['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>{child.kill();reject(Error('Browser launch timed out'));},15000);
    child.on('error',e=>{clearTimeout(timer);reject(e);});child.stderr.on('data',b=>{output+=b;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
  });
  const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map(),events=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else events.push(m);};
  function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},30000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});}
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const call=(m,p)=>send(m,p,sessionId);
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Log.enable');
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  async function load(url){await call('Page.navigate',{url});for(let i=0;i<150;i++){if(await evaluate('document.readyState === "complete"'))return;await new Promise(r=>setTimeout(r,50));}throw Error('Page load timed out');}
  return {call,evaluate,load,events,async close(){await send('Browser.close').catch(()=>{});ws.close();child.kill();}};
}
module.exports={serve,launch,executable};
