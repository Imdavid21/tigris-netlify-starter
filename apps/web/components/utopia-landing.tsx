"use client";

import { useEffect, useRef } from "react";

function Mask({ variant = 0, className = "" }: { variant?: number; className?: string }) {
  const fills = ["#e9e5dc", "#d7d2c7", "#16181d", "#f2eee5", "#a7a39c", "#24262d"];
  const base = fills[variant % fills.length];
  const dark = variant % 3 === 2;
  return (
    <svg className={className} viewBox="0 0 220 300" aria-hidden="true">
      <defs>
        <linearGradient id={`mask-g-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark ? "#2b2d34" : base} />
          <stop offset=".5" stopColor={dark ? "#111217" : "#f7f2ea"} />
          <stop offset="1" stopColor={dark ? "#383a43" : base} />
        </linearGradient>
        <filter id={`grain-${variant}`}>
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed={variant + 2} result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono"><feFuncA type="table" tableValues="0 .12" /></feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <path d="M110 7C56 7 26 45 22 102l10 107c5 54 38 84 78 84s73-30 78-84l10-107C194 45 164 7 110 7Z" fill={`url(#mask-g-${variant})`} stroke="#ff2424" strokeWidth="2" filter={`url(#grain-${variant})`} />
      <path d="M43 94c20-17 43-18 63-6-11 26-26 35-52 27-7-2-11-11-11-21Zm134 0c-20-17-43-18-63-6 11 26 26 35 52 27 7-2 11-11 11-21Z" fill={dark ? "#ff2424" : "#16181d"} />
      <path d="M110 83 91 168l19 16 19-16-19-85Z" fill="none" stroke="#ff2424" strokeWidth="5" />
      <path d="M65 206c29 20 61 20 90 0-4 34-20 55-45 55s-41-21-45-55Z" fill="#ff2424" stroke="#111218" strokeWidth="5" />
      <path d="M77 220c21 13 45 13 66 0M94 28l8 27M126 28l-8 27M35 143l34 11M185 143l-34 11" stroke={dark ? "#f2eee5" : "#ff2424"} strokeWidth="4" fill="none" />
      {variant % 2 === 0 && <path d="M47 62 82 35M173 62l-35-27" stroke="#ff2424" strokeWidth="7" />}
      {variant % 3 === 1 && <path d="M31 174 74 160M189 174l-43-14" stroke="#15171c" strokeWidth="6" />}
    </svg>
  );
}

const gallery = Array.from({ length: 13 }, (_, i) => i);

export function UtopiaLanding() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const onMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      node.style.setProperty("--mx", x.toFixed(3));
      node.style.setProperty("--my", y.toFixed(3));
    };

    const onScroll = () => {
      node.style.setProperty("--scroll", String(window.scrollY));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="utopia" ref={root}>
      <header className="utopia-hero-red">
        <div className="utopia-microbar">
          <span>CELESTIAL/ARC</span>
          <span>BLOCK 5042002</span>
          <span>ONLINE</span>
        </div>
        <div className="utopia-wordmark"><b>CELESTIAL</b><span>ARC</span></div>
        <div className="utopia-hero-grid">
          <div className="utopia-triad">LAUNCH.<br />TRADE.<br />WATCH.</div>
          <div className="utopia-hero-copy">
            Permissionless markets on Arc. Launch assets, discover live markets, and trade through non-custodial smart contracts.
          </div>
          <div className="utopia-hero-mask-wrap">
            <Mask variant={0} className="utopia-hero-mask" />
            <span className="utopia-mask-crosshair" />
          </div>
        </div>
        <div className="utopia-hero-links"><a href="/explore">EXPLORE MARKETS</a><a href="/create">CREATE MARKET</a><a href="/portfolio">PORTFOLIO</a></div>
      </header>

      <main>
        <section className="utopia-manifesto">
          <div className="utopia-lines" aria-hidden="true" />
          <div className="utopia-manifesto-copy">
            <span>EXPLORE</span>
            <span>MARKETS</span>
            <span>OF</span>
            <span>CELESTIAL</span>
            <span>WHERE</span>
            <span>MEMES</span>
            <span>AND</span>
            <span>MARKETS</span>
            <span>COLLIDE</span>
          </div>
          <div className="utopia-mask-totem">
            {[1, 2, 3, 4].map((v, i) => <Mask key={v} variant={v} className={`utopia-totem-mask utopia-totem-${i}`} />)}
          </div>
          <div className="utopia-kanji" aria-hidden="true">天<br />体<br />市<br />場</div>
          <div className="utopia-side-note">ONCHAIN MARKET CULTURE<br />ARC TESTNET / CELESTIAL</div>
        </section>

        <section className="utopia-gallery" id="masks">
          <div className="utopia-gallery-gridlines" aria-hidden="true" />
          {gallery.map((v) => (
            <a key={v} href="/explore" className={`utopia-gallery-mask g${v}`}>
              <Mask variant={v} />
            </a>
          ))}
          <div className="utopia-gallery-brand">CELESTIAL</div>
        </section>

        <section className="utopia-ideogram">
          <div className="utopia-orbit">CELESTIAL</div>
          <div className="utopia-big-kanji">市場</div>
          <div className="utopia-index-row">
            <span>LAUNCH</span><span>TRADE</span><span>DISCOVER</span><span>HOLD</span><span>GRADUATE</span><span>ARC</span>
          </div>
          <p>ONCHAIN MARKETS MOVE THROUGH CURVES, ORDERS, HOLDERS, AND LIQUIDITY.</p>
        </section>

        <section className="utopia-void">
          <div className="utopia-void-grid" />
          <div className="utopia-floating-code">01 / CURVE</div>
          <div className="utopia-floating-code two">02 / HOLDERS</div>
          <div className="utopia-floating-code three">03 / ORDERS</div>
        </section>

        <section className="utopia-your-mask">
          <div className="utopia-blurfield" />
          <div className="utopia-rings" aria-hidden="true"><span /><span /><span /></div>
          <h2>YOUR MARKET</h2>
          <div className="utopia-index-mark">01</div>
          <a href="/create" className="utopia-cta">LAUNCH ON ARC</a>
        </section>
      </main>

      <footer className="utopia-footer">
        <div className="utopia-footer-copy">Celestial turns ideas into permissionless markets. Launch, trade, and graduate assets through contracts on Arc.</div>
        <div className="utopia-footer-meta"><span>CREDITS</span><span>ARC TESTNET</span><span>NON-CUSTODIAL</span></div>
        <div className="utopia-footer-masks">{Array.from({ length: 12 }, (_, i) => <Mask key={i} variant={i} />)}</div>
        <div className="utopia-footer-wordmark"><b>CELESTIAL</b><span>ARC</span></div>
      </footer>
    </div>
  );
}
