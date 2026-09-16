"use client";

import { AnimatePresence, motion } from "motion/react";
import { motionSpring } from "@/lib/motion-system";
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
    <motion.a
      href={href}
      className={styles.card}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.975 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.965 }}
      transition={{
        layout: motionSpring.spatialDefault,
        opacity: motionSpring.effectsFast,
        y: motionSpring.spatialDefault,
        scale: motionSpring.spatialDefault
      }}
      whileHover={{ y: -4, scale: 1.008 }}
      whileTap={{ y: 0, scale: 0.985 }}
      whileFocus={{ scale: 1.006 }}
    >
      <motion.div
        className={styles.media}
        layoutId={`token-media-${href.toLowerCase()}`}
        transition={motionSpring.spatialDefault}
      >
        {image ? (
          <motion.img
            className={styles.image}
            src={image}
            alt=""
            loading="lazy"
            initial={{ scale: 1.025, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={motionSpring.effectsDefault}
          />
        ) : (
          <div className={styles.fallback} aria-hidden="true">
            {symbol.slice(0, 2).toUpperCase() || "✦"}
          </div>
        )}
        <motion.span
          className={`${styles.badge} ${graduated ? styles.graduated : ""}`}
          layout
          transition={motionSpring.spatialFast}
        >
          {badge}
        </motion.span>
      </motion.div>

      <motion.div className={styles.body} layout="position">
        <div className={styles.title}>
          <motion.strong layout="position">{name}</motion.strong>
          <span>${symbol}</span>
        </div>

        <motion.div className={styles.value} layout="position">{value}</motion.div>

        <div className={styles.meta}>
          <span>{metaLeft}</span>
          <span>{metaRight}</span>
        </div>

        <AnimatePresence initial={false}>
          {safeProgress !== undefined && !graduated && (
            <motion.div
              className={styles.progress}
              aria-label={`${safeProgress.toFixed(0)}% to graduation`}
              initial={{ opacity: 0, scaleX: 0.92 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.96 }}
              transition={motionSpring.effectsFast}
              style={{ transformOrigin: "left center" }}
            >
              <motion.span
                initial={false}
                animate={{ width: `${safeProgress}%` }}
                transition={motionSpring.spatialDefault}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.foot}>
          <span>{footLeft}</span>
          <span>{footRight}</span>
        </div>
      </motion.div>
    </motion.a>
  );
}
