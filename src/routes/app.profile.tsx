import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Heart, HelpCircle, LogOut, MapPin, Settings, User, Wallet, ReceiptText, Bell, Star, Trash2, Check, Pencil } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useFavorites } from "@/lib/stores";
import { restaurants, allDishes } from "@/lib/mock-data";
import { useAddresses, type AddressRow } from "@/lib/addresses-store";
import { usePaymentMethods } from "@/lib/payment-methods-store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Scoobix · Profile" }] }),
  component: ProfilePage,
});

type SheetKind = null | "account" | "addresses" | "favorites" | "payments" | "help" | "settings";

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { restaurants: favR, dishes: favD } = useFavorites();
  const [open, setOpen] = useState<SheetKind>(null);
  const { rows: addressRows } = useAddresses();
  const { rows: payMethods, add: addPayMethodRow } = usePaymentMethods();
  const addPayMethod = () => {
    const brand = typeof window !== "undefined" ? window.prompt("Card brand (Visa, Mastercard…)", "Visa") : null;
    if (!brand) return;
    const last4 = typeof window !== "undefined" ? window.prompt("Last 4 digits", "4242") : null;
    if (!last4) return;
    addPayMethodRow(brand, last4);
    toast.success("Payment method saved");
  };

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Profile</h1>
          <div />
        </div>
      </header>

      <section className="px-4 py-6">
        <div className="flex items-center gap-4">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name ?? "Profile photo"} className="h-16 w-16 rounded-full object-cover shadow-glow" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full gradient-primary text-xl font-extrabold text-primary-foreground shadow-glow">
              {(user?.name ?? "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold">{user?.name ?? "Guest"}</h2>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Not signed in"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Orders" value="48" />
          <Stat label="Saved" value={`${favR.size + favD.size}`} />
          <Stat label="Rating" value="4.9" />
        </div>
      </section>

      <section className="px-4">
        <Group title="Account">
          <Item icon={User} label="My account" onClick={() => setOpen("account")} />
          <Item icon={MapPin} label="Saved addresses" hint={`${addressRows.length}`} onClick={() => setOpen("addresses")} />
          <Item icon={Heart} label="Favorites" hint={`${favR.size + favD.size}`} onClick={() => setOpen("favorites")} />
          <Item icon={Wallet} label="Payments" hint={`${payMethods.length}`} onClick={() => setOpen("payments")} />
        </Group>
        <Group title="More">
          <Link to="/app/orders" className="block"><Item icon={ReceiptText} label="Order history" /></Link>
          <Item icon={Bell} label="Notifications" onClick={() => toast.success("Notification preferences saved")} />
          <Item icon={HelpCircle} label="Help & support" onClick={() => setOpen("help")} />
          <Item icon={Settings} label="Settings" onClick={() => setOpen("settings")} />
        </Group>
        <button
          onClick={() => { toast.success("Signed out (demo)"); navigate({ to: "/" }); }}
          className="mt-4 mb-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>

      <Sheet open={open === "account"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>My account</SheetTitle>
            <SheetDescription>Manage your basic info.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <Field label="Full name" value="Alex Morgan" />
            <Field label="Email" value="alex@cravio.app" />
            <Field label="Phone" value="+1 555 0118" />
            <Button onClick={() => { toast.success("Profile updated"); setOpen(null); }} className="w-full rounded-full">Save changes</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={open === "addresses"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88svh] overflow-y-auto">
          <SheetHeader className="text-left"><SheetTitle>Saved addresses</SheetTitle></SheetHeader>
          <AddressesEditor />
        </SheetContent>
      </Sheet>

      <Sheet open={open === "favorites"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88svh] overflow-y-auto">
          <SheetHeader className="text-left"><SheetTitle>Your favorites</SheetTitle></SheetHeader>
          <FavoritesView />
        </SheetContent>
      </Sheet>

      <Sheet open={open === "payments"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left"><SheetTitle>Payment methods</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {payMethods.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <div>
                  <div className="text-sm font-bold">{p.brand}</div>
                  <div className="text-xs text-muted-foreground">•••• {p.last4}</div>
                </div>
                {p.default && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">Default</span>}
              </div>
            ))}
            <Button variant="outline" className="w-full rounded-full" onClick={addPayMethod}>+ Add payment method</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={open === "help"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left"><SheetTitle>Help & support</SheetTitle></SheetHeader>
          <ul className="mt-4 space-y-2 text-sm">
            {["Order issue", "Refunds", "Contact support", "FAQs"].map((q) => (
              <li key={q}><button onClick={() => toast.success(`${q} opened`)} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left"><span className="font-semibold">{q}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button></li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <Sheet open={open === "settings"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left"><SheetTitle>Settings</SheetTitle></SheetHeader>
          <ul className="mt-4 space-y-2 text-sm">
            {["Account security", "Push notifications", "Email notifications", "Language", "Privacy"].map((q) => (
              <li key={q}><button onClick={() => toast.success(`${q} saved`)} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left"><span className="font-semibold">{q}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button></li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddressesEditor() {
  const { rows, add, update, remove: removeRow, setDefault } = useAddresses();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ label: string; line1: string; line2: string }>({ label: "", line1: "", line2: "" });

  const startEdit = (a: AddressRow) => { setEditingId(a.id); setDraft({ label: a.label, line1: a.line1, line2: a.line2 }); };
  const startAdd = () => { setEditingId("__new"); setDraft({ label: "Home", line1: "", line2: "" }); };
  const saveDraft = () => {
    if (!draft.label.trim() || !draft.line1.trim()) { toast.error("Label and address line required"); return; }
    if (editingId === "__new") {
      add(draft);
      toast.success("Address added");
    } else if (editingId) {
      update(editingId, draft);
      toast.success("Address updated");
    }
    setEditingId(null);
  };
  const remove = (id: string) => { removeRow(id); toast.success("Address removed"); };
  const makeDefault = (id: string) => { setDefault(id); toast.success("Default address updated"); };

  return (
    <div className="mt-4 space-y-2">
      {rows.map((a) => (
        <div key={a.id} className="rounded-2xl border border-border bg-card p-3">
          {editingId === a.id ? (
            <div className="space-y-2">
              <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Label (Home / Work)" className="h-9 rounded-xl" />
              <Input value={draft.line1} onChange={(e) => setDraft((d) => ({ ...d, line1: e.target.value }))} placeholder="Address line 1" className="h-9 rounded-xl" />
              <Input value={draft.line2} onChange={(e) => setDraft((d) => ({ ...d, line2: e.target.value }))} placeholder="Address line 2" className="h-9 rounded-xl" />
              <div className="flex gap-2"><Button onClick={saveDraft} className="flex-1 rounded-full">Save</Button><Button variant="outline" onClick={() => setEditingId(null)} className="rounded-full">Cancel</Button></div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold">{a.label}{a.default && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">Default</span>}</div>
                  <div className="text-xs text-muted-foreground">{a.line1}, {a.line2}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(a)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(a.id)} className="grid h-8 w-8 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {!a.default && (
                <button onClick={() => makeDefault(a.id)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold">
                  <Check className="h-3 w-3" /> Set as default
                </button>
              )}
            </>
          )}
        </div>
      ))}
      {editingId === "__new" ? (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-3 space-y-2">
          <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Label (Home / Work)" className="h-9 rounded-xl" />
          <Input value={draft.line1} onChange={(e) => setDraft((d) => ({ ...d, line1: e.target.value }))} placeholder="Address line 1" className="h-9 rounded-xl" />
          <Input value={draft.line2} onChange={(e) => setDraft((d) => ({ ...d, line2: e.target.value }))} placeholder="Address line 2" className="h-9 rounded-xl" />
          <div className="flex gap-2"><Button onClick={saveDraft} className="flex-1 rounded-full">Add address</Button><Button variant="outline" onClick={() => setEditingId(null)} className="rounded-full">Cancel</Button></div>
        </div>
      ) : (
        <Button variant="outline" className="w-full rounded-full" onClick={startAdd}>+ Add new address</Button>
      )}
    </div>
  );
}

function FavoritesView() {
  const { restaurants: favR, dishes: favD } = useFavorites();
  const rList = restaurants.filter((r) => favR.has(r.id));
  const dList = allDishes().filter((d) => favD.has(d.id));
  if (rList.length === 0 && dList.length === 0) {
    return <p className="mt-4 text-center text-sm text-muted-foreground">No favorites yet. Tap the heart on any restaurant or dish to save it.</p>;
  }
  return (
    <div className="mt-4 space-y-5">
      {rList.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Restaurants</h4>
          <div className="mt-2 space-y-2">
            {rList.map((r) => (
              <Link key={r.id} to="/restaurant/$id" params={{ id: r.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <img src={r.logo} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.cuisine}</div>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold"><Star className="h-3 w-3 fill-primary text-primary" />{r.rating.toFixed(1)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {dList.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dishes</h4>
          <div className="mt-2 space-y-2">
            {dList.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <img src={d.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{d.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.cuisineTag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3 text-center">
      <div className="font-display text-lg font-extrabold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mt-2 overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60 divide-y divide-border/60">
        {children}
      </div>
    </div>
  );
}

function Item({ icon: Icon, label, hint, onClick }: { icon: ComponentType<{ className?: string }>; label: string; hint?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-muted/50">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground"><Icon className="h-4 w-4" /></span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input defaultValue={value} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none" />
    </div>
  );
}
