"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { API_URL } from "@/lib/api";
import { motionSpring } from "@/lib/motion-system";

type Token = {
  address: string;
  name: string;
  symbol: string;
  status: string;
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Token[]>([]);

  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((x) => !x);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch(API_URL + "/tokens?limit=100")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = items
    .filter((x) => !q || x.name.toLowerCase().includes(q) || x.symbol.toLowerCase().includes(q) || x.address.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <>
      <motion.button
        className="search-trigger"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.985 }}
        transition={motionSpring.spatialFast}
      >
        <span>Search tokens</span><kbd>⌘K</kbd>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="search-backdrop"
            onMouseDown={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSpring.effectsFast}
          >
            <motion.div
              className="search-modal"
              onMouseDown={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: -18, scale: 0.955 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.975 }}
              transition={{
                ...motionSpring.spatialDefault,
                opacity: motionSpring.effectsFast
              }}
              layout
            >
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search token, ticker, or address" />

              <LayoutGroup id="search-results">
                <motion.div className="search-results" layout transition={{ layout: motionSpring.spatialDefault }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {!filtered.length ? (
                      <motion.p
                        key="empty"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={motionSpring.effectsFast}
                        layout
                      >
                        No tokens found.
                      </motion.p>
                    ) : filtered.map((x, index) => (
                      <motion.a
                        layout
                        key={x.address}
                        href={"/token/" + x.address}
                        onClick={() => setOpen(false)}
                        initial={{ opacity: 0, y: 8, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.985 }}
                        transition={{
                          ...motionSpring.spatialFast,
                          delay: Math.min(index * 0.025, 0.12)
                        }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.985 }}
                      >
                        <motion.span className="search-avatar" layoutId={`search-avatar-${x.address}`}>
                          {x.symbol.slice(0,2)}
                        </motion.span>
                        <span><strong>{x.name}</strong><small>${x.symbol}</small></span>
                        <em>{x.status === "GRADUATED" ? "Graduated" : "Curve"}</em>
                      </motion.a>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </LayoutGroup>

              <motion.div className="search-help" layout="position">
                <span>Enter to open</span><span>Esc to close</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
