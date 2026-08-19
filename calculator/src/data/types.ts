// =============================================================================
// data/types.ts — TypeScript types matching the provider YAML schema.
//
// These types model the YAML *data* loaded from providers/*.yaml. They are
// distinct from src/types.ts which models the calculator's input/output types.
//
// The relationship:
//   YAML file → load+validate → ProviderData (this file)
//   UserInputs + ProviderData → calculator function → ProviderEstimate (src/types.ts)
// =============================================================================

import type { ConfidenceRating, TransparencyTier } from '../types';

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------
export type PricingValueType = 'exact' | 'starting_at' | 'range';

export type PricingModel =
  | 'subscription_tiered'
  | 'per_region_flat'
  | 'per_filing'
  | 'per_transaction'
  | 'hybrid'
  | 'percent_of_revenue'
  | 'custom_quote';

export type Vertical = 'ecommerce' | 'saas' | 'enterprise' | 'smb' | 'marketplace' | 'b2b';

export type ScalesWith = 'orders' | 'transactions' | 'revenue' | 'states' | 'filings' | 'jurisdictions' | 'seats';

export type FilingPeriod = 'monthly' | 'quarterly' | 'annual' | 'none';

export type ChangeType = 'price_increase' | 'price_decrease' | 'new_plan' | 'discontinued_plan' | 'structure_change';

// -----------------------------------------------------------------------------
// Pricing value — represents a dollar amount or range with source/confidence
// -----------------------------------------------------------------------------
export interface PricingValue {
  amount: number | null;
  type: PricingValueType;
  range_min?: number | null;
  range_max?: number | null;
  source: string;
  source_date?: string;
  confidence: ConfidenceRating;
  discount_pct_vs_monthly?: number | null;
}

export interface CostWithSource {
  amount: number | null;
  source: string;
  confidence: ConfidenceRating;
  range_min?: number | null;
  range_max?: number | null;
}

// -----------------------------------------------------------------------------
// Provider metadata
// -----------------------------------------------------------------------------
export interface ProviderMeta {
  name: string;
  slug: string;
  legal_name?: string | null;
  parent_company?: string | null;
  hq_location?: string | null;
  founded_year?: number | null;
  primary_url: string;
  pricing_url?: string | null;
  help_center_url?: string | null;
  target_icp?: string | null;
  primary_verticals?: Vertical[];
  competitive_position?: string | null;
}

// -----------------------------------------------------------------------------
// Transparency
// -----------------------------------------------------------------------------
export interface Transparency {
  tier: TransparencyTier;
  rationale?: string;
  pricing_page_has_dollar_amounts?: boolean;
  quote_required_for_core_product?: boolean;
  publishes_filing_fees?: boolean;
  publishes_registration_fees?: boolean;
  publishes_overage_rates?: boolean;
  publishes_implementation_fees?: boolean;
}

// -----------------------------------------------------------------------------
// Pricing model
// -----------------------------------------------------------------------------
export interface PricingModelInfo {
  primary: PricingModel;
  scales_with?: ScalesWith[];
  predictability_score?: number;
  predictability_notes?: string;
}

// -----------------------------------------------------------------------------
// Plans
// -----------------------------------------------------------------------------
export interface OrderTier {
  included_orders: number;
  monthly_price: number;
  annual_price?: number | null;
  api_calls_included?: number | null;
  source?: string;
  confidence?: ConfidenceRating;
}

export interface Overage {
  model: 'flex_fees' | 'hard_cap' | 'per_unit' | 'upgrade_required' | 'none';
  per_unit_cost?: number | null;
  description?: string;
}

export interface IncludedFilings {
  count: number | null;
  period: FilingPeriod;
}

export interface PlanFeatures {
  nexus_monitoring: boolean;
  exemption_certificate_mgmt: boolean;
  multi_state_filing: boolean;
  audit_support: boolean;
  phone_support: boolean;
  dedicated_csm: boolean;
  sst_program_access: boolean;
  vda_support: boolean;
  international_vat_gst: boolean;
}

