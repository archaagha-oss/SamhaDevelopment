import { type ReactNode } from "react";
import { useFeatureFlag, FEATURE_DEFAULTS } from "../hooks/useFeatureFlag";

/**
 * Renders `children` only when a feature flag is enabled. When disabled,
 * renders the `fallback` (defaults to a "module disabled" panel that points
 * the admin to Settings → Feature Flags).
 *
 * Usage:
 *   <FeatureFlagGate flag="escrowModule">
 *     <EscrowPage />
 *   </FeatureFlagGate>
 */
export default function FeatureFlagGate({
  flag,
  children,
  fallback,
}: {
  flag: keyof typeof FEATURE_DEFAULTS;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const enabled = useFeatureFlag(flag, FEATURE_DEFAULTS[flag] ?? false);
  if (enabled) return <>{children}</>;
  return <>{fallback ?? <DisabledPanel flag={flag} />}</>;
}

function DisabledPanel({ flag }: { flag: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md text-center bg-card rounded-xl border border-border p-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Module disabled</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{flag}</code> feature is currently turned off
          for this organization.
        </p>
        <a
          href="/settings"
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
        >
          Open Settings → Feature Flags
        </a>
      </div>
    </div>
  );
}
