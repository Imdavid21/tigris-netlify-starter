import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import styles from "./TokenPage.module.css";

export default function TokenLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      {children}
      <SiteFooter />
    </div>
  );
}
