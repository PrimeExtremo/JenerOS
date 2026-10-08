const assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,launch}=require('./browser.cjs');
const {placeholder,plan,beatAt}=require('../../[SITE]/assets/preview.js');
const grid=placeholder(),timeline=plan(grid);
assert.equal(timeline.duration,43);assert.equal(timeline.scenes.at(-1).end,68);
assert(timeline.cues.every(c=>grid.beats.includes(c.time)));
assert.throws(()=>plan({...grid,beats:[1,0]}));
assert.throws(()=>plan({...grid,downbeats:[.1]}));
assert.equal(beatAt(timeline.beats,3),4);
const irregular={...grid,beats:grid.beats.map((t,i)=>t+i*i*.001)};
irregular.downbeats=irregular.beats.filter((_,i)=>i%4===0);irregular.drop=irregular.beats[60];
assert.equal(beatAt(plan(irregular).beats,irregular.beats[32]),32);
const phased={...grid,beats:Array.from({length:100},(_,i)=>.5+i*.625),downbeats:Array.from({length:25},(_,i)=>.5+(3+i*4)*.625),drop:50};
const shifted=plan(phased);
assert(phased.downbeats.includes(shifted.audioStart));
assert(shifted.scenes.every(s=>phased.downbeats.includes(shifted.beats[s.start]+shifted.audioStart)));
const out='.scratch/marketing/shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const server=await serve();let browser;
  const results=[];
  try{
    browser=await launch();
    for(const [width,height] of [[1440,900],[360,800],[780,360],[3440,1440]])for(const theme of ['dark','light']){
      await browser.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await browser.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'no-preference'}]});
      await browser.load(server.base+'/preview.html?trailer=1&capture=1&beats=assets/video/beats.json');
      await browser.evaluate('JenerTrailer.ready');
      const errors=await browser.evaluate(`(async()=>{
        const errors=[];
        if(document.documentElement.scrollWidth>innerWidth)errors.push('horizontal overflow');
        if([...document.images].some(i=>!i.complete||!i.naturalWidth))errors.push('image failed');
        for(let t=0;t<=43;t+=.25){JenerTrailer.seek(t);if(document.querySelectorAll('.chapter.active').length!==1)errors.push('active count at '+t);if([...document.querySelectorAll('[style]')].some(e=>/NaN|Infinity/.test(e.getAttribute('style'))))errors.push('invalid transform');}
        JenerTrailer.seek(24);const a=document.querySelector('#storage .disk').style.cssText;JenerTrailer.seek(3);JenerTrailer.seek(24);if(a!==document.querySelector('#storage .disk').style.cssText)errors.push('non-deterministic seek');
        JenerTrailer.seek(42.6);if(getComputedStyle(document.querySelector('#finale .actions a')).visibility!=='visible')errors.push('CTA hidden');
        return errors;
      })()`);
      assert.deepEqual(errors,[],`${width}/${theme}`);
      if((width===1440||width===360)&&theme==='dark'){
        for(const [name,time] of [['hero',4],['macro',7.3],['widget',11.4],['phone',17],['settings',19.8],['storage',26.4],['updates',32],['apps',36.2],['finale',42.6]]){
          await browser.evaluate(`JenerTrailer.seek(${time})`);
          const shot=await browser.call('Page.captureScreenshot',{format:'jpeg',quality:78});
          fs.writeFileSync(`${out}/${width}-${name}.jpg`,Buffer.from(shot.data,'base64'));
        }
      }
      // Actual browser media preference, including live transition back and forth.
      await browser.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-color-scheme',value:theme}]});
      await browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await browser.evaluate(`!document.documentElement.classList.contains('motion') && !JenerTrailer.running && [...document.querySelectorAll('.caption')].every(e=>getComputedStyle(e).display!=='none')`),'reduced motion');
      assert(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'still overflow');
      results.push(`${width}x${height}/${theme}: timeline, images, overflow, still preference`);
    }
    await browser.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await browser.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await browser.load(server.base+'/preview.html');await browser.evaluate('JenerTrailer.ready');
    const scroll=await browser.evaluate(`(async()=>{const out=[];for(const el of document.querySelectorAll('.chapter')){scrollTo(0,el.offsetTop+(el.offsetHeight-innerHeight)*.65);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));out.push({id:el.id,active:el.classList.contains('active'),position:getComputedStyle(el.querySelector('.stage')).position});}return out;})()`);
    assert(scroll.every(x=>x.active&&x.position==='sticky'),JSON.stringify(scroll));
    await browser.evaluate('document.querySelector("#motion-toggle").click()');
    assert(await browser.evaluate('!JenerTrailer.running && !document.documentElement.classList.contains("motion")'));
    await browser.load(server.base+'/preview.html?trailer=1&capture=1&beats=https://example.com/grid.json');await browser.evaluate('JenerTrailer.ready');
    assert.equal(await browser.evaluate('document.querySelector("#trailer-status").textContent'),'Using the 96 BPM test timing.');
    // JS-off HTML remains useful, including both download links.
    await browser.call('Emulation.setScriptExecutionDisabled',{value:true});
    await browser.load(server.base+'/preview.html');
    assert(await browser.evaluate(`!document.documentElement.classList.contains('motion')&&document.querySelectorAll('.caption h2').length===9`));
    await browser.call('Emulation.setScriptExecutionDisabled',{value:false});
    const violations=browser.events.filter(e=>e.method==='Log.entryAdded'&&/Content Security Policy|Refused to/.test(e.params.entry.text));
    const exceptions=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');
    assert.equal(violations.length,0,JSON.stringify(violations));assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    fs.writeFileSync(out+'/checks.json',JSON.stringify({results,scroll,cspViolations:0,exceptions:0},null,2));
    console.log(JSON.stringify({results,scroll,cspViolations:0,exceptions:0},null,2));
  }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
