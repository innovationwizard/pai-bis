import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { AuthHashRedirect } from "@/components/auth-hash-redirect";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

const metadataBase = new URL(
  siteUrl ?? "https://orion-intelligence.vercel.app"
);

const baseUrl = metadataBase.origin;
// Facebook and WhatsApp cache the picture by this exact address. Bump the
// query when the file changes, or a rescrape keeps the previous picture.
const ogImageUrl = `${baseUrl}/og-image.jpg?v=20261104`;

const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "PAI | Reservas, Pagos y Comisiones",
  description: "Puerta Abierta Inmobiliaria — Business Intelligence Dashboard",
  metadataBase,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reservar",
  },
  openGraph: {
    type: "website",
    title: "PAI | Reservas, Pagos y Comisiones",
    description: "Puerta Abierta Inmobiliaria — Business Intelligence Dashboard",
    url: `${baseUrl}/`,
    siteName: "Puerta Abierta Inmobiliaria",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Puerta Abierta Inmobiliaria",
        type: "image/jpeg"
      }
    ]
  },
  other: {
    "og:type": "website",
    ...(fbAppId && { "fb:app_id": fbAppId })
  }
};

type RootLayoutProps = {
  children: ReactNode;
};

// Every page renders on the request. A prerendered document is served from the
// CDN, including as a 304, and that response never runs the session proxy.
// The browser then drops Set-Cookie, the next refresh reuses a dead token,
// and Supabase revokes the login. The screens answer "No autorizado".
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: RootLayoutProps) {
  await connection();
  return (
    <html lang="es-419">
      <body>
        <AuthHashRedirect />
        <main className="p-[clamp(16px,4vw,32px)] grid gap-[clamp(16px,3vw,28px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
