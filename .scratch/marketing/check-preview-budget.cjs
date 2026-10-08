const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,launch}=require('./browser.cjs');
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const worstDark=[40,30,23].map(v=>v*.96+255*.04),worstLight=[255,252,246].map(v=>v*.96);
const contrast={dark:ratio([246,241,231],worstDark),light:ratio([53,40,31],worstLight)};
assert(contrast.dark>=4.5&&contrast.light>=4.5);
(async()=>{
  const s=await serve();let b;const sizes=[];
  try{
    b=await launch();
    for(const [width,height,dpr] of [[1440,900,2],[360,800,3]]){
      await b.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
      await b.load(s.base+'/preview.html?trailer=1&capture=1');await b.evaluate('JenerTrailer.ready');
      const bytes=await b.evaluate(`performance.getEntriesByType('resource').reduce((n,r)=>n+r.decodedBodySize,0)`)+fs.statSync('[SITE]/preview.html').size;
      assert(bytes<2e6,`${bytes} bytes exceeds 2 MB`);sizes.push({width,dpr,bytes});
      await b.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
      await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await b.evaluate(`!document.documentElement.classList.contains('refract')`));
      await b.call('Emulation.setEmulatedMedia',{features:[]});
      await b.evaluate('JenerTrailer.seek(42.5)');
      // Controls in inactive trailer scenes cannot leak above the current shot.
      await b.evaluate('JenerTrailer.seek(4)');
      assert(await b.evaluate(`document.querySelector('#finale .actions a').getClientRects().length===0`));
    }
    // No-JS with enlarged default text remains a readable, non-overflowing grid.
    await b.call('Emulation.setScriptExecutionDisabled',{value:true});
    await b.call('Page.setFontSizes',{fontSizes:{standard:32}}).catch(()=>{});
    await b.load(s.base+'/preview.html');
    assert(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await b.call('Emulation.setScriptExecutionDisabled',{value:false});
    await b.load(s.base+'/preview.html');await b.evaluate('JenerTrailer.ready');
    const lifecycle=await b.evaluate(`(async()=>{
      scrollTo(0,100);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
      const hidden=!JenerTrailer.running;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
      document.querySelector('.story').style.display='none';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const offscreen=!JenerTrailer.running;return {hidden,offscreen};
    })()`);
    assert(lifecycle.hidden&&lifecycle.offscreen,JSON.stringify(lifecycle));
    // Force the CSS-animation fallback feature branch on a fresh load.
    await b.call('Page.addScriptToEvaluateOnNewDocument',{source:`const supports=CSS.supports.bind(CSS);CSS.supports=(...a)=>a[0]==='animation-timeline: scroll()'?false:supports(...a);`});
    await b.load(s.base+'/preview.html');await b.evaluate('JenerTrailer.ready');
    await b.evaluate('scrollTo(0,1000);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    assert(await b.evaluate('document.querySelector(".story-progress").style.transform.startsWith("scaleX(")'));
    console.log(JSON.stringify({sizes,worstCaseGlassContrast:contrast,lifecycle,checks:'reduced transparency, hidden CTAs, JS-off, scroll progress fallback'},null,2));
    fs.writeFileSync('.scratch/marketing/shots/budget.json',JSON.stringify({sizes,worstCaseGlassContrast:contrast},null,2));
  }finally{if(b)await b.close();await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
