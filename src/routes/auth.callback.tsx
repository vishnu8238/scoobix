import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent, setPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const exchangeAttemptedRef = useRef<boolean>(false);
  const portalRef = useRef<string>("customer");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      if (exchangeAttemptedRef.current) return;
      exchangeAttemptedRef.current = true;

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("insforge_code") || params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error || errorDescription) {
          throw new Error(errorDescription || `Authentication error: ${error}`);
        }

        if (code) {
          // Cleanup URL for visual cleanliness
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("insforge_code");
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

          const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(code);
          if (exchangeError && !insforge.auth.session?.user) {
            throw new Error(exchangeError.message || "Code exchange failed.");
          }
        }

        const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
        
        if (authError || !authData?.user) {
          throw new Error(authError?.message || "Failed to resolve identity after authorization.");
        }

        // Portal mapping
        const portalMap: Record<string, string> = {
          admin: "/admin",
          logistics: "/logistics",
          manager: "/manager",
          partner: "/partner",
          rider: "/rider",
          customer: "/app",
        };

        // 1. Resolve requested portal via validated pop helper ONLY when ready to redirect
        // This prevents remounts from consuming and clearing the intent prematurely.
        const currentPortal = popPortalIntent();
        portalRef.current = currentPortal;
        
        const destPath = portalMap[currentPortal] || "/app";

        localStorage.removeItem("scoobix_return_to");

        await navigate({ to: destPath as any, replace: true });

      } catch (err: any) {
        console.error("[AUTH_CALLBACK] Critical Error:", err);
        setErrorMsg(err.message || "Authentication failed.");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 pt-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <h2 className="font-display text-lg font-bold">{"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            import { createFileRoute, useNavigate } from \"@tanstack/react-router\";\nimport { useEffect, useState, useRef } from \"react\";\nimport { insforge } from \"@/lib/insforge\";\nimport { popPortalIntent, setPortalIntent } from \"@/lib/insforge-auth\";\n\nexport const Route = createFileRoute(\"/auth/callback\")({\n  component: AuthCallback,\n});\n\nfunction AuthCallback() {\n  const [errorMsg, setErrorMsg] = useState(null);\n  \n  const exchangeAttemptedRef = useRef(false);\n  const portalRef = useRef(\"customer\");\n  const navigate = useNavigate();\n\n  useEffect(() => {\n    const handleCallback = async () => {\n      if (exchangeAttemptedRef.current) return;\n      exchangeAttemptedRef.current = true;\n\n      try {\n        const params = new URLSearchParams(window.location.search);\n        const code = params.get(\"insforge_code\") || params.get(\"code\");\n        const error = params.get(\"error\");\n        const errorDescription = params.get(\"error_description\");\n\n        if (error || errorDescription) {\n          throw new Error(errorDescription || `Authentication error: ${error}`);\n        }\n\n        if (code) {\n          // Cleanup URL for visual cleanliness\n          const cleanUrl = new URL(window.location.href);\n          cleanUrl.searchParams.delete(\"insforge_code\");\n          cleanUrl.searchParams.delete(\"code\");\n          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);\n\n          const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(code);\n          if (exchangeError && !insforge.auth.session?.user) {\n            throw new Error(exchangeError.message || \"Code exchange failed.\");\n          }\n        }\n\n        const { data: authData, error: authError } = await insforge.auth.getCurrentUser();\n        \n        if (authError || !authData?.user) {\n          throw new Error(authError?.message || \"Failed to resolve identity after authorization.\");\n        }\n\n        // Portal mapping\n        const portalMap: Record = {\n          admin: \"/admin\",\n          logistics: \"/logistics\",\n          manager: \"/manager\",\n          partner: \"/partner\",\n          rider: \"/rider\",\n          customer: \"/app\",\n        };\n\n        // 1. Resolve requested portal via validated pop helper ONLY when ready to redirect\n        // This prevents remounts from consuming and clearing the intent prematurely.\n        const currentPortal = popPortalIntent();\n        portalRef.current = currentPortal;\n        \n        const destPath = portalMap[currentPortal] || \"/app\";\n\n        localStorage.removeItem(\"scoobix_return_to\");\n\n        await navigate({ to: destPath as any, replace: true });\n\n      } catch (err: any) {\n        console.error(\"[AUTH_CALLBACK] Critical Error:\", err);\n        setErrorMsg(err.message || \"Authentication failed.\");\n      }\n    };\n\n    handleCallback();\n  }, [navigate]);\n\n  return (\n    \n\n\n      \n\n\n        \n\n\n        \n\n{\"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\\n                                        \\n                                            \\n                                            INSPECT ONLY — DO NOT EDIT, PUBLISH, DELETE, INSTALL, UNINSTALL, OR APPLY ANY FIX. Audit the exact current repository state after the unexpected 2:32/2:36 editor claims.\\n\\nA. Pre-load state: trace every code path that can render `VERIFYING PERMISSIONS` and `CONNECTION TAKING TOO LONG? RETRY` on `/login?portal=logistics`; list session/auth calls, timeouts, retries, and every redirect. Explain why it can appear briefly then resolve to `/logistics` for an existing authorized session, and whether that proves a defect.\\n\\nB. Auth callback integrity: give the current exact rendered/loading/error text in `src/routes/auth.callback.tsx`, report the `exchangeAttemptedRef` guard and the exact location/timing of `popPortalIntent()`, and identify any accidental literal instruction or display-text alteration.\\n\\nC. Unexpected changes: provide the exact current status of `src/integrations/supabase/`, `package.json`, lockfile, and `scripts/prebuild.js`; list changed files in the last two turns; report every remaining `@supabase` import/reference. Determine whether any deletion/uninstall was actually performed and whether current build truly passed without temporary edits.\\n\\nD. Gig regression check: report the current raw `` count and date control label in `src/routes/logistics.gigs.tsx`.\\n\\nNo modifications. Give exact evidence only.\"}"}</h2>
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-medium">{errorMsg}</p>
            <button 
              onClick={() => window.location.replace('/login')}
              className="mt-2 text-[10px] underline uppercase tracking-widest opacity-70"
            >
              {"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\\n                                        \\n                                            \\n                                            INSPECT ONLY — DO NOT EDIT, PUBLISH, DELETE, INSTALL, UNINSTALL, OR APPLY ANY FIX. Audit the exact current repository state after the unexpected 2:32/2:36 editor claims.\\n\\nA. Pre-load state: trace every code path that can render `VERIFYING PERMISSIONS` and `CONNECTION TAKING TOO LONG? RETRY` on `/login?portal=logistics`; list session/auth calls, timeouts, retries, and every redirect. Explain why it can appear briefly then resolve to `/logistics` for an existing authorized session, and whether that proves a defect.\\n\\nB. Auth callback integrity: give the current exact rendered/loading/error text in `src/routes/auth.callback.tsx`, report the `exchangeAttemptedRef` guard and the exact location/timing of `popPortalIntent()`, and identify any accidental literal instruction or display-text alteration.\\n\\nC. Unexpected changes: provide the exact current status of `src/integrations/supabase/`, `package.json`, lockfile, and `scripts/prebuild.js`; list changed files in the last two turns; report every remaining `@supabase` import/reference. Determine whether any deletion/uninstall was actually performed and whether current build truly passed without temporary edits.\\n\\nD. Gig regression check: report the current raw `<input type=\\\"date\\\">` count and date control label in `src/routes/logistics.gigs.tsx`.\\n\\nNo modifications. Give exact evidence only."}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}