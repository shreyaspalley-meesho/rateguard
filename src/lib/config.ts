/**
 * Feature flags / prototype toggles.
 *
 * Runtime-editable at the console via `window.__RG_CONFIG__ = { showVendorPicker: true }`,
 * else falls back to the values here. Flip and reload.
 */

export interface RateGuardConfig {
  /** Show the "Transport partner (vendor)" combobox on the FM/SC submit form.
   *  KRD FR-01 mandates vendor × location capture, but the current build hides
   *  the picker at the user's request — displays and CSV columns still show the
   *  vendor when a request has one (from seed data).
   */
  showVendorPicker: boolean;
}

const DEFAULTS: RateGuardConfig = {
  showVendorPicker: false,
};

declare global {
  interface Window { __RG_CONFIG__?: Partial<RateGuardConfig>; }
}

const STORAGE_KEY = 'rateguard-config';

/**
 * Precedence: window override (session) > localStorage (per-browser durable) > file defaults.
 * Flip at runtime with either:
 *   - `window.__RG_CONFIG__ = { showVendorPicker: true }`      (until reload)
 *   - `localStorage.setItem('rateguard-config', JSON.stringify({ showVendorPicker: true }))` (durable)
 */
export function getConfig(): RateGuardConfig {
  if (typeof window === 'undefined') return DEFAULTS;
  let stored: Partial<RateGuardConfig> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch { /* ignore corrupt localStorage */ }
  return { ...DEFAULTS, ...stored, ...(window.__RG_CONFIG__ ?? {}) };
}
