export const factoryAbi = [
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
    type: "event",
    name: "Buy",
    anonymous: false,
    inputs: [
      { indexed: true, name: "trader", type: "address" },
      { indexed: false, name: "quoteIn", type: "uint256" },
      { indexed: false, name: "tokensOut", type: "uint256" },
      { indexed: false, name: "fee", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "Sell",
    anonymous: false,
    inputs: [
      { indexed: true, name: "trader", type: "address" },
      { indexed: false, name: "tokensIn", type: "uint256" },
      { indexed: false, name: "quoteOut", type: "uint256" },
      { indexed: false, name: "fee", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "GraduationStarted",
    anonymous: false,
    inputs: [
      { indexed: false, name: "quoteAmount", type: "uint256" },
      { indexed: false, name: "tokenAmount", type: "uint256" }
    ]
  }
] as const;
