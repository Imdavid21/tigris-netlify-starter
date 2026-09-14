"use client";

import { useEffect, useState } from "react";
import { createWalletClient, custom, formatUnits, getAddress, type EIP1193Provider } from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { feeEscrowAbi } from "@/lib/abi";
import { celestialAddresses, celestialFeeEscrowAbi, orderBookAbi, quoteAssets } from "@/lib/celestial";
import { API_URL } from "@/lib/api";
import { useWalletSession } from "@/components/wallet-session";\nimport { createArcPublicClient, friendlyChainError } from "@/lib/rpc";

type Activity = { tx_hash:string; token:string; side:string; quote_amount:string; block_time:string };
type Launch = { address:string; name:string; symbol:string; status:string; created_at:string };
type Position = { token:string; balance:string; name:string; symbol:string; status:string; generation?:string; quote_asset?:string|null };
type Order = { order_id:string; curve:string; side:string; amount_in:string; min_amount_out:string; status:string; created_at?:string };

export function ProfilePanel() {
  const { address, connect, connecting } = useWalletSession();
  const [claimable,setClaimable]=useState(0n);
  const [activity,setActivity]=useState<Activity[]>([]);
  const [launches,setLaunches]=useState<Launch[]>([]);
  const [positions,setPositions]=useState<Position[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [celestialClaims,setCelestialClaims]=useState<Record<string,bigint>>({});
  const [tab,setTab]=useState<"launches"|"positions"|"orders"|"activity">("launches");
  const [status,setStatus]=useState("");
  const [error,setError]=useState<string>();

  const client=createPublicClient({
    chain:arcTestnet,
    transport:http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network")
  });

  async function refresh(account:string){
    const [amount,a,l,p,o]=await Promise.all([
      client.readContract({address:addresses.feeEscrow,abi:feeEscrowAbi,functionName:"claimable",args:[getAddress(account)]}) as Promise<bigint>,
      fetch(API_URL+"/wallet/"+account+"/activity").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
      fetch(API_URL+"/wallet/"+account+"/launches").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
      fetch(API_URL+"/wallet/"+account+"/positions").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
      fetch(API_URL+"/wallet/"+account+"/orders").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]}))
    ]);
    setClaimable(amount); setActivity(a.items??[]); setLaunches(l.items??[]); setPositions(p.items??[]); setOrders(o.items??[]);

    if (celestialAddresses.feeEscrow) {
      const entries = await Promise.all(
        quoteAssets.map(async (asset) => {
          const value = await client.readContract({
            address: celestialAddresses.feeEscrow!,
            abi: celestialFeeEscrowAbi,
            functionName: "claimable",
            args: [asset.address, getAddress(account)]
          }).catch(() => 0n) as bigint;
          return [asset.symbol, value] as const;
        })
      );
      setCelestialClaims(Object.fromEntries(entries));
    }
  }

  async function claim(){
    if(!address||claimable===0n)return;
    const provider=(window as Window & { ethereum?: EIP1193Provider }).ethereum; if(!provider)return;
    try{
      setStatus("Confirm claim");
      const wallet=createWalletClient({account:getAddress(address),chain:arcTestnet,transport:custom(provider)});
      const hash=await wallet.writeContract({address:addresses.feeEscrow,abi:feeEscrowAbi,functionName:"claim"});
      setStatus("Confirming");
      await client.waitForTransactionReceipt({hash});
      setStatus("Claimed");
      await refresh(address);
    }catch(e){setStatus("");setError(friendlyChainError(e,"Claim failed."));}
  }


  async function claimCelestial(symbol:string){
    if(!address||!celestialAddresses.feeEscrow)return;
    const asset=quoteAssets.find((q)=>q.symbol===symbol);
    if(!asset||!(celestialClaims[symbol]??0n))return;
    const provider=(window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if(!provider)return;
    try{
      setStatus("Confirm "+symbol+" claim");
      const wallet=createWalletClient({account:getAddress(address),chain:arcTestnet,transport:custom(provider)});
      const hash=await wallet.writeContract({
        address:celestialAddresses.feeEscrow,
        abi:celestialFeeEscrowAbi,
        functionName:"claim",
        args:[asset.address]
      });
      await client.waitForTransactionReceipt({hash});
      setStatus("Claimed");
      await refresh(address);
    }catch(e){setStatus("");setError(friendlyChainError(e,"Claim failed."));}
  }

  async function cancelOrder(orderId:string){
    if(!address||!celestialAddresses.orderBook)return;
    const provider=(window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if(!provider)return;
    try{
      setStatus("Cancel order");
      const wallet=createWalletClient({account:getAddress(address),chain:arcTestnet,transport:custom(provider)});
      const hash=await wallet.writeContract({
        address:celestialAddresses.orderBook,
        abi:orderBookAbi,
        functionName:"cancel",
        args:[BigInt(orderId)]
      });
      await client.waitForTransactionReceipt({hash});
      setStatus("Cancelled");
      await refresh(address);
    }catch(e){setStatus("");setError(friendlyChainError(e,"Cancellation failed."));}
  }

  useEffect(()=>{ if(address) void refresh(address); },[address]);

  if(!address){
    return <div className="profile-connect">
      <div className="profile-connect-mark">A</div>
      <h2>Connect your wallet</h2>
      <p>See your launches, positions, creator fees, and indexed activity.</p>
      <button disabled={connecting} onClick={()=>void connect()}>{connecting?"Connecting...":"Connect wallet"}</button>
      {error&&<span className="form-error">{error}</span>}
    </div>;
  }

  return <div className="profile-layout">
    <section className="profile-summary">
      <div><span className="kicker">Wallet</span><strong>{address.slice(0,7)}...{address.slice(-5)}</strong></div>
      <div className="profile-summary-stat"><span>Launches</span><strong>{launches.length}</strong></div>
      <div className="profile-summary-stat"><span>Positions</span><strong>{positions.length}</strong></div>
      <button onClick={()=>refresh(address)}>Refresh</button>
    </section>

    <section className="fees-card">
      <div>
        <span className="kicker">Creator fees</span>
        <h2>{Number(formatUnits(claimable,6)).toLocaleString(undefined,{maximumFractionDigits:2})} USDC</h2>
        <p>Legacy and Celestial creator-tax revenue remains non-custodial until claimed.</p>
      </div>
      <button onClick={claim} disabled={claimable===0n||status==="Confirming"}>{status||"Claim legacy USDC"}</button>
    </section>

    {celestialAddresses.feeEscrow && (
      <section className="metric-grid">
        {quoteAssets.map((asset)=>(
          <div className="metric-card" key={asset.symbol}>
            <span>{asset.symbol} creator fees</span>
            <strong>{Number(formatUnits(celestialClaims[asset.symbol]??0n,asset.decimals)).toLocaleString(undefined,{maximumFractionDigits:6})}</strong>
            <button onClick={()=>void claimCelestial(asset.symbol)} disabled={(celestialClaims[asset.symbol]??0n)===0n}>Claim {asset.symbol}</button>
          </div>
        ))}
      </section>
    )}

    <div className="profile-tabs">
      <button className={tab==="launches"?"active":""} onClick={()=>setTab("launches")}>My launches</button>
      <button className={tab==="positions"?"active":""} onClick={()=>setTab("positions")}>Positions</button>
      <button className={tab==="orders"?"active":""} onClick={()=>setTab("orders")}>Orders</button>
      <button className={tab==="activity"?"active":""} onClick={()=>setTab("activity")}>Activity</button>
    </div>

    <section className="profile-table">
      {tab==="launches" && (launches.length?launches.map(x=>
        <a href={"/token/"+x.address} className="profile-row" key={x.address}>
          <div><strong>{x.name}</strong><span>{"$"+x.symbol}</span></div>
          <span>{x.status==="GRADUATED"?"Graduated":"Curve"}</span>
          <span>{new Date(x.created_at).toLocaleDateString()}</span>
        </a>
      ):<div className="profile-empty">No launches from this wallet yet.</div>)}

      {tab==="positions" && (positions.length?positions.map(x=>
        <a href={"/token/"+x.token} className="profile-row" key={x.token}>
          <div><strong>{x.name}</strong><span>{"$"+x.symbol}</span></div>
          <span>{Number(formatUnits(BigInt(x.balance),18)).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          <span>{x.status==="GRADUATED"?"Graduated":"Curve"}</span>
        </a>
      ):<div className="profile-empty">No indexed token positions yet.</div>)}

      {tab==="orders" && (orders.length?orders.map(x=>
        <div className="profile-row" key={x.order_id}>
          <div><strong>{x.side} order</strong><span>#{x.order_id}</span></div>
          <span>{x.status}</span>
          <span>{x.status==="OPEN"&&celestialAddresses.orderBook?<button onClick={()=>void cancelOrder(x.order_id)}>Cancel</button>:new Date(x.created_at??Date.now()).toLocaleDateString()}</span>
        </div>
      ):<div className="profile-empty">No indexed limit orders yet.</div>)}

      {tab==="activity" && (activity.length?activity.map(x=>
        <a href={"/token/"+x.token} className="profile-row" key={x.tx_hash}>
          <div><strong>{x.side}</strong><span>{x.token.slice(0,8)}...{x.token.slice(-6)}</span></div>
          <span>{"$"+Number(formatUnits(BigInt(x.quote_amount),6)).toLocaleString(undefined,{maximumFractionDigits:2})}</span>
          <span>{new Date(x.block_time).toLocaleDateString()}</span>
        </a>
      ):<div className="profile-empty">No indexed activity yet.</div>)}
    </section>

    {error&&<p className="form-error">{error}</p>}
  </div>;
}
