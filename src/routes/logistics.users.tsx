import { createFileRoute } from "@tanstack/react-router";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Search } from "lucide-react";
import { useState } from "react";
import { useLiveTable } from "@/lib/realtime-hooks";

export const Route = createFileRoute("/logistics/users")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Users" }] }),
  component: LogisticsUsers,
});

type UserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  registration_timestamp?: string | null;
};

function LogisticsUsers() {
  const [q, setQ] = useState("");
  const { rows: users } = useLiveTable<UserRow>("users", {
    params: { limit: 500, order: "-registration_timestamp" },
  });

  const term = q.toLowerCase();
  const filtered = users.filter(u => 
    (u.name || "").toLowerCase().includes(term) || 
    (u.email || "").toLowerCase().includes(term) ||
    (u.phone || "").toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Users</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Accounts</h1>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="h-11 w-64 rounded-2xl bg-card pl-11 pr-4 text-sm shadow-soft outline-none ring-1 ring-border/60" />
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Name", "Email", "Phone", "Joined", "Status"]}
          rows={filtered.map((u) => [
            <span key={u.id} className="font-bold">{u.name || "—"}</span>,
            <span key={u.id+"e"} className="text-muted-foreground">{u.email || "—"}</span>,
            <span key={u.id+"p"} className="text-muted-foreground">{u.phone}</span>,
            <span key={u.id+"j"} className="text-[10px] text-muted-foreground">{(u.registration_timestamp ?? "").slice(0, 10)}</span>,
            <StatusBadge key={u.id+"s"} label={u.status || "active"} />,
          ])}
        />
      </section>
    </div>
  );
}
