import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import styles from "./TokenPage.module.css";
import layoutFix from "./TradeLayoutFix.module.css";

export default function TokenLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.root} ${layoutFix.fix}`}>
      {children}
      <SiteFooter />
    </div>
  );
}
