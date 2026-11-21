import {useLayoutEffect, useRef, useState, type RefObject} from 'react';

/** A stable portal target moves, never the React canvas tree or its Y.Doc. */
export function useExpansion(region: RefObject<HTMLDivElement|null>) {
  const [host]=useState(()=>document.createElement('div'));
  const slot=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(false);
  const [reservedHeight,setReservedHeight]=useState<number>();
  const transitioning=useRef(false);
  const saved=useRef<{focus:HTMLElement|null;scroll:{element:Element;x:number;y:number}[]}|null>(null);
  const toggle=()=>{
    if(!expanded){
      const scroll:{element:Element;x:number;y:number}[]=[];
      for(let el:Element|null=slot.current;el;el=el.parentElement)scroll.push({element:el,x:el.scrollLeft,y:el.scrollTop});
      if(document.scrollingElement&&!scroll.some(s=>s.element===document.scrollingElement))scroll.push({element:document.scrollingElement,x:document.scrollingElement.scrollLeft,y:document.scrollingElement.scrollTop});
      saved.current={focus:document.activeElement instanceof HTMLElement ? document.activeElement : null,scroll};
      setReservedHeight(slot.current?.getBoundingClientRect().height);
    }
    transitioning.current=true;setExpanded(value=>!value);
  };
  useLayoutEffect(()=>{
    (expanded ? document.body : slot.current)?.appendChild(host);
    if(transitioning.current){
      if(expanded)region.current?.focus({preventScroll:true});
      else {
        const target=saved.current?.focus;
        (target?.isConnected ? target : region.current)?.focus({preventScroll:true});
        for(const {element,x,y} of saved.current?.scroll??[]){element.scrollLeft=x;element.scrollTop=y;}
        setReservedHeight(undefined);
      }
      transitioning.current=false;
    }
  },[expanded,host]);
  useLayoutEffect(()=>{
    if(!expanded)return;
    const dialogs='[role="dialog"],[role="alertdialog"]';
    let timer:ReturnType<typeof setTimeout>|undefined;
    // Radix resumes the underlying scope after close-autofocus, but a keyboard
    // dialog has no trigger to restore. Its portal removal is outside our scope's
    // own observer. Reclaim BODY only after that teardown; never steal from a
    // live modal or an explicitly focused element, and never run inline.
    const observer=new MutationObserver(records=>{
      if(!records.some(record=>!region.current?.contains(record.target)&&[...record.removedNodes].some(node=>node instanceof Element&&(node.matches(dialogs)||node.querySelector(dialogs)))))return;
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const surface=region.current;
        if(!surface?.isConnected||document.activeElement!==document.body)return;
        const otherDialog=[...document.querySelectorAll(dialogs)].some(el=>!surface.contains(el)&&el.getAttribute('data-state')!=='closed'&&el.getClientRects().length>0);
        if(!otherDialog)surface.focus({preventScroll:true});
      },0);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();clearTimeout(timer);};
  },[expanded,region]);
  useLayoutEffect(()=>()=>host.remove(),[host]);
  return {host,slot,expanded,reservedHeight,transitioning,toggle};
}
