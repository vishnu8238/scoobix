import { useLocation } from "@tanstack/react-router";
import { PREVIEW_MODE_ENABLED, PREVIEW_PORTALS } from "@/lib/preview-mode";
import { useAuth } from "@/lib/auth-store";

/** Dev-only banner + portal switcher. Renders nothing unless Preview Mode is enabled. */
export function PreviewModeBanner() {
  const { user } = useAuth();
  const location = useLocation();
  if (!PREVIEW_MODE_ENABLED || !(user as any)?.isPreview) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-2 bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground shadow-lg">
      <span className="uppercase tracking-wider">Preview mode — not authenticated</span>
      <select
        aria-label="Preview portal"
        className="rounded-md bg-background px-2 py-1 text-foreground"
        value={PREVIEW_PORTALS.find((p) => location.pathname.startsWith(p.path))?.path ?? ""}
        onChange={(e) => {
          if (e.target.value) window.location.assign(e.target.value);
        }}
      >
        <option value="">Switch portal…</option>
        {PREVIEW_PORTALS.map((p) => (
          <option key={p.id} value={p.path}>
            Preview {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
