import SiteNav from "@/components/site-nav";

export default function SectionPage({ title }: { title?: string }) {
  return (
    <div>
      <SiteNav />
      {title ? (
        <div className="p-[clamp(16px,3vw,32px)] max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        </div>
      ) : null}
    </div>
  );
}
