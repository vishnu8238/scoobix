import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { VerificationUploadCard } from "@/components/cravio/VerificationPanel";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { EmptyState } from "@/components/cravio/EmptyState";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/rider/verification")({
  head: () => ({
    meta: [
      { title: "Rider verification · Scoobix" },
      { name: "description", content: "Upload your Aadhaar, PAN, licence, RC, insurance and bank proof to get verified for deliveries." },
      { property: "og:title", content: "Rider verification · Scoobix" },
      { property: "og:description", content: "Track document approval status for your Scoobix rider account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderVerification,
});

function RiderVerification() {
  const { user } = useAuth();
  const { driver } = useDriver();

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Verification" subtitle="Documents & approval status" />
      <div className="px-4 pt-4">
        {driver?.id ? (
          <VerificationUploadCard
            subject="rider"
            subjectId={driver.id}
            actor={{ id: user?.id, name: user?.name, role: "rider" }}
            title="Rider documents"
            note="You can only go online for deliveries once every mandatory document is approved."
          />
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Rider profile not ready"
            description="Complete rider onboarding first — your documents attach to that profile."
          />
        )}
      </div>
    </div>
  );
}
