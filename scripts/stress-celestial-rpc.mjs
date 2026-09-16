import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  maxUint256,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';
const RAW_KEY = process.env.PRIVATE_KEY;
const EXPECTED_SIGNER = (process.env.EXPECTED_SIGNER ?? '').toLowerCase();
const USDC = getAddress('0x3600000000000000000000000000000000000000');
const LAUNCHES = 26;

if (!RAW_KEY) throw new Error('PRIVATE_KEY is required');
const privateKey = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;
const account = privateKeyToAccount(privateKey);
if (EXPECTED_SIGNER && account.address.toLowerCase() !== EXPECTED_SIGNER) {
  throw new Error(`Unexpected signer ${account.address}`);
}

const arcTestnet = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) });

function artifact(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const object = typeof parsed.bytecode === 'string' ? parsed.bytecode : parsed.bytecode?.object;
  return { abi: parsed.abi, bytecode: object?.startsWith('0x') ? object : `0x${object}` };
}

const factoryArtifact = artifact('out/CelestialLaunchFactory.sol/CelestialLaunchFactory.json');
const curveArtifact = artifact('out/CelestialBondingCurve.sol/CelestialBondingCurve.json');
const tokenArtifact = artifact('out/CelestialToken.sol/CelestialToken.json');
const escrowArtifact = artifact('out/CelestialFeeEscrow.sol/CelestialFeeEscrow.json');
const buybackArtifact = artifact('out/CelestialBuybackVault.sol/CelestialBuybackVault.json');

const erc20Abi = [
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const txLog = [];
let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });

function errorText(error) {
  return String(error?.shortMessage ?? error?.message ?? error);
}

function retryable(error) {
  return /rate limit|429|timeout|timed out|temporarily unavailable|connection|fetch failed|nonce too low|replacement transaction underpriced/i.test(errorText(error));
}

async function waitReceipt(hash) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 90_000 });
    } catch (error) {
      if (attempt === 5 || !retryable(error)) throw error;
      await sleep(800 * (attempt + 1));
    }
  }
}

async function send(label, sender) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const hash = await sender(nonce);
      const receipt = await waitReceipt(hash);
      if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
      txLog.push({ label, hash, blockNumber: receipt.blockNumber.toString(), nonce });
      console.log(`TX|${label}|${hash}|nonce=${nonce}|block=${receipt.blockNumber}`);
      nonce += 1;
      await sleep(180);
      return receipt;
    } catch (error) {
      const message = errorText(error);
      console.error(`RETRY|${label}|attempt=${attempt + 1}|${message}`);
      if (attempt === 5 || !retryable(error)) throw error;
      const chainNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }).catch(() => nonce);
      if (chainNonce > nonce) nonce = chainNonce;
      await sleep(900 * (attempt + 1));
    }
  }
}

function randBig(seed, ...parts) {
  const digest = createHash('sha256').update([seed, ...parts].join('|')).digest('hex');
  return BigInt(`0x${digest}`);
}

const adjectives = ['Cash', 'Neon', 'Diamond', 'Crude', 'Turbo', 'Artificial', 'Green', 'Thinking', 'Little', 'Pixel', 'Moon', 'Based', 'Lucky', 'Mega', 'Bonk'];
const nouns = ['Cat', 'Inu', 'Bull', 'Blob', 'Tendies', 'Pipedog', 'Hood', 'Frog', 'Mutt', 'Coco', 'Button', 'Flamingo', 'Wishbone', 'Intern', 'Fox'];
const tickers = ['CAT', 'INU', 'BULL', 'BLOB', 'TEND', 'PIPE', 'HOOD', 'FROG', 'MUTT', 'COCO', 'BUY', 'FLAM', 'WISH', 'INT', 'FOX'];
const avatarStyles = ['pixel-art', 'bottts', 'shapes', 'identicon'];

function generatedAddress(seed, i, j) {
  const digest = createHash('sha256').update(`${seed}|${i}|${j}|exempt`).digest('hex');
  return getAddress(`0x${digest.slice(-40)}`);
}

