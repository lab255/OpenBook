import {test,expect} from './fixtures';
import {newPage} from './seed';
import {writeFileSync} from 'node:fs';

test.use({freshWorkspace:true,mockAi:true,screenshot:'off',trace:'off',video:'off'});
test('BUILD-5 real shell layer relationships',async({page,request})=>{
  test.setTimeout(120000);await page.setViewportSize({width:1280,height:800});
  await page.route('https://canvas-layer.test/probe.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNI61j1HwAFiAKYYfIIaAAAAABJRU5ErkJggg==','base64')}));
  const id=await newPage(request,'BUILD-5 layers',{editor:'blocks',blockdoc:{blocks:[{id:'canvas',type:'canvas',props:{canvasVersion:1,height:360,background:'#ffffff',shapes:{}}},{id:'picture',type:'image',props:{src:'https://canvas-layer.test/probe.png',alt:'Layer probe'}}]},editorjs:{blocks:[]},values:[],names:[]});
  const toastId=await newPage(request,'BUILD-5 toast probe');
  await page.goto(`/?page=${id}`);await expect(page.getByRole('button',{name:'Page actions'})).toBeVisible();
  const rows:unknown[]=[];const save=()=>writeFileSync('../../_evidence-build5/round2-layers.json',JSON.stringify({scope:'Real production Next app + isolated data server; native hit testing at 1280x800 and 1024x640 light/dark, inline mirror1280x1400, too-tall1024x240. No screenshots/trace/video.',rows},null,2));
  const hit=async(selector:string)=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:el.getAttribute('aria-label')||el.textContent,hittable:el===target||el.contains(target),canvasOnTop:!!target?.closest('.ob-canvas-expanded'),z:getComputedStyle(el).zIndex,rect:r.toJSON()};});
  for(const [vw,vh] of [[1280,800],[1024,640]]){
    await page.setViewportSize({width:vw,height:vh});
    expect(await page.evaluate(()=>[innerWidth,innerHeight])).toEqual([vw,vh]);
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
      const drawer=page.locator('[data-sidebar-drawer]');if(!(await drawer.evaluate(el=>el.getBoundingClientRect().right>100)))await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
      await page.getByRole('region',{name:/Canvas, /}).focus();await page.keyboard.press('Enter');await page.keyboard.press('r');await page.keyboard.press('Enter');await page.keyboard.press('f');
      const tools=await page.locator('.ob-canvas-tools button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:el.getAttribute('aria-label'),hittable:el===target||el.contains(target)};}));
      const back=await hit('.ob-canvas-expanded-heading button'),title=await hit('.ob-canvas-expanded-heading strong');rows.push({theme,tools,back,title,sidebarRight:await drawer.evaluate(el=>el.getBoundingClientRect().right)});save();expect(tools).toHaveLength(8);expect(tools.every(t=>t.hittable)).toBe(true);expect(back.hittable&&title.hittable).toBe(true);
      await page.getByRole('button',{name:'Arrange',exact:true}).click();const arrange=await hit('.ob-canvas-arrange button');const menu=await page.locator('.ob-canvas-arrange').evaluate(el=>{const r=el.getBoundingClientRect();return {rect:r.toJSON(),within:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};});rows.push({theme,vw,vh,arrange,menu});save();expect(menu.within).toBe(true);save();expect(arrange.hittable).toBe(true);expect(arrange.canvasOnTop).toBe(true);await page.getByRole('menuitem',{name:'Bring to front',exact:true}).click();
      for(const [name,selector,item] of [['Objects','.ob-canvas-objects','[role="option"]'],['Help (?)','.ob-canvas-help','button']]){
        await page.getByRole('button',{name,exact:true}).click();
        const menu=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {rect:r.toJSON(),within:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,placement:(el as HTMLElement).dataset.placement};});
        const first=await hit(`${selector} ${item}`);rows.push({theme,vw,vh,name,menu,first});save();expect(menu.within).toBe(true);expect(first.hittable).toBe(true);
        await page.getByRole('button',{name,exact:true}).click();
      }
      await page.keyboard.press('ControlOrMeta+k');await expect(page.getByPlaceholder(/Search pages or run a command/)).toBeVisible();const palette=await hit('[cmdk-input]');rows.push({theme,palette});save();expect(palette.hittable).toBe(true);expect(palette.canvasOnTop).toBe(false);
      await page.getByPlaceholder(/Search pages or run a command/).fill('Open settings');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();const dialog=await hit('[role="dialog"]');rows.push({theme,dialog});save();expect(dialog.hittable).toBe(true);expect(dialog.canvasOnTop).toBe(false);await page.keyboard.press('Escape');await expect(page.locator('.ob-canvas-expanded')).toBeVisible();
      await page.locator('.ob-canvas-expanded-heading button').click();
    }
  }
  await page.setViewportSize({width:1280,height:1400});
  await page.getByRole('button',{name:'Help (?)',exact:true}).click();
  await page.getByLabel('Drawing viewport',{exact:true}).focus();await page.keyboard.press('f');
  const openDuringExpand=await page.locator('.ob-canvas-help').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
  expect(openDuringExpand).toBe(true);rows.push({openDuringExpand});save();await page.keyboard.press('f');
  await page.getByRole('button',{name:'Help (?)',exact:true}).click();
  await page.getByLabel('Drawing viewport',{exact:true}).focus();
  await page.getByRole('button',{name:'Arrange',exact:true}).click();
  const inline=await page.locator('.ob-canvas-arrange').evaluate(el=>{const r=el.getBoundingClientRect(),a=el.parentElement!.getBoundingClientRect();return {placement:(el as HTMLElement).dataset.placement,top:r.top,anchorBottom:a.bottom,within:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};});
  rows.push({inline});save();expect(inline.placement).toBe('below');expect(inline.top).toBe(inline.anchorBottom+4);expect(inline.within).toBe(true);
  await page.getByRole('menuitem',{name:'Bring to front',exact:true}).click();
  await page.setViewportSize({width:1024,height:240});
  await page.getByLabel('Drawing viewport',{exact:true}).focus();await page.keyboard.press('f');
  await page.getByRole('button',{name:'Help (?)',exact:true}).click();
  const tall=await page.locator('.ob-canvas-help').evaluate(el=>({top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
  rows.push({tooTall:tall});save();expect(tall.top).toBe(8);expect(tall.scrollHeight).toBeGreaterThan(tall.clientHeight);expect(tall.overflow).toBe('auto');
  await page.getByRole('button',{name:'Close help',exact:true}).scrollIntoViewIfNeeded();expect((await hit('.ob-canvas-help button')).hittable).toBe(true);await page.getByRole('button',{name:'Close help',exact:true}).click();
  await page.locator('.ob-canvas-expanded-heading button').click();
  await page.setViewportSize({width:1280,height:800});
  await page.getByLabel('Drawing viewport',{exact:true}).focus();await page.keyboard.press('f');
  const toastRow=page.getByRole('treeitem').filter({hasText:'BUILD-5 toast probe'}).last();
  await toastRow.getByRole('button',{name:'More actions'}).evaluate(el=>(el as HTMLButtonElement).click());
  await page.getByRole('menuitem',{name:'Move to trash',exact:true}).click();
  const confirm=page.getByRole('dialog',{name:'Move this page to the trash?'});await expect(confirm).toBeVisible();{const confirmation=await hit('[role="dialog"]');rows.push({confirmation});save();expect(confirmation.hittable).toBe(true);expect(confirmation.canvasOnTop).toBe(false);await confirm.getByRole('button',{name:/trash/i}).click();}
  await expect(page.locator('[data-toast-host]').getByRole('button',{name:'Undo'})).toBeVisible();const toast=await hit('[data-toast-host] button');rows.push({toast});save();expect(toast.hittable).toBe(true);expect(toast.canvasOnTop).toBe(false);await page.locator('[data-toast-host]').getByRole('button',{name:'Undo'}).click();
  await expect(page).toHaveURL(new RegExp(toastId));
  await page.goto(`/?page=${id}`);await expect(page.getByRole('region',{name:/Canvas, /})).toBeVisible();
  // Open an existing image action programmatically while expanded; only the
  // layer relationship is under test (canvas does not add an image command).
  await page.getByLabel('Drawing viewport',{exact:true}).focus();await page.keyboard.press('f');
  await page.locator('[data-block-image="picture"] [data-chrome="view"]').evaluate(el=>(el as HTMLButtonElement).click());
  await expect(page.getByRole('dialog',{name:'Layer probe'})).toBeVisible();const lightbox=await hit('.obe-lightbox-close');rows.push({lightbox});save();expect(lightbox.hittable).toBe(true);expect(lightbox.canvasOnTop).toBe(false);await page.keyboard.press('Escape');
});
