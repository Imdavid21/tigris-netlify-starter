"use client";

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

function priceOf(trade: IndexedTrade) {
  const quote = Number(trade.quote_amount) / 1e6;
  const tokens = Number(trade.token_amount) / 1e18;
  return tokens > 0 ? quote / tokens : 0;
}

export function PriceChart({ token }: { token: string }) {
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
        price: priceOf(x)
      }))
      .filter((x) => Number.isFinite(x.price) && x.price > 0)
      .sort((a, b) => a.time - b.time);
  }, [trades, range]);

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
      line: coords.map(([x, y]) => x + "," + y).join(" ")
    };
  }, [points]);

  const latest = points.at(-1)?.price;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <span className="muted">Price</span>
          <strong>
            {latest
              ? "$" +
                latest.toLocaleString(undefined, {
                  maximumSignificantDigits: 6
                })
              : "—"}
          </strong>
        </div>

        <div className="chart-ranges">
          {ranges.map(([id, label]) => (
            <button
              key={id}
              className={range === id ? "active" : ""}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-stage">
        {geometry ? (
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img">
            <polyline
              points={geometry.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="chart-empty">
            Price history appears after at least two indexed trades.
          </div>
        )}
      </div>
    </div>
  );
}
