/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import { LiveTrackingView } from "@/components/maps/MapView";

type OrderTrackingMapProps = {
  restaurant: any;
  customer: any;
  rider: any;
  order: any;
  showAllRiders?: boolean;
};

export function OrderTrackingMap(props: OrderTrackingMapProps) {
  return <LiveTrackingView {...props} />;
}