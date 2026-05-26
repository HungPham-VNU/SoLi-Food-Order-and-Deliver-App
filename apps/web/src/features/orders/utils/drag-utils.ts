import type { OrderStatus } from "../types";

// Define valid transitions between columns
export const COLUMN_TRANSITIONS: Record<string, { from: string; to: string; api: string }> = {
  "incoming-to-preparing": {
    from: "incoming",
    to: "preparing",
    api: "confirmOrder",
  },
  "preparing-to-preparing-start": {
    from: "preparing",
    to: "preparing",
    api: "startPreparing",
  },
  "preparing-to-ready": {
    from: "preparing",
    to: "ready",
    api: "markReady",
  },
};

// Map order status to whether it can be dragged from its column
export const CAN_DRAG_FROM_COLUMN: Record<OrderStatus, boolean> = {
  pending: true,          // Can drag from incoming
  paid: true,             // Can drag from incoming
  confirmed: true,        // Can drag from preparing
  preparing: true,        // Can drag from preparing
  ready_for_pickup: false, // Cannot drag from ready
  picked_up: false,       // Cannot drag from done
  delivering: false,      // Cannot drag from done
  delivered: false,       // Cannot drag from done
  cancelled: false,       // Cannot drag from done
  refunded: false,        // Cannot drag from done
};

// Map valid drops: from column -> to columns
export const VALID_DROP_TARGETS: Record<string, string[]> = {
  incoming: ["preparing"],  // pending/paid can go to preparing
  preparing: ["ready"],     // confirmed/preparing can go to ready
  ready: [],                // ready_for_pickup cannot go anywhere
  done: [],                 // done states cannot go anywhere
};

// Get the transition details for a drag action
export function getTransition(
  fromColumn: string,
  toColumn: string,
  orderStatus: OrderStatus
): { api: string; isValid: boolean; reason?: string } {
  // Check if destination is valid for source column
  if (!VALID_DROP_TARGETS[fromColumn]?.includes(toColumn)) {
    return {
      api: "",
      isValid: false,
      reason: `Cannot transition from ${fromColumn} to ${toColumn}`,
    };
  }

  // Check order status can be dragged
  if (!CAN_DRAG_FROM_COLUMN[orderStatus]) {
    return {
      api: "",
      isValid: false,
      reason: `Order with status '${orderStatus}' cannot be dragged`,
    };
  }

  // Map status + column transition to API endpoint
  if (fromColumn === "incoming" && toColumn === "preparing") {
    if (orderStatus === "pending" || orderStatus === "paid") {
      return { api: "confirmOrder", isValid: true };
    }
  }

  if (fromColumn === "preparing" && toColumn === "preparing") {
    if (orderStatus === "confirmed") {
      return { api: "startPreparing", isValid: true };
    }
  }

  if (fromColumn === "preparing" && toColumn === "ready") {
    if (orderStatus === "preparing") {
      return { api: "markReady", isValid: true };
    }
  }

  return {
    api: "",
    isValid: false,
    reason: `No valid transition for status '${orderStatus}' from ${fromColumn} to ${toColumn}`,
  };
}

// Check if an order can be dragged from a column
export function canDragFromColumn(status: OrderStatus): boolean {
  return CAN_DRAG_FROM_COLUMN[status] ?? false;
}

// Check if a drop is valid
export function isValidDrop(
  fromColumn: string,
  toColumn: string,
  orderStatus: OrderStatus
): boolean {
  const transition = getTransition(fromColumn, toColumn, orderStatus);
  return transition.isValid;
}
