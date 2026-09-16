"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { motionSpring } from "@/lib/motion-system";

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
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionSpring.effectsFast}
              style={{
                position: "fixed",
                insetInline: 0,
                top: 0,
                height: 2,
                zIndex: 9999,
                pointerEvents: "none",
                overflow: "hidden"
              }}
            >
              <motion.div
                initial={{ x: "-35%", width: "30%" }}
                animate={{ x: ["-35%", "135%"] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  height: "100%",
                  background: "var(--md-sys-color-primary)"
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MaterialWebContext.Provider>
  );
}
