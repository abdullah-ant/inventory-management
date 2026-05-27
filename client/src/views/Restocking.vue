<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Success banner shown after placing an order; dismissed by clicking X -->
      <div v-if="orderPlacedBanner" class="success-banner">
        <span>{{ t('restocking.orderPlaced') }}</span>
        <button class="banner-dismiss" @click="orderPlacedBanner = false">&#x2715;</button>
      </div>

      <!-- Budget control card -->
      <div class="card budget-card">
        <div class="budget-header">
          <div class="budget-label-row">
            <span class="budget-label">{{ t('restocking.availableBudget') }}</span>
            <span class="budget-amount">{{ formatMoney(budget) }}</span>
          </div>
          <!-- Range slider styled with accent-color + custom track/thumb via CSS below -->
          <input
            type="range"
            class="budget-slider"
            min="0"
            :max="maxBudget"
            step="100"
            v-model.number="budget"
          />
          <div class="budget-range-labels">
            <span>{{ formatMoney(0) }}</span>
            <span>{{ formatMoney(maxBudget) }}</span>
          </div>
        </div>
        <!-- Lead-time note: e.g. "All restock orders ship with a 14-day delivery lead time." -->
        <p class="lead-time-note">{{ t('restocking.leadTimeNote', { days: LEAD_TIME_DAYS }) }}</p>
      </div>

      <!-- Budget summary card (modelled on BacklogDetailModal .summary-card) -->
      <div class="budget-summary-row">
        <div class="summary-card budget-used">
          <div class="summary-label">{{ t('restocking.total') }}</div>
          <div class="summary-value">{{ formatMoney(recommendedTotal) }}</div>
          <div class="summary-sub">{{ t('restocking.ofBudget', { budget: formatMoney(budget) }) }}</div>
        </div>
        <div class="summary-card budget-remaining">
          <div class="summary-label">{{ t('restocking.remaining') }}</div>
          <div class="summary-value">{{ formatMoney(Math.max(0, budget - recommendedTotal)) }}</div>
          <div class="summary-sub">&nbsp;</div>
        </div>
      </div>

      <!-- Recommendations table card -->
      <div class="card">
        <div class="card-header recs-header">
          <h3 class="card-title">{{ t('restocking.recommendedCount', { count: recommendations.length }) }}</h3>
          <!-- Place Order button — styled after .task-add-btn in TasksModal.vue -->
          <button
            class="place-order-btn"
            :disabled="recommendations.length === 0"
            @click="placeOrder"
          >
            {{ t('restocking.placeOrder') }}
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="recommendations.length === 0" class="no-recommendations">
          {{ t('restocking.noRecommendations') }}
        </div>

        <!-- Recommendations table -->
        <div v-else class="table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th class="col-sku">{{ t('restocking.table.sku') }}</th>
                <th class="col-name">{{ t('restocking.table.itemName') }}</th>
                <th class="col-trend">{{ t('restocking.table.trend') }}</th>
                <th class="col-demand">{{ t('restocking.table.currentDemand') }}</th>
                <th class="col-demand">{{ t('restocking.table.forecastedDemand') }}</th>
                <th class="col-qty">{{ t('restocking.table.restockQty') }}</th>
                <th class="col-cost">{{ t('restocking.table.unitCost') }}</th>
                <th class="col-cost">{{ t('restocking.table.lineCost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recommendations" :key="item.item_sku">
                <td class="col-sku"><strong>{{ item.item_sku }}</strong></td>
                <td class="col-name">{{ translateProductName(item.item_name) }}</td>
                <td class="col-trend">
                  <span :class="['badge', item.trend]">{{ t('trends.' + item.trend) }}</span>
                </td>
                <td class="col-demand">{{ item.current_demand }}</td>
                <td class="col-demand"><strong>{{ item.forecasted_demand }}</strong></td>
                <td class="col-qty"><strong>{{ item.restockQty }}</strong> {{ t('restocking.units') }}</td>
                <td class="col-cost">{{ formatMoney(item.unit_cost) }}</td>
                <td class="col-cost"><strong>{{ formatMoney(item.lineCost) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'
import { useRestocking } from '../composables/useRestocking'

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency, translateProductName } = useI18n()
    const { selectedLocation, getCurrentFilters } = useFilters()
    const { addSubmittedOrder, expectedDelivery, LEAD_TIME_DAYS } = useRestocking()

    // --- State ---
    const loading = ref(true)
    const error = ref(null)
    const allForecasts = ref([])
    const budget = ref(0)
    const orderPlacedBanner = ref(false)

    // --- Currency symbol (mirrors Inventory.vue:101-103) ---
    const currencySymbol = computed(() => currentCurrency.value === 'JPY' ? '¥' : '$')

    /**
     * Format a number as currency.  Keeps 2 decimal places so unit costs like
     * $12.50 don't get truncated.
     */
    const formatMoney = (value) =>
      currencySymbol.value + Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

    /**
     * The maximum budget value for the slider equals the total cost to fully
     * restock every item that has a positive demand gap, rounded UP to the
     * nearest $1,000.  With current data this is roughly $9,307 → $10,000.
     * Recomputed whenever forecast data changes.
     */
    const maxBudget = computed(() => {
      const total = allForecasts.value.reduce((sum, f) => {
        const qty = Math.max(0, f.forecasted_demand - f.current_demand)
        return sum + qty * f.unit_cost
      }, 0)
      // Round up to nearest 1000 so the slider always reaches "full restock"
      return Math.ceil(total / 1000) * 1000 || 1000
    })

    /**
     * Greedy recommendation algorithm.
     *
     * Step 1 – Compute restockQty per item (demand gap) and skip items that
     *           don't need restocking (gap ≤ 0).
     * Step 2 – Sort by urgency: "increasing" trend items first (most urgent
     *           because demand is accelerating); within the same priority tier
     *           sort by restockQty descending (larger gap = higher impact).
     * Step 3 – Greedy budget fill: walk the sorted list and include each item
     *           if its lineCost fits the remaining budget.  We continue past
     *           an unaffordable item so cheaper lower-priority items can still
     *           be picked (non-contiguous knapsack approximation).
     *
     * The computed property depends on both `budget` and `allForecasts` so it
     * re-runs live whenever the slider moves or data refreshes.
     */
    const recommendations = computed(() => {
      // Build candidate list with derived fields
      const candidates = allForecasts.value
        .map(f => ({
          item_sku: f.item_sku,
          item_name: f.item_name,
          trend: f.trend,
          current_demand: f.current_demand,
          forecasted_demand: f.forecasted_demand,
          unit_cost: f.unit_cost,
          restockQty: Math.max(0, f.forecasted_demand - f.current_demand),
          // lineCost computed after restockQty is known
          lineCost: 0
        }))
        .filter(item => item.restockQty > 0)
        .map(item => ({ ...item, lineCost: item.restockQty * item.unit_cost }))

      // Sort: increasing trend has urgency=0 (first), all others urgency=1;
      // secondary sort by restockQty descending for higher-impact items.
      candidates.sort((a, b) => {
        const urgencyA = a.trend === 'increasing' ? 0 : 1
        const urgencyB = b.trend === 'increasing' ? 0 : 1
        if (urgencyA !== urgencyB) return urgencyA - urgencyB
        return b.restockQty - a.restockQty
      })

      // Greedy fill: track remaining budget and pick affordable items
      let remaining = budget.value
      const picked = []
      for (const item of candidates) {
        if (item.lineCost <= remaining) {
          picked.push(item)
          remaining -= item.lineCost
        }
        // Do NOT break on unaffordable — a cheaper item later may still fit
      }
      return picked
    })

    /** Sum of all picked line costs — used in the summary card and order payload. */
    const recommendedTotal = computed(() =>
      recommendations.value.reduce((sum, r) => sum + r.lineCost, 0)
    )

    // --- Data loading ---
    const loadForecasts = async () => {
      try {
        loading.value = true
        error.value = null
        allForecasts.value = await api.getDemandForecasts()

        // Initialise budget to ~50 % of the maximum so the slider starts
        // at a meaningful mid-point rather than zero or the ceiling.
        // maxBudget is a computed based on allForecasts, so it is already
        // available by the time this line runs.
        budget.value = Math.round(maxBudget.value * 0.5 / 100) * 100
      } catch (err) {
        error.value = 'Failed to load demand forecasts: ' + err.message
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    // --- Place order handler ---
    const placeOrder = () => {
      const orderDate = new Date().toISOString()
      const order = {
        customer: 'Internal Restock',
        items: recommendations.value.map(r => ({
          sku: r.item_sku,
          name: r.item_name,
          quantity: r.restockQty,
          unit_price: r.unit_cost
        })),
        status: 'Submitted',
        order_date: orderDate,
        expected_delivery: expectedDelivery(orderDate),
        total_value: recommendedTotal.value,
        // Use the active warehouse filter if one is selected; fall back to
        // the primary warehouse so the order always has a valid location.
        warehouse: selectedLocation.value !== 'all' ? selectedLocation.value : 'San Francisco',
        category: 'Restock'
      }
      addSubmittedOrder(order)    // composable assigns id / order_number / lead_time_days
      orderPlacedBanner.value = true
    }

    onMounted(loadForecasts)

    return {
      t,
      loading,
      error,
      budget,
      maxBudget,
      recommendations,
      recommendedTotal,
      orderPlacedBanner,
      LEAD_TIME_DAYS,
      formatMoney,
      translateProductName,
      placeOrder
    }
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
}

.page-header h2 {
  margin-bottom: 0.25rem;
}

.page-header p {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-family: var(--font-sans);
}

/* ── Success banner ── */
.success-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(80, 250, 123, 0.12);
  border: 1px solid var(--success);
  color: var(--success);
  padding: 0.875rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-weight: 500;
  font-size: 0.938rem;
  font-family: var(--font-mono);
}

.banner-dismiss {
  background: transparent;
  border: none;
  color: var(--success);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.15s;
}

.banner-dismiss:hover {
  background: rgba(80, 250, 123, 0.15);
}

/* ── Budget card ── */
.budget-card {
  margin-bottom: 1.25rem;
}

.budget-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.budget-label-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.budget-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: var(--font-mono);
}

.budget-amount {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

/* ── Custom range slider ── */
.budget-slider {
  width: 100%;
  height: 6px;
  /* accent-color sets the thumb and fill in modern browsers */
  accent-color: var(--accent);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 4px;
  outline: none;
  background: transparent;
}

/* Track — WebKit */
.budget-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
}

/* Thumb — WebKit */
.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-deep);
  box-shadow: 0 1px 4px rgba(189, 147, 249, 0.4);
  margin-top: -7px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.budget-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 2px 8px rgba(189, 147, 249, 0.6), var(--glow-accent);
  transform: scale(1.1);
}

/* Track — Firefox */
.budget-slider::-moz-range-track {
  width: 100%;
  height: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
}

/* Thumb — Firefox */
.budget-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-deep);
  box-shadow: 0 1px 4px rgba(189, 147, 249, 0.4);
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.budget-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.lead-time-note {
  margin-top: 0.875rem;
  font-size: 0.813rem;
  color: var(--text-muted);
  font-style: italic;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border);
  font-family: var(--font-sans);
}

