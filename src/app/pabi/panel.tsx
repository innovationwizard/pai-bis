"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { loadDisplayedUser, supabaseBrowser } from "@/lib/supabase-browser";
import { departmentFromPath } from "@/app/pabi/department-icons";
import {
  readDashboardTier,
  useDashboardTier,
  writeDashboardTier,
  type DashboardTier,
} from "@/lib/dashboard-tier";
import logoHorizontal from "./assets/logo-horizontal.png";

const SECTIONS = [
  { href: "/mercadeo", label: "Mercadeo" },
  { href: "/ventas", label: "Ventas" },
  { href: "/cobros", label: "Cobros" },
  { href: "/creditos", label: "Créditos" },
  { href: "/entregas", label: "Entregas" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type LoadedIdentity = { role: string | null; email: string | null };

let clientIdentity: LoadedIdentity | null = null;

export default function Panel() {
  const pathname = usePathname();
  const router = useRouter();
  const { tier } = useDashboardTier();
  const [role, setRole] = useState<string | null | undefined>(() => clientIdentity?.role);
  const [email, setEmail] = useState<string | null>(() => clientIdentity?.email ?? null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clientIdentity) return;
    loadDisplayedUser().then((user) => {
      const next = {
        role: (user?.app_metadata?.role as string | undefined) ?? null,
        email: user?.email ?? null,
      };
      clientIdentity = next;
      setRole(next.role);
      setEmail(next.email);
    });
  }, []);

  useEffect(() => {
    if (role === undefined) return;
    if (role === "ventas") {
      try {
        const raw = sessionStorage.getItem("orion:current-salesperson");
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.data?.salesperson?.display_name) {
            setDisplayName(cached.data.salesperson.display_name);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (email) {
      setDisplayName(email.split("@")[0]);
    }
  }, [role, email]);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      try {
        sessionStorage.removeItem("orion:current-salesperson");
      } catch {
        /* ok */
      }
      await supabaseBrowser.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }, []);

  if (role === undefined) return null;

  const resolvedName = displayName ?? "Usuario";
  const department = departmentFromPath(pathname);

  function selectTier(next: DashboardTier) {
    if (next === readDashboardTier()) return;
    writeDashboardTier(next);
    if (!department) return;
    const root = `/${department}`;
    if (pathname !== root) router.push(root);
  }

  return (
    <div className="section-header rounded-2xl border border-border px-[clamp(16px,3vw,32px)] py-4 backdrop-blur-sm bg-gradient-to-br from-panel-gradient-from/85 to-panel-gradient-to/70">
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="logo-mark">
          <Image
            src={logoHorizontal}
            alt="Puerta Abierta"
            height={56}
            className="pointer-events-none"
            priority
          />
        </div>
        <nav className="glass-nav z-10" aria-label="Secciones">
          {SECTIONS.map((section) => {
            const current = isCurrent(pathname, section.href);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={current ? "page" : undefined}
                className="glass-nav-item font-semibold uppercase tracking-wide"
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
        <div className="z-10 flex items-center justify-self-end gap-3">
          <div className="tier-switch tier-switch-compact" role="group" aria-label="Nivel del tablero">
            <button
              type="button"
              aria-pressed={tier === "operativo"}
              aria-label="Operativo"
              onClick={() => selectTier("operativo")}
            >
              O
            </button>
            <button
              type="button"
              aria-pressed={tier === "directivo"}
              aria-label="Directivo"
              onClick={() => selectTier("directivo")}
            >
              D
            </button>
          </div>
          <div ref={accountRef} className="relative">
            <button
              type="button"
              className="glass-chevron"
              aria-expanded={accountOpen}
              aria-controls="account-panel"
              aria-label={accountOpen ? "Cerrar cuenta" : "Abrir cuenta"}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                <path d="M3 5.25 7 9.25 11 5.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {accountOpen ? (
              <div id="account-panel" className="glass-account">
                <p className="glass-account-name">{resolvedName}</p>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  className="glass-account-signout"
                >
                  {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
