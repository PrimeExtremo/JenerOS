/* The clock and the scroll use the same beat-space choreography.
 * One rAF owner; no CSS ambient loops, no timers, no layout reads after writes.
 * Pure timeline helpers are also consumed by the recorder and its fixtures. */
(() => {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const segments = [['hero',8],['macro',4],['widget',8],['phone',8],['settings',4],['storage',12],['updates',8],['apps',8],['finale',8]];
  const totalBeats=segments.reduce((sum,s)=>sum+s[1],0);
  const placeholder = () => ({ bpm:96, offset:.5, beats:Array.from({length:totalBeats+1},(_,i)=>.5+i*.625), downbeats:Array.from({length:18},(_,i)=>.5+i*2.5), drop:40.5 });
  function validateGrid(g) {
    if (!g || !Number.isFinite(g.bpm) || g.bpm < 20 || g.bpm > 300 || !Number.isFinite(g.offset) || g.offset < 0 || !Array.isArray(g.beats) || g.beats.length < totalBeats+1 || g.beats.length > 50000) throw Error('The beat grid needs at least 69 beats.');
    if (g.beats.some((b,i)=>!Number.isFinite(b)||b<0||(i&&b<=g.beats[i-1]))) throw Error('Beats must be finite, increasing seconds.');
    if (!Array.isArray(g.downbeats) || !g.downbeats.length || g.downbeats.some((b,i)=>!Number.isFinite(b)||(i&&b<=g.downbeats[i-1])||!g.beats.some(t=>Math.abs(t-b)<.002))) throw Error('Downbeats must belong to the beat grid.');
    if (!Number.isFinite(g.drop)||g.drop<0||g.drop>g.beats[g.beats.length-1]) throw Error('Drop must be inside the beat grid.');
    return g;
  }
  function plan(grid) {
    const g=validateGrid(grid);
    // Prefer a 68-beat phrase with the closing logo landing on the drop's
    // nearest downbeat. Short tracks use the first complete phrase.
    const dropBeat=g.downbeats.reduce((a,b)=>Math.abs(b-g.drop)<Math.abs(a-g.drop)?b:a);
    const dropIndex=g.beats.findIndex(t=>Math.abs(t-dropBeat)<.002);
    const candidates=g.downbeats.map(t=>g.beats.findIndex(b=>Math.abs(b-t)<.002)).filter(i=>i+totalBeats<g.beats.length);
    if(!candidates.length)throw Error('The beat grid needs 69 beats starting on a downbeat.');
    const target=dropIndex-(totalBeats-4);
    const first=candidates.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
    const origin=first?g.beats[first]:0;
    const beats=g.beats.slice(first,first+totalBeats+1).map(t=>t-origin);
    let index=0;
    const scenes=segments.map(([id,length])=>{const s={id,start:index,end:index+length,length};index+=length;return s;});
    const event=(scene,beat,type)=>({time:beats[scenes.find(s=>s.id===scene).start+beat],type});
    const cues=[event('hero',0,'boot'),event('hero',2,'whoosh'),event('hero',4,'chime'),event('macro',2,'whoosh'),event('widget',2,'pop'),event('phone',2,'whoosh'),event('phone',6,'chime'),event('settings',0,'whoosh'),... [2,3,4].map(b=>event('storage',b,'pop')),event('storage',8,'chime'),event('updates',6,'whoosh'),event('apps',3,'pop'),event('finale',0,'whoosh'),event('finale',4,'chime'),event('finale',6,'pop')].sort((a,b)=>a.time-b.time);
    return {beats,scenes,cues,duration:beats[totalBeats],audioStart:origin,grid:g};
  }
  function beatAt(beats,time) {
    if(time<=beats[0]) return 0;
    if(time>=beats[totalBeats]) return totalBeats;
    let lo=0,hi=totalBeats;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(beats[mid]<=time)lo=mid;else hi=mid;}
    return lo+(time-beats[lo])/(beats[lo+1]-beats[lo]);
  }
  function bezier(x1,y1,x2,y2) {
    const at=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    return x=>{x=clamp(x);let lo=0,hi=1;for(let i=0;i<14;i++){const m=(lo+hi)/2;if(at(m,x1,x2)<x)lo=m;else hi=m;}return x===0?0:x===1?1:at((lo+hi)/2,y1,y2);};
  }
  const api={placeholder,validateGrid,plan,beatAt};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const root=document.documentElement;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const transparency=matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast=matchMedia('(prefers-contrast: more)');
  const forced=matchMedia('(forced-colors: active)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const params=new URLSearchParams(location.search);
  const trailer=params.get('trailer')==='1', capture=trailer&&params.get('capture')==='1';
  const ease=bezier(.2,0,0,1), enter=bezier(.05,.7,.1,1), pop=bezier(.175,.885,.32,1.275);
  const $=(s,el=document)=>el.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
  let timeline=plan(placeholder()), frame=0, enabled=false, still=false, paused=capture, manual=capture;
  let clock=0, previous=0, elapsed=0, intro=0, observer, pointer={x:0,y:0}, visible=new Set();
  const chapters=$$('.chapter').map(el=>({el,id:el.dataset.scene,n:Number(el.dataset.beats),cache:new Map()}));
  chapters.forEach(c=>{c.n=segments.find(s=>s[0]===c.id)[1];});
  const nodes=(c,selector)=>{if(!c.cache.has(selector))c.cache.set(selector,$$(selector,c.el));return c.cache.get(selector);};
  const one=(c,s)=>nodes(c,s)[0];
  const pose=(el,t,opacity=1)=>{if(!el)return;el.style.transform=t;el.style.opacity=clamp(opacity);};
  const fade=(el,value)=>{if(el)el.style.opacity=clamp(value);};
  const motionButton=$('#motion-toggle'), pauseButton=$('#trailer-pause'), status=$('#trailer-status');
  const progress=document.createElement('div');progress.className='story-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
  $('.tour-tools').hidden=false;
  function renderScene(c,b,time) {
    const scene=timeline.scenes.find(s=>s.id===c.id);
    // Every authored action begins at an integer beat. Its entrance lasts .8 s
    // regardless of tempo; scroll uses the equivalent interpolated beat time.
    const localTime = timeline.beats[scene.start+Math.min(c.n-1,Math.floor(b))]+(b%1)*(timeline.beats[scene.start+Math.min(c.n,Math.floor(b)+1)]-timeline.beats[scene.start+Math.min(c.n-1,Math.floor(b))]);
    const age=(beat,duration=.8,curve=enter)=>curve(clamp((localTime-timeline.beats[scene.start+beat])/duration));
    const drift=Math.sin(time*.24), p=b/c.n;
    const dolly=1+.045*p;
    const out=c.id==='finale'?1:1-ease(clamp((b-(c.n-.5))/.5));
    let entrance=['hero','macro','settings','finale'].includes(c.id)?0:2;
    if(c.id==='updates')entrance=4;
    const arrive=age(entrance);
    const camera=one(c,'.camera');
    pose(camera,`translate3d(${pointer.x*3}px,${(1-arrive)*Math.min(innerHeight*.8,600)+drift*3}px,${p*24}px) rotateX(${-pointer.y*.7}deg) rotateY(${pointer.x*1.2}deg) scale(${dolly})`,Math.max(c.id==='hero'?.4:0,arrive)*out);
    nodes(c,'.ribbon').forEach((r,i)=>pose(r,`translate3d(${drift*(i+1)*12-pointer.x*8}px,${(p-.5)*(i+1)*38}px,0) scale(${1+p*.035})`,(i?.12:.22)*out));
    pose(one(c,'.scene-glow'),`translate3d(${(p-.5)*70}px,${drift*14}px,0) scale(${1+p*.06})`,out);
    const captionStart=c.id==='hero'?4:c.id==='storage'?6:c.id==='updates'?5:entrance+1;
    nodes(c,'.caption h2 span, .caption p').forEach((el,i)=>{const a=age(captionStart,.65+(i*.18));pose(el,`translateY(${(1-a)*12}px)`,a*out);});
    nodes(c,'.specular').forEach((el,i)=>{
      const sweep=age(entrance+1,1.4,ease);
      const lightX=trailer?Math.sin(time*.25):fine.matches?pointer.x:p*2-1;
      const x=-60+sweep*240+lightX*120+drift*10;
      pose(el,`translateX(${x}%) skewX(-18deg)`,(.12+Math.sin(sweep*Math.PI)*.7)*out);
    });
    const word=one(c,'.word-card');
    if(word){
      const tail=c.id==='widget'&&b>=6;
      const end=c.id==='updates'?4:2;
      const alpha=tail?age(6,.35)*(1-age(7,.5)):1-age(end,.6);
      pose(word,`translateY(${-p*10}px)`,alpha);
      // No hidden text or focus destinations are removed from the still DOM.
      nodes(c,'.word-card span').forEach((el,i)=>{
        const start=c.id==='widget'?(i?6:0):c.id==='updates'?i*2:i;
        const a=age(start,.4);
        const show=c.id==='widget'?(tail?i===1:i===0):true;
        pose(el,`translateY(${(1-a)*12}px)`,show?a:0);
        if(c.id==='widget')el.style.display=show?'block':'none';
      });
    }
    const primary=one(c,'.primary');
    if(primary)pose(primary,`translate3d(0,${(1-arrive)*60}px,${(1-arrive)*-180}px) rotateX(${(1-arrive)*22}deg) rotateY(${(1-arrive)*-12}deg) scale(${1+p*.025})`,1);
    nodes(c,'.box').forEach(el=>pose(el,`rotateX(${14+drift*2}deg) rotateY(${-22+p*16}deg) scale(${innerWidth<900?.6:.85})`,arrive));
    if(c.id==='hero'){
      const open=age(2,1.2), reveal=age(2,.9);
      pose(one(c,'.hero-product'),`translate3d(0,${30-open*15}px,${-160+open*160}px) rotateX(${(1-open)*48+drift*.6}deg) rotateY(${(1-open)*-24+drift*.7}deg) scale(${.86+open*.14})`);
      fade(one(c,'.boot-logo'),1-reveal);
      nodes(c,'.letter').forEach((el,i)=>{const start=timeline.beats[2]+i*.055,end=timeline.beats[4];const a=enter(clamp((localTime-start)/(end-start)));pose(el,`translateY(${(1-a)*45}px) scale(${.8+a*.2})`,a);});
      fade(one(c,'.hero-brand p'),age(4));fade(one(c,'.scroll-hint'),age(4));
    }
    if(c.id==='macro'){
      const shelf=age(2);
      pose(one(c,'.bar-macro'),`translateX(${-p*50}px) scale(${1.45+p*.06})`,1-shelf);
      nodes(c,'.app-tile').forEach((el,i)=>{pose(el,`translate3d(${(2-i)*8-p*28}px,${(1-shelf)*180+(i-2)*8}px,${-Math.abs(i-2)*70}px) rotateX(20deg) rotateY(-20deg) scale(1.15)`,shelf);el.style.filter=Math.abs(i-2)>1?'blur(1.5px)':'none';});
    }
    if(c.id==='widget'){
      const grow=age(3), content=age(3,1), vanish=1-age(6,.5);
      pose(one(c,'.widget-shape'),`scale(${.3+.7*grow},${.28+.72*grow})`);
      pose(one(c,'.widget-content'),`translateY(${(1-content)*12}px)`,content*vanish);
      fade(one(c,'.widget-seed'),(1-grow)*arrive);fade(camera,arrive*vanish*out);
      const count=Math.round(24*age(4,1.2,ease));one(c,'[data-count]').textContent=count;
      one(c,'.ring-value').style.strokeDashoffset=100-count;
    }
    if(c.id==='phone'){
      const phone=age(3), qr=age(4), connect=age(5,.625,ease);
      pose(one(c,'.phone'),`translate3d(${(1-phone)*90}px,${(1-phone)*180}px,${70+phone*30}px) rotateY(${(1-phone)*-35-5}deg)`,phone);
      pose(one(c,'.qr-detail'),`scale(${.8+qr*.2})`,qr);
      one(c,'.connection path').style.strokeDashoffset=1-connect;fade(one(c,'.connection'),qr);
      growChip(c,'.connected',age(6,.5,pop),age(6,.7));
    }
    if(c.id==='settings'){
      const flip=age(1,1);
      pose(one(c,'.before'),`rotateY(${-flip*75}deg) translateZ(${-flip*240}px) scale(${1+flip*.12})`,1-flip);
      pose(primary,`rotateY(${(1-flip)*75}deg) translateZ(${(1-flip)*-220}px) scale(${.96+flip*.04})`,flip);
      pose(one(c,'.sidebar-highlight'),`translateY(${age(2)*55}px)`,flip*.65);
    }
    if(c.id==='storage'){
      fade(primary,.25);
      nodes(c,'.disk').forEach((el,i)=>{const d=age(2+i,.8,ease);pose(el,`translate3d(0,${-180*(1-d)}px,${60*(1-d)}px) rotateX(${(1-d)*-24}deg)`,d);});
      const fill=age(5,1.5,ease);pose(one(c,'.mirror-track i'),`scaleX(${fill})`);
      one(c,'[data-count]').textContent=Math.round(fill*100);
      growChip(c,'.storage-ready',age(7,timeline.beats[scene.start+8]-timeline.beats[scene.start+7],pop),age(8,.4));
    }
    if(c.id==='updates'){
      fade(primary,.2);const swap=age(6,.9);
      pose(one(c,'.system-a'),`translate3d(${swap*42}%,${-swap*22}px,${swap*100}px) rotateY(${12-swap*12}deg) scale(${.9+swap*.1})`);
      pose(one(c,'.system-b'),`translate3d(${-swap*70}%,${swap*32}px,${-swap*110}px) rotateY(${-12+swap*24}deg) scale(${1-swap*.12})`,1-swap*.55);
      growChip(c,'.update-safe',age(7,.5,pop),age(7,.7));
    }
    if(c.id==='apps'){
      nodes(c,'.app-tile').forEach((el,i)=>{
        const a=age(3,.7+i*.08,pop), stack=age(6,.8);
        pose(el,`translate3d(${(2-i)*stack*70}%,${(1-a)*120-Math.sin(i*.8)*35*(1-stack)}px,${i*12}px) rotateZ(${(i-2)*7*(1-stack)}deg) rotateY(${(1-a)*25}deg) scale(${.7+.3*a-stack*.12})`,clamp(a));
      });
    }
    if(c.id==='finale'){
      const settle=age(2,1.1);
      nodes(c,'.orbit-screen').forEach((el,i)=>{
        const angle=(i-2)*.65+(1-settle)*1.3, arc=(1-settle)*200;
        const x=Math.sin(angle)*arc+(i-2)*14, y=Math.cos(angle)*arc*.3+i*-12;
        pose(el,`translate3d(${x}px,${y}px,${-160+i*34}px) rotateX(${12-settle*4}deg) rotateY(${(1-settle)*(i-2)*25-10}deg) rotateZ(${(i-2)*(1-settle)*10}deg) scale(.86)`,arrive);
      });
      nodes(c,'.letter').forEach((el,i)=>{const start=timeline.beats[scene.start+3]+i*.045,end=timeline.beats[scene.start+4];const a=enter(clamp((localTime-start)/Math.max(.05,end-start)));pose(el,`translateY(${(1-a)*30}px) scale(${.9+a*.1})`,a);});
      fade(one(c,'.final-brand p'),age(4));
      nodes(c,'.actions a').forEach((el,i)=>{const a=age(6,.8+i*.12);pose(el,`translateY(${(1-a)*24}px)`,a);el.style.visibility=a>.01?'visible':'hidden';});
    }
  }
  function growChip(c,selector,grow,content) {
    const el=one(c,selector);pose(el,`translateY(${(1-clamp(grow))*8}px)`,clamp(grow));
    pose($('.chip-glass',el),`scale(${.3+.7*grow},${.7+.3*grow})`);
    pose($('.chip-content',el),`translateY(${(1-content)*8}px)`,content);
    const check=$('svg',el);pose(check,`scale(${grow})`);
  }
  function draw(time) {
    if(!enabled)return;
    const b=beatAt(timeline.beats,time);
    // Read first, write second. IO limits scroll work to adjacent visible scenes.
    const work=trailer?chapters:chapters.filter(c=>visible.has(c.el));
    const rects=trailer?[]:work.map(c=>c.el.getBoundingClientRect());
    work.forEach((c,i)=>{
      const scene=timeline.scenes.find(s=>s.id===c.id);
      const active=trailer?(b>=scene.start&&(b<scene.end||scene.id==='finale')):rects[i].top<innerHeight&&rects[i].bottom>0;
      const after=time-timeline.beats[scene.end];
      const outgoing=trailer&&!active&&after>=0&&after<.45;
      c.el.classList.toggle('active',active);
      c.el.classList.toggle('outgoing',outgoing);
      if(trailer)c.el.inert=!active;
      if(!active&&!outgoing)return;
      let local=trailer?Math.min(c.n-.0001,b-scene.start):clamp(-rects[i].top/Math.max(1,rects[i].height-innerHeight))*c.n;
      if(outgoing)local=c.n-.5+clamp(after/.45)*.5;
      if(trailer)fade(one(c,'.stage'),outgoing?1:enter(clamp((time-timeline.beats[scene.start])/.45)));
      if(!trailer&&c.id==='hero'&&scrollY<10)local=Math.max(local,Math.min(5,intro*1.6));
      renderScene(c,Math.min(c.n-.0001,local),trailer?time:elapsed);
    });
    if(root.classList.contains('refract'))$('feDisplacementMap').setAttribute('scale',(2+Math.sin(time*1.8)*1.5).toFixed(2));
    if(trailer||!CSS.supports('animation-timeline: scroll()'))progress.style.transform=`scaleX(${trailer?b/totalBeats:scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)})`;
  }
  function tick(now) {
    frame=0;if(!enabled||document.hidden)return;
    const dt=previous?Math.min((now-previous)/1000,.1):0;previous=now;elapsed+=dt;intro+=dt;
    if(trailer&&!paused&&!manual)clock=Math.min(timeline.duration,clock+dt);
    draw(trailer?clock:elapsed);
    if(trailer&&clock>=timeline.duration&&!paused){paused=true;pauseButton.textContent='Replay trailer';}
    if((trailer&&!paused&&!manual)||(!trailer&&visible.size))schedule();
  }
  function schedule(){if(!frame&&enabled&&!document.hidden)frame=requestAnimationFrame(tick);}
  function clear(){cancelAnimationFrame(frame);frame=0;previous=0;chapters.forEach(c=>{c.el.classList.remove('active','outgoing');c.el.inert=false;$$('[style]',c.el).forEach(el=>el.removeAttribute('style'));nodes(c,'[data-count]').forEach(el=>el.textContent=el.dataset.count);});progress.style.transform='scaleX(0)';}
  function configure() {
    enabled=!still&&!reduce.matches&&!forced.matches&&!!window.IntersectionObserver;
    clear();root.classList.toggle('motion',enabled);root.classList.toggle('trailer',enabled&&trailer);root.classList.toggle('capture',enabled&&capture);
    root.classList.toggle('refract',enabled&&!transparency.matches&&!contrast.matches);
    motionButton.textContent=enabled?'Still view':'Motion view';motionButton.setAttribute('aria-pressed',String(!enabled));
    motionButton.disabled=reduce.matches||forced.matches;
    pauseButton.hidden=!enabled||!trailer;progress.hidden=!enabled;
    if(!enabled){observer?.disconnect();visible.clear();return;}
    if(!trailer){observer?.disconnect();observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)visible.add(e.target);else{visible.delete(e.target);e.target.classList.remove('active');}});schedule();},{rootMargin:'0px'});chapters.forEach(c=>observer.observe(c.el));}
    schedule();
  }
  function seek(seconds){if(!Number.isFinite(seconds))throw Error('Time must be finite');manual=true;paused=true;cancelAnimationFrame(frame);frame=0;clock=Math.max(0,Math.min(timeline.duration,seconds));draw(clock);return clock;}
  const ready=(async()=>{
    if(trailer){
      try{
        const url=new URL(params.get('beats')||'assets/video/beats.json',location.href);
        if(url.origin!==location.origin)throw Error('Beat grids must be self-hosted.');
        const response=await fetch(url);if(!response.ok)throw Error('Beat grid could not be loaded.');
        const text=await response.text();if(text.length>1000000)throw Error('Beat grid is too large.');
        timeline=plan(JSON.parse(text));
      }catch(error){status.textContent='Using the 96 BPM test timing.';console.warn('Preview timing:',error.message);}
      $$('img').forEach(img=>img.loading='eager');
      await Promise.all($$('img').map(img=>img.decode().catch(()=>{})));
      await document.fonts.ready;
      document.dispatchEvent(new CustomEvent('jeneros:sfx-cues',{detail:timeline.cues}));
    }
    configure();return {duration:timeline.duration,cues:timeline.cues,audioStart:timeline.audioStart};
  })();
  window.JenerTrailer={ready,seek,get duration(){return timeline.duration;},get cues(){return timeline.cues;},get audioStart(){return timeline.audioStart;},get time(){return clock;},get running(){return !!frame;},play(){if(clock>=timeline.duration)clock=0;manual=false;paused=false;previous=0;pauseButton.textContent='Pause trailer';schedule();}};
  motionButton.addEventListener('click',()=>{still=!still;configure();});
  pauseButton.addEventListener('click',()=>{if(paused){window.JenerTrailer.play();}else{paused=true;cancelAnimationFrame(frame);frame=0;pauseButton.textContent='Play trailer';}});
  $('#finale .actions').addEventListener('focusin',()=>{
    if(enabled&&!trailer){const c=$('#finale');scrollTo(0,c.offsetTop+(c.offsetHeight-innerHeight)*.9);schedule();}
  });
  $('.tour-tools a').addEventListener('click',event=>{if(trailer&&enabled){event.preventDefault();seek(timeline.beats[totalBeats-1]);$('#finale .actions a').focus({preventScroll:true});}else if(enabled){event.preventDefault();const c=$('#finale');scrollTo(0,c.offsetTop+(c.offsetHeight-innerHeight)*.9);schedule();}});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
  addEventListener('pointermove',e=>{if(fine.matches&&!trailer){pointer={x:e.clientX/innerWidth*2-1,y:e.clientY/innerHeight*2-1};schedule();}},{passive:true});
  document.addEventListener('pointerleave',()=>{pointer={x:0,y:0};schedule();});
  document.addEventListener('visibilitychange',()=>{previous=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',()=>{previous=0;schedule();});
  [reduce,transparency,contrast,forced].forEach(m=>m.addEventListener('change',configure));
})();
