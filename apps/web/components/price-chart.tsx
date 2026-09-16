"use client";
import { ui } from "@/styles/ui";


import { useEffect, useMemo, useState } from "react";
import { API_URL, type IndexedTrade } from "@/lib/api";

type Range = "5m" | "1h" | "6h" | "1d" | "all";

const ranges: Array<[Range, string, number | null]> = [
  ["5m", "5M", 5 * 60_000],
  ["1h", "1H", 60 * 60_000],
  ["6h", "6H", 6 * 60 * 60_000],
  ["1d", "1D", 24 * 60 * 60_000],
  ["all", "ALL", null]
];

function priceOf(trade: IndexedTrade, decimals: number) {
  const quote = Number(trade.quote_amount) / 10 ** decimals;
  const tokens = Number(trade.token_amount) / 1e18;
  return tokens > 0 ? quote / tokens : 0;
}

export function PriceChart({ token, quoteDecimals = 6, quoteSymbol = "USDC" }: { token: string; quoteDecimals?: number; quoteSymbol?: string }) {
  const [hover, setHover] = useState<number>();
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [range, setRange] = useState<Range>("1h");

  useEffect(() => {
    fetch(API_URL + "/tokens/" + token)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTrades(data?.trades ?? []))
      .catch(() => {});
  }, [token]);

  const points = useMemo(() => {
    const duration = ranges.find(([id]) => id === range)?.[2] ?? null;
    const cutoff = duration ? Date.now() - duration : 0;

    return trades
      .filter((x) => !duration || new Date(x.block_time).getTime() >= cutoff)
      .map((x) => ({
        time: new Date(x.block_time).getTime(),
        price: priceOf(x, quoteDecimals)
      }))
      .filter((x) => Number.isFinite(x.price) && x.price > 0)
      .sort((a, b) => a.time - b.time);
  }, [trades, range, quoteDecimals]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const prices = points.map((x) => x.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(max - min, max * 0.001);

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * 1000;
      const y = 280 - ((p.price - min) / spread) * 240;
      return [x, y] as const;
    });

    return {
      min,
      max,
      coords,
      line: coords.map(([x, y]) => x + "," + y).join(" ")
    };
  }, [points]);

  const latest = points.at(-1)?.price;

  return (
    <div className={ui("chart-card")}>
      <div className={ui("chart-head")}>
        <div>
          <span className={ui("muted")}>Price</span>
          <strong>
            {latest
              ? quoteSymbol + " " +
                latest.toLocaleString(undefined, {
                  maximumSignificantDigits: 6
                })
              : "—"}
          </strong>
        </div>

        <div className={ui("chart-ranges")}>
          {ranges.map(([id, label]) => (
            <button
              key={id}
              className={ui(range === id ? "active" : "")}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui("chart-stage")} onMouseLeave={() => setHover(undefined)} onMouseMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - rect.left) / rect.width * (points.length - 1))))); }}>
        {geometry ? (
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label={quoteSymbol + " price history"}>
            <polygon points={"0,300 " + geometry.line + " 1000,300"} fill="currentColor" opacity=".07" />
            {geometry.coords.map(([x,y], i) => hover === i ? <g key={i}><line x1={x} x2={x} y1="0" y2="300" stroke="currentColor" strokeDasharray="3 4" opacity=".35"/><circle cx={x} cy={y} r="4" fill="currentColor"/></g> : null)}
            <polyline
              points={geometry.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className={ui("chart-empty")}>
            Price history appears after at least two indexed trades.
          </div>
        )}
        {hover !== undefined && points[hover] && <div className={ui("chart-tooltip")}>{points[hover].price.toPrecision(5)} {quoteSymbol}<br />{new Date(points[hover].time).toLocaleString()}</div>}
      </div>
      {points.length > 1 && <div className={ui("chart-axis")}><span>{new Date(points[0].time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span><span>{new Date(points[points.length-1].time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div>}
    </div>
  );
}
