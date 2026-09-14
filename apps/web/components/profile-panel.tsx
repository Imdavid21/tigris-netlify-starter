"use client";

import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  http,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { feeEscrowAbi } from "@/lib/abi";
import { ensureArcChain } from "@/lib/wallet";
import { API_URL } from "@/lib/api";

function injected(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

type Activity = {
  tx_hash: string;
  token: string;
  side: string;
  token_amount: string;
  quote_amount: string;
  fee_amount: string;
  block_time: string;
};

export function ProfilePanel() {
  const [address, setAddress] = useState<`0x${string}`>();
  const [claimable, setClaimable] = useState(0n);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_ARC_RPC_URL ??
        "https://rpc.testnet.arc.network"
    )
  });

  async function refresh(account: `0x${string}`) {
    const [amount, indexed] = await Promise.all([
      client.readContract({
        address: addresses.feeEscrow,
        abi: feeEscrowAbi,
        functionName: "claimable",
        args: [account]
      }) as Promise<bigint>,
      fetch(API_URL + "/wallet/" + account + "/activity")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] }))
    ]);

    setClaimable(amount);
    setActivity(indexed.items ?? []);
  }

  async function connect() {
    setError(undefined);
    const provider = injected();
    if (!provider) {
      setError("No EVM wallet detected.");
      return;
    }

    try {
      await ensureArcChain(provider);
      const accounts = (await provider.request({
        method: "eth_requestAccounts"
      })) as string[];

      if (!accounts[0]) throw new Error("No wallet account available.");

      const account = getAddress(accounts[0]);
      setAddress(account);
      await refresh(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection failed.");
    }
  }

  async function claim() {
    if (!address || claimable === 0n) return;

    const provider = injected();
    if (!provider) return;

    try {
      setStatus("Confirm claim");
      await ensureArcChain(provider);

      const wallet = createWalletClient({
        account: address,
        chain: arcTestnet,
        transport: custom(provider)
      });

      const hash = await wallet.writeContract({
        address: addresses.feeEscrow,
        abi: feeEscrowAbi,
        functionName: "claim"
      });

      setStatus("Confirming");
      await client.waitForTransactionReceipt({ hash });
      setStatus("Claimed");
      await refresh(address);
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Claim failed.");
    }
  }

  if (!address) {
    return (
      <div className="empty-state">
        <strong>Connect your wallet</strong>
        <span>View creator fees and indexed activity.</span>
        <button onClick={connect}>Connect wallet</button>
        {error && <span style={{ color: "#ff9d9d" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section className="metric-grid">
        <div className="metric-card">
          <span>Claimable creator fees</span>
          <strong>
            ${Number(formatUnits(claimable, 6)).toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}
          </strong>
          <button
            onClick={claim}
            disabled={claimable === 0n || status === "Confirming"}
            style={{ marginTop: 16, width: "100%" }}
          >
            {status || "Claim USDC"}
          </button>
        </div>

        <div className="metric-card">
          <span>Wallet</span>
          <strong style={{ fontSize: 16 }}>
            {address.slice(0, 7)}...{address.slice(-5)}
          </strong>
          <button
            onClick={() => refresh(address)}
            style={{ marginTop: 16, width: "100%" }}
          >
            Refresh
          </button>
        </div>
      </section>

      <section>
        <strong>Activity</strong>
        <div style={{ marginTop: 12, borderTop: "1px solid #222824" }}>
          {!activity.length ? (
            <p className="muted">No indexed activity yet.</p>
          ) : (
            activity.map((item) => (
              <div
                key={item.tx_hash}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #171b18",
                  fontSize: 13
                }}
              >
                <strong>{item.side}</strong>
                <a href={"/token/" + item.token}>
                  {item.token.slice(0, 8)}...{item.token.slice(-6)}
                </a>
                <span>
                  ${Number(formatUnits(BigInt(item.quote_amount), 6)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {error && <p style={{ color: "#ff9d9d" }}>{error}</p>}
    </div>
  );
}
