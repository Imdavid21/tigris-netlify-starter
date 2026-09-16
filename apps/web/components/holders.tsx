"use client";
import { ui } from "@/styles/ui";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL } from "@/lib/api";
type Holder = { holder: string; balance: string };
export function Holders({ token }: { token: string }) {
  const [items, setItems] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setPage(1);
    fetch(API_URL + "/tokens/" + token + "/holders")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setItems(data.items ?? []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  return <section className={ui("data-panel")}>
    <div className={ui("section-title")}><strong>Top holders</strong><span>Token balances</span></div>
    <table className={ui("data-table")}><thead><tr><th scope="col">#</th><th scope="col">Wallet</th><th scope="col">Balance</th></tr></thead><tbody>
    {loading || error || !items.length ? <tr><td colSpan={3}>{loading ? "Loading holders…" : error ? "Holder data is temporarily unavailable." : "No indexed holders yet."}</td></tr> : items.slice((page - 1) * 10, page * 10).map((item,index) => <tr key={item.holder}><td>{(page - 1) * 10 + index + 1}</td><td><a href={"https://testnet.arcscan.app/address/" + item.holder} target="_blank" rel="noreferrer" title={item.holder}>{item.holder.slice(0,7)}...{item.holder.slice(-5)} ↗</a></td><td>{Number(formatUnits(BigInt(item.balance),18)).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>)}
    </tbody></table>
    {items.length > 10 && <nav className={ui("pagination")} aria-label="Holder pages"><button disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</button><span>{page} / {Math.ceil(items.length/10)}</span><button disabled={page*10 >= items.length} onClick={() => setPage(p => p+1)}>Next</button></nav>}
  </section>;
}
