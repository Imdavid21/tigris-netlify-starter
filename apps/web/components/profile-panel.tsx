"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { createWalletClient, custom, formatUnits, getAddress, type EIP1193Provider } from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { feeEscrowAbi } from "@/lib/abi";
import { celestialAddresses, celestialFeeEscrowAbi, orderBookAbi, quoteAssets } from "@/lib/celestial";
import { API_URL } from "@/lib/api";
import { useWalletSession } from "@/components/wallet-session";
import { createArcPublicClient, friendlyChainError } from "@/lib/rpc";
import { flowContainer, flowItem, motionSpring } from "@/lib/motion-system";

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

  const client=createArcPublicClient();

  async function refresh(account:string){
    const legacyClaim = addresses.feeEscrow
      ? client.readContract({address:addresses.feeEscrow,abi:feeEscrowAbi,functionName:"claimable",args:[getAddress(account)]}).catch(()=>0n) as Promise<bigint>
      : Promise.resolve(0n);

    const [amount,a,l,p,o]=await Promise.all([
      legacyClaim,
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
    if(!address||claimable===0n||!addresses.feeEscrow)return;
    const feeEscrow=addresses.feeEscrow;
    const provider=(window as Window & { ethereum?: EIP1193Provider }).ethereum; if(!provider)return;
    try{
      setStatus("Confirm claim");
      const wallet=createWalletClient({account:getAddress(address),chain:arcTestnet,transport:custom(provider)});
      const hash=await wallet.writeContract({address:feeEscrow,abi:feeEscrowAbi,functionName:"claim"});
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
    return <motion.div
      className="profile-connect"
      initial={{ opacity: 0, y: 14, scale: .985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={motionSpring.spatialDefault}
    >
      <motion.div className="profile-connect-mark" animate={{ rotate: [0, 4, -3, 0] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}>A</motion.div>
      <h2>Connect your wallet</h2>
      <p>See your launches, positions, creator fees, and indexed activity.</p>
      <motion.button disabled={connecting} onClick={()=>void connect()} whileTap={{ scale: .97 }} transition={motionSpring.spatialFast}>{connecting?"Connecting...":"Connect wallet"}</motion.button>
      <AnimatePresence>{error&&<motion.span className="form-error" initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>{error}</motion.span>}</AnimatePresence>
    </motion.div>;
  }

  const rows = tab === "launches"
    ? launches.map((x) => ({ key:x.address, node:<a href={"/token/"+x.address} className="profile-row"><div><strong>{x.name}</strong><span>{"$"+x.symbol}</span></div><span>{x.status==="GRADUATED"?"Graduated":"Curve"}</span><span>{new Date(x.created_at).toLocaleDateString()}</span></a> }))
    : tab === "positions"
      ? positions.map((x) => ({ key:x.token, node:<a href={"/token/"+x.token} className="profile-row"><div><strong>{x.name}</strong><span>{"$"+x.symbol}</span></div><span>{Number(formatUnits(BigInt(x.balance),18)).toLocaleString(undefined,{maximumFractionDigits:0})}</span><span>{x.status==="GRADUATED"?"Graduated":"Curve"}</span></a> }))
      : tab === "orders"
        ? orders.map((x) => ({ key:x.order_id, node:<div className="profile-row"><div><strong>{x.side} order</strong><span>#{x.order_id}</span></div><span>{x.status}</span><span>{x.status==="OPEN"&&celestialAddresses.orderBook?<button onClick={()=>void cancelOrder(x.order_id)}>Cancel</button>:new Date(x.created_at??Date.now()).toLocaleDateString()}</span></div> }))
        : activity.map((x) => ({ key:x.tx_hash, node:<a href={"/token/"+x.token} className="profile-row"><div><strong>{x.side}</strong><span>{x.token.slice(0,8)}...{x.token.slice(-6)}</span></div><span>{"$"+Number(formatUnits(BigInt(x.quote_amount),6)).toLocaleString(undefined,{maximumFractionDigits:2})}</span><span>{new Date(x.block_time).toLocaleDateString()}</span></a> }));

  const emptyText = tab === "launches" ? "No launches from this wallet yet." : tab === "positions" ? "No indexed token positions yet." : tab === "orders" ? "No indexed limit orders yet." : "No indexed activity yet.";

  return <LayoutGroup id="portfolio">
    <motion.div className="profile-layout" layout transition={{layout:motionSpring.spatialDefault}}>
      <motion.section className="profile-summary" layout>
        <div><span className="kicker">Wallet</span><strong>{address.slice(0,7)}...{address.slice(-5)}</strong></div>
        <div className="profile-summary-stat"><span>Launches</span><motion.strong key={launches.length} initial={{opacity:0,y:3}} animate={{opacity:1,y:0}}>{launches.length}</motion.strong></div>
        <div className="profile-summary-stat"><span>Positions</span><motion.strong key={positions.length} initial={{opacity:0,y:3}} animate={{opacity:1,y:0}}>{positions.length}</motion.strong></div>
        <motion.button onClick={()=>refresh(address)} whileTap={{scale:.95,rotate:-2}} transition={motionSpring.spatialFast}>Refresh</motion.button>
      </motion.section>

      {addresses.feeEscrow && (
        <motion.section className="fees-card" layout>
          <div>
            <span className="kicker">Legacy creator fees</span>
            <motion.h2 layout>{Number(formatUnits(claimable,6)).toLocaleString(undefined,{maximumFractionDigits:2})} USDC</motion.h2>
            <p>Legacy creator-fee revenue remains non-custodial until claimed.</p>
          </div>
          <motion.button onClick={claim} disabled={claimable===0n||status==="Confirming"} whileTap={{scale:.97}} transition={motionSpring.spatialFast}>{status||"Claim legacy USDC"}</motion.button>
        </motion.section>
      )}

      {celestialAddresses.feeEscrow && (
        <motion.section className="metric-grid" layout variants={flowContainer} initial="hidden" animate="show">
          {quoteAssets.map((asset)=>(
            <motion.div className="metric-card" key={asset.symbol} variants={flowItem} layout>
              <span>{asset.symbol} creator fees</span>
              <strong>{Number(formatUnits(celestialClaims[asset.symbol]??0n,asset.decimals)).toLocaleString(undefined,{maximumFractionDigits:6})}</strong>
              <motion.button onClick={()=>void claimCelestial(asset.symbol)} disabled={(celestialClaims[asset.symbol]??0n)===0n} whileTap={{scale:.96}}>Claim {asset.symbol}</motion.button>
            </motion.div>
          ))}
        </motion.section>
      )}

      <motion.div className="profile-tabs" layout>
        {(["launches","positions","orders","activity"] as const).map((value)=><motion.button
          key={value}
          className={tab===value?"active":""}
          onClick={()=>setTab(value)}
          whileTap={{scale:.94}}
          transition={motionSpring.spatialFast}
        >{value === "launches" ? "My launches" : value[0].toUpperCase()+value.slice(1)}</motion.button>)}
      </motion.div>

      <motion.section className="profile-table" layout transition={{layout:motionSpring.spatialDefault}}>
        <AnimatePresence mode="popLayout" initial={false}>
          {rows.length ? rows.map(({key,node},index)=><motion.div
            key={`${tab}-${key}`}
            layout
            initial={{opacity:0,y:8,scale:.992}}
            animate={{opacity:1,y:0,scale:1}}
            exit={{opacity:0,x:-10,scale:.99}}
            transition={{...motionSpring.spatialFast,delay:Math.min(index*.018,.12)}}
          >{node}</motion.div>) : <motion.div key={`${tab}-empty`} className="profile-empty" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={motionSpring.effectsDefault}>{emptyText}</motion.div>}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence initial={false}>{error&&<motion.p className="form-error" layout initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}>{error}</motion.p>}</AnimatePresence>
    </motion.div>
  </LayoutGroup>;
}
