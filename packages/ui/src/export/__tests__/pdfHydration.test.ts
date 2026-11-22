import {afterEach,describe,expect,it,vi} from 'vitest';
import {toPdf} from '../toPdf';

const pdfOptions=vi.hoisted(()=>[] as unknown[]);
vi.mock('jspdf',()=>({jsPDF:class {constructor(options:unknown){pdfOptions.push(options);} async svg() {} output(){return new Blob(['pdf']);}}}));
vi.mock('svg2pdf.js',()=>({}));
vi.mock('dom-to-svg',()=>({elementToSVG:()=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 720 400');
  return {documentElement:svg};
}}));
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();pdfOptions.length=0;});
describe('PDF static projection mechanism',()=>{
  it.each(['paged','continuous'] as const)('%s: sets the frame flag before parsing, without script injection, and compresses losslessly',async mode=>{
    vi.useFakeTimers();
    const append=document.body.appendChild.bind(document.body);let flagAtWrite:unknown,parsed='';
    vi.spyOn(document.body,'appendChild').mockImplementation(<T extends Node>(element:T):T=>{
      const result=append(element);
      if(element instanceof HTMLIFrameElement){
        const frame=element,doc=frame.contentDocument!;
        vi.spyOn(doc,'readyState','get').mockReturnValue('complete');
        vi.spyOn(doc,'write').mockImplementation((...text:string[])=>{flagAtWrite=(frame.contentWindow as Window & {__OB_NO_HYDRATE?:boolean}).__OB_NO_HYDRATE;parsed=text.join('');doc.body.innerHTML='<main>Text and image projection</main>';});
      }
      return result;
    });
    const promise=toPdf('<!doctype html><html><head></head><body><main>Document</main></body></html>',mode);
    await vi.runAllTimersAsync();await promise;
    expect(pdfOptions).toEqual([expect.objectContaining({compress:true})]);
    expect(flagAtWrite).toBe(true);expect(parsed).not.toContain('<script');expect(document.querySelector('iframe')).toBeNull();
  });
});
