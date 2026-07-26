import { createFileRoute } from "@tanstack/react-router";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Search, Plus } from "lucide-react";
import { useState } from "react";
import { useCms } from "@/lib/cms-store";
import { useLiveTable } from "@/lib/realtime-hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Users" }] }),
  component: AdminUsers,
});

type UserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  registration_timestamp?: string | null;
};

function AdminUsers() {
  const [q, setQ] = useState("");
  const { blockedUsers, setUserBlocked } = useCms();
  const { rows: users } = useLiveTable<UserRow>("users", {
    params: { limit: 500, order: "-registration_timestamp" },
    minMs: 10000,
    maxMs: 60000,
  });
  const term = q.toLowerCase();
  const rows = users
    .map((u) => ({
      id: u.id,
      name: u.name ?? (u.email ?? "").split("@")[0] ?? "User",
      email: u.email ?? "—",
      orders: 0,
      joined: (u.registration_timestamp ?? "").slice(0, 10) || "—",
      status: u.status ?? "active",
    }))
    .filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Users</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Customer accounts</h1>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="h-11 w-64 rounded-2xl bg-card pl-11 pr-4 text-sm shadow-soft outline-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary/40" />
          </div>
          <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
            <Plus className="h-4 w-4" /> Invite
          </button>
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Name", "Email", "Orders", "Joined", "Status", ""]}
          rows={rows.map((u) => {
            const blocked = !!blockedUsers[u.id];
            return [
              <span className="font-bold text-primary">{u.id}</span>,
              <span className="font-bold">{u.name}</span>,
              <span className="text-muted-foreground">{u.email}</span>,
              u.orders,
              <span className="text-muted-foreground">{u.joined}</span>,
              <StatusBadge label={blocked ? "Suspended" : u.status} />,
              <button
                onClick={() => { setUserBlocked(u.id, !blocked); toast.success(blocked ? `${u.name} unblocked` : `${u.name} blocked`); }}
                className={`text-[12px] font-bold ${blocked ? "text-primary" : "text-destructive"}`}
              >
                {blocked ? "Unblock" : "Block"}
              </button>,
            ];
          })}
        />
      </section>
    </div>
  );
}
