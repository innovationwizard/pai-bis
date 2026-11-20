import type { LucideIcon } from "lucide-react";
import { Megaphone } from "lucide-react";

export type MercadeoSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

/** The page ends at the Campañas band inside Performance Ads. */
export const MERCADEO_SECTIONS: readonly MercadeoSection[] = [
  { slug: "performance-ads", title: "Performance Ads", icon: Megaphone },
];

export function mercadeoSectionPath(slug: string): string {
  return `/mercadeo#${slug}`;
}
