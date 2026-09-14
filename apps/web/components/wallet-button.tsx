"use client";

import { useState } from "react";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function provider(): EthereumProvider | undefined {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

export function WalletButton() {
  const [address, setAddress] = useState<string>();
  const [pending, setPending] = useState(false);

  async function connect() {
    const ethereum = provider();
    if (!ethereum) return;

    setPending(true);
    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts"
      })) as string[];
      setAddress(accounts[0]);
    } finally {
      setPending(false);
    }
  }

  if (address) {
    return (
      <button type="button" onClick={connect}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button type="button" disabled={pending} onClick={connect}>
      {pending ? "Connecting..." : "Connect wallet"}
    </button>
  );
}