/* ── Budget summary row (modelled on BacklogDetailModal .summary-card) ── */
.budget-summary-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.summary-card {
  padding: 1.25rem;
  border-radius: 10px;
  border: 2px solid;
}

.budget-used {
  border-color: rgba(189, 147, 249, 0.35);
  background: rgba(189, 147, 249, 0.08);
}

.budget-remaining {
  border-color: rgba(80, 250, 123, 0.32);
  background: rgba(80, 250, 123, 0.08);
}

.summary-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  font-family: var(--font-mono);
}

.summary-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

.budget-used .summary-value {
  color: var(--accent);
}

.budget-remaining .summary-value {
  color: var(--success);
}

.summary-sub {
  font-size: 0.813rem;
  color: var(--text-muted);
  margin-top: 0.375rem;
  font-family: var(--font-mono);
}

/* ── Recommendations card ── */
.recs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Place Order button — gradient uses accent (purple) → highlight (pink) */
.place-order-btn {
  padding: 0.75rem 1.75rem;
  background: linear-gradient(135deg, var(--accent), var(--highlight));
  color: var(--bg-deep);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.938rem;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  font-family: var(--font-mono);
}

.place-order-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--glow-accent);
}

.place-order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-recommendations {
  padding: 2.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.938rem;
  font-style: italic;
  font-family: var(--font-mono);
}

/* ── Table columns ── */
.orders-table {
  table-layout: fixed;
  width: 100%;
}

.col-sku    { width: 110px; }
.col-name   { width: auto; }
.col-trend  { width: 120px; }
.col-demand { width: 130px; }
.col-qty    { width: 120px; }
.col-cost   { width: 120px; }
</style>
