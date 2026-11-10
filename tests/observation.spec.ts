import {test,expect} from '@playwright/test';
test('internal observation and historical playback never mutate production',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#twin');
 const before=await page.evaluate(async()=>{const e=await import('/src/simulation/engine.ts');const {useFactory}=await import('/src/store/useFactory.ts');const s=e.initialState();s.orders=[{...s.orders[0],quantity:1}];s.flow.demoVariations=false;s.running=true;e.tick(s,53);s.running=false;e.assign(s);useFactory.setState({s});return JSON.stringify(s);});
 await page.getByRole('button',{name:'观察加工',exact:true}).click();
 await expect(page.getByTestId('observation')).toBeVisible();
 const id=await page.evaluate(async()=>{const {useFactory}=await import('/src/store/useFactory.ts');return Object.keys(useFactory.getState().s.flow.runs)[0];});
 await page.getByLabel('观察工件',{exact:true}).selectOption(id);
 await page.getByLabel('回放工序',{exact:true}).selectOption('contour');
 await expect(page.getByTestId('observed-stage')).toContainText('轮廓加工');
 await page.getByRole('button',{name:'播放回放',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'暂停回放',exact:true}).click();
 expect(await page.evaluate(async()=>{const {useFactory}=await import('/src/store/useFactory.ts');return JSON.stringify(useFactory.getState().s);})).toBe(before);
 await page.screenshot({path:'deliverables/screenshots/v1.2-observation.png',fullPage:true});
 await page.setViewportSize({width:390,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'返回车间',exact:true}).click();await expect(page.getByTestId('observation')).toHaveCount(0);expect(errors).toEqual([]);
});
