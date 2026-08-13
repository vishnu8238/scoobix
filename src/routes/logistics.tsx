import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useAuth } from "@/lib/auth-store";
import { useEffect } from "react";

export const Route = createFileRoute("/logistics")({
  component: LogisticsLayout,
});

function LogisticsLayout() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__AUTH_STORE_DEBUG__ = {
        user,
        loading,
        authenticated: !!user,
        membershipsResolved: user?.membershipsResolved,
        roles: user?.roles
      };
      
      console.log("[AUTH_TRACE]", {
        path: window.location.pathname,
        loading,
        authenticated: !!user,
        userExists: !!user,
        membershipsResolved: user?.membershipsResolved,
        roles: user?.roles
      });
    }
  }, [user, loading]);

  const isLoginPage = typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/login/');

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <RoleGuard allow={["logistics"]}>
      <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500/30">
        <Outlet />
        
        {/* TEMPORARY FORENSIC DIAGNOSTIC PANEL */}
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900/95 border border-slate-800 p-4 rounded-xl shadow-2xl backdrop-blur-sm text-[10px] font-mono w-64 pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
          <div className="font-bold text-sky-400 mb-2 border-b border-slate-800 pb-1 uppercase tracking-wider">Auth Forensic</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Loading:</span> <span className={loading ? "text-yellow-400" : "text-green-400"}>{String(loading)}</span></div>
            <div className="flex justify-between"><span>Auth:</span> <span className={!!user ? "text-green-400" : "text-red-400"}>{String(!!user)}</span></div>
            <div className="flex justify-between"><span>Resolved:</span> <span className={user?.membershipsResolved ? "text-green-400" : "text-red-400"}>{String(!!user?.membershipsResolved)}</span></div>
            <div className="flex justify-between"><span>Roles:</span> <span className="text-slate-300">[{user?.roles?.join(",") || ""}]</span></div>
            <div className="flex justify-between"><span>Path:</span> <span className="text-slate-400 truncate max-w-[120px]">{typeof window !== 'undefined' ? window.location.pathname : ''}</span></div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
