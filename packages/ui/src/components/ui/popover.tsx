import { OVERLAY_MOTION } from "./overlay-motion"
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        // Clamp to the space the collision detector measured (Radix exposes
        // these vars when avoidCollisions is on — the default) and scroll when
        // the content is taller than the viewport, so a popover opened near an
        // edge never spills off-screen.
        "z-50 max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg border bg-popover p-4 text-popover-foreground shadow-overlay outline-hidden",
          OVERLAY_MOTION.menu,
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
