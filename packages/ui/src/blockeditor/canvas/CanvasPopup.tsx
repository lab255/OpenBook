import {useLayoutEffect, useRef, type HTMLAttributes} from 'react';

/** Anchored → flip above when space below is insufficient → clamp inward.
 * If content is taller than the viewport, top-clamp the bounded popup and
 * scroll its content; never promise that all of that content is visible at once.
 * Preserve the original CSS anchor unchanged wherever it fits.
 */
export function CanvasPopup({expanded,...props}:HTMLAttributes<HTMLDivElement>&{expanded:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const el=ref.current!,anchor=el.parentElement!;
    const place=()=>{
      el.style.transform='';el.style.boxSizing='border-box';el.style.maxWidth=`${window.innerWidth-16}px`;
      el.style.maxHeight=`${window.innerHeight-16}px`;el.style.overflow='auto';
      const r=el.getBoundingClientRect(),a=anchor.getBoundingClientRect();
      const boundary=expanded?anchor.closest('.ob-canvas-footer')?.getBoundingClientRect().top:undefined;
      const left=Math.max(8,Math.min(r.left,window.innerWidth-8-r.width));
      const top=Math.max(8,Math.min(r.bottom>window.innerHeight-8?Math.min(a.top-4,boundary??Infinity)-r.height:r.top,window.innerHeight-8-r.height));
      el.style.transform=`translate(${left-r.left}px,${top-r.top}px)`;
      el.dataset.placement=top< a.top?'above':'below';
    };
    place();const observer=new ResizeObserver(place);observer.observe(el);observer.observe(anchor);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[expanded]);
  return <div {...props} ref={ref}/>;
}
