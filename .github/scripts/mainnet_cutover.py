from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_required(path: Path, old: str, new: str):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new))


# Production components must never link to the testnet explorer.
for base in [ROOT / "apps/web/components", ROOT / "apps/web/app"]:
    for path in base.rglob("*.tsx"):
        if "testnet" in path.parts:
            continue
        text = path.read_text()
        updated = text.replace("https://testnet.arcscan.app", "https://arc-scan.org")
        updated = updated.replace("https://testnet.arc-scan.org", "https://arc-scan.org")
        if updated != text:
            path.write_text(updated)

# Retry transient API cold starts without leaking raw browser errors into the UI.
launches = ROOT / "apps/web/components/launches.tsx"
text = launches.read_text()
helper_marker = "async function fetchMarketsWithRetry()"
if helper_marker not in text:
    marker = "export function Launches() {"
    if marker not in text:
        raise SystemExit("Launches component marker not found")
    helper = '''async function fetchMarketsWithRetry() {\n  let lastStatus = 0;\n\n  for (let attempt = 0; attempt < 3; attempt += 1) {\n    try {\n      const response = await fetch(API_URL + \"/tokens?limit=100\", { cache: \"no-store\" });\n      lastStatus = response.status;\n      if (response.ok) return response.json();\n    } catch {\n      // Render can briefly refuse connections while a new release becomes healthy.\n    }\n\n    if (attempt < 2) {\n      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));\n    }\n  }\n\n  throw new Error(lastStatus ? \"Market data is temporarily unavailable.\" : \"Market data is reconnecting.\");\n}\n\n'''
    text = text.replace(marker, helper + marker, 1)

old_fetch = '''        const response = await fetch(API_URL + "/tokens?limit=100");\n        if (!response.ok) throw new Error("Market index is temporarily unavailable.");\n        const payload = await response.json();'''
new_fetch = '''        const payload = await fetchMarketsWithRetry();'''
if old_fetch in text:
    text = text.replace(old_fetch, new_fetch, 1)
elif new_fetch not in text:
    raise SystemExit("Launches market fetch block changed unexpectedly")
launches.write_text(text)

# Mainnet defaults in the example config. Testnet remains documented on /testnet.
env_file = ROOT / ".env.example"
env = env_file.read_text()
env = env.replace("ARC_CHAIN_ID=5042002", "ARC_CHAIN_ID=5042", 1)
env = env.replace("ARC_RPC_URL=https://rpc.testnet.arc.network", "ARC_RPC_URL=https://rpc.mainnet.arc.io", 1)
env = env.replace("NEXT_PUBLIC_ARC_CHAIN_ID=5042002", "NEXT_PUBLIC_ARC_CHAIN_ID=5042", 1)
env = env.replace("NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network", "NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io", 1)
env = env.replace("NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arc-scan.org", "NEXT_PUBLIC_ARC_EXPLORER_URL=https://arc-scan.org", 1)
env = env.replace("DATABASE_SCHEMA=public", "DATABASE_SCHEMA=mainnet", 1)
env_file.write_text(env)

