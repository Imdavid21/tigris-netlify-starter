# Initial curve economics

All constants are provisional until fuzz, invariant, and lifecycle testing complete.

- Total supply: 1,000,000,000
- Curve allocation: 800,000,000
- Graduation allocation: 200,000,000
- Quote asset: Arc USDC ERC-20 interface
- USDC accounting: 6 decimals
- Initial graduation target: 10,000 USDC
- Initial phantom quote reserve: 2,500 USDC
- Initial trading fee: 1%
- Initial protocol share of trading fee: 75%
- Initial creator share of trading fee: 25%

At zero real quote reserve:

- virtual token reserve: 1B
- virtual USDC reserve: $2,500
- implied opening FDV: $2,500

At 800M tokens sold under the idealized zero-fee reserve path:

- virtual token reserve: 200M
- virtual USDC reserve: $12,500
- implied graduation FDV: $62,500
- price multiple: 25x

These values are design inputs, not production commitments.
