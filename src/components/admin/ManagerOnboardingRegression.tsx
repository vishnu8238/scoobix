import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Play, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listTable, createRecord, patchRecord, deleteRecord } from "@/lib/insforge-crud";
import { provisionAccount, type ManagedRestaurant } from "@/lib/manager-api";

type TestStep = {
  id: string;
  name: string;
  status: "idle" | "running" | "passed" | "failed";
  error?: string;
};

export function ManagerOnboardingRegression() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([
    { id: "account", name: "Provision Demo Manager Account", status: "idle" },
    { id: "onboard_no_images", name: "Onboard Restaurant (No Images)", status: "idle" },
    { id: "onboard_with_images", name: "Onboard Restaurant (With Images)", status: "idle" },
    { id: "admin_approval", name: "Admin Approval Flow", status: "idle" },
    { id: "customer_visibility", name: "Verify Customer Visibility", status: "idle" },
    { id: "cleanup", name: "Cleanup Demo Data", status: "idle" },
  ]);

  const updateStep = (id: string, patch: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runTest = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "idle", error: undefined })));

    const demoTag = `regression_test_${Date.now()}`;
    const demoEmail = `demo_manager_${Date.now()}@scoobix.test`;
    let managerUserId: string | undefined;
    let restaurantIds: string[] = [];

    try {
      // 1. Provision Account
      updateStep("account", { status: "running" });
      const acc = await provisionAccount({
        email: demoEmail,
        name: "Demo Manager (Regression)",
        role: "MERCHANT_MANAGER",
      });
      if (!acc.ok || !acc.userId) throw new Error(acc.message || "Account provisioning failed");
      managerUserId = acc.userId;
      updateStep("account", { status: "passed" });

      // 2. Onboard No Images
      updateStep("onboard_no_images", { status: "running" });
      const r1 = await createRecord<ManagedRestaurant>("restaurants", {
        name: `Demo Cafe (No Images) - ${demoTag}`,
        status: "pending",
        onboarding_status: "submitted",
        owner_email: `owner1_${Date.now()}@scoobix.test`,
        manager_id: managerUserId,
        city: "Vadodara",
        cover_url: null,
        logo_url: null,
        documents: [],
      });
      if (!r1?.id) throw new Error("Failed to onboard restaurant (no images)");
      restaurantIds.push(r1.id);
      updateStep("onboard_no_images", { status: "passed" });

      // 3. Onboard With Images
      updateStep("onboard_with_images", { status: "running" });
      const r2 = await createRecord<ManagedRestaurant>("restaurants", {
        name: `Demo Bistro (With Images) - ${demoTag}`,
        status: "pending",
        onboarding_status: "submitted",
        owner_email: `owner2_${Date.now()}@scoobix.test`,
        manager_id: managerUserId,
        city: "Vadodara",
        cover_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
        logo_url: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17",
        documents: [{ label: "FSSAI licence", url: "https://example.com/doc.pdf" }],
      });
      if (!r2?.id) throw new Error("Failed to onboard restaurant (with images)");
      restaurantIds.push(r2.id);
      updateStep("onboard_with_images", { status: "passed" });

      // 4. Admin Approval
      updateStep("admin_approval", { status: "running" });
      for (const rid of restaurantIds) {
        const approved = await patchRecord("restaurants", rid, {
          status: "active",
          onboarding_status: "live",
          approved_at: new Date().toISOString(),
        });
        if (!approved) throw new Error(`Failed to approve restaurant ${rid}`);
      }
      updateStep("admin_approval", { status: "passed" });

      // 5. Customer Visibility
      updateStep("customer_visibility", { status: "running" });
      const visibleRows = await listTable<ManagedRestaurant>("restaurants", {
        status: "eq.active",
        limit: 1000,
      }, { fresh: true });
      
      const foundAll = restaurantIds.every(id => visibleRows.some(r => r.id === id));
      if (!foundAll) throw new Error("Some approved restaurants are not visible to customers");
      updateStep("customer_visibility", { status: "passed" });

      // 6. Cleanup
      updateStep("cleanup", { status: "running" });
      for (const rid of restaurantIds) {
        await deleteRecord("restaurants", rid);
      }
      // Note: We don't delete the user account to avoid cascading issues in demo env
      updateStep("cleanup", { status: "passed" });

      toast.success("Regression test passed successfully");
    } catch (err: any) {
      console.error("Test failure:", err);
      const activeStep = steps.find(s => s.status === "running");
      if (activeStep) {
        updateStep(activeStep.id, { status: "failed", error: err.message });
      }
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-lg font-extrabold">Manager Onboarding Regression v2</h2>
          <p className="text-xs text-muted-foreground">End-to-end verification of the onboarding flow (InsForge-only).</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => runTest()} 
            disabled={isRunning}
            variant="outline"
            className="rounded-full border-primary/20 hover:bg-primary/5"
          >
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4 fill-current" />
            )}
            Run Complete Suite
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s) => (
          <div 
            key={s.id} 
            className="flex items-center justify-between rounded-2xl bg-secondary/40 p-3 ring-1 ring-border/40"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-full bg-background/50">
                {s.status === "passed" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {s.status === "failed" && <AlertCircle className="h-4 w-4 text-rose-500" />}
                {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {s.status === "idle" && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
              </div>
              <span className={cn(
                "text-[13px] font-bold",
                s.status === "failed" ? "text-rose-600" : "text-foreground/80"
              )}>
                {s.name}
              </span>
            </div>
            {s.error && (
              <span className="text-[10px] font-medium text-rose-500 max-w-[150px] truncate">
                {s.error}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
