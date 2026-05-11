import { type ReactNode } from "react";
import { Lock } from "lucide-react";
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
          <Lock className="size-5 text-muted-foreground" />
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
