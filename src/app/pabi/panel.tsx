"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { loadDisplayedUser, supabaseBrowser } from "@/lib/supabase-browser";
import SectionSidebar from "@/components/section-sidebar";
import {
  DEPARTMENT_LABEL,
  departmentFromPath,
  iconsFor,
} from "@/app/pabi/department-icons";
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

export default function Panel() {
  const pathname = usePathname();
  const router = useRouter();
  const { tier } = useDashboardTier();
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDisplayedUser().then((user) => {
      setRole(user?.app_metadata?.role ?? null);
      setEmail(user?.email ?? null);
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
  const icons = department ? iconsFor(department, tier) : [];

  function selectTier(next: DashboardTier) {
    if (next === readDashboardTier()) return;
    writeDashboardTier(next);
    if (!department) return;
    const root = `/${department}`;
    if (pathname !== root) router.push(root);
  }

  return (
    <>
      <div className="section-header rounded-2xl border border-border px-[clamp(16px,3vw,32px)] py-4 backdrop-blur-sm bg-gradient-to-br from-panel-gradient-from/85 to-panel-gradient-to/70">
        <div className="relative flex min-h-14 items-center">
          <Image
            src={logoHorizontal}
            alt="Puerta Abierta"
            height={56}
            className="relative z-10 h-14 w-auto shrink-0"
            priority
          />
          <nav className="glass-nav absolute top-1/2 left-1/2 z-0 -translate-x-1/2 -translate-y-1/2" aria-label="Secciones">
            {SECTIONS.map((section) => {
              const current = isCurrent(pathname, section.href);
              return (
                <a
                  key={section.href}
                  href={section.href}
                  aria-current={current ? "page" : undefined}
                  className="glass-nav-item font-semibold uppercase tracking-wide"
                >
                  {section.label}
                </a>
              );
            })}
          </nav>
          <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
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
      {department && icons.length > 0 ? (
        <SectionSidebar label={DEPARTMENT_LABEL[department]} items={icons} />
      ) : null}
    </>
  );
}
