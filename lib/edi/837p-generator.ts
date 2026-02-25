/**
 * HIPAA 837P (Professional Claims) EDI X12 Generator
 * ANSI X12 837P Version 005010X222A1
 *
 * Generates fully compliant 837P EDI files for physical therapy claims.
 * Supports both commercial insurance and Texas Medicaid (TMHP).
 *
 * Handles:
 * - Subscriber-is-patient (standard)
 * - Subscriber-is-not-patient (pediatric / dependent)
 * - Referring provider (Loop 2310A)
 * - Rendering provider (Loop 2310B)
 * - Prior authorization references
 * - Up to 12 ICD-10 diagnosis codes
 * - Up to 4 modifiers per service line (GP, 59, KX, etc.)
 * - Proper ISA/GS/SE/GE/IEA segment counting
 */

import {
  segment,
  ediDate,
  ediTime,
  fixedWidth,
  ediClean,
  formatNPI,
  formatTaxId,
  COMPONENT_SEP,
} from './edi-utils';

import {
  generateISAControlNumber,
  generateGSControlNumber,
  generateSTControlNumber,
} from './control-numbers';

import { validateClaim, hasErrors } from './validate-claim';

import type {
  Claim837PInput,
  GenerationResult,
  ControlNumbers,
} from './types';

// ============================================================================
// Helper: convert cents to EDI dollar format (2 decimal places)
// ============================================================================

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a complete ANSI X12 837P v5010A1 EDI file from structured claim data.
 *
 * All monetary amounts in the input are expected in CENTS and will be
 * converted to dollars (with 2 decimal places) in the EDI output.
 *
 * @param input - The claim data to generate EDI for
 * @returns GenerationResult with EDI content, control numbers, and any errors
 */
