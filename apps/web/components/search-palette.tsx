"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { animateMaterialSpring } from "@/lib/material-motion";

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
  const modalRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open || !modalRef.current) return;
    const animation = animateMaterialSpring(
      modalRef.current,
      "spatialDefault",
      (progress) => ({
        opacity: Math.min(1, Math.max(0, progress)),
        transform: `translateY(${(-14 * (1 - progress)).toFixed(3)}px) scale(${(0.965 + 0.035 * progress).toFixed(4)})`
      })
    );
    return () => animation?.cancel();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = items
    .filter((x) => !q || x.name.toLowerCase().includes(q) || x.symbol.toLowerCase().includes(q) || x.address.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <>
      <button className="search-trigger" onClick={() => setOpen(true)}>
        <span>Search tokens</span><kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="search-backdrop" onMouseDown={() => setOpen(false)}>
          <div ref={modalRef} className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search token, ticker, or address" />
            <div className="search-results">
              {!filtered.length ? <p>No tokens found.</p> : filtered.map((x) => (
                <a key={x.address} href={"/token/" + x.address} onClick={() => setOpen(false)}>
                  <span className="search-avatar">{x.symbol.slice(0,2)}</span>
                  <span><strong>{x.name}</strong><small>${x.symbol}</small></span>
                  <em>{x.status === "GRADUATED" ? "Graduated" : "Curve"}</em>
                </a>
              ))}
            </div>
            <div className="search-help"><span>Enter to open</span><span>Esc to close</span></div>
          </div>
        </div>
      )}
    </>
  );
}
