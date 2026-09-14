"use client";

import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, formatUnits, getAddress, http, type EIP1193Provider } from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { feeEscrowAbi } from "@/lib/abi";
import { API_URL } from "@/lib/api";
import { useWalletSession } from "@/components/wallet-session";

type Activity = { tx_hash:string; token:string; side:string; quote_amount:string; block_time:string };
type Launch = { address:string; name:string; symbol:string; status:string; created_at:string };
type Position = { token:string; balance:string; name:string; symbol:string; status:string };

export function ProfilePanel() {
  const { address, connect, connecting } = useWalletSession();
  const [claimable,setClaimable]=useState(0n);
  const [activity,setActivity]=useState<Activity[]>([]);
  const [launches,setLaunches]=useState<Launch[]>([]);
  const [positions,setPositions]=useState<Position[]>([]);
  const [tab,setTab]=useState<"launches"|"positions"|"activity">("launches");
  const [status,setStatus]=useState("");
  const [error,setError]=useState<string>();

  const client=createPublicClient({
    chain:arcTestnet,
    transport:http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network")
  });

  async function refresh(account:string){
    const [amount,a,l,p]=await Promise.all([
      client.readContract({address:addresses.feeEscrow,abi:feeEscrowAbi,functionName:"claimable",args:[getAddress(account)]}) as Promise<bigint>,
      fetch(API_URL+"/wallet/"+account+"/activity").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
      fetch(API_URL+"/wallet/"+account+"/launches").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]})),
      fetch(API_URL+"/wallet/"+account+"/positions").then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]}))
    ]);
    setClaimable(amount); setActivity(a.items??[]); setLaunches(l.items??[]); setPositions(p.items??[]);
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
    }catch(e){setStatus("");setError(e instanceof Error?e.message:"Claim failed.");}
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
        <h2>{"$"+Number(formatUnits(claimable,6)).toLocaleString(undefined,{maximumFractionDigits:2})}</h2>
        <p>USDC claimable from the deployed fee escrow.</p>
      </div>
      <button onClick={claim} disabled={claimable===0n||status==="Confirming"}>{status||"Claim USDC"}</button>
    </section>

    <div className="profile-tabs">
      <button className={tab==="launches"?"active":""} onClick={()=>setTab("launches")}>My launches</button>
      <button className={tab==="positions"?"active":""} onClick={()=>setTab("positions")}>Positions</button>
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
