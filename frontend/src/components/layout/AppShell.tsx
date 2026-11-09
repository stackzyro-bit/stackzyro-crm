import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "../../lib/format";
import { OnboardingTour } from "../help/OnboardingTour";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const SIDEBAR_KEY = "stackzyro.sidebar.collapsed";

export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStorage.setItem(SIDEBAR_KEY, String(!value));
      return !value;
    });
  };

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[80px]" : "lg:pl-[264px]",
          "print:pl-0"
        )}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:p-0">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
        <footer className="no-print px-4 pb-6 text-center text-[10px] text-ink-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} STACKZYRO — Turning Ideas Into Digital Solutions
        </footer>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <OnboardingTour />
    </div>
  );
}