function launchMetadata(seed, i) {
  const r = randBig(seed, 'launch', i);
  const a = Number(r % BigInt(adjectives.length));
  const n = Number((r >> 12n) % BigInt(nouns.length));
  const pattern = Number((r >> 24n) % 4n);
  const baseTicker = tickers[Number((r >> 32n) % BigInt(tickers.length))];
  const symbol = `${baseTicker}${i}`.slice(0, 10);
  let name;
  if (pattern === 0) name = `${adjectives[a]} ${nouns[n]} ${i}`;
  else if (pattern === 1) name = `Wen ${nouns[n]} ${i}`;
  else if (pattern === 2) name = `${nouns[n]} Strategy ${i}`;
  else name = `The ${adjectives[a]} ${nouns[n]} ${i}`;
  name = name.slice(0, 32);

  const creatorTaxBps = Number((r >> 48n) % 501n);
  const holderFeeBps = Number((r >> 64n) % 301n);
  const exemptionCount = Number((r >> 80n) % 3n);
  const snipeExemptions = Array.from({ length: exemptionCount }, (_, j) => generatedAddress(seed, i, j));
  const style = avatarStyles[Number((r >> 96n) % BigInt(avatarStyles.length))];

  return {
    name,
    symbol,
    creatorTaxBps,
    holderFeeBps,
    params: {
      name,
      symbol,
      quoteAsset: USDC,
      creatorFeeRecipient: i % 5 === 0 ? account.address : zeroAddress,
      creatorTaxBps: BigInt(creatorTaxBps),
      holderFeeBps: BigInt(holderFeeBps),
      metadata: {
        description: `Arc test meme ${name}. Randomized signed stress launch ${i}.`,
        image: `https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(symbol)}`,
        website: i % 4 === 0 ? '' : `https://example.com/celestial-stress/${i}`,
        twitter: i % 3 === 0 ? '' : `@arcstress${i}`,
        telegram: i % 5 === 0 ? '' : `t.me/arcstress${i}`,
      },
      snipeExemptions,
    },
  };
}

const chainId = await publicClient.getChainId();
if (chainId !== 5_042_002) throw new Error(`Wrong chain ${chainId}`);

const nativeStart = await publicClient.getBalance({ address: account.address });
const usdcStart = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
if (usdcStart < 2_000_000n) throw new Error(`Need at least 2 testnet USDC; have ${usdcStart}`);

const blockNumber = await publicClient.getBlockNumber();
const runSeed = process.env.STRESS_SEED ?? `${Date.now()}-${blockNumber}-${account.address}`;
console.log(`STRESS_SIGNER|${account.address}`);
console.log(`STRESS_CHAIN_ID|${chainId}`);
console.log(`STRESS_START_NATIVE|${nativeStart}`);
console.log(`STRESS_START_USDC|${usdcStart}`);
console.log(`STRESS_SEED|${createHash('sha256').update(runSeed).digest('hex')}`);

const deployReceipt = await send('deploy-factory', (txNonce) => walletClient.deployContract({
  abi: factoryArtifact.abi,
  bytecode: factoryArtifact.bytecode,
  args: [account.address],
  nonce: txNonce,
}));
const factory = deployReceipt.contractAddress;
if (!factory) throw new Error('Factory deployment returned no contract address');
console.log(`STRESS_FACTORY|${factory}`);

await send('configure-usdc', (txNonce) => walletClient.writeContract({
  address: factory,
  abi: factoryArtifact.abi,
  functionName: 'configureQuoteAsset',
  args: [USDC, {
    enabled: true,
    phantomQuote: 2_500_000_000n,
    graduationThreshold: 10_000_000_000n,
    feeBps: 100n,
    protocolShareBps: 7_500n,
    buybackShareBps: 2_000n,
    maxSnipeBps: 2_000n,
    snipeDuration: 5n,
  }],
  nonce: txNonce,
}));

await send('approve-factory-usdc', (txNonce) => walletClient.writeContract({
  address: USDC, abi: erc20Abi, functionName: 'approve', args: [factory, maxUint256], nonce: txNonce,
}));

const feeEscrow = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'feeEscrow' });
const buybackVault = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'buybackVault' });

let totalActions = 0;
let totalBuys = 0;
let totalSells = 0;
let atomicLaunches = 0;
let claims = 0;
let buybacks = 0;
const launches = [];

