"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, type IndexedTrade } from "@/lib/api";
import styles from "./PriceChart.module.css";

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

function priceLabel(value: number) {
  if (value >= 1) return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return "$" + value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}

export function PriceChart({ token }: { token: string }) {
  const [trades, setTrades] = useState<IndexedTrade[]>([]);
  const [range, setRange] = useState<Range>("1h");
  const [hoverIndex, setHoverIndex] = useState<number>();

  useEffect(() => {
    fetch(API_URL + "/tokens/" + token)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setTrades(data?.trades ?? []))
      .catch(() => {});
  }, [token]);

  const points = useMemo(() => {
    const duration = ranges.find(([id]) => id === range)?.[2] ?? null;
    const cutoff = duration ? Date.now() - duration : 0;

    return trades
      .filter((trade) => !duration || new Date(trade.block_time).getTime() >= cutoff)
      .map((trade) => ({
        time: new Date(trade.block_time).getTime(),
        price: priceOf(trade)
      }))
      .filter((point) => Number.isFinite(point.price) && point.price > 0)
      .sort((a, b) => a.time - b.time);
  }, [trades, range]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = Math.max(max - min, max * 0.001);
    const coords = points.map((point, index) => {
      const x = (index / (points.length - 1)) * 1000;
      const y = 280 - ((point.price - min) / spread) * 240;
      return { x, y };
    });
    const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");

    return {
      min,
      max,
      coords,
      line,
      area: `0,300 ${line} 1000,300`
    };
  }, [points]);

  const latest = points.at(-1)?.price;
  const hovered = hoverIndex === undefined ? undefined : points[hoverIndex];
  const hoveredCoord = geometry && hoverIndex !== undefined ? geometry.coords[hoverIndex] : undefined;

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!geometry || points.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <div className={`chart-card ${styles.card}`}>
      <div className={styles.head}>
        <div className={styles.price}>
          <span>Price</span>
          <strong>{latest ? priceLabel(latest) : "—"}</strong>
        </div>

        <div className={styles.ranges} aria-label="Chart range">
          {ranges.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={range === id ? styles.active : ""}
              onClick={() => {
                setRange(id);
                setHoverIndex(undefined);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.stage}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(undefined)}
      >
        {geometry ? (
          <>
            <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="Token price history">
              <polygon points={geometry.area} className={styles.area} />
              <polyline points={geometry.line} className={styles.line} />
              {hoveredCoord && (
                <>
                  <line x1={hoveredCoord.x} x2={hoveredCoord.x} y1="0" y2="300" className={styles.crosshair} />
                  <circle cx={hoveredCoord.x} cy={hoveredCoord.y} r="4" className={styles.dot} />
                </>
              )}
            </svg>
            <div className={styles.axis} aria-hidden="true">
              <span>{priceLabel(geometry.max)}</span>
              <span>{priceLabel((geometry.max + geometry.min) / 2)}</span>
              <span>{priceLabel(geometry.min)}</span>
            </div>
            {hovered && (
              <div className={styles.tooltip}>
                <strong>{priceLabel(hovered.price)}</strong>
                <span>{new Date(hovered.time).toLocaleString()}</span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.empty}>Price history appears after at least two indexed trades.</div>
        )}
      </div>
    </div>
  );
}
