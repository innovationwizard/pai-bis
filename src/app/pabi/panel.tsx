"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import DepartmentIconNav from "@/components/department-icon-nav";
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
  { href: "/ventas", label: "Ventas" },
  { href: "/mercadeo", label: "Mercadeo" },
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
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setRole(data.user?.app_metadata?.role ?? null);
      setEmail(data.user?.email ?? null);
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
    <div className="rounded-2xl border border-border px-[clamp(16px,3vw,32px)] py-4 backdrop-blur-sm bg-gradient-to-br from-panel-gradient-from/85 to-panel-gradient-to/70 flex flex-col gap-4">
      <div className="flex justify-center">
        <Image src={logoHorizontal} alt="Puerta Abierta" height={64} className="h-16 w-auto" priority />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="col-start-1 row-start-2 flex justify-start md:col-start-1 md:row-start-1">
          <div className="tier-switch" role="group" aria-label="Nivel del tablero">
            <button type="button" aria-pressed={tier === "operativo"} onClick={() => selectTier("operativo")}>
              Operativo
            </button>
            <button type="button" aria-pressed={tier === "directivo"} onClick={() => selectTier("directivo")}>
              Directivo
            </button>
          </div>
        </div>
        <nav className="glass-nav col-span-2 row-start-1 justify-self-center md:col-span-1 md:col-start-2" aria-label="Secciones">
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
        <div ref={accountRef} className="relative col-start-2 row-start-2 flex justify-end md:col-start-3 md:row-start-1">
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
      {department && icons.length > 0 ? (
        <DepartmentIconNav label={DEPARTMENT_LABEL[department]} items={icons} />
      ) : null}
    </div>
  );
}
