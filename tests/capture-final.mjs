import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-proxy-server','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const seed=await b.newPage();await seed.goto('http://127.0.0.1:5174');
const generated=await seed.evaluate(async()=>{
 const e=await import('/src/simulation/engine.ts'),p=await import('/src/simulation/persistence.ts');
 const {defaults}=await import('/src/app/preferences.ts');
 const pack=s=>{s.running=false;e.assign(s);return {state:{s:p.serializeFactoryState(s),theme:'dark',accent:'cyan',preferences:{...defaults}},version:1};};
 const normal=e.initialState();normal.running=true;e.tick(normal,300);const main=pack(normal);
 const fault=structuredClone(normal);e.inject(fault,'CNC-01','温度异常');e.createMaintenance(fault,'CNC-01');fault.maintenance[0].steps[0]=true;
 const single=(time,plate=false)=>{const s=e.initialState();s.orders=[{...s.orders[0],quantity:1,recipeId:plate?'plate':'flange',product:plate?'安装支架板 B-210':'精密法兰 A-320'}];s.flow.demoVariations=false;s.running=true;e.tick(s,time);return pack(s);};
 const lab=e.initialState();lab.orders=[{...lab.orders[0],quantity:1}];lab.flow.demoVariations=false;lab.flow.qualityHold=true;lab.flow.parameters.skipDeburr=true;lab.running=true;e.tick(lab,50);
 const batch=e.initialState();batch.running=true;e.tick(batch,12000);const packed=pack(batch);
 const batchResult={...e.metrics(batch),released:batch.workpieces.length,rejected:batch.workpieces.filter(w=>w.result==='fail').length,scrapped:batch.workpieces.filter(w=>w.scrappedAt!==undefined).length,stored:batch.workpieces.filter(w=>w.storedAt!==undefined).length,traceCount:Object.values(batch.flow.runs).filter(r=>r.trace.length===19).length,storageBytes:JSON.stringify(packed).length*2,completionTime:Math.max(...batch.orders.map(o=>o.completedAt??0))};
 const benchmark=[];for(const mode of ['standard','performance','eco']){const s=e.initialState();s.orders=[{...s.orders[0],quantity:40}];s.flow.demoVariations=false;s.mode=mode;s.running=true;while(s.orders[0].completed<40&&s.time<10000)e.tick(s,1);benchmark.push({mode,quantity:40,seconds:s.time,energyKwh:e.metrics(s).energy,stored:s.orders[0].completed});}
 return {main,fault:pack(fault),load:single(4.5),face:single(13),drill:single(28.5),plate:single(26,true),complete:single(80),lab:pack(lab),batch:batchResult,benchmark,example:{version:'1.3.0',simulation:normal,settings:{theme:'dark',accent:'cyan',...defaults}}};
});await seed.close();
await fs.writeFile('deliverables/示例完整备份-v1.3.json',JSON.stringify(generated.example,null,2));
const errors=[],screens=[],performance=[];
async function context(snapshot){const c=await b.newContext({viewport:{width:1440,height:1000}});await c.addInitScript(snapshot=>localStorage.setItem('nexus-simulation-v1',JSON.stringify(snapshot)),snapshot);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};}
async function shot(p,name,locator){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);const out=`deliverables/screenshots/final-${name}.png`;if(locator)await p.locator(locator).screenshot({path:out});else await p.screenshot({path:out,clip:{x:216,y:70,width:1224,height:850}});screens.push(out);}
let {c,p}=await context(generated.main);
for(const route of ['dashboard','twin','scheduling','quality','energy','reports','settings']){await p.goto('http://127.0.0.1:4173/#'+route);await p.locator('h1').waitFor();await shot(p,route);}
// All production layouts at representative widths.
const layouts=[];for(const width of [1440,768,390]){await p.setViewportSize({width,height:1000});for(const route of ['dashboard','twin','scheduling','quality','health','energy','ar','reports','settings']){await p.goto('http://127.0.0.1:4173/#'+route);await p.locator('h1').waitFor();layouts.push({width,route,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});}}
await c.close();
({c,p}=await context(generated.fault));for(const route of ['health','ar']){await p.goto('http://127.0.0.1:4173/#'+route);await p.locator('h1').waitFor();await shot(p,route);}await c.close();
for(const phase of ['load','face','drill','plate','complete']){({c,p}=await context(generated[phase]));await p.goto('http://127.0.0.1:4173/#twin');await p.getByRole('button',{name:'观察加工',exact:true}).click();if(phase==='complete'){const id=await p.getByLabel('观察工件',{exact:true}).locator('option').nth(1).getAttribute('value');await p.getByLabel('观察工件',{exact:true}).selectOption(id);await p.getByLabel('回放工序',{exact:true}).selectOption('drill');}
 await p.waitForTimeout(1200);await shot(p,phase,'.twin-root');if(phase==='complete')await shot(p,'observer','.twin-layout');
 if(phase==='face'){
  for(let i=0;i<12;i++){await p.waitForTimeout(250);const data=await p.locator('.twin-root').getAttribute('data-scene');if(data)performance.push(JSON.parse(data));}
  const resources=[];for(let i=0;i<5;i++){await p.getByRole('button',{name:'返回车间',exact:true}).click();await p.getByRole('button',{name:'观察加工',exact:true}).click();await p.waitForTimeout(300);const data=JSON.parse(await p.locator('.twin-root').getAttribute('data-scene'));resources.push({geometries:data.geometries,textures:data.textures});}
  await fs.writeFile('deliverables/v1.3-resource-trend.json',JSON.stringify(resources,null,2));
 }
 await c.close();}
({c,p}=await context(generated.lab));await p.goto('http://127.0.0.1:4173/#quality');await p.getByRole('button',{name:'查看产品',exact:true}).first().click();await shot(p,'cause','[aria-label="工艺因果追溯"]');await shot(p,'inspection','dialog');await c.close();
const result={version:'1.3.0',featureCommit:'a5a0736',browser:'Windows installed Chrome / SwiftShader software WebGL',unitTests:58,browserTests:21,batch:generated.batch,benchmark:generated.benchmark,productionLayouts:layouts,errors,screens,performance:{method:'12 samples of 250ms window means, paused face view, viewport 1440x1000; software renderer, no GPU timing or GPU memory claim',samples:performance}};
await fs.writeFile('deliverables/v1.3-final-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify({batch:generated.batch,benchmark:generated.benchmark,errors,overflow:layouts.filter(x=>x.overflow),screens:screens.length}));await b.close();
