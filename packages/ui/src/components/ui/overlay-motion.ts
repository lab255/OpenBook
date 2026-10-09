// DSX §2: exits fade only; menus enter 2px from their anchor at scale .98.
const fade = 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:pointer-events-none data-[state=closed]:duration-(--motion-fast) data-[state=open]:ease-out-soft data-[state=closed]:ease-in-out-soft';
export const OVERLAY_MOTION = {
  menu: `${fade} data-[state=open]:duration-(--motion-base) data-[state=open]:zoom-in-[0.98] data-[state=open]:data-[side=bottom]:slide-in-from-top-0.5 data-[state=open]:data-[side=left]:slide-in-from-right-0.5 data-[state=open]:data-[side=right]:slide-in-from-left-0.5 data-[state=open]:data-[side=top]:slide-in-from-bottom-0.5`,
  dialog: `${fade} data-[state=open]:duration-(--motion-slow) data-[state=open]:zoom-in-[0.98]`,
  scrim: `${fade} data-[state=open]:duration-(--motion-slow)`,
  tooltip: `${fade} data-[state=open]:duration-(--motion-fast)`,
};
