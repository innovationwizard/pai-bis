import type { ReactNode } from "react";
import SiteNav from "@/components/site-nav";

export default function PanelGroupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
