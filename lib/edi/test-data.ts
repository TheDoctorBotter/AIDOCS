/**
 * EDI 837P Test Data
 *
 * Sample claim data for a south Texas physical therapy practice.
 * Includes scenarios for Texas Medicaid (TMHP) and commercial insurance,
 * as well as subscriber-is-patient and pediatric (subscriber != patient) cases.
 */

import type { Claim837PInput } from './types';

// ============================================================================
// Scenario 1: Adult PT Visit — Texas Medicaid (TMHP)
// Subscriber IS the patient. Evaluation + 3 treatment codes.
// ============================================================================

export const SAMPLE_MEDICAID_ADULT: Claim837PInput = {
  submitterId: '1234567890',
  submitterName: 'SOUTH TEXAS PT CLINIC',
  receiverId: 'TXMCD',
  receiverName: 'TEXAS MEDICAID AND HEALTHCARE PARTNERSHIP',
  usageIndicator: 'T',

  billingProvider: {
    npi: '1234567890',
    taxId: '74-1234567',
    taxonomyCode: '225100000X',
    organizationName: 'SOUTH TEXAS PHYSICAL THERAPY PLLC',
    address: {
      line1: '1200 S 10TH ST',
      line2: 'STE 200',
      city: 'MCALLEN',
      state: 'TX',
      zip: '785011234',
    },
    contactName: 'MARIA GARCIA',
    contactPhone: '9565551234',
    contactEmail: 'billing@southtxpt.com',
  },

  renderingProvider: {
    npi: '9876543210',
    lastName: 'GARCIA',
    firstName: 'MARIA',
    taxonomyCode: '225100000X',
  },

  referringProvider: {
    npi: '5551234567',
    lastName: 'JOHNSON',
    firstName: 'ROBERT',
    suffix: 'MD',
  },

  subscriber: {
    memberId: '123456789',
    lastName: 'DOE',
    firstName: 'JOHN',
    middleName: 'A',
    dateOfBirth: '1985-03-15',
    gender: 'M',
    address: {
      line1: '456 OAK AVE',
      city: 'MCALLEN',
      state: 'TX',
      zip: '78501',
    },
  },

  payer: {
    payerId: 'TXMCD',
    payerName: 'TEXAS MEDICAID',
    claimFilingIndicator: 'MC',
  },

  claim: {
    claimId: 'CLM-2024-001',
    totalChargesCents: 35000,           // $350.00
    placeOfService: '11',
    diagnosisCodes: ['M5416', 'M5130'],
    priorAuthNumber: 'AUTH2024001',
    onsetDate: '2024-01-02',
    initialTreatmentDate: '2024-01-08',
  },

  serviceLines: [
    {
      lineNumber: 1,
      cptCode: '97161',                 // PT Eval Low Complexity
      modifiers: ['GP'],
      chargeAmountCents: 15000,         // $150.00
      units: 1,
      diagnosisPointers: [1, 2],
      dateOfService: '2024-01-15',
    },
    {
      lineNumber: 2,
      cptCode: '97110',                 // Therapeutic Exercises
      modifiers: ['GP'],
      chargeAmountCents: 8000,          // $80.00
      units: 2,
      diagnosisPointers: [1],
      dateOfService: '2024-01-15',
    },
    {
      lineNumber: 3,
      cptCode: '97140',                 // Manual Therapy
      modifiers: ['GP', '59'],
      chargeAmountCents: 7000,          // $70.00
      units: 1,
      diagnosisPointers: [1, 2],
      dateOfService: '2024-01-15',
    },
    {
      lineNumber: 4,
      cptCode: '97530',                 // Therapeutic Activities
      modifiers: ['GP'],
      chargeAmountCents: 5000,          // $50.00
      units: 1,
      diagnosisPointers: [1],
      dateOfService: '2024-01-15',
    },
  ],
};

// ============================================================================
// Scenario 2: Pediatric PT Visit — Texas Medicaid
// Subscriber (parent) is NOT the patient (child).
// ============================================================================