export function generate837P(input: Claim837PInput): GenerationResult {
  // Validate input
  const errors = validateClaim(input);
  const controlNumbers: ControlNumbers = {
    isaControlNumber: '',
    gsControlNumber: '',
    stControlNumber: '',
  };

  if (hasErrors(errors)) {
    return {
      success: false,
      errors,
      controlNumbers,
      segmentCount: 0,
    };
  }

  // Generate control numbers
  controlNumbers.isaControlNumber = generateISAControlNumber();
  controlNumbers.gsControlNumber = generateGSControlNumber();
  controlNumbers.stControlNumber = generateSTControlNumber();

  const now = new Date();
  const hasPatientLevel = !!input.patient;

  // Transaction segments (ST through SE) — counted for SE01
  const txn: string[] = [];

  // ==================================================================
  // ST - Transaction Set Header
  // ==================================================================
  txn.push(
    segment('ST', '837', controlNumbers.stControlNumber, '005010X222A1')
  );

  // ==================================================================
  // BHT - Beginning of Hierarchical Transaction
  // ==================================================================
  txn.push(
    segment(
      'BHT',
      '0019',                                   // Hierarchical Structure Code
      '00',                                      // Transaction Purpose: 00 = Original
      ediClean(input.claim.claimId).slice(0, 30),// Reference Identification
      ediDate(now),                              // Transaction Set Creation Date
      ediTime(now),                              // Transaction Set Creation Time
      'CH'                                       // Transaction Type: CH = Chargeable
    )
  );

  // ==================================================================
  // Loop 1000A - Submitter Name
  // ==================================================================
  txn.push(
    segment(
      'NM1',
      '41',                                      // Entity ID: Submitter
      '2',                                       // Entity Type: Non-Person (organization)
      ediClean(input.submitterName),
      '', '', '', '',
      '46',                                      // ID Code Qualifier: ETIN
      input.submitterId
    )
  );

  // PER - Submitter EDI Contact Information
  const perElements: (string | undefined)[] = [
    'IC',                                        // Contact Function: Information Contact
    ediClean(input.billingProvider.contactName),
    'TE',                                        // Comm Number Qualifier: Telephone
    input.billingProvider.contactPhone.replace(/\D/g, ''),
  ];
  if (input.billingProvider.contactEmail) {
    perElements.push('EM', input.billingProvider.contactEmail);
  }
  txn.push(segment('PER', ...perElements));

  // ==================================================================
  // Loop 1000B - Receiver Name
  // ==================================================================
  txn.push(
    segment(
      'NM1',
      '40',                                      // Entity ID: Receiver
      '2',                                       // Entity Type: Non-Person
      ediClean(input.receiverName),
      '', '', '', '',
      '46',                                      // ID Code Qualifier: ETIN
      input.receiverId
    )
  );

  // ==================================================================
  // Loop 2000A - Billing Provider Hierarchical Level
  // ==================================================================
  txn.push(
    segment(
      'HL',
      '1',                                       // HL01: Hierarchical ID Number
      '',                                        // HL02: Parent ID (none for billing)
      '20',                                      // HL03: Hierarchical Level Code (Info Source)
      '1'                                        // HL04: Hierarchical Child Code (1 = has children)
    )
  );

  // PRV - Billing Provider Specialty Information
  txn.push(
    segment(
      'PRV',
      'BI',                                      // Provider Code: Billing
      'PXC',                                     // Reference ID Qualifier: Taxonomy
      input.billingProvider.taxonomyCode
    )
  );

  // ==================================================================
  // Loop 2010AA - Billing Provider Name
  // ==================================================================
  txn.push(
    segment(
      'NM1',
      '85',                                      // Entity ID: Billing Provider
      '2',                                       // Entity Type: Non-Person (organization)
      ediClean(input.billingProvider.organizationName),
      '', '', '', '',
      'XX',                                      // ID Code Qualifier: NPI
      formatNPI(input.billingProvider.npi)
    )
  );

  // N3 - Billing Provider Address
  const bpAddr = input.billingProvider.address;
  if (bpAddr.line2) {
    txn.push(segment('N3', ediClean(bpAddr.line1), ediClean(bpAddr.line2)));
  } else {
    txn.push(segment('N3', ediClean(bpAddr.line1)));
  }

  // N4 - Billing Provider City/State/ZIP
  txn.push(
    segment(
      'N4',
      ediClean(bpAddr.city),
      bpAddr.state,
      bpAddr.zip.replace(/\D/g, '')
    )
  );

  // REF - Billing Provider Tax ID
  txn.push(
    segment(
      'REF',
      'EI',                                      // Reference ID Qualifier: Employer's ID Number
      formatTaxId(input.billingProvider.taxId)
    )
  );

  // ==================================================================
  // Loop 2000B - Subscriber Hierarchical Level
  // ==================================================================
  txn.push(
    segment(
      'HL',
      '2',                                       // HL01: Hierarchical ID
      '1',                                       // HL02: Parent ID (billing provider)
      '22',                                      // HL03: Hierarchical Level Code (Subscriber)
      hasPatientLevel ? '1' : '0'                // HL04: 1 if patient level follows, 0 if not
    )
  );

  // SBR - Subscriber Information
  txn.push(
    segment(
      'SBR',
      'P',                                       // SBR01: Payer Responsibility (P = Primary)
      hasPatientLevel ? '' : '18',               // SBR02: Individual Relationship (18=Self, blank if patient level)
      input.subscriber.groupNumber || '',        // SBR03: Group/Policy Number
      '',                                        // SBR04: Group Name (not used)
      '',                                        // SBR05: Insurance Type Code
      '',                                        // SBR06-08: not used
      '',
      '',
      input.payer.claimFilingIndicator           // SBR09: Claim Filing Indicator Code
    )
  );

  // ==================================================================
  // Loop 2010BA - Subscriber Name
  // ==================================================================
  txn.push(
    segment(
      'NM1',
      'IL',                                      // Entity ID: Insured/Subscriber
      '1',                                       // Entity Type: Person
      ediClean(input.subscriber.lastName),
      ediClean(input.subscriber.firstName),
      ediClean(input.subscriber.middleName || ''),
      '',
      ediClean(input.subscriber.suffix || ''),
      'MI',                                      // ID Code Qualifier: Member ID
      input.subscriber.memberId
    )
  );

  // N3 - Subscriber Address
  const subAddr = input.subscriber.address;
  if (subAddr.line2) {
    txn.push(segment('N3', ediClean(subAddr.line1), ediClean(subAddr.line2)));
  } else {
    txn.push(segment('N3', ediClean(subAddr.line1)));
  }

  // N4 - Subscriber City/State/ZIP
  txn.push(
    segment(
      'N4',
      ediClean(subAddr.city),
      subAddr.state,
      subAddr.zip.replace(/\D/g, '')
    )
  );

  // DMG - Subscriber Demographics
  txn.push(
    segment(
      'DMG',
      'D8',                                      // Date Time Period Format: Date (CCYYMMDD)
      ediDate(input.subscriber.dateOfBirth),
      input.subscriber.gender
    )
  );

  // ==================================================================
  // Loop 2010BB - Payer Name
  // ==================================================================
  txn.push(
    segment(
      'NM1',
      'PR',                                      // Entity ID: Payer
      '2',                                       // Entity Type: Non-Person
      ediClean(input.payer.payerName),
      '', '', '', '',
      'PI',                                      // ID Code Qualifier: Payor Identification
      input.payer.payerId
    )
  );

  // Payer address (optional, included if provided)
  if (input.payer.payerAddress) {
    const payAddr = input.payer.payerAddress;
    if (payAddr.line2) {
      txn.push(segment('N3', ediClean(payAddr.line1), ediClean(payAddr.line2)));
    } else {
      txn.push(segment('N3', ediClean(payAddr.line1)));
    }
    txn.push(
      segment(
        'N4',
        ediClean(payAddr.city),
        payAddr.state,
        payAddr.zip.replace(/\D/g, '')
      )
    );
  }

  // ==================================================================
  // Loop 2000C - Patient Hierarchical Level (ONLY if patient != subscriber)
  // ==================================================================
  if (hasPatientLevel && input.patient) {
    txn.push(
      segment(
        'HL',
        '3',                                     // HL01: Hierarchical ID
        '2',                                     // HL02: Parent ID (subscriber)
        '23',                                    // HL03: Hierarchical Level Code (Dependent)
        '0'                                      // HL04: No children
      )
    );

    // PAT - Patient Information
    txn.push(
      segment(
        'PAT',
        input.patient.relationshipToSubscriber   // PAT01: Individual Relationship Code
      )
    );

    // Loop 2010CA - Patient Name
    txn.push(
      segment(
        'NM1',
        'QC',                                    // Entity ID: Patient
        '1',                                     // Entity Type: Person
        ediClean(input.patient.lastName),
        ediClean(input.patient.firstName),
        ediClean(input.patient.middleName || ''),
        '',
        ediClean(input.patient.suffix || '')
        // No ID code qualifier or ID for patient in 2010CA
      )
    );

    // N3 - Patient Address
    const patAddr = input.patient.address;
    if (patAddr.line2) {
      txn.push(segment('N3', ediClean(patAddr.line1), ediClean(patAddr.line2)));
    } else {
      txn.push(segment('N3', ediClean(patAddr.line1)));
    }

    // N4 - Patient City/State/ZIP
    txn.push(
      segment(
        'N4',
        ediClean(patAddr.city),
        patAddr.state,
        patAddr.zip.replace(/\D/g, '')
      )
    );

    // DMG - Patient Demographics
    txn.push(
      segment(
        'DMG',
        'D8',
        ediDate(input.patient.dateOfBirth),
        input.patient.gender
      )
    );
  }

  // ==================================================================
  // Loop 2300 - Claim Information
  // ==================================================================

  // CLM - Claim
  const frequencyCode = input.claim.frequencyCode || '1';
  txn.push(
    segment(
      'CLM',
      ediClean(input.claim.claimId).slice(0, 20),  // CLM01: Patient Account Number
      centsToDollars(input.claim.totalChargesCents), // CLM02: Total Claim Charge Amount
      '',                                            // CLM03: not used
      '',                                            // CLM04: not used
      `${input.claim.placeOfService}${COMPONENT_SEP}B${COMPONENT_SEP}${frequencyCode}`,
                                                     // CLM05: POS:Facility Code Qualifier:Frequency Code
      'Y',                                           // CLM06: Provider Accept Assignment
      'A',                                           // CLM07: Assignment of Benefits (A=Assigned)
      'Y',                                           // CLM08: Patient Signature on File
      'I'                                            // CLM09: Release of Information (I=Informed Consent)
    )
  );

  // DTP - Date of Onset (conditional)
  if (input.claim.onsetDate) {
    txn.push(
      segment('DTP', '431', 'D8', ediDate(input.claim.onsetDate))
    );
  }

  // DTP - Initial Treatment Date (conditional)
  if (input.claim.initialTreatmentDate) {
    txn.push(
      segment('DTP', '454', 'D8', ediDate(input.claim.initialTreatmentDate))
    );
  }

  // DTP - Last Seen Date (conditional, for referring provider)
  if (input.claim.lastSeenDate) {
    txn.push(
      segment('DTP', '304', 'D8', ediDate(input.claim.lastSeenDate))
    );
  }

  // REF - Prior Authorization (claim-level)
  if (input.claim.priorAuthNumber) {
    txn.push(
      segment(
        'REF',
        'G1',                                    // Reference ID Qualifier: Prior Authorization
        input.claim.priorAuthNumber
      )
    );
  }

  // REF - Referral Number (conditional)
  if (input.claim.referralNumber) {
    txn.push(
      segment(
        'REF',
        '9F',                                    // Reference ID Qualifier: Referral Number
        input.claim.referralNumber
      )
    );
  }

  // HI - Health Care Diagnosis Codes
  if (input.claim.diagnosisCodes.length > 0) {
    const hiElements = input.claim.diagnosisCodes.map((code, idx) => {
      const qualifier = idx === 0 ? 'ABK' : 'ABF';  // ABK=Principal, ABF=Other
      // Remove periods from ICD-10 codes for EDI
      return `${qualifier}${COMPONENT_SEP}${code.replace(/\./g, '')}`;
    });
    txn.push(segment('HI', ...hiElements));
  }

  // NTE - Claim Note (conditional)
  if (input.claim.claimNote) {
    txn.push(
      segment(
        'NTE',
        'ADD',                                   // Note Reference Code: Additional Information
        ediClean(input.claim.claimNote).slice(0, 80)
      )
    );
  }

  // ==================================================================
  // Loop 2310A - Referring Provider (conditional)
  // ==================================================================
  if (input.referringProvider) {
    txn.push(
      segment(
        'NM1',
        'DN',                                    // Entity ID: Referring Provider
        '1',                                     // Entity Type: Person
        ediClean(input.referringProvider.lastName),
        ediClean(input.referringProvider.firstName),
        ediClean(input.referringProvider.middleName || ''),
        '',
        ediClean(input.referringProvider.suffix || ''),
        'XX',                                    // ID Code Qualifier: NPI
        formatNPI(input.referringProvider.npi)
      )
    );
  }

  // ==================================================================
  // Loop 2310B - Rendering Provider (conditional)
  // ==================================================================
  if (input.renderingProvider) {
    txn.push(
      segment(
        'NM1',
        '82',                                    // Entity ID: Rendering Provider
        '1',                                     // Entity Type: Person
        ediClean(input.renderingProvider.lastName),
        ediClean(input.renderingProvider.firstName),
        ediClean(input.renderingProvider.middleName || ''),
        '',
        ediClean(input.renderingProvider.suffix || ''),
        'XX',                                    // ID Code Qualifier: NPI
        formatNPI(input.renderingProvider.npi)
      )
    );

    // PRV - Rendering Provider Specialty
    txn.push(
      segment(
        'PRV',
        'PE',                                    // Provider Code: Performing
        'PXC',                                   // Reference ID Qualifier: Taxonomy
        input.renderingProvider.taxonomyCode
      )
    );
  }

  // ==================================================================
  // Loop 2400 - Service Lines
  // ==================================================================
  input.serviceLines.forEach((line) => {
    // LX - Assigned Number (line counter)
    txn.push(segment('LX', String(line.lineNumber)));

    // SV1 - Professional Service
    // Build procedure code composite: HC:CPT:mod1:mod2:mod3:mod4
    const modifiers = (line.modifiers || []).filter(Boolean);
    const procedureCode = ['HC', line.cptCode, ...modifiers].join(COMPONENT_SEP);

    // Build diagnosis pointer string (1:2:3:4)
    const pointers = (line.diagnosisPointers || [1]).map(String).join(COMPONENT_SEP);

    txn.push(
      segment(
        'SV1',
        procedureCode,                           // SV101: Procedure Code (composite)
        centsToDollars(line.chargeAmountCents),   // SV102: Line Item Charge Amount
        'UN',                                    // SV103: Unit Basis: Units
        String(line.units),                      // SV104: Service Unit Count
        '',                                      // SV105: Place of Service (use CLM level)
        '',                                      // SV106: not used
        pointers                                 // SV107: Diagnosis Code Pointers (composite)
      )
    );

    // DTP - Date of Service
    if (line.dateOfServiceEnd && line.dateOfServiceEnd !== line.dateOfService) {
      // Date range: RD8 format CCYYMMDD-CCYYMMDD
      txn.push(
        segment(
          'DTP',
          '472',                                 // Date/Time Qualifier: Service
          'RD8',                                 // Date Time Period Format: Range
          `${ediDate(line.dateOfService)}-${ediDate(line.dateOfServiceEnd)}`
        )
      );
    } else {
      // Single date: D8 format CCYYMMDD
      txn.push(
        segment('DTP', '472', 'D8', ediDate(line.dateOfService))
      );
    }

    // REF - Line-level Prior Authorization (conditional)
    if (line.priorAuthNumber) {
      txn.push(
        segment('REF', 'G1', line.priorAuthNumber)
      );
    }
  });

  // ==================================================================
  // SE - Transaction Set Trailer
  // SE01 = count of segments from ST to SE inclusive
  // ==================================================================
  const segmentCount = txn.length + 1; // +1 for SE itself
  txn.push(
    segment('SE', String(segmentCount), controlNumbers.stControlNumber)
  );

  // ==================================================================
  // Build the complete interchange envelope
  // ==================================================================
  const allSegments: string[] = [];

  // ISA - Interchange Control Header
  allSegments.push(
    segment(
      'ISA',
      '00',                                      // ISA01: Authorization Information Qualifier
      fixedWidth('', 10),                         // ISA02: Authorization Information
      '00',                                      // ISA03: Security Information Qualifier
      fixedWidth('', 10),                         // ISA04: Security Information
      'ZZ',                                      // ISA05: Interchange Sender ID Qualifier
      fixedWidth(input.submitterId, 15),          // ISA06: Interchange Sender ID
      'ZZ',                                      // ISA07: Interchange Receiver ID Qualifier
      fixedWidth(input.receiverId, 15),           // ISA08: Interchange Receiver ID
      ediDate(now).slice(2),                      // ISA09: Interchange Date (YYMMDD)
      ediTime(now),                              // ISA10: Interchange Time (HHMM)
      '^',                                       // ISA11: Repetition Separator
      '00501',                                   // ISA12: Interchange Control Version
      controlNumbers.isaControlNumber,            // ISA13: Interchange Control Number
      '0',                                       // ISA14: Acknowledgment Requested
      input.usageIndicator,                      // ISA15: Usage Indicator (P/T)
      COMPONENT_SEP                              // ISA16: Component Element Separator
    )
  );

  // GS - Functional Group Header
  allSegments.push(
    segment(
      'GS',
      'HC',                                      // GS01: Functional Identifier (Health Care)
      input.submitterId,                         // GS02: Application Sender's Code
      input.receiverId,                          // GS03: Application Receiver's Code
      ediDate(now),                              // GS04: Date
      ediTime(now),                              // GS05: Time
      controlNumbers.gsControlNumber,             // GS06: Group Control Number
      'X',                                       // GS07: Responsible Agency Code
      '005010X222A1'                              // GS08: Version / Release / Industry ID Code
    )
  );

  // Transaction Set (ST through SE)
  allSegments.push(...txn);

  // GE - Functional Group Trailer
  allSegments.push(
    segment(
      'GE',
      '1',                                       // GE01: Number of Transaction Sets
      controlNumbers.gsControlNumber              // GE02: Group Control Number
    )
  );

  // IEA - Interchange Control Trailer
  allSegments.push(
    segment(
      'IEA',
      '1',                                       // IEA01: Number of Functional Groups
      controlNumbers.isaControlNumber             // IEA02: Interchange Control Number
    )
  );

  return {
    success: true,
    ediContent: allSegments.join('\n'),
    errors,
    controlNumbers,
    segmentCount,
  };
}
