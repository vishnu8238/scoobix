/**
 * Restaurant KYC panels — role-specific wrappers around the shared
 * verification components so existing partner/admin screens keep working.
 */
import {
  StatusPill,
  VerificationProgress,
  VerificationReviewPanel,
  VerificationUploadCard,
  useVerification,
} from "@/components/cravio/VerificationPanel";
import type { Actor, KycStatus, KycSummary } from "@/lib/verification-api";

export const useKyc = (restaurantId?: string | null) => useVerification("restaurant", restaurantId);
export const KycStatusPill = ({ status }: { status: KycStatus }) => <StatusPill status={status} />;
export const KycProgress = ({ summary }: { summary: KycSummary }) => <VerificationProgress summary={summary} />;

export function KycUploadCard({ restaurantId, actor }: { restaurantId?: string | null; actor?: Actor }) {
  return (
    <VerificationUploadCard
      subject="restaurant"
      subjectId={restaurantId}
      actor={actor}
      title="KYC documents"
      note="Your restaurant stays offline until every mandatory document is verified by Scoobix."
    />
  );
}

export function AdminKycPanel({
  restaurantId,
  actor,
  readOnly,
}: {
  restaurantId: string;
  actor?: Actor;
  readOnly?: boolean;
}) {
  return <VerificationReviewPanel subject="restaurant" subjectId={restaurantId} actor={actor} readOnly={readOnly} />;
}