export const SAMPLE_MEDICAID_PEDIATRIC: Claim837PInput = {
  submitterId: '1234567890',
  submitterName: 'SOUTH TEXAS PT CLINIC',
  receiverId: 'TXMCD',
  receiverName: 'TEXAS MEDICAID AND HEALTHCARE PARTNERSHIP',
  usageIndicator: 'T',

  billingProvider: {
    npi: '1234567890',
    taxId: '74-1234567',
    taxonomyCode: '225100000X',
    organizationName: 'SOUTH TEXAS PHYSICAL THERAPY PLLC',
    address: {
      line1: '1200 S 10TH ST',
      line2: 'STE 200',
      city: 'MCALLEN',
      state: 'TX',
      zip: '785011234',
    },
    contactName: 'MARIA GARCIA',
    contactPhone: '9565551234',
  },

  renderingProvider: {
    npi: '9876543210',
    lastName: 'GARCIA',
    firstName: 'MARIA',
    taxonomyCode: '225100000X',
  },

  referringProvider: {
    npi: '5551234567',
    lastName: 'MARTINEZ',
    firstName: 'ANA',
    suffix: 'MD',
  },

  subscriber: {
    memberId: '987654321',
    lastName: 'RAMIREZ',
    firstName: 'CARMEN',
    dateOfBirth: '1988-07-22',
    gender: 'F',
    address: {
      line1: '789 PALM DR',
      city: 'EDINBURG',
      state: 'TX',
      zip: '78539',
    },
  },

  patient: {
    lastName: 'RAMIREZ',
    firstName: 'SOFIA',
    dateOfBirth: '2019-11-03',
    gender: 'F',
    address: {
      line1: '789 PALM DR',
      city: 'EDINBURG',
      state: 'TX',
      zip: '78539',
    },
    relationshipToSubscriber: '19',       // Child
  },

  payer: {
    payerId: 'TXMCD',
    payerName: 'TEXAS MEDICAID',
    claimFilingIndicator: 'MC',
  },

  claim: {
    claimId: 'CLM-2024-002',
    totalChargesCents: 27500,             // $275.00
    placeOfService: '11',
    diagnosisCodes: ['F820', 'R262'],
    priorAuthNumber: 'AUTH2024PED002',
    onsetDate: '2023-06-15',
  },

  serviceLines: [
    {
      lineNumber: 1,
      cptCode: '97163',                   // PT Eval High Complexity
      modifiers: ['GP'],
      chargeAmountCents: 18000,           // $180.00
      units: 1,
      diagnosisPointers: [1, 2],
      dateOfService: '2024-01-18',
    },
    {
      lineNumber: 2,
      cptCode: '97530',                   // Therapeutic Activities
      modifiers: ['GP'],
      chargeAmountCents: 5000,            // $50.00
      units: 1,
      diagnosisPointers: [1],
      dateOfService: '2024-01-18',
    },
    {
      lineNumber: 3,
      cptCode: '97542',                   // Wheelchair Assessment
      modifiers: ['GP'],
      chargeAmountCents: 4500,            // $45.00
      units: 1,
      diagnosisPointers: [1, 2],
      dateOfService: '2024-01-18',
    },
  ],
};

// ============================================================================
// Scenario 3: Adult PT Visit — Commercial Insurance (Blue Cross)
// Subscriber IS the patient. Follow-up treatment visit.
// ============================================================================

export const SAMPLE_COMMERCIAL_ADULT: Claim837PInput = {
  submitterId: '1234567890',
  submitterName: 'SOUTH TEXAS PT CLINIC',
  receiverId: '84980',
  receiverName: 'BLUE CROSS BLUE SHIELD OF TEXAS',
  usageIndicator: 'T',

  billingProvider: {
    npi: '1234567890',
    taxId: '74-1234567',
    taxonomyCode: '225100000X',
    organizationName: 'SOUTH TEXAS PHYSICAL THERAPY PLLC',
    address: {
      line1: '1200 S 10TH ST',
      line2: 'STE 200',
      city: 'MCALLEN',
      state: 'TX',
      zip: '785011234',
    },
    contactName: 'MARIA GARCIA',
    contactPhone: '9565551234',
  },

  renderingProvider: {
    npi: '9876543210',
    lastName: 'GARCIA',
    firstName: 'MARIA',
    taxonomyCode: '225100000X',
  },

  referringProvider: {
    npi: '5551234567',
    lastName: 'JOHNSON',
    firstName: 'ROBERT',
  },

  subscriber: {
    memberId: 'BCB123456789',
    groupNumber: 'GRP-TX-5500',
    lastName: 'SMITH',
    firstName: 'SARAH',
    middleName: 'J',
    dateOfBirth: '1972-09-08',
    gender: 'F',
    address: {
      line1: '321 MESQUITE BLVD',
      line2: 'APT 4B',
      city: 'PHARR',
      state: 'TX',
      zip: '78577',
    },
  },

  payer: {
    payerId: '84980',
    payerName: 'BLUE CROSS BLUE SHIELD OF TEXAS',
    claimFilingIndicator: 'BL',
  },

  claim: {
    claimId: 'CLM-2024-003',
    totalChargesCents: 24000,             // $240.00
    placeOfService: '11',
    diagnosisCodes: ['M5412', 'M4806'],
    onsetDate: '2024-01-05',
    lastSeenDate: '2024-01-05',
  },

  serviceLines: [
    {
      lineNumber: 1,
      cptCode: '97110',                   // Therapeutic Exercises
      modifiers: ['GP', 'KX'],
      chargeAmountCents: 8000,            // $80.00
      units: 2,
      diagnosisPointers: [1],
      dateOfService: '2024-01-22',
    },
    {
      lineNumber: 2,
      cptCode: '97112',                   // Neuromuscular Reeducation
      modifiers: ['GP'],
      chargeAmountCents: 8000,            // $80.00
      units: 2,
      diagnosisPointers: [1, 2],
      dateOfService: '2024-01-22',
    },
    {
      lineNumber: 3,
      cptCode: '97116',                   // Gait Training
      modifiers: ['GP'],
      chargeAmountCents: 4000,            // $40.00
      units: 1,
      diagnosisPointers: [1],
      dateOfService: '2024-01-22',
    },
    {
      lineNumber: 4,
      cptCode: '97035',                   // Ultrasound
      modifiers: ['GP'],
      chargeAmountCents: 4000,            // $40.00
      units: 1,
      diagnosisPointers: [2],
      dateOfService: '2024-01-22',
    },
  ],
};
