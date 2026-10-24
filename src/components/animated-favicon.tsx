"use client";

import { useEffect } from "react";

// Swap pre-rendered PNGs: CSS/SVG animation inside favicons is not portable.
export function AnimatedFavicon() {
  useEffect(() => {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.dataset.animatedFavicon = "true";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frames = Array.from({ length: 12 }, (_, index) => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = "#240442";
      ctx.beginPath();
      ctx.roundRect(0, 0, 32, 32, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fill(
        new Path2D(
          "M8 9h13a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-7l-6 4v-4a4 4 0 0 1-4-4v-7a4 4 0 0 1 4-4Z",
        ),
      );
      ctx.strokeStyle = "#240442";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke(new Path2D("M9 16h10M9 20h6"));
      ctx.save();
      ctx.translate(24, 10);
      const scale = 0.82 + 0.18 * Math.cos((index * Math.PI) / 6);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffe08a";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      const star = new Path2D(
        "M0-8 2.3-2.3 8 0 2.3 2.3 0 8-2.3 2.3-8 0-2.3-2.3Z",
      );
      ctx.fill(star);
      ctx.stroke(star);
      ctx.restore();
      return canvas.toDataURL("image/png");
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    let frame = 0;
    function sync() {
      clearInterval(timer);
      icon.remove();
      if (motion.matches || document.hidden) return;
      timer = setInterval(() => {
        icon.href = frames[frame++ % frames.length];
        // Own this node instead of mutating React-managed metadata.
        document.head.append(icon);
      }, 200);
    }
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      icon.remove();
    };
  }, []);
  return null;
}
