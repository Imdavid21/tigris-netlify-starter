export const factoryAbi = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" }
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" }
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
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" }
    ]
  }
] as const;

export const curveAbi = [
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [{ name: "quoteIn", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [{ name: "tokenIn", type: "uint256" }],
    outputs: [{ name: "netQuoteOut", type: "uint256" }]
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "quoteIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" }
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }]
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" }
    ],
    outputs: [{ name: "quoteOut", type: "uint256" }]
  }
] as const;
