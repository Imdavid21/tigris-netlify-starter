"use client";

import { FormEvent, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  getAddress,
  http,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { factoryAbi } from "@/lib/abi";
import { ensureArcChain } from "@/lib/wallet";

function getProvider(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

export function CreateTokenForm() {
  const [status, setStatus] = useState<
    "idle" | "wallet" | "submitted" | "confirmed"
  >("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const ethereum = getProvider();
    if (!ethereum) {
      setError("No EVM wallet detected.");
      return;
    }
    if (!addresses.factory) {
      setError("Factory address is not configured.");
      return;
    }

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const symbol = String(data.get("symbol") ?? "").trim();

    if (!name || !symbol) {
      setError("Name and ticker are required.");
      return;
    }

    try {
      setStatus("wallet");

      await ensureArcChain(ethereum);

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts"
      })) as string[];

      if (!accounts[0]) throw new Error("No wallet account available.");

      const account = getAddress(accounts[0]);
      const wallet = createWalletClient({
        account,
        chain: arcTestnet,
        transport: custom(ethereum)
      });

      const txHash = await wallet.writeContract({
        address: addresses.factory,
        abi: factoryAbi,
        functionName: "createToken",
        args: [name, symbol]
      });

      setHash(txHash);
      setStatus("submitted");

      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_ARC_RPC_URL ??
            "https://rpc.testnet.arc.network"
        )
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("confirmed");

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: factoryAbi,
            data: log.data,
            topics: log.topics
          });

          if (decoded.eventName === "TokenCreated") {
            const args = decoded.args as { token: `0x${string}` };
            window.location.href = "/token/" + args.token;
            return;
          }
        } catch {
          // Ignore logs emitted by child contracts.
        }
      }
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <input name="name" maxLength={32} placeholder="Name" required />
      <input name="symbol" maxLength={10} placeholder="Ticker" required />

      <div className="launch-review">
        <div>
          <span>Supply</span>
          <strong>1,000,000,000</strong>
        </div>
        <div>
          <span>Pair</span>
          <strong>USDC</strong>
        </div>
        <div>
          <span>Trade fee</span>
          <strong>1.00%</strong>
        </div>
        <div>
          <span>Graduation</span>
          <strong>$10,000</strong>
        </div>
        <div>
          <span>Creator fee share</span>
          <strong>25%</strong>
        </div>
        <div>
          <span>Liquidity</span>
          <strong>Locked</strong>
        </div>
      </div>

      <p className="immutable-note">
        These economics are fixed by the current Arc Testnet factory.
      </p>

      <button type="submit" disabled={status === "wallet" || status === "submitted"}>
        {status === "wallet"
          ? "Confirm in wallet"
          : status === "submitted"
            ? "Confirming"
            : status === "confirmed"
              ? "Launched"
              : "Launch token"}
      </button>

      {hash && (
        <p style={{ opacity: 0.65, wordBreak: "break-all" }}>Tx: {hash}</p>
      )}
      {error && <p style={{ color: "#ff9d9d" }}>{error}</p>}
    </form>
  );
}
