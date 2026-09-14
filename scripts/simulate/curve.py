from dataclasses import dataclass

@dataclass(frozen=True)
class CurveConfig:
    total_supply: float = 1_000_000_000
    curve_share: float = 0.80
    graduation_usdc: float = 10_000
    fee_rate: float = 0.01

def simulate(c: CurveConfig):
    curve_tokens = c.total_supply * c.curve_share
    reserved_tokens = c.total_supply - curve_tokens

    # Choose phantom reserve so exhausting the curve allocation leaves
    # reserved_tokens / total_supply of the initial virtual token reserve.
    phantom_usdc = c.graduation_usdc * reserved_tokens / curve_tokens

    opening_price = phantom_usdc / c.total_supply
    opening_fdv = opening_price * c.total_supply

    final_virtual_usdc = phantom_usdc + c.graduation_usdc
    final_virtual_tokens = reserved_tokens
    graduation_price = final_virtual_usdc / final_virtual_tokens
    graduation_fdv = graduation_price * c.total_supply

    gross_buy_volume = c.graduation_usdc / (1 - c.fee_rate)

    return {
        "curve_tokens": curve_tokens,
        "reserved_tokens": reserved_tokens,
        "phantom_usdc": phantom_usdc,
        "opening_fdv": opening_fdv,
        "graduation_fdv": graduation_fdv,
        "price_multiple": graduation_price / opening_price,
        "gross_buy_volume": gross_buy_volume,
        "fees_on_pure_up_path": gross_buy_volume - c.graduation_usdc,
    }

if __name__ == "__main__":
    for k, v in simulate(CurveConfig()).items():
        print(f"{k}: {v:,.6f}")
