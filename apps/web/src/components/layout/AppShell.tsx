"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleHelp,
  Clock3,
  Hand,
  History,
  LogOut,
  Maximize,
  Menu,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAttentionStore } from "@/features/attention/application/attention-store";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { href: "/atender", label: "Atención", description: "Señas y respuestas", icon: Hand },
  { href: "/historial", label: "Historial", description: "Atenciones guardadas", icon: History },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const records = useAttentionStore((state) => state.records);
  const activeRecordId = useAttentionStore((state) => state.activeRecordId);
  const activeRecord = records.find((record) => record.id === activeRecordId);

  useEffect(() => {
    const updateClock = () => setClock(new Intl.DateTimeFormat("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [highContrast]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setSignOutError("No se pudo cerrar la sesión. Intenta otra vez.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("No se pudo cerrar la sesión. Intenta otra vez.");
    }
  }

  return (
    <div className={`app-shell ${highContrast ? "app-shell--high-contrast" : ""}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <header className="app-header">
        <div className="header-brand">
          <button
            className="icon-button mobile-menu-button"
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <span className="brand-mark" aria-hidden="true"><Hand size={23} strokeWidth={2.3} /></span>
          <span className="brand-name">La Voz de tus Manos</span>
          <span className="header-divider" aria-hidden="true" />
          <span className="brand-subtitle">Comunicación accesible en trámites</span>
        </div>
        <div className="header-tools">
          {activeRecord?.status === "active" ? (
            <span className="attention-live"><span aria-hidden="true" /> Atención en curso</span>
          ) : (
            <span className="attention-live attention-live--quiet">Sin atención activa</span>
          )}
          <span className="clock-label">
            <Clock3 size={16} aria-hidden="true" />
            <time>{clock || "--:--"}</time>
          </span>
          <span className="header-divider header-divider--small" aria-hidden="true" />
          <button className="icon-button" type="button" onClick={toggleFullscreen} aria-label="Pantalla completa" title="Pantalla completa">
            <Maximize size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => setHelpOpen(true)} aria-label="Ayuda" title="Ayuda">
            <CircleHelp size={19} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Configuración" title="Configuración">
            <Settings2 size={19} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => void handleSignOut()} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={`workspace-layout ${collapsed ? "workspace-layout--collapsed" : ""}`}>
        <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`} aria-label="Navegación principal">
          <div className="sidebar-topline">
            <span className="sidebar-topline-label">Navegación</span>
            <button
              className="icon-button sidebar-collapse-button"
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
              aria-expanded={!collapsed}
              aria-controls="primary-navigation"
              title={collapsed ? "Expandir menú" : "Contraer menú"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              className="icon-button sidebar-mobile-close"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav className="sidebar-navigation" id="primary-navigation" aria-label="Secciones">
            {navigation.map(({ href, label, description, icon: Icon }) => {
              const current = pathname === href;
              return (
                <Link
                  className={`navigation-link ${current ? "navigation-link--active" : ""}`}
                  href={href}
                  key={href}
                  aria-label={label}
                  aria-current={current ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="navigation-icon"><Icon size={20} aria-hidden="true" /></span>
                  <span className="navigation-copy">
                    <span className="navigation-label">{label}</span>
                    <span className="navigation-description">{description}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <span className="sidebar-footer-icon"><MapPin size={17} aria-hidden="true" /></span>
            <span className="sidebar-footer-copy"><strong>LSB · Bolivia</strong><small>Atención accesible</small></span>
          </div>
        </aside>
        {mobileOpen ? (
          <button className="mobile-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />
        ) : null}

        <main className="workspace-main" id="main-content">
          {signOutError ? <p className="sync-error" role="alert">{signOutError}</p> : null}
          {children}
        </main>
      </div>

      <Dialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Ayuda para esta demostración"
        description="La interfaz guarda las atenciones y conversaciones de tu cuenta. El reconocimiento de señas todavía es demostrativo."
        footer={<Button variant="primary" onClick={() => setHelpOpen(false)}>Entendido</Button>}
      >
        <ul className="dialog-list">
          <li>Revisa y confirma cualquier interpretación antes de añadirla a la conversación.</li>
          <li>La vista previa del avatar es demostrativa y no valida señas en LSB.</li>
          <li>Los mensajes y observaciones se guardan en Supabase; la cámara no almacena sus imágenes ni audio.</li>
        </ul>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Configuración básica"
        description="Preferencias visuales para esta sesión."
      >
        <label className="setting-row">
          <span><strong>Contraste alto</strong><small>Refuerza bordes y contraste del texto.</small></span>
          <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.currentTarget.checked)} />
        </label>
        <p className="help-text">No se guarda ninguna preferencia en el dispositivo.</p>
      </Dialog>
    </div>
  );
}
