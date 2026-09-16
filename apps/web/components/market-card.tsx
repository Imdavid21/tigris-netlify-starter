"use client";
import { ui } from "@/styles/ui";

import { useState } from "react";
import { formatUnits } from "viem";
export type IndexedLaunch = {
  address: `0x${string}`;
  curve_address: `0x${string}`;
  name: string;
  symbol: string;
  status: string;
  generation?: string;
  quote_asset?: `0x${string}` | null;
  image?: string | null;
  volume_24h?: string;
  trades_24h?: number;
  last_trade_at?: string | null;
  created_at?: string;
};

export type Launch = IndexedLaunch & {
  raised?: bigint;
  threshold?: bigint;
};

type Sort = "activity" | "newest" | "graduation" | "volume";

const QUOTE_DECIMALS: Record<string, number> = {
  "0x3600000000000000000000000000000000000000": 6,
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": 6,
  "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf": 8,
};

function decimals(item: Launch) {
  return item.quote_asset
    ? (QUOTE_DECIMALS[item.quote_asset.toLowerCase()] ?? 6)
    : 6;
}

function money(value: bigint | string | undefined, d = 6) {
  if (value === undefined) return "—";
  try {
    const n = Number(formatUnits(BigInt(value), d));
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

export function progress(item: Launch) {
  if (item.status === "GRADUATED") return 100;
  if (!item.raised || !item.threshold || item.threshold === 0n) return 0;
  return Math.min(100, Number((item.raised * 10_000n) / item.threshold) / 100);
}

function age(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function TokenImage({ item }: { item: Launch }) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) {
    return (
      <img
        className={ui("market-card-image")}
        src={
          item.image.startsWith("ipfs://")
            ? "https://ipfs.io/ipfs/" + item.image.slice(7)
            : item.image
        }
        alt=""
        loading="lazy"
        width={240}
        height={240}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={ui("market-card-image market-card-fallback")}
      aria-hidden="true"
    >
      {item.symbol?.slice(0, 2).toUpperCase() || "✦"}
    </div>
  );
}

export function MarketCard({
  item,
  graduated = false,
  preview = false,
}: {
  item: Launch;
  graduated?: boolean;
  preview?: boolean;
}) {
  const Tag = preview ? "div" : "a";
  const pct = progress(item);
  const d = decimals(item);
  const quoteSymbol =
    item.quote_asset?.toLowerCase() ===
    "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf"
      ? "cirBTC"
      : item.quote_asset?.toLowerCase() ===
          "0x89b50855aa3be2f677cd6303cec089b5f319d72a"
        ? "EURC"
        : "USDC";
  return (
    <Tag href={preview ? undefined : "/token/" + item.address} className={ui("market-card")}>
      <div className={ui("market-card-media")}>
        <TokenImage item={item} />
        <span
          className={ui("market-version " + (graduated ? "graduated" : ""))}
        >
          {preview ? "Preview" : graduated
            ? "Graduated"
            : item.generation === "CELESTIAL"
              ? "C"
              : "V1"}
        </span>
      </div>
      <div className={ui("market-card-body")}>
        <div className={ui("market-card-title")}>
          <strong>{item.name}</strong>
          <span>{item.symbol}</span>
        </div>
        <div className={ui("market-card-value")}>
          {money(item.volume_24h ?? "0", d).replace("$", "")}{" "}
          <small>{quoteSymbol}</small>
        </div>
        <div className={ui("market-card-meta")}>
          <span>
            24h volume · {Number(item.trades_24h ?? 0).toLocaleString()} trades
          </span>
          <span>{age(item.last_trade_at ?? item.created_at)}</span>
        </div>
        {!graduated && (
          <div className={ui("market-progress")}>
            <div style={{ width: pct + "%" }} />
          </div>
        )}
        <div className={ui("market-card-foot")}>
          <span>
            {preview ? "Contract assigned at launch" : item.address.slice(0, 6) + "..." + item.address.slice(-4)}
          </span>
          <span>{preview ? "" : graduated ? "DEX" : pct ? pct.toFixed(0) + "%" : "Live"}</span>
        </div>
      </div>
    </Tag>
  );
}
