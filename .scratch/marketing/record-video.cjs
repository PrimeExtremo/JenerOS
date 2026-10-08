// Deterministic 60 fps recording; Chromium/Edge + Node stdlib + ffmpeg.
// node .scratch/marketing/record-video.cjs [wide|tall|all] [--audio=cleared.wav] [--beats=assets/video/beats.json]
// No installs. Frames stream to ffmpeg; no large image sequence on disk.
const fs=require('node:fs'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {serve,launch}=require('./browser.cjs');
const FPS=60,dir=path.resolve('[SITE]/assets/video');
const cuts={wide:{width:1920,height:1080,scale:1,file:'jeneros-preview'},tall:{width:540,height:960,scale:2,file:'jeneros-preview-vertical'}};
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const ffmpeg=process.env.FFMPEG||'ffmpeg',which=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'all';
async function record(name,cut,base,browser){
  await browser.call('Emulation.setDeviceMetricsOverride',{width:cut.width,height:cut.height,deviceScaleFactor:cut.scale,mobile:false});
  await browser.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'no-preference'}]});
  await browser.load(`${base}/preview.html?trailer=1&capture=1&beats=${encodeURIComponent(arg('beats')||'assets/video/beats.json')}`);
  const timing=await browser.evaluate('JenerTrailer.ready');
  const warning=await browser.evaluate('document.querySelector("#trailer-status").textContent');
  if(warning)throw Error('Recording refused a fallback beat grid: '+warning);
  if(await browser.evaluate('[...document.images].some(i=>!i.complete||!i.naturalWidth)'))throw Error('A story image failed to decode.');
  const frames=Math.ceil(timing.duration*FPS),duration=frames/FPS;
  fs.writeFileSync(path.join(dir,'sfx-cues.json'),JSON.stringify(timing.cues,null,2)+'\n');
  const audio=path.resolve(arg('audio')||path.join(dir,'test-click.wav'));
  if(!fs.existsSync(audio))throw Error('Audio missing: '+audio+'; run make-timing.cjs for test clicks.');
  const probe=spawnSync(ffmpeg,['-hide_banner','-i',audio],{windowsHide:true,encoding:'utf8'});
  const length=probe.stderr?.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if(!length||Number(length[1])*3600+Number(length[2])*60+Number(length[3])+0.03<timing.audioStart+duration)throw Error('Audio is too short for the complete beat phrase.');
  const temp=path.join(dir,cut.file+'.pending.mp4'),target=path.join(dir,cut.file+'.mp4');
  // 14 MB target reserves space below the 15 MB hard cap, even for slow BPM.
  const rate=Math.floor(Math.min(2600000,(14e6*8/duration-128000)*.94));
  if(rate<300000)throw Error('Beat phrase too long for the 15 MB export budget.');
  const args=['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-',
    '-ss',String(timing.audioStart),'-i',audio,'-map','0:v:0','-map','1:a:0',
    '-c:v','libx264','-preset','slow','-b:v',String(rate),'-maxrate',String(rate),'-bufsize',String(rate*2),'-profile:v','high','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-af',`loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0,duration-1.5)}:d=1.5`,
    '-t',String(duration),'-shortest','-movflags','+faststart',temp];
  const ff=spawn(ffmpeg,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='',failure;
  ff.stderr.on('data',b=>stderr+=b);ff.stdin.on('error',e=>{failure=e;});
  const done=new Promise(resolve=>{ff.on('error',e=>{failure=e;resolve(-1);});ff.on('close',resolve);});
  console.log(`${name}: ${frames} frames, ${duration}s at ${FPS} fps`);
  try{
    for(let i=0;i<frames;i++){
      if(failure)throw failure;
      await browser.evaluate(`JenerTrailer.seek(${i/FPS})`);
      const {data}=await browser.call('Page.captureScreenshot',{format:'jpeg',quality:92,fromSurface:true});
      if(!ff.stdin.write(Buffer.from(data,'base64')))await once(ff.stdin,'drain');
      if(i%300===0)console.log(`  ${name}: ${i}/${frames}`);
    }
    ff.stdin.end();const code=await done;if(code!==0||failure)throw Error(stderr||failure?.message||'ffmpeg exited '+code);
    if(fs.statSync(temp).size>=15e6)throw Error('Encoded video exceeds 15 MB; existing video was preserved.');
    fs.renameSync(temp,target);
    await browser.evaluate('JenerTrailer.seek(4)');
    const poster=await browser.call('Page.captureScreenshot',{format:'jpeg',quality:84});
    fs.writeFileSync(path.join(dir,cut.file+'-poster.jpg'),Buffer.from(poster.data,'base64'));
    console.log(`${target}: ${(fs.statSync(target).size/1e6).toFixed(2)} MB`);
  }catch(error){ff.kill();throw error;}
}
(async()=>{
  if(which!=='all'&&!cuts[which])throw Error('Choose wide, tall or all.');
  const check=spawnSync(ffmpeg,['-version'],{windowsHide:true,encoding:'utf8'});
  if(check.error||check.status)throw Error('ffmpeg is unavailable. Set FFMPEG to an existing binary; see .scratch/marketing/README.md. No files were replaced.');
  const server=await serve();let browser;
  try{browser=await launch();for(const [name,cut] of Object.entries(cuts))if(which==='all'||which===name)await record(name,cut,server.base,browser);}
  finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
