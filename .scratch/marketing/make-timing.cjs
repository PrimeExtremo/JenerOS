// Self-authored 96 BPM timing + test clicks. No music or third-party samples.
const fs=require('node:fs');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {placeholder,plan}=require('../../[SITE]/assets/preview.js');
const dir='[SITE]/assets/video', grid=placeholder(), timeline=plan(grid);
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/beats.json',JSON.stringify(grid,null,2)+'\n');
fs.writeFileSync(dir+'/sfx-cues.json',JSON.stringify(timeline.cues,null,2)+'\n');
// ffmpeg sine bursts: 880 Hz (downbeat), 660 Hz (other beats), 22 ms,
// exponential decay, peak -30 dBFS. Keep it deliberately quiet for timing tests.
const expression=grid.beats.slice(0,68).map((t,i)=>`if(between(t,${t},${t+.022}),0.0316*sin(2*PI*${i%4?660:880}*(t-${t}))*exp(-180*(t-${t})),0)`).join('+');
const args=['-y','-loglevel','error','-f','lavfi','-i',`aevalsrc=${expression}:s=16000:d=${timeline.duration}`,'-c:a','pcm_s16le',dir+'/test-click.wav'];
const ff=process.env.FFMPEG||'ffmpeg';
const result=spawnSync(ff,args,{windowsHide:true,encoding:'utf8'});
if(result.error?.code==='ENOENT'){
  // Same synthesis without an install, so the shipped test track works here too.
  const rate=16000,n=Math.ceil(timeline.duration*rate), wav=Buffer.alloc(44+n*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);
  grid.beats.slice(0,68).forEach((beat,i)=>{for(let j=0;j<rate*.022;j++){const t=j/rate,index=Math.round(beat*rate)+j;if(index<n)wav.writeInt16LE(Math.round(32767*.0316*Math.sin(2*Math.PI*(i%4?660:880)*t)*Math.exp(-180*t)),44+index*2);}});
  fs.writeFileSync(dir+'/test-click.wav',wav);console.log('ffmpeg absent; wrote equivalent quiet sine bursts with Node.');
}else if(result.status!==0)throw Error(result.stderr||result.error?.message);
// Use the project's QR encoder, with a tiny serializer, for a real public URL.
const element=tag=>({tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},append(...n){this.children.push(...n);}});
const sandbox={window:{},TextEncoder,document:{createElementNS:(_,tag)=>element(tag)}};
vm.runInNewContext(fs.readFileSync('[DASHBOARD]/vendor/qrcode.js','utf8'),sandbox);
const holder=element('div');new sandbox.window.QRCode(holder,{text:'https://jener.dev/preview',width:120,height:120});
holder.children[0].attrs.xmlns='http://www.w3.org/2000/svg';
const serialize=el=>`<${el.tag} ${Object.entries(el.attrs).map(([k,v])=>`${k}="${v}"`).join(' ')}>${el.children.map(serialize).join('')}</${el.tag}>`;
fs.writeFileSync('[SITE]/assets/preview-qr.svg','<!-- Generated with JenerOS vendor/qrcode.js (MIT); public preview URL, not pairing credentials. -->\n'+serialize(holder.children[0])+'\n');
console.log(`Wrote ${timeline.duration}s grid, ${timeline.cues.length} cues and QR.`);
