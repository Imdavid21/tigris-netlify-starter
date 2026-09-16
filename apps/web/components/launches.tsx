"use client";
import { ui } from "@/styles/ui";

import { useEffect, useMemo, useState } from "react";
import {
  MarketCard,
  progress,
  type Launch,
  type IndexedLaunch,
} from "./market-card";
type Sort = "activity" | "newest" | "oldest" | "graduation" | "volume";
import { curveAbi } from "@/lib/abi";
import { API_URL } from "@/lib/api";
import { createArcPublicClient } from "@/lib/rpc";

export function Launches() {
  const [items, setItems] = useState<Launch[]>([]);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [pair, setPair] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("activity");
  const [windowFilter, setWindowFilter] = useState<"all" | "24h" | "7d">("all");

  useEffect(() => {
    let active = true;
    const client = createArcPublicClient();
    setLoading(true);
    setError(undefined);

    (async () => {
      try {
        const response = await fetch(API_URL + "/tokens?limit=100", {signal: AbortSignal.timeout(12000)});
        if (!response.ok)
          throw new Error("Market index is temporarily unavailable.");
        const payload = await response.json();
        const indexed = (payload.items ?? []) as IndexedLaunch[];

        if (active) {
          setItems(indexed);
          setLoading(false);
        }
        const enriched = await Promise.all(
          indexed.map(async (item): Promise<Launch> => {
            if (!item.curve_address || item.status === "GRADUATED") return item;
            try {
              const [raised, threshold] = await Promise.all([
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "trackedQuote",
                }),
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "graduationThreshold",
                }),
              ]);
              return {
                ...item,
                raised: raised as bigint,
                threshold: threshold as bigint,
              };
            } catch {
              return item;
            }
          }),
        );

        if (active) setItems(enriched);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Failed to load markets.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [retry]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      windowFilter === "24h"
        ? now - 86_400_000
        : windowFilter === "7d"
          ? now - 604_800_000
          : 0;

    const matches = items.filter((x) => {
      const matchQuery =
        !q ||
        x.name.toLowerCase().includes(q) ||
        x.symbol.toLowerCase().includes(q) ||
        x.address.toLowerCase().includes(q);
      const time = new Date(x.last_trade_at ?? x.created_at ?? 0).getTime();
      const matchPair =
        pair === "all" ||
        (
          x.quote_asset ?? "0x3600000000000000000000000000000000000000"
        ).toLowerCase() === pair;
      return matchQuery && matchPair && (!cutoff || time >= cutoff);
    });

    return [...matches].sort((a, b) => {
      if (sort === "volume" && pair !== "all") {
        const av = BigInt(a.volume_24h ?? "0"),
          bv = BigInt(b.volume_24h ?? "0");
        return av === bv ? 0 : bv > av ? 1 : -1;
      }
      if (sort === "graduation") return progress(b) - progress(a);
      if (sort === "oldest")
        return String(a.created_at ?? "").localeCompare(
          String(b.created_at ?? ""),
        );
      if (sort === "newest")
        return String(b.created_at ?? "").localeCompare(
          String(a.created_at ?? ""),
        );
      return String(b.last_trade_at ?? b.created_at ?? "").localeCompare(
        String(a.last_trade_at ?? a.created_at ?? ""),
      );
    });
  }, [items, query, sort, windowFilter, pair]);

  const graduated = filtered
    .filter((x) => x.status === "GRADUATED")
    .slice(0, 10);
  const live = filtered.filter((x) => x.status !== "GRADUATED");

  useEffect(() => setPage(1), [query, sort, windowFilter, pair]);
  const pageCount = Math.max(1, Math.ceil(live.length / 20));

  return (
    <div className={ui("explore-surface")}>
      <div className={ui("discovery-heading")}>
        <div>
          <h1>Find your next market.</h1>
          <p>Discover, launch, and trade on Arc.</p>
        </div>
        <div className={ui("discovery-links")}>
          <a className={ui("secondary-link")} href="/stocks">
            Stocks
          </a>
          <a className={ui("primary-link")} href="/create">
            + Create token
          </a>
        </div>
      </div>
      <div
        className={ui("discovery-summary")}
        aria-label="Loaded market summary"
      >
        <div>
          <span>Markets loaded</span>
          <strong>{loading ? "…" : items.length}</strong>
        </div>
        <div>
          <span>On the curve</span>
          <strong>
            {loading
              ? "…"
              : items.filter((x) => x.status !== "GRADUATED").length}
          </strong>
        </div>
        <div>
          <span>Graduated</span>
          <strong>
            {loading
              ? "…"
              : items.filter((x) => x.status === "GRADUATED").length}
          </strong>
        </div>
      </div>
      {error && (
        <div className={ui("system-notice")}>
          <strong>Market index degraded</strong>
          <span>
            {error} Open a known token address to check its onchain market.
          </span>
          <button type="button" onClick={() => setRetry((x) => x + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className={ui("market-toolbar dense")}>
        <div className={ui("market-search-wrap")}>
          <span>⌕</span>
          <input
            aria-label="Search tokens"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ticker, or address"
          />
        </div>
        <div className={ui("market-toolbar-actions")}>
          <select
            aria-label="Quote asset"
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className={ui("pair-filter")}
          >
            <option value="all">All pairs</option>
            <option value="0x3600000000000000000000000000000000000000">
              USDC
            </option>
            <option value="0x89b50855aa3be2f677cd6303cec089b5f319d72a">
              EURC
            </option>
            <option value="0xf0c4a4ce82a5746abaad9425360ab04fbba432bf">
              cirBTC
            </option>
          </select>
          <div className={ui("segmented")}>
            {(
              [
                ["activity", "Activity"],
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["graduation", "Graduation"],
                ["volume", "Volume"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                disabled={value === "volume" && pair === "all"}
                title={
                  value === "volume" && pair === "all"
                    ? "Select a quote asset to compare volumes"
                    : undefined
                }
                aria-pressed={sort === value}
                className={ui(sort === value ? "active" : "")}
                onClick={() => setSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={ui("segmented compact-segment")}>
            {(["all", "24h", "7d"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={windowFilter === value}
                className={ui(windowFilter === value ? "active" : "")}
                onClick={() => setWindowFilter(value)}
              >
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>
        </div>
      </div>

      {graduated.length > 0 && (
        <section className={ui("market-section graduated-section")}>
          <div className={ui("market-section-head")}>
            <div>
              <h2>
                Graduated <span>{graduated.length}</span>
              </h2>
              <p>Markets that cleared the graduation threshold.</p>
            </div>
          </div>
          <div className={ui("graduated-grid")}>
            {graduated.map((item) => (
              <MarketCard item={item} graduated key={item.address} />
            ))}
          </div>
        </section>
      )}

      <section className={ui("market-section explore-grid-section")}>
        <div className={ui("market-section-head")}>
          <div>
            <h2>
              Explore <span>{live.length}</span>
            </h2>
            <p>Tokens trading on the bonding curve.</p>
          </div>
          <a href="/create" className={ui("secondary-link compact-link")}>
            + Create
          </a>
        </div>

        {loading ? (
          <div
            className={ui("market-card-grid")}
            aria-label="Loading markets"
            aria-busy="true"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <div className={ui("market-card")} key={i}>
                <div className={ui("skeleton skeleton-image")} />
                <div className={ui("skeleton skeleton-line")} />
                <div className={ui("skeleton skeleton-line")} />
              </div>
            ))}
          </div>
        ) : !live.length ? (
          <div className={ui("empty-state")}>
            <strong>
              {items.length ? "No matching markets" : "No live markets yet"}
            </strong>
            <span>
              {items.length
                ? "Try another search or time range."
                : "New launches will appear here automatically."}
            </span>
          </div>
        ) : (
          <div className={ui("market-card-grid")}>
            {live.slice((page - 1) * 20, page * 20).map((item) => (
              <MarketCard item={item} key={item.address} />
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <nav className={ui("pagination")} aria-label="Market pages">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              {page} / {pageCount}
            </span>
            <button
              disabled={page === pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
