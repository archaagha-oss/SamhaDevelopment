import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LayoutGrid, Coins, UserPlus, Check, X, Sparkles } from "lucide-react";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "samha:onboarding-dismissed";

interface Step {
  key: keyof Omit<import("../hooks/useOnboardingStatus").OnboardingStatus, "hasTeam">;
  title: string;
  description: string;
  icon: typeof Building2;
  cta: string;
  href: string;
}

// Order = the natural sequence a new tenant follows. Project first because
// every other entity hangs off a project; payment plan before unit/lead
// because deals require it.
const STEPS: Step[] = [
  {
    key: "hasProject",
    title: "Create your first project",
    description: "Projects group units, deals, and team access. Everything else hangs off one.",
    icon: Building2,
    cta: "Create project",
    href: "/projects",
  },
  {
    key: "hasPaymentPlan",
    title: "Set up a payment plan",
    description: "Define the milestone schedule that every deal will reference (10/40/50, etc.).",
    icon: Coins,
    cta: "Configure plans",
    href: "/payment-plans",
  },
  {
    key: "hasUnit",
    title: "Add at least one unit",
    description: "Without inventory, agents have nothing to reserve, share, or close on.",
    icon: LayoutGrid,
    cta: "Browse projects",
    href: "/projects",
  },
  {
    key: "hasLead",
    title: "Capture your first lead",
    description: "Once a lead is in, you can log activities, send offers, and create a deal.",
    icon: UserPlus,
    cta: "Add lead",
    href: "/leads",
  },
];

/**
 * First-visit onboarding checklist for the dashboard.
 *
 * Renders only when:
 *   - the API status has loaded successfully,
 *   - at least one step is incomplete,
 *   - the user is an ADMIN or MANAGER (others can't act on these),
 *   - the user has not dismissed the panel via the close button.
 *
 * Once every step is complete, the panel hides itself permanently — no
 * dismissal needed. Until then, dismissal is sticky via localStorage so the
 * user isn't nagged on every dashboard visit. Clearing localStorage or
 * incognito will bring it back, which is the intended escape hatch.
 */
export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const { data: status } = useOnboardingStatus();
  const { data: user } = useCurrentUser();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!status) return null;
  if (user && user.role !== "ADMIN" && user.role !== "MANAGER") return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  const allDone = completedCount === STEPS.length;
  if (allDone) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — fall through; the in-memory state below still hides it */
    }
    setDismissed(true);
  };

  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <section
      role="region"
      aria-label="Onboarding checklist"
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-info-soft/40">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Get set up</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} of {STEPS.length} done · {progressPct}% complete
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div
        className="h-1 bg-muted"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Onboarding progress: ${progressPct}%`}
      >
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="divide-y divide-border">
        {STEPS.map((step) => {
          const done = status[step.key];
          const Icon = step.icon;
          return (
            <li
              key={step.key}
              className={`flex items-center gap-4 px-5 py-3 ${done ? "opacity-60" : ""}`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {!done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              <Button
                variant={done ? "ghost" : "outline"}
                size="sm"
                onClick={() => navigate(step.href)}
                aria-label={done ? `Go to ${step.title}` : step.cta}
              >
                {done ? "View" : step.cta}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
