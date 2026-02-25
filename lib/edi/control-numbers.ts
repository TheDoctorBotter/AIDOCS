/**
 * EDI Control Number Generator & Tracker
 *
 * Generates sequential, unique control numbers for ISA, GS, and ST segments.
 * Control numbers are tracked in-memory with support for initialization
 * from an external store (database, file, etc.).
 *
 * ISA13: 9 digits (000000001 - 999999999)
 * GS06:  variable (typically 1-999999)
 * ST02:  4 digits (0001 - 9999)
 */

let isaCounter = 0;
let gsCounter = 0;
let stCounter = 0;

/**
 * Generate the next ISA Interchange Control Number (9 digits, zero-padded).
 */
export function generateISAControlNumber(): string {
  isaCounter = (isaCounter % 999999999) + 1;
  return String(isaCounter).padStart(9, '0');
}

/**
 * Generate the next GS Group Control Number (up to 9 digits).
 */
export function generateGSControlNumber(): string {
  gsCounter = (gsCounter % 999999999) + 1;
  return String(gsCounter).padStart(6, '0');
}

/**
 * Generate the next ST Transaction Set Control Number (4 digits, zero-padded).
 */
export function generateSTControlNumber(): string {
  stCounter = (stCounter % 9999) + 1;
  return String(stCounter).padStart(4, '0');
}

/**
 * Get current counter values (for persisting to external storage).
 */
export function getCounterState(): { isa: number; gs: number; st: number } {
  return { isa: isaCounter, gs: gsCounter, st: stCounter };
}

/**
 * Initialize counters from previously persisted values.
 * Call this on application startup to resume from last known state.
 */
export function initializeCounters(isa: number, gs: number, st: number): void {
  isaCounter = isa;
  gsCounter = gs;
  stCounter = st;
}

/**
 * Reset all counters to zero. Primarily for testing.
 */
export function resetCounters(): void {
  isaCounter = 0;
  gsCounter = 0;
  stCounter = 0;
}
