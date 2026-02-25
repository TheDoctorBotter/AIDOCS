/**
 * EDI 837P (Professional Claims) Type Definitions
 * ANSI X12 837P v5010A1 compliant data structures
 *
 * All monetary amounts are in CENTS (integers) and converted to dollars in EDI output.
 */

// ============================================================================
// Provider Types
// ============================================================================

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;       // 2-letter state code
  zip: string;         // 5 or 9 digit ZIP
}

export interface BillingProvider {
  npi: string;                // 10-digit NPI
  taxId: string;              // EIN (XX-XXXXXXX or XXXXXXXXX)
  taxonomyCode: string;       // e.g., 225100000X for Physical Therapy
  organizationName: string;   // Entity type 2 (organization)
  address: Address;
  contactName: string;        // Submitter contact person
  contactPhone: string;       // 10-digit phone
  contactEmail?: string;      // Optional contact email
}

export interface RenderingProvider {
  npi: string;                // 10-digit NPI
  lastName: string;
  firstName: string;
  middleName?: string;
  taxonomyCode: string;       // 225100000X for PT
  suffix?: string;            // Jr., Sr., etc.
}

export interface ReferringProvider {
  npi: string;                // 10-digit NPI
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
}

// ============================================================================
// Patient / Subscriber Types
// ============================================================================

export type Gender = 'M' | 'F' | 'U';

/**
 * Individual Relationship Codes (SBR02 / PAT01)
 * Used to identify the patient's relationship to the subscriber.
 */
export type RelationshipCode =
  | '18'   // Self
  | '01'   // Spouse
  | '19'   // Child
  | '20'   // Employee
  | '21'   // Unknown
  | '39'   // Organ Donor
  | '40'   // Cadaver Donor
  | '53'   // Life Partner
  | 'G8';  // Other Relationship

export interface Subscriber {
  memberId: string;           // Insurance ID / Medicaid ID
  groupNumber?: string;       // Group/policy number
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth: string;        // YYYY-MM-DD
  gender: Gender;
  address: Address;
}

/**
 * Patient info — only used when the patient is NOT the subscriber.
 * Common in pediatric PT where a parent is the subscriber.
 */
export interface PatientInfo {
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth: string;        // YYYY-MM-DD
  gender: Gender;
  address: Address;
  relationshipToSubscriber: RelationshipCode;
}

// ============================================================================
// Payer Types
// ============================================================================

/**
 * Claim Filing Indicator Codes (SBR09)
 * Identifies the type of insurance.
 */
export type ClaimFilingIndicator =
  | 'MC'   // Medicaid
  | 'CI'   // Commercial Insurance
  | 'BL'   // Blue Cross/Blue Shield
  | 'MB'   // Medicare Part B
  | 'MA'   // Medicare Part A
  | 'HM'   // HMO
  | 'OF'   // Other Federal Program
  | 'CH'   // CHAMPUS (TRICARE)
  | 'VA'   // Veterans Affairs
  | 'WC'   // Workers' Compensation
  | 'ZZ';  // Mutually Defined

export interface PayerInfo {
  payerId: string;            // e.g., TXMCD for Texas Medicaid
  payerName: string;
  payerAddress?: Address;     // Optional payer address
  claimFilingIndicator: ClaimFilingIndicator;
}

// ============================================================================
// Claim Types
// ============================================================================

export interface ClaimInfo {
  claimId: string;                  // Patient account number / claim ID
  totalChargesCents: number;        // Total charges in CENTS
  placeOfService: string;           // 11 = Office, 12 = Home, etc.
  frequencyCode?: string;           // 1 = Original, 7 = Replacement, 8 = Void
  diagnosisCodes: string[];         // ICD-10 codes (up to 12)
  priorAuthNumber?: string;         // Prior authorization reference number
  onsetDate?: string;               // Date of current illness/symptom (YYYY-MM-DD)
  initialTreatmentDate?: string;    // Initial treatment date (YYYY-MM-DD)
  lastSeenDate?: string;            // Date last seen by referring provider
  referralNumber?: string;          // Referral number
  claimNote?: string;               // Additional claim info (NTE segment)
}

export interface ServiceLine {
  lineNumber: number;               // Sequential line number (1-based)
  cptCode: string;                  // CPT/HCPCS code
  modifiers: string[];              // Up to 4 modifiers (GP, 59, KX, etc.)
  chargeAmountCents: number;        // Charge amount in CENTS
  units: number;                    // Service units
  diagnosisPointers: number[];      // 1-based indices into claim diagnosisCodes
  dateOfService: string;            // YYYY-MM-DD
  dateOfServiceEnd?: string;        // End date for date ranges (YYYY-MM-DD)
  description?: string;             // Optional line description
  priorAuthNumber?: string;         // Line-level prior auth (REF*G1)
}

// ============================================================================
// Main Input / Output Types
// ============================================================================

export interface Claim837PInput {
  // Interchange identifiers
  submitterId: string;              // ISA06 sender ID
  submitterName: string;            // Loop 1000A submitter name
  receiverId: string;               // ISA08 receiver ID
  receiverName: string;             // Loop 1000B receiver name

  // Production or test mode
  usageIndicator: 'P' | 'T';       // P = Production, T = Test

  // Providers
  billingProvider: BillingProvider;
  renderingProvider?: RenderingProvider;
  referringProvider?: ReferringProvider;

  // Patient / Subscriber
  subscriber: Subscriber;
  patient?: PatientInfo;            // Only when patient != subscriber

  // Payer
  payer: PayerInfo;

  // Claim details
  claim: ClaimInfo;

  // Service lines
  serviceLines: ServiceLine[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ControlNumbers {
  isaControlNumber: string;
  gsControlNumber: string;
  stControlNumber: string;
}

export interface GenerationResult {
  success: boolean;
  ediContent?: string;
  errors: ValidationError[];
  controlNumbers: ControlNumbers;
  segmentCount: number;
}
