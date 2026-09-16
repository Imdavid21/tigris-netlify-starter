"use client";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { ui } from "@/styles/ui";
type Token = { address: string; name: string; symbol: string; status: string };
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(x => !x); } };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError(false);
    fetch(API_URL + "/tokens?limit=100").then(r => {if (!r.ok) throw new Error(); return r.json();})
      .then(data => {if(active) setItems(data.items ?? []);})
      .catch(() => {if(active) setError(true);}).finally(() => {if(active) setLoading(false);});
    return () => {active = false;};
  }, [open]);
  const q = query.trim().toLowerCase();
  const filtered = items.filter(x => !q || x.name.toLowerCase().includes(q) || x.symbol.toLowerCase().includes(q) || x.address.toLowerCase().includes(q)).slice(0,8);
  return <>
    <button className={ui("search-trigger")} onClick={() => setOpen(true)}><span>Search tokens</span><kbd>⌘K</kbd></button>
    <dialog ref={dialog} className={ui("search-modal")} aria-label="Search markets" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <div className={ui("search-dialog-head")}><input aria-label="Search markets" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, ticker, or address" onKeyDown={e => {if (e.key === "Enter" && filtered[0]) window.location.href = "/token/" + filtered[0].address;}}/><button type="button" aria-label="Close search" onClick={()=>setOpen(false)}>×</button></div>
      <div className={ui("search-results")}>
        {loading || error || !filtered.length ? <p>{loading ? "Searching markets…" : error ? "Search is temporarily unavailable." : "No matching markets."}</p> : filtered.map(x => <a key={x.address} href={"/token/"+x.address} onClick={()=>setOpen(false)}><span className={ui("search-avatar")}>{x.symbol.slice(0,2)}</span><span><strong>{x.name}</strong><small>{x.symbol}</small></span><em>{x.status === "GRADUATED" ? "Graduated" : "Curve"}</em></a>)}
        {/^(0x)[a-fA-F0-9]{40}$/.test(query.trim()) && <a href={"/token/" + query.trim()}>Open this contract address ↗</a>}
      </div>
      <div className={ui("search-help")}><span>Enter to open first result</span><span>Esc to close</span></div>
    </dialog>
  </>;
}
