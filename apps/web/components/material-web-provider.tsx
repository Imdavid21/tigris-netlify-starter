"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { motionSpring } from "@/lib/motion-system";
import { PulseLadderLoader } from "@/components/dotmatrix/celestial-loaders";

const MaterialWebContext = createContext(false);

export function useMaterialWebReady() {
  return useContext(MaterialWebContext);
}

export function MaterialWebProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      import("@/lib/material-web-catalog"),
      import("@material/web/typography/md-typescale-styles.js")
    ])
      .then(([, typography]) => {
        const sheet = typography.styles?.styleSheet;
        if (sheet && "adoptedStyleSheets" in document && !document.adoptedStyleSheets.includes(sheet)) {
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <MaterialWebContext.Provider value={ready}>
      <div data-material-web={ready ? "ready" : "loading"}>
        {children}
        <AnimatePresence>
          {!ready && (
            <motion.div
              role="status"
              aria-label="Preparing interface"
              initial={{ opacity: 0, y: -8, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: .97 }}
              transition={motionSpring.spatialFast}
              style={{
                position: "fixed",
                top: 12,
                right: 12,
                zIndex: 9999,
                pointerEvents: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 38,
                padding: "6px 10px",
                borderRadius: "var(--md-sys-shape-corner-full)",
                background: "var(--md-sys-color-surface-container-high)",
                color: "var(--md-sys-color-on-surface-variant)",
                boxShadow: "var(--md-sys-elevation-level1)"
              }}
            >
              <PulseLadderLoader size={24} dotSize={2.7} speed={1.2} ariaLabel="Preparing Material interface" />
              <span className="md-typescale-label-small">Preparing interface</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MaterialWebContext.Provider>
  );
}
