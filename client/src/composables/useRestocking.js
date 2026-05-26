import { ref } from 'vue'

// Standard delivery lead time (in days) applied to every restocking order.
// Fixed by product decision rather than stored per-item.
export const LEAD_TIME_DAYS = 14

// Shared singleton state: declared at module scope so every component that
// calls useRestocking() reads/writes the SAME array (same pattern as
// useFilters.js). This is how a restock order placed in Restocking.vue shows
// up in Orders.vue without a backend round-trip.
const submittedOrders = ref([])

// Running counter for human-readable, sequential order numbers (RST-2025-0001…).
// Kept at module scope so numbers keep incrementing across the session.
let orderSequence = 0

/**
 * Compute the expected delivery date for an order placed at `orderDateISO`,
 * by adding the fixed lead time. Returns an ISO string so it formats the same
 * way as the existing order dates (formatDate in Orders.vue).
 */
export function expectedDelivery(orderDateISO) {
  const date = new Date(orderDateISO)
  // Guard against invalid input before doing date math.
  if (isNaN(date.getTime())) return orderDateISO
  date.setDate(date.getDate() + LEAD_TIME_DAYS)
  return date.toISOString()
}

export function useRestocking() {
  /**
   * Add a submitted restock order to the shared list.
   * Assigns a unique, timestamp-based id (avoids the id-collision risk noted
   * in useAuth.js where mock records reuse ids 1-4) and a sequential
   * order_number. Newest orders are placed first.
   *
   * @param {Object} order - order fields except id/order_number/lead_time_days,
   *   which are assigned here.
   * @returns {Object} the stored order, including assigned id/order_number.
   */
  const addSubmittedOrder = (order) => {
    orderSequence += 1
    const year = new Date(order.order_date).getFullYear() || new Date().getFullYear()
    const stored = {
      ...order,
      id: `rst-${Date.now()}-${orderSequence}`,
      order_number: `RST-${year}-${String(orderSequence).padStart(4, '0')}`,
      lead_time_days: LEAD_TIME_DAYS
    }
    submittedOrders.value.unshift(stored)
    return stored
  }

  return {
    submittedOrders,
    addSubmittedOrder,
    expectedDelivery,
    LEAD_TIME_DAYS
  }
}
