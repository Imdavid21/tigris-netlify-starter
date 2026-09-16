import styles from "./TokenCard.module.css";

type TokenCardProps = {
  href: string;
  image?: string | null;
  name: string;
  symbol: string;
  badge: string;
  graduated?: boolean;
  value: string;
  metaLeft: string;
  metaRight: string;
  footLeft: string;
  footRight: string;
  progress?: number;
};

export function TokenCard({
  href,
  image,
  name,
  symbol,
  badge,
  graduated = false,
  value,
  metaLeft,
  metaRight,
  footLeft,
  footRight,
  progress
}: TokenCardProps) {
  const safeProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <a href={href} className={styles.card}>
      <div className={styles.media}>
        {image ? (
          <img className={styles.image} src={image} alt="" loading="lazy" />
        ) : (
          <div className={styles.fallback} aria-hidden="true">
            {symbol.slice(0, 2).toUpperCase() || "✦"}
          </div>
        )}
        <span className={`${styles.badge} ${graduated ? styles.graduated : ""}`}>
          {badge}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.title}>
          <strong>{name}</strong>
          <span>${symbol}</span>
        </div>

        <div className={styles.value}>{value}</div>

        <div className={styles.meta}>
          <span>{metaLeft}</span>
          <span>{metaRight}</span>
        </div>

        {safeProgress !== undefined && !graduated && (
          <div className={styles.progress} aria-label={`${safeProgress.toFixed(0)}% to graduation`}>
            <span style={{ width: `${safeProgress}%` }} />
          </div>
        )}

        <div className={styles.foot}>
          <span>{footLeft}</span>
          <span>{footRight}</span>
        </div>
      </div>
    </a>
  );
}
