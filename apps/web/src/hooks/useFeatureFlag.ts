import { useSettings } from "../contexts/SettingsContext";

/**
 * Resolve a feature flag. Returns `fallback` (default `false`) when the flag
 * isn't explicitly set in AppSettings.featureFlags.
 *
 * Catalog of flags lives server-side in `apps/api/src/routes/settings.ts`
 * (`FEATURE_FLAGS`). UI consumers can pass any string key — unknown keys
 * just resolve to the fallback.
 *
 * Usage:
 *   const escrowOn = useFeatureFlag("escrowModule");
 *   if (escrowOn) { ... }
 */
export function useFeatureFlag(key: string, fallback = false): boolean {
  const { isFeatureEnabled } = useSettings();
  return isFeatureEnabled(key, fallback);
}

/**
 * Catalog defaults — keep in sync with the server-side FEATURE_FLAGS list.
 * Used as the fallback when the org hasn't explicitly toggled a flag.
 */
export const FEATURE_DEFAULTS: Record<string, boolean> = {
  escrowModule:         false,
  snagList:             false,
  handoverChecklist:    true,
  // KYC backend is partial — UI lives at /lead-kyc but several POST/PATCH paths
  // still hit unimplemented routes. Default OFF until that ships; toggle on
  // in Settings if you want to dogfood the read paths.
  kycVerification:      false,
  commissionTiers:      false,
  constructionProgress: false,
  bulkUnitImport:       true,
  publicShareLinks:     true,
  leadAutoAssignment:   false,
};
