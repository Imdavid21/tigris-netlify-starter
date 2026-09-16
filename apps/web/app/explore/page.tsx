
import { ui } from "@/styles/ui";
import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";
export default function ExplorePage() {
  return <main className={ui("app-shell explore-page")}><AppHeader /><Launches /><SiteFooter /></main>;
}
