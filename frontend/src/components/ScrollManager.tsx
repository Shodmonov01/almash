import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * React Router keeps the window where it was, so a new page used to open
 * mid-way down. New pages (push/replace) start at the top; going back (pop)
 * returns to where the user left that page.
 */
export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const currentKey = useRef(location.key);

  // We manage it ourselves; the browser's own restore fights with async pages.
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Remember the position continuously: reading it at navigation time is too
  // late, the next (shorter) page may already have clamped it.
  useEffect(() => {
    const onScroll = () => positions.current.set(currentKey.current, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    currentKey.current = location.key;
    const saved = positions.current.get(location.key);

    if (navType !== "POP" || saved == null) {
      window.scrollTo(0, 0);
      return;
    }
    // Going back: content may still be loading, retry briefly until it is tall enough.
    let raf = 0;
    const started = performance.now();
    const restore = () => {
      window.scrollTo(0, saved);
      if (Math.abs(window.scrollY - saved) > 2 && performance.now() - started < 800) {
        raf = requestAnimationFrame(restore);
      }
    };
    restore();
    return () => cancelAnimationFrame(raf);
  }, [location.key, navType]);

  return null;
}