for (let i = 0; i < LAUNCHES; i++) {
  const meta = launchMetadata(runSeed, i);
  const r = randBig(runSeed, 'launch-behavior', i);
  const countBefore = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'tokenCount' });
  const atomic = r % 3n === 0n;
  let launchHash;

  if (atomic) {
    const developerBuy = 1_000n + ((r >> 8n) % 4_001n); // 0.001-0.005001 USDC
    const preview = await publicClient.readContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: 'previewInitialBuy',
      args: [USDC, BigInt(meta.creatorTaxBps), BigInt(meta.holderFeeBps), developerBuy],
    });
    const receipt = await send(`launch-${i}-atomic`, (txNonce) => walletClient.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: 'createTokenAndBuy',
      args: [meta.params, developerBuy, preview[0] * 95n / 100n],
      nonce: txNonce,
    }));
    launchHash = receipt.transactionHash;
    atomicLaunches++;
  } else {
    const receipt = await send(`launch-${i}`, (txNonce) => walletClient.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: 'createToken',
      args: [meta.params],
      nonce: txNonce,
    }));
    launchHash = receipt.transactionHash;
  }

  const token = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'allTokens', args: [countBefore] });
  const curve = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'curveOf', args: [token] });

  await send(`launch-${i}-approve-usdc`, (txNonce) => walletClient.writeContract({
    address: USDC, abi: erc20Abi, functionName: 'approve', args: [curve, maxUint256], nonce: txNonce,
  }));
  await send(`launch-${i}-approve-token`, (txNonce) => walletClient.writeContract({
    address: token, abi: tokenArtifact.abi, functionName: 'approve', args: [curve, maxUint256], nonce: txNonce,
  }));

  const actionCount = 10 + Number((r >> 20n) % 6n);
  let launchBuys = 0;
  let launchSells = 0;

  for (let j = 0; j < actionCount; j++) {
    const tracked = await publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'trackedQuote' });
    const tokenBalance = await publicClient.readContract({ address: token, abi: tokenArtifact.abi, functionName: 'balanceOf', args: [account.address] });
    const q = randBig(runSeed, 'trade', i, j, tracked.toString());
    const shouldBuy = tokenBalance === 0n || q % 100n < 58n;

    if (shouldBuy) {
      const quoteIn = 500n + ((q >> 32n) % 4_501n); // 0.0005-0.005 USDC
      const quoted = await publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'quoteBuyFor', args: [account.address, quoteIn] });
      if (quoted > 0n) {
        const slippageBps = 50n + ((q >> 60n) % 451n);
        await send(`launch-${i}-buy-${j}`, (txNonce) => walletClient.writeContract({
          address: curve,
          abi: curveArtifact.abi,
          functionName: 'buy',
          args: [quoteIn, quoted * (10_000n - slippageBps) / 10_000n],
          nonce: txNonce,
        }));
        totalBuys++; launchBuys++;
      }
    } else {
      const divisor = 5n + ((q >> 40n) % 16n);
      const tokenIn = tokenBalance / divisor || tokenBalance;
      const quoted = await publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'quoteSell', args: [tokenIn] });
      if (tokenIn > 0n && quoted > 0n) {
        const slippageBps = 50n + ((q >> 68n) % 451n);
        await send(`launch-${i}-sell-${j}`, (txNonce) => walletClient.writeContract({
          address: curve,
          abi: curveArtifact.abi,
          functionName: 'sell',
          args: [tokenIn, quoted * (10_000n - slippageBps) / 10_000n],
          nonce: txNonce,
        }));
        totalSells++; launchSells++;
      }
    }
    totalActions++;

    if (j === 4 && i % 4 === 0) {
      await send(`launch-${i}-allowance-reset`, (txNonce) => walletClient.writeContract({
        address: USDC, abi: erc20Abi, functionName: 'approve', args: [curve, 0n], nonce: txNonce,
      }));
      await send(`launch-${i}-allowance-reapprove`, (txNonce) => walletClient.writeContract({
        address: USDC, abi: erc20Abi, functionName: 'approve', args: [curve, maxUint256], nonce: txNonce,
      }));
    }
  }

  if (i % 2 === 0) {
    const remaining = await publicClient.readContract({ address: token, abi: tokenArtifact.abi, functionName: 'balanceOf', args: [account.address] });
    if (remaining > 0n) {
      const quoteOut = await publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'quoteSell', args: [remaining] });
      if (quoteOut > 0n) {
        await send(`launch-${i}-sell-all`, (txNonce) => walletClient.writeContract({
          address: curve, abi: curveArtifact.abi, functionName: 'sell', args: [remaining, quoteOut * 95n / 100n], nonce: txNonce,
        }));
        totalSells++; launchSells++;
      }
    }
  }

  const pending = async () => {
    const [a, b, c] = await Promise.all([
      publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'pendingProtocolFees' }),
      publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'pendingCreatorFees' }),
      publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'pendingBuybackFees' }),
    ]);
    return a + b + c;
  };

  if (i % 4 === 0 && await pending() > 0n) {
    await send(`launch-${i}-sweep-fees`, (txNonce) => walletClient.writeContract({
      address: curve, abi: curveArtifact.abi, functionName: 'sweepFees', args: [], nonce: txNonce,
    }));
    const claimable = await publicClient.readContract({ address: feeEscrow, abi: escrowArtifact.abi, functionName: 'claimable', args: [USDC, account.address] });
    if (claimable > 0n) {
      await send(`launch-${i}-claim-creator`, (txNonce) => walletClient.writeContract({
        address: feeEscrow, abi: escrowArtifact.abi, functionName: 'claim', args: [USDC], nonce: txNonce,
      }));
      claims++;
    }
  }

  if (i % 5 === 0) {
    const holderRewards = await publicClient.readContract({ address: token, abi: tokenArtifact.abi, functionName: 'withdrawableRewardOf', args: [account.address] });
    if (holderRewards > 0n) {
      await send(`launch-${i}-claim-holder`, (txNonce) => walletClient.writeContract({
        address: token, abi: tokenArtifact.abi, functionName: 'claimHolderRewards', args: [], nonce: txNonce,
      }));
      claims++;
    }
  }

  if (i % 6 === 0) {
    if (await pending() > 0n) {
      await send(`launch-${i}-sweep-for-buyback`, (txNonce) => walletClient.writeContract({
        address: curve, abi: curveArtifact.abi, functionName: 'sweepFees', args: [], nonce: txNonce,
      }));
    }
    const available = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [buybackVault] });
    if (available > 0n) {
      const spend = available > 2_000n ? 2_000n : available;
      const buyQuote = await publicClient.readContract({ address: curve, abi: curveArtifact.abi, functionName: 'quoteBuyFor', args: [buybackVault, spend] });
      if (buyQuote > 0n) {
        await send(`launch-${i}-buyback`, (txNonce) => walletClient.writeContract({
          address: buybackVault,
          abi: buybackArtifact.abi,
          functionName: 'executeCurveBuyback',
          args: [curve, spend, buyQuote * 90n / 100n],
          nonce: txNonce,
        }));
        buybacks++;
      }
    }
  }

  launches.push({
    index: i,
    name: meta.name,
    symbol: meta.symbol,
    token,
    curve,
    image: meta.params.metadata.image,
    creatorTaxBps: meta.creatorTaxBps,
    holderFeeBps: meta.holderFeeBps,
    atomic,
    actionCount,
    buys: launchBuys,
    sells: launchSells,
    launchHash,
  });
  console.log(`LAUNCH|${i + 1}/${LAUNCHES}|${meta.name}|${meta.symbol}|token=${token}|curve=${curve}|actions=${actionCount}|buys=${launchBuys}|sells=${launchSells}|atomic=${atomic}`);
}

