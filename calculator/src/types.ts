// =============================================================================
// types.ts — Shared types for the sales tax pricing calculator
//
// All calculator functions consume UserInputs and return ProviderEstimate.
// The discriminated union on estimate.type lets the UI render transparent
// vendors as exact numbers and opaque vendors as ranges, without losing the
// difference in transit.
// =============================================================================

export type IntegrationType =
  | 'shopify'
  | 'stripe'
  | 'quickbooks'
  | 'netsuite'
  | 'sap'
  | 'oracle'
  | 'dynamics'
  | 'chargebee'
  | 'bigcommerce'
  | 'woocommerce'
  | 'custom_api'
  | 'csv_only';

export type FilingFrequency = 'monthly' | 'quarterly' | 'annual';

export type BillingCadence = 'monthly' | 'annual';

export type TransparencyTier = 'transparent' | 'partial' | 'opaque';

export type EstimateType = 'exact' | 'range' | 'starting_at' | 'quote_required';

export type ConfidenceRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type BuyerSegment = 'startup' | 'smb' | 'mid_market' | 'enterprise';

// -----------------------------------------------------------------------------
// User inputs — everything the calculator needs to produce an estimate
// -----------------------------------------------------------------------------
export interface UserInputs {
  // Volume
  monthlyOrders: number;
  monthlyTransactionVolumeUSD: number;  // For basis-point pricers (Stripe Tax, Anrok)
  annualRevenueUSD: number;             // For opaque vendor buyer-segment estimation

  // State footprint
  statesFiling: number;                 // Total states where customer files returns
  statesPhysicalNexus: number;          // Subset of states where customer has physical nexus
                                        // (disqualifies them from SST free-filing in those states)

  // Filing posture
  filingFrequency: FilingFrequency;
  registrationBacklog: number;          // Net new state registrations needed at onboarding

  // Integration / technical needs
  integrationType: IntegrationType;
  requiresApiAccess: boolean;
  requiresExemptionCertificateMgmt: boolean;
  requiresInternationalVatGst: boolean;
  requiresVdaSupport: boolean;

  // Billing preference
  billingCadence: BillingCadence;

  // TaxJar-specific: API call volume drives effective order tier on Professional
  // because TaxJar counts 1 API call as 1/10 of an order. Pass undefined if unknown.
  monthlyApiCalls?: number;

  // International (for Anrok, Sphere, Stripe Tax)
  internationalCountries?: number;

  // SST states where the customer has economic nexus only (no physical
  // presence). When provided, SST CSPs (TaxCloud, Avalara) discount filings
  // in this many states. When omitted, sstEligibleStateCount() falls back to
  // its proportional estimate.
  sstEligibleStates?: number;

  // Total annual filings count, when the buyer can supply it directly. When
  // omitted, totalFilingsPerYear() computes it as statesFiling × frequency.
  // This is the cleaner input for buyers who know their filing cadence
  // explicitly (e.g., 120/year = 10 states monthly).
  annualFilings?: number;
}

// -----------------------------------------------------------------------------
// Estimate output — discriminated union by transparency reality
// -----------------------------------------------------------------------------
export interface ExactEstimate {
  type: 'exact';
  annualCostUSD: number;
}

export interface StartingAtEstimate {
  type: 'starting_at';
  annualCostUSD: number;     // Floor; actual will be at least this much
}

export interface RangeEstimate {
  type: 'range';
  annualCostMinUSD: number;
  annualCostMaxUSD: number;
}

export interface QuoteRequiredEstimate {
  type: 'quote_required';
  startingAtUSD?: number;
  message: string;
}

export type CostEstimate =
  | ExactEstimate
  | StartingAtEstimate
  | RangeEstimate
  | QuoteRequiredEstimate;

// -----------------------------------------------------------------------------
// Cost breakdown (for exact / starting_at estimates only)
// -----------------------------------------------------------------------------
export interface CostBreakdown {
  subscription: number;
  filings: number;
  registrations: number;
  transactions: number;
  addOns: number;
  implementation: number;
  /**
   * Count of annual returns that fall in SST member states and are therefore
   * not charged at all. A COUNT, not a dollar figure.
   *
   * This replaces an earlier `sstSavings` dollar field. Returns in SST member
   * states are $0 rather than discounted, and they do not consume the seller's
   * filing subscription, so there is no credit to net off a gross filing cost.
   * `filings` above is already the cost of the billable returns only. Rendering
   * the benefit as a discount both misdescribed it and, because the credit was
   * valued at a higher per-filing rate than the tiered price it reduced,
   * understated the provider's own cost.
   */
  filingsNotCharged?: number;
}

// -----------------------------------------------------------------------------
// Per-provider output
// -----------------------------------------------------------------------------
export interface ProviderEstimate {
  provider: string;             // Display name (e.g., "TaxJar")
  slug: string;                 // URL-safe identifier
  transparencyTier: TransparencyTier;
  recommendedPlan: string;      // Which plan we matched the user to
  estimate: CostEstimate;
  breakdown?: CostBreakdown;    // Present only for exact / starting_at estimates
  assumptions: string[];        // What the calculator assumed
  caveats: string[];            // What could change the number
  sources: string[];            // URLs the pricing data came from
}

// -----------------------------------------------------------------------------
// Provider registry signature
// Calculators may optionally consume ProviderData loaded from YAML. Hardcoded
// calculators ignore the second arg; data-driven calculators require it.
// -----------------------------------------------------------------------------
// Note: We avoid importing ProviderData here to keep the type module standalone.
// The second arg is typed as `unknown` and refined by each calculator.
export type CalculatorFn = (inputs: UserInputs, data?: unknown) => ProviderEstimate;
