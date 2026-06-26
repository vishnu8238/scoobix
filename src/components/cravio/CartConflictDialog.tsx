import { useCart } from "@/lib/stores";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Global popup that appears when a user tries to add an item from a
 * different restaurant. Mounted once at the app root.
 */
export function CartConflictDialog() {
  const { pendingConflict, restaurant, confirmReplaceCart, dismissConflict } = useCart();
  const open = !!pendingConflict;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) dismissConflict(); }}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-lg font-extrabold">
            Start a new cart?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your cart contains items from
            {" "}<span className="font-semibold text-foreground">{restaurant?.name ?? "another restaurant"}</span>.
            Clear cart and add this item from{" "}
            <span className="font-semibold text-foreground">{pendingConflict?.item.restaurantName}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Keep current cart</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmReplaceCart}
            className="rounded-full gradient-primary text-primary-foreground shadow-glow"
          >
            Clear & add
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
