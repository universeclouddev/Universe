"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AmbientBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="orb orb-teal absolute -left-32 top-0 h-[480px] w-[480px] rounded-full"
        animate={reducedMotion ? undefined : { x: [0, 50, 0], y: [0, 35, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="orb orb-violet absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full"
        animate={reducedMotion ? undefined : { x: [0, -40, 0], y: [0, 30, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="orb orb-amber absolute bottom-0 left-1/4 h-[320px] w-[320px] rounded-full"
        animate={reducedMotion ? undefined : { x: [0, 30, 0], y: [0, -25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 6 }}
      />
      <div className="noise-overlay absolute inset-0 opacity-[0.012]" />
      <div className="grid-overlay absolute inset-0" />
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/15 to-transparent"
        aria-hidden
      />
    </div>
  );
}
