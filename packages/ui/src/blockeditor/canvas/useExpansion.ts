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
  useLayoutEffect(()=>()=>host.remove(),[host]);
  return {host,slot,expanded,reservedHeight,transitioning,toggle};
}
