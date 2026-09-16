"use client";

import { motion } from "motion/react";
import { CelestialLogo } from "@/components/celestial-logo";
import { flowContainer, flowItem, motionSpring } from "@/lib/motion-system";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <motion.footer
      className={styles.footer}
      variants={flowContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
      layout
      transition={{ layout: motionSpring.spatialDefault }}
    >
      <motion.div className={styles.brandBlock} variants={flowItem}>
        <motion.a
          href="/explore"
          className={styles.brand}
          aria-label="Celestial Explore"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={motionSpring.spatialFast}
        >
          <motion.span whileHover={{ rotate: 8, scale: 1.05 }} transition={motionSpring.spatialFast}>
            <CelestialLogo className={styles.logo} />
          </motion.span>
          <span>Celestial</span>
        </motion.a>
        <p>
          Non-custodial token launches and onchain markets on Arc. Your wallet signs every transaction.
        </p>
      </motion.div>

      <motion.div className={styles.column} variants={flowItem}>
        <strong>Product</strong>
        <motion.a href="/explore" whileHover={{ x: 3 }}>Explore</motion.a>
        <motion.a href="/analytics" whileHover={{ x: 3 }}>Analytics</motion.a>
        <motion.a href="/create" whileHover={{ x: 3 }}>Create</motion.a>
        <motion.a href="/portfolio" whileHover={{ x: 3 }}>Portfolio</motion.a>
      </motion.div>

      <motion.div className={styles.column} variants={flowItem}>
        <strong>Network</strong>
        <motion.a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" whileHover={{ x: 3 }}>Arc Explorer</motion.a>
        <motion.a href="/scanner" whileHover={{ x: 3 }}>Scanner</motion.a>
      </motion.div>

      <motion.div className={styles.risk} variants={flowItem}>
        <strong>Risk</strong>
        <p>
          Transactions are irreversible. Token markets can be volatile and may lose all value.
        </p>
      </motion.div>

      <motion.div className={styles.bottom} variants={flowItem} layout="position">
        <span>© Celestial · Arc Testnet</span>
        <div className={styles.bottomLinks}>
          <motion.a href="/analytics" whileHover={{ y: -1 }}>Protocol data</motion.a>
          <motion.a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" whileHover={{ y: -1 }}>Arc</motion.a>
        </div>
      </motion.div>
    </motion.footer>
  );
}
