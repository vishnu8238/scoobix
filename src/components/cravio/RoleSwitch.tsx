import { Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";

/** Small floating pill that returns to the role picker. */
export function RoleSwitch({ label }: { label: string }) {
  return (
    <Link
      to="/portal"
      className="fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-foreground/90 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-background shadow-pop backdrop-blur-md transition active:scale-95 md:right-6"
    >
      <Repeat className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </Link>
  );
}
