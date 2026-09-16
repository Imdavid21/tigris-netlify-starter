"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type MouseEventParams,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import styles from "./ArcActivityChart.module.css";

type Point = { date: string; transactions: number };
type Range = "7d" | "30d" | "90d" | "all";

const ranges: Array<[Range, string, number | null]> = [
  ["7d", "7D", 7],
  ["30d", "30D", 30],
  ["90d", "90D", 90],
  ["all", "ALL", null]
];

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color: string, opacity: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const raw = Number.parseInt(match[1], 16);
  return `rgba(${(raw >> 16) & 255}, ${(raw >> 8) & 255}, ${raw & 255}, ${opacity})`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function timeToMs(time: Time) {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(time).getTime();
  return Date.UTC(time.year, time.month - 1, time.day);
}

export function ArcActivityChart({ points }: { points: Point[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("30d");
  const [hovered, setHovered] = useState<{ time: number; value: number }>();
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((value) => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(() => {
    const days = ranges.find(([id]) => id === range)?.[2] ?? null;
    const source = days ? points.slice(-days) : points;
    return source
      .map((point) => ({
        time: Math.floor(new Date(point.date).getTime() / 1000) as UTCTimestamp,
        value: Number(point.transactions)
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value) && point.value >= 0);
  }, [points, range]);

  const latest = visible.at(-1);
  const displayed = hovered ?? (latest ? { time: Number(latest.time) * 1000, value: latest.value } : undefined);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || visible.length < 2) return;

    const primary = cssColor("--md-sys-color-primary", "#435400");
    const surface = cssColor("--md-sys-color-surface-container-lowest", "#ffffff");
    const text = cssColor("--md-sys-color-on-surface-variant", "#47483e");
    const outline = cssColor("--md-sys-color-outline-variant", "#c8c8ba");
    const inverse = cssColor("--md-sys-color-inverse-surface", "#30312b");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: surface },
        textColor: text,
        fontFamily: '\"Roboto Flex\", \"Roboto\", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: true
      },
      localization: { priceFormatter: formatNumber },
      grid: {
        vertLines: { color: withAlpha(outline, 0.38), style: LineStyle.Dotted },
        horzLines: { color: withAlpha(outline, 0.38), style: LineStyle.Dotted }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: withAlpha(text, 0.5), style: LineStyle.Dashed, labelBackgroundColor: inverse },
        horzLine: { color: withAlpha(text, 0.38), style: LineStyle.Dashed, labelBackgroundColor: inverse }
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: false, rightOffset: 2, minBarSpacing: 3, fixLeftEdge: true },
      handleScroll: true,
      handleScale: true
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: primary,
      topColor: withAlpha(primary, 0.2),
      bottomColor: withAlpha(primary, 0.015),
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: surface,
      crosshairMarkerBackgroundColor: primary,
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: "custom", formatter: formatNumber, minMove: 1 }
    });

    series.setData(visible);
    chart.timeScale().fitContent();

    const onCrosshair = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) return setHovered(undefined);
      const datum = param.seriesData.get(series) as { value?: number } | undefined;
      if (!datum || typeof datum.value !== "number") return setHovered(undefined);
      setHovered({ time: timeToMs(param.time), value: datum.value });
    };

    chart.subscribeCrosshairMove(onCrosshair);
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
    };
  }, [visible, themeVersion]);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <span className={styles.label}>{hovered ? new Date(hovered.time).toLocaleDateString() : "Arc transactions"}</span>
          <strong>{displayed ? formatNumber(displayed.value) : "—"}</strong>
        </div>
        <div className={styles.ranges} aria-label="Arc activity chart range">
          {ranges.map(([id, label]) => (
            <button key={id} type="button" className={range === id ? styles.active : ""} onClick={() => { setRange(id); setHovered(undefined); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.stage}>
        {visible.length >= 2 ? <div ref={chartRef} className={styles.mount} aria-label="Interactive Arc transaction activity chart" /> : <div className={styles.empty}>Historical Arc transaction data will appear when Blockscout returns at least two points.</div>}
      </div>
    </div>
  );
}
