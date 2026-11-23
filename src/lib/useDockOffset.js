import { useEffect } from "react";

// Keeps a bottom-pinned reply bar (phones and the iPhone app) in the right place:
//  --fd-nav  = height of a bottom tab bar if one is showing (the iPhone app has one), so the bar sits above it
//  --fd-kb   = height of the on-screen keyboard, so the bar rides on top of the keyboard instead of hiding behind it
//  --fd-pad  = safe-area space under the bar, only when nothing else is below it
export default function useDockOffset(active) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const apply = () => {
      const n = document.querySelector(".bottom-nav");
      const navRaw = n && getComputedStyle(n).display !== "none" ? Math.round(n.getBoundingClientRect().height) : 0;
      const vv = window.visualViewport;
      const k = vv ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : 0;
      const kb = k > 80 ? k : 0; // small differences are browser bars, not a keyboard
      const navH = kb ? 0 : navRaw; // the keyboard covers the tab bar
      root.style.setProperty("--fd-nav", `${navH}px`);
      root.style.setProperty("--fd-kb", `${kb}px`);
      root.style.setProperty("--fd-pad", navH || kb ? "0px" : "env(safe-area-inset-bottom, 0px)");
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    const nav = document.querySelector(".bottom-nav");
    const ro = nav && typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (ro) ro.observe(nav);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      ro?.disconnect();
      ["--fd-nav", "--fd-kb", "--fd-pad"].forEach((p) => root.style.removeProperty(p));
    };
  }, [active]);
}