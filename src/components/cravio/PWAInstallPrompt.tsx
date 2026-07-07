import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cravio.pwa.dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; others use display-mode media query.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

/**
 * Native-style "Add Scoobix to Home Screen" banner.
 * - Only shows when the browser fires `beforeinstallprompt` (Chromium/Edge/Android).
 * - Hides forever after install or explicit dismissal.
 * - Never appears when the app is already running standalone.
 */
export function PWAInstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setEvt(null);
      localStorage.setItem(DISMISS_KEY, "installed");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !evt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
    } finally {
      setVisible(false);
      setEvt(null);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4 animate-fade-up">
      <div className="flex w-full max-w-[440px] items-center gap-3 rounded-2xl bg-foreground/95 px-4 py-3 text-background shadow-pop backdrop-blur">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold leading-tight">Add Scoobix to Home Screen</p>
          <p className="truncate text-[11px] opacity-70">Faster access. Works like a native app.</p>
        </div>
        <button
          onClick={install}
          className="rounded-xl bg-primary px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-primary-foreground active:scale-95"
        >
          Install
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1.5 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
