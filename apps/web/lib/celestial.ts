import type { Address } from "viem";

export const celestialAddresses = {
  factory: process.env.NEXT_PUBLIC_CELESTIAL_FACTORY_ADDRESS as Address | undefined,
  orderBook: process.env.NEXT_PUBLIC_CELESTIAL_ORDERBOOK_ADDRESS as Address | undefined,
  dexAdapter: process.env.NEXT_PUBLIC_CELESTIAL_DEX_ADAPTER_ADDRESS as Address | undefined,
  feeEscrow: process.env.NEXT_PUBLIC_CELESTIAL_FEE_ESCROW_ADDRESS as Address | undefined,
  buybackVault: process.env.NEXT_PUBLIC_CELESTIAL_BUYBACK_VAULT_ADDRESS as Address | undefined,
  usdc: "0x3600000000000000000000000000000000000000" as Address,
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address,
  cirbtc: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" as Address
};

export const quoteAssets = [
  { symbol: "USDC", address: celestialAddresses.usdc, decimals: 6 },
  { symbol: "EURC", address: celestialAddresses.eurc, decimals: 6 },
  { symbol: "cirBTC", address: celestialAddresses.cirbtc, decimals: 8 }
] as const;

export const celestialFactoryAbi = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "nonpayable",
    inputs: [{
      name: "params",
      type: "tuple",
      components: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "quoteAsset", type: "address" },
        { name: "creatorFeeRecipient", type: "address" },
        { name: "creatorTaxBps", type: "uint256" },
        { name: "holderFeeBps", type: "uint256" },
        {
          name: "metadata",
          type: "tuple",
          components: [
            { name: "description", type: "string" },
            { name: "image", type: "string" },
            { name: "website", type: "string" },
            { name: "twitter", type: "string" },
            { name: "telegram", type: "string" }
          ]
        },
        { name: "snipeExemptions", type: "address[]" }
      ]
    }],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" }
    ]
  },
  {
    type: "function",
    name: "createTokenAndBuy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "quoteAsset", type: "address" },
          { name: "creatorFeeRecipient", type: "address" },
          { name: "creatorTaxBps", type: "uint256" },
          { name: "holderFeeBps", type: "uint256" },
          {
            name: "metadata",
            type: "tuple",
            components: [
              { name: "description", type: "string" },
              { name: "image", type: "string" },
              { name: "website", type: "string" },
              { name: "twitter", type: "string" },
              { name: "telegram", type: "string" }
            ]
          },
          { name: "snipeExemptions", type: "address[]" }
        ]
      },
      { name: "developerBuyQuote", type: "uint256" },
      { name: "minTokensOut", type: "uint256" }
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
      { name: "tokensOut", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "previewInitialBuy",
    stateMutability: "view",
    inputs: [
      { name: "quoteAsset", type: "address" },
      { name: "creatorTaxBps", type: "uint256" },
      { name: "holderFeeBps", type: "uint256" },
      { name: "quoteIn", type: "uint256" }
    ],
    outputs: [
      { name: "tokensOut", type: "uint256" },
      { name: "effectiveQuoteIn", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "graduationAdapter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "graduations",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "quoteAmount", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "pool", type: "address" },
      { name: "positionId", type: "uint256" },
      { name: "swept", type: "bool" },
      { name: "seeded", type: "bool" }
    ]
  },
  {
    type: "event",
    name: "TokenCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "curve", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "quoteAsset", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "creatorFeeRecipient", type: "address" },
      { indexed: false, name: "creatorTaxBps", type: "uint256" },
      { indexed: false, name: "holderFeeBps", type: "uint256" }
    ]
  }
] as const;

export const celestialTokenAbi = [
  {
    type: "function",
    name: "withdrawableRewardOf",
    stateMutability: "view",
    inputs: [{ name: "holder", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "claimHolderRewards",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }]
  }
] as const;

export const orderBookAbi = [
  {
    type: "function",
    name: "placeBuyOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "curve", type: "address" },
      { name: "quoteAmount", type: "uint256" },
      { name: "minTokensOut", type: "uint256" }
    ],
    outputs: [{ name: "orderId", type: "uint256" }]
  },
  {
    type: "function",
    name: "placeSellOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "curve", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" }
    ],
    outputs: [{ name: "orderId", type: "uint256" }]
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: []
  }
] as const;

export const dexAdapterAbi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  },
  {
    type: "function",
    name: "swapExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  }
] as const;


export const celestialCurveAbi = [
  {
    type: "function",
    name: "quoteAsset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "quoteBuyFor",
    stateMutability: "view",
    inputs: [
      { name: "buyer", type: "address" },
      { name: "quoteIn", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [{ name: "tokenIn", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "quoteIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "trackedQuote",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "graduationThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "graduated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "currentSnipeBps",
    stateMutability: "view",
    inputs: [{ name: "buyer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "creatorTaxBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "holderFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export const celestialFeeEscrowAbi = [
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;
