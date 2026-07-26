/** "Your Relationship Manager" card shown inside the partner app. */
import { Mail, MessageCircle, Phone, UserRound } from "lucide-react";

type ManagerFields = {
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  manager_avatar?: string | null;
};

export function RelationshipManagerCard({ restaurant }: { restaurant?: ManagerFields | null }) {
  const name = restaurant?.manager_name?.trim();
  const phone = restaurant?.manager_phone?.trim();
  const email = restaurant?.manager_email?.trim();

  if (!name) {
    return (
      <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your relationship manager</p>
        <p className="mt-1 text-sm text-muted-foreground">Not assigned yet — Scoobix will assign a manager to your restaurant shortly.</p>
      </div>
    );
  }

  const waNumber = (phone ?? "").replace(/[^\d]/g, "");

  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your relationship manager</p>
      <div className="mt-3 flex items-center gap-3">
        {restaurant?.manager_avatar ? (
          <img src={restaurant.manager_avatar} alt={`${name}, relationship manager`} className="h-12 w-12 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><UserRound className="h-6 w-6" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{phone || email || "Contact via Scoobix support"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Action href={phone ? `tel:${phone}` : undefined} icon={Phone} label="Call" />
        <Action href={waNumber ? `https://wa.me/${waNumber}` : undefined} icon={MessageCircle} label="WhatsApp" />
        <Action href={email ? `mailto:${email}` : undefined} icon={Mail} label="Email" />
      </div>
    </div>
  );
}

function Action({ href, icon: Icon, label }: { href?: string; icon: any; label: string }) {
  const cls = "flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold transition active:scale-95";
  if (!href) {
    return <span className={`${cls} bg-muted text-muted-foreground opacity-60`}><Icon className="h-4 w-4" /> {label}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} bg-primary-soft text-primary`}>
      <Icon className="h-4 w-4" /> {label}
    </a>
  );
}