# Static, read-only archive. It deliberately does not use the production wallet,
# indexer, API, or protocol status components.
testnet_dir = ROOT / "apps/web/app/testnet"
testnet_dir.mkdir(parents=True, exist_ok=True)
(testnet_dir / "page.tsx").write_text('''import styles from "./testnet.module.css";\n\nconst contracts = [\n  ["Celestial factory", "0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826"],\n  ["Fee escrow", "0xab922E5F1Ff1071a00a339C8b5FcF7d2f6F2a4e0"],\n  ["Buyback vault", "0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8"],\n  ["Liquidity locker", "0x3e535c6F3daE1594A1C9ebB55E49175abC03bf77"],\n  ["Limit order book", "0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62"],\n  ["Legacy V1 factory", "0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423"]\n] as const;\n\nconst explorer = "https://testnet.arc-scan.org";\n\nexport default function TestnetArchivePage() {\n  return (\n    <main className={styles.page}>\n      <header className={styles.header}>\n        <a href="/explore" className={styles.brand}>supershot.fun</a>\n        <a href="/explore" className={styles.back}>Back to mainnet</a>\n      </header>\n\n      <section className={styles.hero}>\n        <span className={styles.badge}>Arc Testnet · Chain 5042002</span>\n        <h1>Testnet archive</h1>\n        <p>Historical Supershot deployments from Arc Testnet. Production markets, balances, and trading now live on Arc Mainnet.</p>\n      </section>\n\n      <section className={styles.panel}>\n        <div className={styles.panelHead}>\n          <div>\n            <h2>Archived contracts</h2>\n            <p>Read-only references. Testnet assets have no relationship to mainnet assets.</p>\n          </div>\n          <a href={explorer} target="_blank" rel="noreferrer">Open testnet explorer</a>\n        </div>\n\n        <div className={styles.rows}>\n          {contracts.map(([label, address]) => (\n            <a key={address} className={styles.row} href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer">\n              <span>{label}</span>\n              <code>{address}</code>\n            </a>\n          ))}\n        </div>\n      </section>\n\n      <section className={styles.note}>\n        <strong>Production is Arc Mainnet.</strong>\n        <span>The live app does not read testnet contracts or testnet indexed market data.</span>\n      </section>\n    </main>\n  );\n}\n''')

(testnet_dir / "testnet.module.css").write_text('''.page {\n  min-height: 100vh;\n  padding: 0 24px 64px;\n  background: var(--md-sys-color-background);\n  color: var(--md-sys-color-on-background);\n}\n\n.header {\n  width: min(100%, 1180px);\n  min-height: 72px;\n  margin: 0 auto;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  border-bottom: 1px solid var(--md-sys-color-outline-variant);\n}\n\n.brand {\n  color: var(--md-sys-color-on-surface);\n  font-weight: 700;\n  letter-spacing: -.02em;\n}\n\n.back, .panelHead a {\n  color: var(--md-sys-color-primary);\n  font-size: 14px;\n}\n\n.hero, .panel, .note {\n  width: min(100%, 980px);\n  margin-left: auto;\n  margin-right: auto;\n}\n\n.hero {\n  padding: 72px 0 36px;\n}\n\n.badge {\n  display: inline-flex;\n  padding: 7px 11px;\n  border: 1px solid var(--md-sys-color-outline-variant);\n  border-radius: 999px;\n  color: var(--md-sys-color-on-surface-variant);\n  font-size: 12px;\n}\n\n.hero h1 {\n  margin: 18px 0 10px;\n  font-size: clamp(38px, 7vw, 72px);\n  line-height: .98;\n  letter-spacing: -.055em;\n}\n\n.hero p {\n  max-width: 680px;\n  margin: 0;\n  color: var(--md-sys-color-on-surface-variant);\n  line-height: 1.6;\n}\n\n.panel {\n  overflow: hidden;\n  border: 1px solid var(--md-sys-color-outline-variant);\n  border-radius: 24px;\n  background: var(--md-sys-color-surface-container-low);\n}\n\n.panelHead {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 20px;\n  padding: 24px;\n  border-bottom: 1px solid var(--md-sys-color-outline-variant);\n}\n\n.panelHead h2, .panelHead p { margin: 0; }\n.panelHead h2 { font-size: 20px; }\n.panelHead p { margin-top: 5px; color: var(--md-sys-color-on-surface-variant); font-size: 13px; }\n\n.rows { display: grid; }\n.row {\n  display: grid;\n  grid-template-columns: minmax(140px, 1fr) minmax(0, 2fr);\n  gap: 20px;\n  padding: 17px 24px;\n  color: inherit;\n  border-bottom: 1px solid var(--md-sys-color-outline-variant);\n}\n.row:last-child { border-bottom: 0; }\n.row:hover { background: var(--md-sys-color-surface-container); }\n.row span { color: var(--md-sys-color-on-surface-variant); }\n.row code { overflow: hidden; text-overflow: ellipsis; text-align: right; }\n\n.note {\n  display: flex;\n  gap: 10px;\n  margin-top: 18px;\n  padding: 16px 18px;\n  border-radius: 16px;\n  background: var(--md-sys-color-surface-container);\n  font-size: 13px;\n}\n.note span { color: var(--md-sys-color-on-surface-variant); }\n\n@media (max-width: 680px) {\n  .page { padding: 0 14px 48px; }\n  .hero { padding-top: 48px; }\n  .panelHead { display: grid; }\n  .row { grid-template-columns: 1fr; gap: 6px; }\n  .row code { text-align: left; font-size: 11px; }\n  .note { display: grid; }\n}\n''')

