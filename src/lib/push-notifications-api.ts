import { listTable, createRecord, patchRecord, createRecords } from "./insforge-crud";
import { insforge, requireAuthenticatedInsforgeUser } from "./insforge";

export interface RiderProfile {
  id: string;
  user_id: string;
  driver_id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_type: string;
  verification_status: string;
  docs_verified: boolean;
  created_at: string;
}

export interface LogisticsZone {
  id: string;
  name: string;
  city: string;
  status: string;
}

export interface RiderZoneAssignment {
  rider_profile_id: string;
  zone_id: string;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  target_status: "ALL" | "ACTIVE" | "PENDING" | "INACTIVE";
  target_zone_id: string | null;
  created_by: string;
  campaign_status: "QUEUED" | "PROCESSING" | "SENT" | "PARTIAL" | "FAILED";
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
}

export interface NotificationDelivery {
  id: string;
  campaign_id: string;
  rider_profile_id: string;
  recipient_user_id: string | null;
  notification_id: string | null;
  delivery_status: "QUEUED" | "SENT" | "FAILED";
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export type RiderVerificationGroup = "Active" | "Pending" | "Inactive";

export function mapVerificationStatus(status: string | null | undefined, docsVerified: boolean): RiderVerificationGroup {
  const s = (status || "").toLowerCase();
  if (s === "verified" && docsVerified) return "Active";
  if (s === "pending" || s === "unverified" || !s) return "Pending";
  // rejected, suspended, disabled, inactive
  return "Inactive";
}

export async function fetchPushRecipients() {
  const [riders, zones, assignments] = await Promise.all([
    listTable<RiderProfile>("rider_profiles", { limit: 1000 }),
    listTable<LogisticsZone>("logistics_zones", { status: "eq.ACTIVE" }),
    listTable<RiderZoneAssignment>("rider_zone_assignments", { limit: 2000 })
  ]);

  return {
    riders,
    zones,
    assignments
  };
}

export async function fetchCampaignHistory() {
  return listTable<NotificationCampaign>("notification_campaigns", {
    order: "created_at.desc",
    limit: 100
  });
}

export async function dispatchNotificationCampaign(
  title: string,
  message: string,
  recipientIds: string[],
  targetScope: { status: string; zoneId: string | null }
) {
  if (!recipientIds.length) {
    throw new Error("Cannot dispatch campaign: No recipients selected.");
  }

  const userId = await requireAuthenticatedInsforgeUser();
  const now = new Date().toISOString();

  // 1. Authoritative recipient resolution from explicit IDs
  // We fetch specific profiles by ID to ensure we have the correct user_id mappings
  // using a single query for efficiency.
  const selectedRiders = await listTable<RiderProfile>("rider_profiles", {
    "id.in": recipientIds.join(",")
  });

  if (!selectedRiders || selectedRiders.length === 0) {
    throw new Error("Selected recipients could not be resolved from database.");
  }

  // 2. Create campaign row as PROCESSING
  const campaign = await createRecord<NotificationCampaign>("notification_campaigns", {
    title,
    message,
    target_status: (targetScope.status || "ALL").toUpperCase() as any,
    target_zone_id: targetScope.zoneId,
    created_by: userId,
    campaign_status: "PROCESSING",
    total_count: recipientIds.length,
    sent_count: 0,
    failed_count: 0,
    created_at: now
  });

  if (!campaign) throw new Error("Failed to create notification campaign");

  let sentCount = 0;
  let failedCount = 0;

  for (const rider of selectedRiders) {
    try {
      let notificationId: string | null = null;
      
      // Create in-app notification if user_id exists
      if (rider.user_id) {
        const notif = await createRecord<any>("notifications", {
          user_id: rider.user_id,
          title,
          message,
          read_status: false,
          created_at: now
        });
        if (notif) {
          notificationId = notif.id;
        }
      }

      // Create delivery record
      if (notificationId) {
        await createRecord<NotificationDelivery>("notification_deliveries", {
          campaign_id: campaign.id,
          rider_profile_id: rider.id,
          recipient_user_id: rider.user_id,
          notification_id: notificationId,
          delivery_status: "SENT",
          created_at: now,
          sent_at: now
        });
        sentCount++;
      } else {
        await createRecord<NotificationDelivery>("notification_deliveries", {
          campaign_id: campaign.id,
          rider_profile_id: rider.id,
          recipient_user_id: rider.user_id || null,
          notification_id: null,
          delivery_status: "FAILED",
          error_message: rider.user_id ? "Failed to create notification record" : "No user_id found for rider",
          created_at: now
        });
        failedCount++;
      }
    } catch (err: any) {
      console.error(`Failed dispatch to rider ${rider.id}:`, err);
      try {
        await createRecord<NotificationDelivery>("notification_deliveries", {
          campaign_id: campaign.id,
          rider_profile_id: rider.id,
          recipient_user_id: rider.user_id || null,
          notification_id: null,
          delivery_status: "FAILED",
          error_message: err.message || "Unknown error",
          created_at: now
        });
      } catch (innerErr) {
        console.error("Critical: Failed to record delivery failure", innerErr);
      }
      failedCount++;
    }
  }

  // 4. Finalize campaign counters
  // 4. Update campaign using actual created delivery outcomes
  const finalStatus = failedCount === 0 ? "SENT" : (sentCount === 0 ? "FAILED" : "PARTIAL");
  
  const updatedCampaign = await patchRecord<NotificationCampaign>("notification_campaigns", campaign.id, {
    campaign_status: finalStatus,
    total_count: selectedRiders.length, // Authoritative selection total
    sent_count: sentCount,
    failed_count: failedCount,
    sent_at: now
  });

  return updatedCampaign;
}