export interface Plan {
  name: string;
  slug: string;
  tagline?: string | null;
  target_customer?: string | null;
  is_free: boolean;
  is_quote_only: boolean;
  monthly_price: PricingValue;
  annual_price: PricingValue;
  order_tiers?: OrderTier[];
  overage?: Overage;
  included_filings_per_period?: IncludedFilings;
  included_integrations?: number | null;
  included_states?: number | null;
  api_access_included: boolean;
  features: PlanFeatures;
  /**
   * Optional per-plan override for filing cost. When present, the calculator
   * should use this instead of data.filings.base_cost.amount for plans where
   * the per-filing cost differs by tier (e.g., TaxJar Starter $50 vs Professional $55).
   */
  per_filing_cost_override?: number | null;
  /**
   * Optional per-plan override for registration cost. Same pattern as
   * per_filing_cost_override.
   */
  per_registration_cost_override?: number | null;
  /**
   * Optional per-plan override for transaction fee rate. Used by hybrid and
   * per-transaction pricing models where the bps rate varies by tier (e.g.,
   * Anrok: 40 bps Starter, 30 bps Core; Stripe Tax: 50 bps Billing, 40 bps
   * Payment API). Units inherit from data.transaction_fees.rate_unit.
   */
  transaction_fee_rate_override?: number | null;
}

// -----------------------------------------------------------------------------
// Other sections
// -----------------------------------------------------------------------------
export interface FilingTier {
  /** Annual filings count covered by this tier. */
  filings: number;
  /** Total annual price for this filing-count tier (USD). */
  annual_price: number;
  source?: string;
  confidence?: ConfidenceRating;
}

export interface FilingsInfo {
  has_per_filing_fee: boolean;
  base_cost: CostWithSource;
  state_upcharges?: Array<{ state: string; reason: string; additional_cost: number; source: string }>;
  volume_discounts?: Array<{ threshold_filings_per_month: number | null; discounted_rate: number | null; source: string }>;
  /**
   * Tiered annual pricing for filings, when the provider charges a single
   * all-in annual fee per filing-count bucket rather than per-filing × volume.
   * When present, the calculator walks this ladder for billable filings and
   * ignores base_cost.amount. (TaxCloud uses this model.)
   */
  tier_pricing?: FilingTier[];
  /**
   * Filing-credit bundles sold to annual subscribers, keyed by plan slug.
   * A `filings` of null means "unlimited". Used by TaxJar, which sells blocks
   * of AutoFile credits at a discount to its per-filing rate.
   */
  bundle_pricing?: Record<string, FilingBundle[]>;
  notes?: string;
}

export interface FilingBundle {
  /** Filings covered by the bundle; null means unlimited. */
  filings: number | null;
  /** Total annual price for the bundle (USD). */
  annual_price: number;
  source?: string;
  confidence?: ConfidenceRating;
}

export interface RegistrationsInfo {
  has_per_registration_fee: boolean;
  base_cost: CostWithSource;
  includes_state_fees?: boolean | null;
  notes?: string;
}

export interface TransactionFeesInfo {
  has_transaction_fee: boolean;
  model?: 'flat_per_txn' | 'basis_points' | 'percent' | 'tiered' | null;
  rate?: number | null;
  rate_unit?: 'bps' | 'percent' | 'usd_per_txn' | null;
  applies_to?: 'taxable_only' | 'all_transactions' | null;
  notes?: string;
}

export interface SstInfo {
  is_csp: boolean;
  sst_member_states_covered_free?: number | null;
  eligibility_requirements?: string;
  filings_covered_under_csp?: boolean;
  source?: string;
}

export interface InternationalInfo {
  supports_vat?: boolean;
  supports_gst?: boolean;
  countries_covered?: number | null;
  pricing_model_international?: string;
  source?: string;
}

export interface Source {
  url: string;
  title?: string;
  accessed_date?: string;
  confidence: ConfidenceRating;
  fields_supported?: string[];
}

export interface ChangeLogEntry {
  date: string;
  change_type: ChangeType;
  description: string;
  source?: string;
}

export interface CalculatorInfo {
  applicable_inputs?: string[];
  cost_formula_notes: string;
  output_caveat?: string;
}

// -----------------------------------------------------------------------------
// Root provider data type
// -----------------------------------------------------------------------------
export interface ProviderData {
  provider: ProviderMeta;
  transparency: Transparency;
  pricing_model: PricingModelInfo;
  plans: Plan[];
  filings: FilingsInfo;
  registrations: RegistrationsInfo;
  transaction_fees: TransactionFeesInfo;
  add_ons: Record<string, unknown>;
  sst: SstInfo;
  international: InternationalInfo;
  discounts?: Record<string, unknown>;
  commitments?: Record<string, unknown>;
  sources: Source[];
  change_log?: ChangeLogEntry[];
  calculator: CalculatorInfo;
  notes?: string;
}
