import shell from "./shell.module.css";
import discovery from "./discovery.module.css";
import market from "./market.module.css";
import forms from "./forms.module.css";
import dashboard from "./dashboard.module.css";
const modules = [shell, discovery, market, forms, dashboard];
/** Resolve shared semantic class names to locally scoped CSS modules. */
export function ui(value: string): string {
  return value.split(/\s+/).flatMap(name => modules.flatMap(module => module[name] ? [module[name]] : [])).join(" ");
}
