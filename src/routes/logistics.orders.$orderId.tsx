import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLiveOrder } from "@/lib/realtime-hooks";
import { fetchCompleteOrderDetails, calculateOrderFinancials } from "@/lib/order-details-api";
import { patchOrder, type OrderStatus } from "@/lib/orders-api";
import { updateOrderStatus } from "@/lib/order-mgmt.functions";
import { logAudit } from "@/lib/audit-api";
import { OrderHeader } from "@/components/admin/OrderHeader";
import { OrderKpiCards } from "@/components/admin/OrderKpiCards";
import { RestaurantCard, CustomerCard, RiderCard } from "@/components/admin/OrderEntityCards";
import { OrderItemsList, OrderFinancials } from "@/components/admin/OrderItemsList";
import { OrderLifecycleTimeline, OrderDeliveryProof } from "@/components/admin/OrderLifecycleTimeline";
import { OrderTrackingMap } from "@/components/admin/OrderTrackingMap";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { AssignRiderModal } from "@/components/admin/AssignRiderModal";

export const Route = createFileRoute("/logistics/orders/$orderId")({
  component: LogisticsOrderDetailsPage,
});

function LogisticsOrderDetailsPage() {
  const { orderId } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const liveOrder = useLiveOrder(orderId);

  useEffect(() => {
    const init = async () => {
      try {
        console.log(`[ORDER_DETAIL] Loading authoritative order ${orderId}...`);
        const d = await fetchCompleteOrderDetails(orderId);
        if (d && d.order) {
          setData(d);
        } else {
          // Attempt to find order in local demo data
          const { getLogisticsDemoData } = await import("@/lib/logistics-ops.functions");
          const demo = await getLogisticsDemoData();
          const demoOrder = demo.orders.find((o: any) => o.id === orderId);
          if (demoOrder) {
            const o = demoOrder as any;
            setData({
              order: o,
              items: o.items?.lines || [],
              payment: { status: o.payment_status || "PENDING", amount: o.total_price },
              restaurant: { name: "Demo Restaurant", address: o.pickup_address || o.delivery_address },
              customer: { name: "Demo Customer", email: "demo@scoobix.test" },
              rider: null,
              history: [],
              proofs: { pickup: null, delivery: null }
            });
          }
        }
      } catch (err: any) {
        console.error("[ORDER_DETAIL] Load failed:", err);
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
  }, [orderId]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAssignRiderOpen, setIsAssignRiderOpen] = useState(false);

  useEffect(() => {
    if (liveOrder) {
      setData((prev: any) => prev ? { ...prev, order: { ...prev.order, ...liveOrder } } : prev);
    }
  }, [liveOrder]);

  if (loadingInitial || !data || !data.order) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
        <p className="font-display font-bold text-muted-foreground">Loading Order Details...</p>
        {!loadingInitial && !data?.order && <p className="text-xs text-rose-500 mt-2">Order #{orderId.slice(0, 8)} not found</p>}
      </div>
    </div>
  );

  const financials = calculateOrderFinancials(data.order);

  const handleRefresh = async () => {
    setIsUpdating(true);
    const updated = await fetchCompleteOrderDetails(orderId);
    if (updated) setData(updated);
    setIsUpdating(false);
    toast.success("Order details refreshed");
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      await updateOrderStatus({ data: { orderId, status: newStatus } });
      try {
        await logAudit({
          category: "admin",
          subjectType: "order",
          subjectId: orderId,
          action: "STATUS_CHANGE",
          summary: `Admin manually updated status from ${data.order.status} to ${newStatus}`,
        });
      } catch (auditErr) {
        console.warn("Audit logging failed but status was updated", auditErr);
      }
      toast.success(`Status updated to ${newStatus}`);
      await handleRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <OrderHeader 
        order={data.order} 
        onRefresh={handleRefresh}
        onShowHistory={() => {}}
        onAssignRider={() => setIsAssignRiderOpen(true)}
        onUpdateStatus={handleUpdateStatus}
        onTrack={() => {}}
      />

      <OrderKpiCards 
        order={data.order} 
        restaurant={data.restaurant} 
        payment={data.payment} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-8 space-y-6">
          <OrderTrackingMap 
            restaurant={data.restaurant} 
            customer={data.customer} 
            rider={data.rider} 
            order={data.order} 
            showAllRiders={true}
          />
          
          <OrderItemsList items={data.items} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrderFinancials financials={financials} />
            <OrderDeliveryProof proofs={data.proofs} />
          </div>
        </div>

        {/* Right Column - Entities & Timeline */}
        <div className="lg:col-span-4 space-y-6">
          <RestaurantCard restaurant={data.restaurant} order={data.order} />
          <CustomerCard customer={data.customer} order={data.order} />
          <RiderCard rider={data.rider} order={data.order} />
          <OrderLifecycleTimeline history={data.history} />
        </div>
      </div>

      <AssignRiderModal 
        isOpen={isAssignRiderOpen}
        onClose={() => setIsAssignRiderOpen(false)}
        orderId={orderId}
        onAssigned={handleRefresh}
        currentRiderId={data.order.driver_id}
        zoneId={data.order.zone_id}
      />

      {isUpdating && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-card p-4 rounded-3xl shadow-glow ring-1 ring-border/60 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
