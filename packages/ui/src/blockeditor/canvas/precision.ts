import type {Point} from './geometry';

export function snapPoint(point: Point, zoom: number, enabled: boolean, bypass: boolean): {point: Point; guides: Partial<Point>} {
  const next = {...point}, guides: Partial<Point> = {};
  if (enabled && !bypass) for (const axis of ['x','y'] as const) {
    const grid = Math.round(point[axis]/16)*16;
    if (Math.abs(grid-point[axis])*zoom <= 4) {next[axis] = grid; guides[axis] = grid;}
  }
  return {point:next,guides};
}
