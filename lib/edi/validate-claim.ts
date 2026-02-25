/**
 * EDI 837P Claim Validation
 *
 * Validates a Claim837PInput before EDI generation.
 * Returns an array of ValidationError objects with severity levels.
 * 'error' severity prevents generation; 'warning' is informational only.
 */

import type { Claim837PInput, ValidationError } from './types';

const NPI_REGEX = /^\d{10}$/;
const TAX_ID_REGEX = /^\d{9}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CPT_REGEX = /^[0-9A-Z]{5}$/;
const MODIFIER_REGEX = /^[A-Z0-9]{2}$/;
const STATE_REGEX = /^[A-Z]{2}$/;

function digitsOnly(val: string): string {
  return val.replace(/\D/g, '');
}

export function validateClaim(input: Claim837PInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // ========================================================================
  // Interchange / Submitter / Receiver
  // ========================================================================
  if (!input.submitterId?.trim()) {
    errors.push({ field: 'submitterId', message: 'Submitter ID is required', severity: 'error' });
  }
  if (!input.submitterName?.trim()) {
    errors.push({ field: 'submitterName', message: 'Submitter name is required', severity: 'error' });
  }
  if (!input.receiverId?.trim()) {
    errors.push({ field: 'receiverId', message: 'Receiver ID is required', severity: 'error' });
  }
  if (!input.receiverName?.trim()) {
    errors.push({ field: 'receiverName', message: 'Receiver name is required', severity: 'error' });
  }

  // ========================================================================
  // Billing Provider
  // ========================================================================
  const bp = input.billingProvider;
  if (!bp) {
    errors.push({ field: 'billingProvider', message: 'Billing provider is required', severity: 'error' });
  } else {
    if (!bp.npi || !NPI_REGEX.test(digitsOnly(bp.npi))) {
      errors.push({ field: 'billingProvider.npi', message: 'Billing provider NPI must be 10 digits', severity: 'error' });
    }
    if (!bp.taxId || !TAX_ID_REGEX.test(digitsOnly(bp.taxId))) {
      errors.push({ field: 'billingProvider.taxId', message: 'Billing provider Tax ID (EIN) must be 9 digits', severity: 'error' });
    }
    if (!bp.taxonomyCode?.trim()) {
      errors.push({ field: 'billingProvider.taxonomyCode', message: 'Billing provider taxonomy code is required', severity: 'error' });
    }
    if (!bp.organizationName?.trim()) {
      errors.push({ field: 'billingProvider.organizationName', message: 'Billing provider organization name is required', severity: 'error' });
    }
    if (!bp.address?.line1?.trim()) {
      errors.push({ field: 'billingProvider.address.line1', message: 'Billing provider street address is required', severity: 'error' });
    }
    if (!bp.address?.city?.trim()) {
      errors.push({ field: 'billingProvider.address.city', message: 'Billing provider city is required', severity: 'error' });
    }
    if (!bp.address?.state || !STATE_REGEX.test(bp.address.state)) {
      errors.push({ field: 'billingProvider.address.state', message: 'Billing provider state must be a 2-letter code', severity: 'error' });
    }
    if (!bp.address?.zip?.trim()) {
      errors.push({ field: 'billingProvider.address.zip', message: 'Billing provider ZIP code is required', severity: 'error' });
    }
    if (!bp.contactName?.trim()) {
      errors.push({ field: 'billingProvider.contactName', message: 'Submitter contact name is required', severity: 'error' });
    }
    if (!bp.contactPhone || digitsOnly(bp.contactPhone).length < 10) {
      errors.push({ field: 'billingProvider.contactPhone', message: 'Submitter contact phone must be at least 10 digits', severity: 'error' });
    }
  }

  // ========================================================================
  // Rendering Provider (optional but validated if present)
  // ========================================================================
  if (input.renderingProvider) {
    const rp = input.renderingProvider;
    if (!rp.npi || !NPI_REGEX.test(digitsOnly(rp.npi))) {
      errors.push({ field: 'renderingProvider.npi', message: 'Rendering provider NPI must be 10 digits', severity: 'error' });
    }
    if (!rp.lastName?.trim()) {
      errors.push({ field: 'renderingProvider.lastName', message: 'Rendering provider last name is required', severity: 'error' });
    }
    if (!rp.firstName?.trim()) {
      errors.push({ field: 'renderingProvider.firstName', message: 'Rendering provider first name is required', severity: 'error' });
    }
    if (!rp.taxonomyCode?.trim()) {
      errors.push({ field: 'renderingProvider.taxonomyCode', message: 'Rendering provider taxonomy code is required', severity: 'error' });
    }
  }

  // ========================================================================
  // Referring Provider (optional but validated if present)
  // ========================================================================
  if (input.referringProvider) {
    const ref = input.referringProvider;
    if (!ref.npi || !NPI_REGEX.test(digitsOnly(ref.npi))) {
      errors.push({ field: 'referringProvider.npi', message: 'Referring provider NPI must be 10 digits', severity: 'error' });
    }
    if (!ref.lastName?.trim()) {
      errors.push({ field: 'referringProvider.lastName', message: 'Referring provider last name is required', severity: 'error' });
    }
    if (!ref.firstName?.trim()) {
      errors.push({ field: 'referringProvider.firstName', message: 'Referring provider first name is required', severity: 'error' });
    }
  }

  // ========================================================================
  // Subscriber
  // ========================================================================
  const sub = input.subscriber;
  if (!sub) {
    errors.push({ field: 'subscriber', message: 'Subscriber information is required', severity: 'error' });
  } else {
    if (!sub.memberId?.trim()) {
      errors.push({ field: 'subscriber.memberId', message: 'Subscriber member ID is required', severity: 'error' });
    }
    if (!sub.lastName?.trim()) {
      errors.push({ field: 'subscriber.lastName', message: 'Subscriber last name is required', severity: 'error' });
    }
    if (!sub.firstName?.trim()) {
      errors.push({ field: 'subscriber.firstName', message: 'Subscriber first name is required', severity: 'error' });
    }
    if (!sub.dateOfBirth || !DATE_REGEX.test(sub.dateOfBirth)) {
      errors.push({ field: 'subscriber.dateOfBirth', message: 'Subscriber date of birth must be YYYY-MM-DD', severity: 'error' });
    }
    if (!sub.gender || !['M', 'F', 'U'].includes(sub.gender)) {
      errors.push({ field: 'subscriber.gender', message: 'Subscriber gender must be M, F, or U', severity: 'error' });
    }
    if (!sub.address?.line1?.trim()) {
      errors.push({ field: 'subscriber.address.line1', message: 'Subscriber street address is required', severity: 'error' });
    }
    if (!sub.address?.city?.trim()) {
      errors.push({ field: 'subscriber.address.city', message: 'Subscriber city is required', severity: 'error' });
    }
    if (!sub.address?.state || !STATE_REGEX.test(sub.address.state)) {
      errors.push({ field: 'subscriber.address.state', message: 'Subscriber state must be a 2-letter code', severity: 'error' });
    }
    if (!sub.address?.zip?.trim()) {
      errors.push({ field: 'subscriber.address.zip', message: 'Subscriber ZIP code is required', severity: 'error' });
    }
  }

  // ========================================================================
  // Patient (only when different from subscriber)
  // ========================================================================
  if (input.patient) {
    const pat = input.patient;
    if (!pat.lastName?.trim()) {
      errors.push({ field: 'patient.lastName', message: 'Patient last name is required', severity: 'error' });
    }
    if (!pat.firstName?.trim()) {
      errors.push({ field: 'patient.firstName', message: 'Patient first name is required', severity: 'error' });
    }
    if (!pat.dateOfBirth || !DATE_REGEX.test(pat.dateOfBirth)) {
      errors.push({ field: 'patient.dateOfBirth', message: 'Patient date of birth must be YYYY-MM-DD', severity: 'error' });
    }
    if (!pat.gender || !['M', 'F', 'U'].includes(pat.gender)) {
      errors.push({ field: 'patient.gender', message: 'Patient gender must be M, F, or U', severity: 'error' });
    }
    if (!pat.relationshipToSubscriber) {
      errors.push({ field: 'patient.relationshipToSubscriber', message: 'Patient relationship to subscriber is required', severity: 'error' });
    }
    if (pat.relationshipToSubscriber === '18') {
      errors.push({ field: 'patient.relationshipToSubscriber', message: 'If patient is Self (18), omit the patient object and use subscriber only', severity: 'warning' });
    }
    if (!pat.address?.line1?.trim()) {
      errors.push({ field: 'patient.address.line1', message: 'Patient street address is required', severity: 'error' });
    }
  }

  // ========================================================================
  // Payer
  // ========================================================================
  if (!input.payer) {
    errors.push({ field: 'payer', message: 'Payer information is required', severity: 'error' });
  } else {
    if (!input.payer.payerId?.trim()) {
      errors.push({ field: 'payer.payerId', message: 'Payer ID is required', severity: 'error' });
    }
    if (!input.payer.payerName?.trim()) {
      errors.push({ field: 'payer.payerName', message: 'Payer name is required', severity: 'error' });
    }
    if (!input.payer.claimFilingIndicator) {
      errors.push({ field: 'payer.claimFilingIndicator', message: 'Claim filing indicator is required', severity: 'error' });
    }
  }

  // ========================================================================
  // Claim Info
  // ========================================================================
  const clm = input.claim;
  if (!clm) {
    errors.push({ field: 'claim', message: 'Claim information is required', severity: 'error' });
  } else {
    if (!clm.claimId?.trim()) {
      errors.push({ field: 'claim.claimId', message: 'Claim ID is required', severity: 'error' });
    }
    if (typeof clm.totalChargesCents !== 'number' || clm.totalChargesCents <= 0) {
      errors.push({ field: 'claim.totalChargesCents', message: 'Total charges must be a positive number (in cents)', severity: 'error' });
    }
    if (!clm.placeOfService?.trim()) {
      errors.push({ field: 'claim.placeOfService', message: 'Place of service code is required', severity: 'error' });
    }
    if (!clm.diagnosisCodes || clm.diagnosisCodes.length === 0) {
      errors.push({ field: 'claim.diagnosisCodes', message: 'At least one diagnosis code (ICD-10) is required', severity: 'error' });
    }
    if (clm.diagnosisCodes && clm.diagnosisCodes.length > 12) {
      errors.push({ field: 'claim.diagnosisCodes', message: 'Maximum of 12 diagnosis codes allowed per claim', severity: 'error' });
    }
    if (clm.onsetDate && !DATE_REGEX.test(clm.onsetDate)) {
      errors.push({ field: 'claim.onsetDate', message: 'Onset date must be YYYY-MM-DD', severity: 'error' });
    }
    if (clm.initialTreatmentDate && !DATE_REGEX.test(clm.initialTreatmentDate)) {
      errors.push({ field: 'claim.initialTreatmentDate', message: 'Initial treatment date must be YYYY-MM-DD', severity: 'error' });
    }
  }

  // ========================================================================
  // Service Lines
  // ========================================================================
  if (!input.serviceLines || input.serviceLines.length === 0) {
    errors.push({ field: 'serviceLines', message: 'At least one service line is required', severity: 'error' });
  } else {
    // Validate line total matches claim total
    const lineTotal = input.serviceLines.reduce((sum, l) => sum + l.chargeAmountCents, 0);
    if (clm && lineTotal !== clm.totalChargesCents) {
      errors.push({
        field: 'serviceLines',
        message: `Service line charges total ${lineTotal} cents but claim total is ${clm.totalChargesCents} cents`,
        severity: 'warning',
      });
    }

    input.serviceLines.forEach((line, idx) => {
      const prefix = `serviceLines[${idx}]`;

      if (!line.cptCode || !CPT_REGEX.test(line.cptCode)) {
        errors.push({
          field: `${prefix}.cptCode`,
          message: `Line ${idx + 1}: CPT code must be 5 alphanumeric characters`,
          severity: 'error',
        });
      }

      if (typeof line.chargeAmountCents !== 'number' || line.chargeAmountCents <= 0) {
        errors.push({
          field: `${prefix}.chargeAmountCents`,
          message: `Line ${idx + 1}: Charge amount must be positive (in cents)`,
          severity: 'error',
        });
      }

      if (typeof line.units !== 'number' || line.units <= 0) {
        errors.push({
          field: `${prefix}.units`,
          message: `Line ${idx + 1}: Units must be a positive number`,
          severity: 'error',
        });
      }

      if (!line.diagnosisPointers || line.diagnosisPointers.length === 0) {
        errors.push({
          field: `${prefix}.diagnosisPointers`,
          message: `Line ${idx + 1}: At least one diagnosis pointer is required`,
          severity: 'error',
        });
      } else if (clm?.diagnosisCodes) {
        line.diagnosisPointers.forEach((ptr) => {
          if (ptr < 1 || ptr > clm.diagnosisCodes.length) {
            errors.push({
              field: `${prefix}.diagnosisPointers`,
              message: `Line ${idx + 1}: Diagnosis pointer ${ptr} references non-existent diagnosis (only ${clm.diagnosisCodes.length} defined)`,
              severity: 'error',
            });
          }
        });
      }

      if (line.diagnosisPointers && line.diagnosisPointers.length > 4) {
        errors.push({
          field: `${prefix}.diagnosisPointers`,
          message: `Line ${idx + 1}: Maximum of 4 diagnosis pointers per service line`,
          severity: 'error',
        });
      }

      if (line.modifiers && line.modifiers.length > 4) {
        errors.push({
          field: `${prefix}.modifiers`,
          message: `Line ${idx + 1}: Maximum of 4 modifiers per service line`,
          severity: 'error',
        });
      }

      if (line.modifiers) {
        line.modifiers.forEach((mod, mi) => {
          if (!MODIFIER_REGEX.test(mod)) {
            errors.push({
              field: `${prefix}.modifiers[${mi}]`,
              message: `Line ${idx + 1}: Modifier "${mod}" must be 2 alphanumeric characters`,
              severity: 'error',
            });
          }
        });
      }

      if (!line.dateOfService || !DATE_REGEX.test(line.dateOfService)) {
        errors.push({
          field: `${prefix}.dateOfService`,
          message: `Line ${idx + 1}: Date of service must be YYYY-MM-DD`,
          severity: 'error',
        });
      }

      if (line.dateOfServiceEnd && !DATE_REGEX.test(line.dateOfServiceEnd)) {
        errors.push({
          field: `${prefix}.dateOfServiceEnd`,
          message: `Line ${idx + 1}: End date of service must be YYYY-MM-DD`,
          severity: 'error',
        });
      }
    });
  }

  return errors;
}

/**
 * Check if validation errors contain any fatal errors that prevent generation.
 */
export function hasErrors(errors: ValidationError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}
