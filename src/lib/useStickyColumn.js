import { useEffect } from "react";

// Desktop side columns: scroll with the page until their bottom reaches the bottom of the
// window, then stay put (like X / LinkedIn). If the column is shorter than the window it just
// sticks under the header. Sets `top` on a `position: sticky` element; nothing is clipped.
export default function useStickyColumn(ref, dep, gap = 12) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = () => {
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--snaprium-header-h"), 10) || 64;
      const stickTop = headerH + gap;
      const fit = window.innerHeight - el.offsetHeight - gap;
      el.style.top = `${Math.min(stickTop, fit)}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      el.style.top = "";
    };
  }, [ref, dep, gap]);
}