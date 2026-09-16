"use client";
import { ui } from "@/styles/ui";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { API_URL, type IndexedTrade } from "@/lib/api";
export function RecentTrades({ token, quoteDecimals = 6, quoteSymbol = "USDC" }: { token: string; quoteDecimals?: number; quoteSymbol?: string }) {
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setPage(1);
    fetch(API_URL + "/tokens/" + token)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setTrades(data?.trades ?? []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  return <section className={ui("data-panel")}>
    <div className={ui("section-title")}><strong>Recent trades</strong><span>On Arc</span></div>
    <table className={ui("data-table")}><thead><tr><th scope="col">Side</th><th scope="col">Wallet</th><th scope="col">Amount</th></tr></thead><tbody>
      {loading || error || !trades.length ? <tr><td colSpan={3}>{loading ? "Loading trades…" : error ? "Trade history is temporarily unavailable." : "No indexed trades yet."}</td></tr> : trades.slice((page-1)*10,page*10).map((trade,index) => <tr key={trade.tx_hash + index}><td className={ui(trade.side === "BUY" ? "buy" : "sell")}><a href={"https://testnet.arcscan.app/tx/" + trade.tx_hash} target="_blank" rel="noreferrer">{trade.side === "BUY" ? "Buy" : "Sell"} ↗</a></td><td><a href={"https://testnet.arcscan.app/address/" + trade.trader} target="_blank" rel="noreferrer" title={trade.trader}>{trade.trader.slice(0,6)}...{trade.trader.slice(-4)}</a></td><td>{Number(formatUnits(BigInt(trade.quote_amount),quoteDecimals)).toLocaleString(undefined,{maximumFractionDigits:6})} {quoteSymbol}</td></tr>)}
    </tbody></table>
    {trades.length > 10 && <nav className={ui("pagination")} aria-label="Trade pages"><button disabled={page === 1} onClick={() => setPage(p=>p-1)}>Previous</button><span>{page} / {Math.ceil(trades.length/10)}</span><button disabled={page*10 >= trades.length} onClick={() => setPage(p=>p+1)}>Next</button></nav>}
  </section>;
}
