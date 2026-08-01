import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { VerificationUploadCard } from "@/components/cravio/VerificationPanel";
import { useAuth } from "@/lib/auth-store";
import { useManager } from "@/lib/manager-api";
import { EmptyState } from "@/components/cravio/EmptyState";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/manager/verification")({
  head: () => ({
    meta: [
      { title: "Manager verification · Scoobix" },
      { name: "description", content: "Upload identity, employment and bank documents for your Scoobix merchant manager account." },
      { property: "og:title", content: "Manager verification · Scoobix" },
      { property: "og:description", content: "Track approval status of your merchant manager KYC documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerVerification,
});

function ManagerVerification() {
  const { user } = useAuth();
  const { manager } = useManager();

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="My verification" subtitle="Identity, employment & bank proof" />
      <div className="px-5 pt-4">
        {manager?.id ? (
          <VerificationUploadCard
            subject="manager"
            subjectId={manager.id}
            actor={{ id: user?.id, name: user?.name, role: "manager" }}
            title="Manager documents"
            note="Restaurant onboarding stays limited until your mandatory documents are approved."
          />
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Manager profile missing"
            description="Ask the Scoobix admin to finish creating your merchant manager profile."
          />
        )}
      </div>
    </div>
  );
}
