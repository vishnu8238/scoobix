import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user && user.membershipsResolved) {
      // If the user has a privileged role but somehow landed on root, 
      // redirect them to their primary role's portal.
      const privilegedRole = user.roles.find(r => r !== "customer");
      if (privilegedRole) {
        navigate({ to: `/${privilegedRole}` as any, replace: true });
        return;
      }
    }
    
    // Default to the customer app home for normal users or unauthenticated visitors
    navigate({ to: "/app", replace: true });
  }, [navigate, user, loading]);

  return null;
}
