"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import styles from "./AnalyticsCharts.module.css";

export type AnalyticsChartPoint = {
  time: number;
  value: number;
  label?: string;
};

type Kind = "area" | "bar";
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

function compact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function timeToMs(time: Time) {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(time).getTime();
  return Date.UTC(time.year, time.month - 1, time.day);
}

export function AnalyticsChart({
  title,
  points,
  kind = "area",
  format = "compact",
  rangesEnabled = false,
  defaultRange = "30d"
}: {
  title: string;
  points: AnalyticsChartPoint[];
  kind?: Kind;
  format?: "compact" | "percent";
  rangesEnabled?: boolean;
  defaultRange?: Range;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>(defaultRange);
  const [hovered, setHovered] = useState<{ time: number; value: number; label?: string }>();
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((value) => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(() => {
    if (!rangesEnabled || range === "all") return points;
    const days = ranges.find(([id]) => id === range)?.[2] ?? null;
    if (!days) return points;
    const cutoff = Date.now() - days * 86_400_000;
    return points.filter((point) => point.time * 1000 >= cutoff);
  }, [points, range, rangesEnabled]);

  const latest = visible.at(-1);
  const displayed = hovered ?? (latest ? { time: latest.time * 1000, value: latest.value, label: latest.label } : undefined);
  const formatter = format === "percent" ? percent : compact;

  useEffect(() => {
    const container = mountRef.current;
    if (!container || visible.length < 2) return;

    const primary = cssColor("--md-sys-color-primary", "#435400");
    const surface = cssColor("--md-sys-color-surface-container-lowest", "#ffffff");
    const text = cssColor("--md-sys-color-on-surface-variant", "#47483e");
    const outline = cssColor("--md-sys-color-outline-variant", "#c8c8ba");
    const inverse = cssColor("--md-sys-color-inverse-surface", "#30312b");

    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: surface },
        textColor: text,
        fontFamily: '\"Roboto Flex\", \"Roboto\", system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: true
      },
      localization: { priceFormatter: formatter },
      grid: {
        vertLines: { color: withAlpha(outline, 0.34), style: LineStyle.Dotted },
        horzLines: { color: withAlpha(outline, 0.34), style: LineStyle.Dotted }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: withAlpha(text, 0.5), style: LineStyle.Dashed, labelBackgroundColor: inverse },
        horzLine: { color: withAlpha(text, 0.34), style: LineStyle.Dashed, labelBackgroundColor: inverse }
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.13, bottom: 0.12 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 2, minBarSpacing: 3, fixLeftEdge: true },
      handleScroll: true,
      handleScale: true
    });

    let series: ISeriesApi<"Area"> | ISeriesApi<"Histogram">;
    if (kind === "bar") {
      series = chart.addSeries(HistogramSeries, {
        color: primary,
        priceFormat: { type: "custom", formatter, minMove: format === "percent" ? 0.01 : 1 },
        lastValueVisible: false,
        priceLineVisible: false
      });
    } else {
      series = chart.addSeries(AreaSeries, {
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
        priceFormat: { type: "custom", formatter, minMove: format === "percent" ? 0.01 : 1 }
      });
    }

    series.setData(visible.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })) as any);
    chart.timeScale().fitContent();

    const onCrosshair = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) return setHovered(undefined);
      const datum = param.seriesData.get(series as any) as { value?: number } | undefined;
      if (!datum || typeof datum.value !== "number") return setHovered(undefined);
      const ms = timeToMs(param.time);
      const nearest = visible.reduce((best, point) => Math.abs(point.time * 1000 - ms) < Math.abs(best.time * 1000 - ms) ? point : best, visible[0]);
      setHovered({ time: ms, value: datum.value, label: nearest?.label });
    };

    chart.subscribeCrosshairMove(onCrosshair);
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
    };
  }, [visible, themeVersion, kind, format, formatter]);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h3>{title}</h3>
          <div className={styles.valueRow}>
            <strong>{displayed ? formatter(displayed.value) : "—"}</strong>
            {hovered && <span>{displayed?.label ?? new Date(hovered.time).toLocaleString()}</span>}
          </div>
        </div>
        {rangesEnabled && (
          <div className={styles.ranges} aria-label={`${title} range`}>
            {ranges.map(([id, label]) => (
              <button key={id} type="button" className={range === id ? styles.active : ""} onClick={() => { setRange(id); setHovered(undefined); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.stage}>
        {visible.length >= 2 ? <div ref={mountRef} className={styles.mount} aria-label={`Interactive ${title} chart`} /> : <div className={styles.empty}>Not enough history yet.</div>}
      </div>
    </div>
  );
}