# Record the production deployment for future agents.
mainnet_doc = ROOT / "docs/MAINNET_DEPLOYMENT.md"
if mainnet_doc.exists():
    doc = mainnet_doc.read_text()
else:
    doc = "# Arc Mainnet Deployment\n"
marker = "## Production deployment · 2026-09-16"
if marker not in doc:
    doc += '''\n\n## Production deployment · 2026-09-16\n\n- Chain ID: `5042`\n- Deployment blocks: `21158188` to `21158206`\n- Factory: `0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423`\n- Fee escrow: `0x6D1597932B93b9939f21E9A8D8C2908457F7925d`\n- Buyback vault: `0xf58489A0B285F3b0046FF53a055b80E69a6e15eB`\n- Liquidity locker: `0xE7fFCe43E0eCA4C27e3bB1985C231DBB97145896`\n- Limit order book: `0xED7b5904e272d3DF891179D916D2E3A939ed1471`\n- Uniswap v4 hook: `0x3aC85a7cB39981c95c005E5d72a5Df24d0bb2000`\n- Uniswap v4 connector: `0x0A30D71fB42b7cD92596e9a200d7a101E34DA956`\n- DEX/graduation adapter: `0x4c40f0C8DfC518f436A9a5244179a0Dac145eE43`\n- USDC: `0x3600000000000000000000000000000000000000`\n- Production database schema: `mainnet`\n- Testnet data remains isolated in the `public` schema and is not used by production routes.\n'''
    mainnet_doc.write_text(doc)

agents = ROOT / "AGENTS.md"
if agents.exists():
    text = agents.read_text()
    marker = "## Arc Mainnet production · 2026-09-16"
    if marker not in text:
        text += '''\n\n## Arc Mainnet production · 2026-09-16\n\nProduction chain is Arc Mainnet, chain ID `5042`, RPC `https://rpc.mainnet.arc.io`. Supershot production deploy spans blocks `21158188` to `21158206`. Factory `0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423`, fee escrow `0x6D1597932B93b9939f21E9A8D8C2908457F7925d`, buyback vault `0xf58489A0B285F3b0046FF53a055b80E69a6e15eB`, liquidity locker `0xE7fFCe43E0eCA4C27e3bB1985C231DBB97145896`, order book `0xED7b5904e272d3DF891179D916D2E3A939ed1471`, v4 hook `0x3aC85a7cB39981c95c005E5d72a5Df24d0bb2000`, v4 connector `0x0A30D71fB42b7cD92596e9a200d7a101E34DA956`, and DEX adapter `0x4c40f0C8DfC518f436A9a5244179a0Dac145eE43`. Mainnet backend/indexer uses PostgreSQL schema `mainnet`; historical testnet rows remain in `public`. Production frontend must never fall back to testnet addresses or testnet explorer links. Testnet references belong under `/testnet`.\n'''
        agents.write_text(text)

# Refuse to commit obvious testnet explorer leakage in the production component tree.
leaks = []
for path in (ROOT / "apps/web/components").rglob("*.tsx"):
    data = path.read_text()
    if "testnet.arc" in data:
        leaks.append(str(path.relative_to(ROOT)))
if leaks:
    raise SystemExit("testnet explorer links remain in production components: " + ", ".join(leaks))

print("mainnet cutover source cleanup complete")
