export interface FxDef {
  description: string;
  /** Target file (components dir) or null for print-to-terminal effects */
  file: string | null;
  render: (opts?: Record<string, string>) => string;
}

function pixelCarSvg(size: number): string {
  return `<svg width="${size}" height="${Math.round(size * 0.7)}" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
          <rect x="4" y="12" width="32" height="8" fill="white"/>
          <rect x="10" y="6" width="16" height="6" fill="white"/>
          <rect x="22" y="7" width="6" height="5" fill="#555"/>
          <rect x="12" y="7" width="6" height="5" fill="#555"/>
          <rect x="28" y="18" width="8" height="8" rx="4" fill="white"/>
          <rect x="30" y="20" width="4" height="4" rx="2" fill="#333"/>
          <rect x="6" y="18" width="8" height="8" rx="4" fill="white"/>
          <rect x="8" y="20" width="4" height="4" rx="2" fill="#333"/>
          <rect x="34" y="14" width="4" height="3" fill="#ffd700"/>
          <rect x="2" y="14" width="3" height="3" fill="#ff3333"/>
        </svg>`;
}

export const FX: Record<string, FxDef> = {
  cursor: {
    description: "Pixel supercar that trails the cursor, steers into motion, boosts on click (desktop only)",
    file: "CursorFollower.tsx",
    render: () => `"use client";

import { useEffect, useRef } from "react";

interface CursorFollowerProps {
  size?: number;
  offsetX?: number;
  offsetY?: number;
}

export default function CursorFollower({ size = 52, offsetX = 26, offsetY = 30 }: CursorFollowerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my, angle = 0, boost = 0, visible = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (!visible) { visible = true; el.style.opacity = "1"; cx = mx + offsetX; cy = my + offsetY; }
    };
    const onDown = () => { boost = 1; };
    const onLeave = () => { visible = false; el.style.opacity = "0"; };

    const lerpAngle = (a: number, b: number, t: number) => {
      let d = (b - a) % 360;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return a + d * t;
    };

    const tick = () => {
      const ease = 0.1 + boost * 0.3;
      const tx = mx + offsetX, ty = my + offsetY;
      const vx = tx - cx, vy = ty - cy;
      cx += vx * ease; cy += vy * ease;
      const speed = Math.hypot(vx, vy);
      const target = speed > 2 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;
      angle = lerpAngle(angle, target, speed > 2 ? 0.12 : 0.06);
      boost *= 0.9;
      el.style.transform =
        \`translate3d(\${cx}px, \${cy}px, 0) translate(-50%, -50%) rotate(\${angle}deg) scale(\${1 + boost * 0.35})\`;
      raf = requestAnimationFrame(tick);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mousedown", onDown);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [offsetX, offsetY]);

  return (
    <div ref={ref} className="pointer-events-none fixed left-0 top-0 z-[70] select-none opacity-0" aria-hidden="true">
      ${pixelCarSvg(52).replace('width="52"', 'width={size}').replace('height="36"', 'height={Math.round(size * 0.7)}')}
    </div>
  );
}
`,
  },

  badge: {
    description: "Fixed pixel-art badge pinned at exact coordinates (e.g. covering a video watermark)",
    file: "PixelBadge.tsx",
    render: () => `"use client";

interface PixelBadgeProps {
  left?: number;
  top?: number;
  width?: number;
  zIndex?: number;
}

export default function PixelBadge({ left = 24, top, bottom = 80, width = 110, zIndex = 60 }: PixelBadgeProps & { bottom?: number }) {
  const style: React.CSSProperties =
    top !== undefined ? { left, top, width } : { left, bottom, width };
  return (
    <div className="pointer-events-none fixed select-none" style={{ ...style, zIndex }}>
      ${pixelCarSvg(110).replace('width="110"', 'width="100%"').replace('height="77"', 'height="auto"')}
    </div>
  );
}
`,
  },

  progress: {
    description: "Scroll progress rail (top or bottom) + optional frame counter hookup",
    file: "ScrollProgress.tsx",
    render: () => `"use client";

import { useEffect, useRef } from "react";

interface ScrollProgressProps {
  position?: "top" | "bottom";
  onProgress?: (pct: number) => void;
}

export default function ScrollProgress({ position = "bottom", onProgress }: ScrollProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (barRef.current) barRef.current.style.width = \`\${pct * 100}%\`;
      onProgress?.(pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onProgress]);

  return (
    <div className={\`fixed left-0 right-0 z-50 h-[2px] bg-white/10 \${position === "top" ? "top-0" : "bottom-0"}\`}>
      <div ref={barRef} className="h-full bg-white" style={{ width: "0%", willChange: "width" }} />
    </div>
  );
}
`,
  },

  reveal: {
    description: "useReveal() hook — IntersectionObserver driver for .reveal elements",
    file: "useReveal.ts",
    render: () => `import { useEffect } from "react";

/** Adds .visible to .reveal elements as they enter the viewport. Call once per page. */
export function useReveal(): void {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      }),
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}
`,
  },

  favicon: {
    description: "Generate a custom icon.svg (letter mark) — no more default Next.js favicon",
    file: "icon.svg",
    render: (opts = {}) => {
      const letter = (opts.letter ?? "A").slice(0, 2);
      const bg = opts.bg ?? "#000000";
      const fg = opts.fg ?? "#ffffff";
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="none" stroke="${fg}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="30" y="44" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="800" fill="${fg}" text-anchor="middle">${letter}</text>
  <circle cx="46" cy="44" r="4" fill="${fg}" fill-opacity="0.4"/>
</svg>
`;
    },
  },

  smooth: {
    description: "Print the one-line smooth-scroll CSS for anchor links",
    file: null,
    render: () => `html {
  scroll-behavior: smooth;
}

/* Add to your globals.css — navbar anchor jumps will glide instead of snap. */
`,
  },

  marquee: {
    description: "Infinite scrolling text/logo band",
    file: "Marquee.tsx",
    render: () => `interface MarqueeProps {
  items?: string[];
  speed?: number;
}

export default function Marquee({ items = ["FAST", "BOLD", "ALIVE"], speed = 22 }: MarqueeProps) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="relative z-10 overflow-hidden border-y border-white/10 py-4 select-none" aria-hidden="true">
      <div
        className="flex w-max whitespace-nowrap gap-10 animate-[marquee_linear_infinite]"
        style={{ animationDuration: \`\${speed}s\` }}
      >
        {row.map((t, i) => (
          <span key={i} className="text-sm tracking-[0.3em] uppercase opacity-40">
            {t} <span className="ml-10 opacity-50">✦</span>
          </span>
        ))}
      </div>
      <style>{\`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      \`}</style>
    </div>
  );
}
`,
  },

  preloader: {
    description: "Branded loading veil that fades out on first paint",
    file: "Preloader.tsx",
    render: () => `"use client";

import { useEffect, useState } from "react";

interface PreloaderProps {
  word?: string;
  minMs?: number;
}

export default function Preloader({ word = "LOADING", minMs = 900 }: PreloaderProps) {
  const [gone, setGone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t0 = performance.now();
    const finish = () => {
      const wait = Math.max(0, minMs - (performance.now() - t0));
      setTimeout(() => {
        setGone(true);
        setTimeout(() => setHidden(true), 600);
      }, wait);
    };
    if (document.readyState === "complete") finish();
    else {
      window.addEventListener("load", finish, { once: true });
      setTimeout(finish, 4000); // never trap the visitor
    }
  }, [minMs]);

  if (hidden) return null;
  return (
    <div
      className={\`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 \${gone ? "opacity-0 pointer-events-none" : "opacity-100"}\`}
      aria-hidden="true"
    >
      <p className="text-[11px] tracking-[0.4em] uppercase animate-pulse">{word}</p>
    </div>
  );
}
`,
  },

  magnetic: {
    description: "Wrapper that pulls its child toward the cursor (magnetic hover)",
    file: "Magnetic.tsx",
    render: () => `"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

export default function Magnetic({ children, strength = 0.35, className = "" }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = \`translate(\${x * strength}px, \${y * strength}px)\`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "translate(0, 0)";
    setTimeout(() => { if (ref.current) ref.current.style.transition = ""; }, 500);
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={\`inline-block \${className}\`}>
      {children}
    </div>
  );
}
`,
  },
};
