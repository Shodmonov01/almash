import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type PopoverPos = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

const GAP = 6;
const EDGE = 8;

/**
 * A popover rendered position:fixed in a portal, anchored to a trigger.
 * - capped height, flips upwards when there is no room below;
 * - follows the trigger on scroll/resize and closes once it leaves the screen
 *   (or slides under the top header);
 * - closes on outside pointerdown and on Escape.
 */
export function useAnchoredPopover<A extends HTMLElement, P extends HTMLElement>({
  maxHeight = 224,
  minWidth = 0,
  flipBelow = Math.min(maxHeight, 160),
}: {
  /** Preferred (maximum) height of the popover. */
  maxHeight?: number;
  /** Popover is at least this wide even if the trigger is narrower. */
  minWidth?: number;
  /** Open upwards when less than this much room is left below. */
  flipBelow?: number;
} = {}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const anchorRef = useRef<A>(null);
  const popoverRef = useRef<P>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Visible part of the top header (0 once it has scrolled away)
    const headerBottom = Math.max(
      0,
      document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
    );

    if (r.bottom <= headerBottom || r.top >= vh) {
      setOpen(false);
      return;
    }

    const width = Math.min(Math.max(r.width, minWidth), vw - EDGE * 2);
    const left = Math.min(Math.max(r.left, EDGE), vw - width - EDGE);
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - headerBottom - GAP - EDGE;
    const openUp = below < flipBelow && above > below;
    const height = Math.max(96, Math.min(maxHeight, openUp ? above : below));

    setPos(
      openUp
        ? { left, width, maxHeight: height, bottom: vh - r.top + GAP }
        : { left, width, maxHeight: height, top: r.bottom + GAP },
    );
  }, [maxHeight, minWidth, flipBelow]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();

    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePos);
    };
    // capture: also catches scrolling inside nested scroll containers
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const style: CSSProperties | undefined = pos
    ? {
        position: "fixed",
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        zIndex: 60,
      }
    : undefined;

  return { open, setOpen, anchorRef, popoverRef, style };
}
