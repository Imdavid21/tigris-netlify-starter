"use client";

import { FormEvent, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
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

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("confirmed");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
      <input name="name" maxLength={32} placeholder="Name" required />
      <input name="symbol" maxLength={10} placeholder="Ticker" required />
      <input name="image" type="file" accept="image/*" disabled />
      <textarea name="description" placeholder="Description (metadata phase)" disabled />
      <input name="website" placeholder="Website (metadata phase)" disabled />
      <input name="twitter" placeholder="X (metadata phase)" disabled />
      <input name="telegram" placeholder="Telegram (metadata phase)" disabled />

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