const tokenCount = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: 'tokenCount' });
if (tokenCount !== BigInt(LAUNCHES)) throw new Error(`Expected ${LAUNCHES} launches, got ${tokenCount}`);
if (totalActions < LAUNCHES * 10 || totalBuys === 0 || totalSells === 0) throw new Error('Stress coverage floor not met');

const nativeEnd = await publicClient.getBalance({ address: account.address });
const usdcEnd = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
const summary = {
  ok: true,
  signer: account.address,
  chainId,
  factory,
  launches: LAUNCHES,
  marketActions: totalActions,
  buys: totalBuys,
  sells: totalSells,
  atomicLaunches,
  claims,
  buybacks,
  nativeStart: nativeStart.toString(),
  nativeEnd: nativeEnd.toString(),
  usdcStart: usdcStart.toString(),
  usdcEnd: usdcEnd.toString(),
  transactions: txLog.length,
  runSeedHash: createHash('sha256').update(runSeed).digest('hex'),
};

writeFileSync('/tmp/celestial-stress-summary.json', JSON.stringify({ summary, launches }, null, 2));
writeFileSync('/tmp/celestial-stress-transactions.json', JSON.stringify(txLog, null, 2));
console.log(`STRESS_LAUNCHES|${LAUNCHES}`);
console.log(`STRESS_MARKET_ACTIONS|${totalActions}`);
console.log(`STRESS_BUYS|${totalBuys}`);
console.log(`STRESS_SELLS|${totalSells}`);
console.log(`STRESS_ATOMIC_LAUNCHES|${atomicLaunches}`);
console.log(`STRESS_CLAIMS|${claims}`);
console.log(`STRESS_BUYBACKS|${buybacks}`);
console.log(`STRESS_TRANSACTIONS|${txLog.length}`);
console.log(`STRESS_END_NATIVE|${nativeEnd}`);
console.log(`STRESS_END_USDC|${usdcEnd}`);
console.log('STRESS_OK|1');
