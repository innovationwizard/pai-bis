import SiteNav from "@/components/site-nav";
import type { ReactNode } from "react";

export default function SectionPage({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div>
      <SiteNav />
      {title ? (
        <div className="p-[clamp(16px,3vw,32px)] max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: "#0d2041" }}>
            {title}
          </h1>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
