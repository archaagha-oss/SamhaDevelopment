import { lazy, Suspense, ReactElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppShell from "./components/AppShell";

// Route components are code-split via React.lazy so the initial dashboard
// bundle doesn't drag in the deal edit, print pages, Phase 4 modules, etc.
// AppShell wraps its <Outlet /> in <Suspense>, so only the standalone routes
// below need their own Suspense wrapper (see withSuspense).

const ExecutiveDashboard            = lazy(() => import("./components/ExecutiveDashboard"));
const ProjectDetailPage             = lazy(() => import("./components/ProjectDetailPage"));
const UnitDetailPage                = lazy(() => import("./components/UnitDetailPage"));
const UnitsPage                     = lazy(() => import("./components/UnitsPage"));
const UnitEditPage                  = lazy(() => import("./pages/UnitEditPage"));
const UnitsBulkPage                 = lazy(() => import("./pages/UnitsBulkPage"));
const LeadsPage                     = lazy(() => import("./components/LeadsPage"));
const LeadProfilePage               = lazy(() => import("./components/LeadProfilePage"));
const LeadEditPage                  = lazy(() => import("./pages/LeadEditPage"));
const DealsPage                     = lazy(() => import("./components/DealsPage"));
const DealDetailPage                = lazy(() => import("./components/DealDetailPage"));
const DealEditPage                  = lazy(() => import("./pages/DealEditPage"));
const DealCreatePage                = lazy(() => import("./pages/DealCreatePage"));
const BrokerPage                    = lazy(() => import("./components/BrokerPage"));
const CommissionDashboard           = lazy(() => import("./components/CommissionDashboard"));
const FinanceDashboard              = lazy(() => import("./components/FinanceDashboard"));
const PaymentReportPage             = lazy(() => import("./components/PaymentReportPage"));
const BrokerOnboarding              = lazy(() => import("./components/BrokerOnboarding"));
const ContractsPage                 = lazy(() => import("./pages/ContractsPage"));
const NotFoundPage                  = lazy(() => import("./components/NotFoundPage"));
const ProjectsPage                  = lazy(() => import("./components/ProjectsPage"));
const ProjectSettingsPage           = lazy(() => import("./components/ProjectSettingsPage"));
const ActivitiesPage                = lazy(() => import("./pages/ActivitiesPage"));
const TeamPage                      = lazy(() => import("./pages/TeamPage"));
const MemberDetailPage              = lazy(() => import("./pages/MemberDetailPage"));
const MemberEditPage                = lazy(() => import("./pages/MemberEditPage"));
const PaymentPlansPage              = lazy(() => import("./components/PaymentPlansPage"));
const PaymentPlanEditPage           = lazy(() => import("./pages/PaymentPlanEditPage"));
const OfferPrintPage                = lazy(() => import("./components/OfferPrintPage"));
const ReservationFormPrintPage      = lazy(() => import("./components/ReservationFormPrintPage"));
const SpaDraftPrintPage             = lazy(() => import("./components/SpaDraftPrintPage"));
const SalesOfferPrintPage           = lazy(() => import("./components/SalesOfferPrintPage"));
const InvoicePrintPage              = lazy(() => import("./components/InvoicePrintPage"));
const ReceiptPrintPage              = lazy(() => import("./components/ReceiptPrintPage"));
const ReportsPage                   = lazy(() => import("./pages/ReportsPage"));
const AgentLeaderboardPage          = lazy(() => import("./pages/AgentLeaderboardPage"));
const ReservationsPage              = lazy(() => import("./components/ReservationsPage"));
const OffersPage                    = lazy(() => import("./components/OffersPage"));
const SettingsPage                  = lazy(() => import("./pages/SettingsPage"));
const ContactsPage                  = lazy(() => import("./pages/ContactsPage"));
const ContactDetailPage             = lazy(() => import("./pages/ContactDetailPage"));
const ContactEditPage               = lazy(() => import("./pages/ContactEditPage"));
// Phase 4 expansion pages
const PhasesPage                    = lazy(() => import("./pages/PhasesPage"));
const UnitTypePlansPage             = lazy(() => import("./pages/UnitTypePlansPage"));
const ConstructionProgressPage      = lazy(() => import("./pages/ConstructionProgressPage"));
const SnagListPage                  = lazy(() => import("./pages/SnagListPage"));
const HandoverChecklistPage         = lazy(() => import("./pages/HandoverChecklistPage"));
const RefundsPage                   = lazy(() => import("./pages/RefundsPage"));
const EscrowPage                    = lazy(() => import("./pages/EscrowPage"));
const CommissionTiersPage           = lazy(() => import("./pages/CommissionTiersPage"));
const LeadKycPage                   = lazy(() => import("./pages/LeadKycPage"));
const DealJointOwnersPage           = lazy(() => import("./pages/DealJointOwnersPage"));
const PublicUnitView                = lazy(() => import("./components/PublicUnitView"));
const HotInboxPage                  = lazy(() => import("./pages/HotInboxPage"));
const CompliancePage                = lazy(() => import("./pages/CompliancePage"));
const NotificationPreferencesPage   = lazy(() => import("./pages/NotificationPreferencesPage"));
const BulkPaymentImportPage         = lazy(() => import("./pages/BulkPaymentImportPage"));
const MyDayPage                     = lazy(() => import("./pages/MyDayPage"));

// FeatureFlagGate stays eager — it's tiny and used inline below.
import FeatureFlagGate from "./components/FeatureFlagGate";
import { useCurrentUser } from "./hooks/useCurrentUser";

/**
 * Role-aware home dispatcher (UX_AUDIT_2 Part B).
 *
 * `/` renders the personal `<MyDayPage />` for MEMBER and VIEWER agents — their
 * day-to-day work lives there. ADMIN and MANAGER continue to see
 * `<ExecutiveDashboard />` because the org-wide rollup is what they actually
 * use. While the role lookup is in flight we show the dashboard's loading
 * shell (via Suspense above) — flicker is acceptable here because the page
 * always re-renders on auth resolve.
 *
 * `/dashboard` always renders ExecutiveDashboard (so managers can reach it
 * even when their default landing changes), and `/my-day` always renders
 * MyDayPage (so a manager can use it as their own queue).
 */
function RoleAwareHome() {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) {
    // Same minimal loader the Suspense wrapper uses — keeps the visual
    // continuity when auth resolves and we swap to the real page.
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading"
        className="flex min-h-[60vh] items-center justify-center"
      >
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }
  const role = user?.role;
  if (role === "MEMBER" || role === "VIEWER") {
    return <MyDayPage />;
  }
  return <ExecutiveDashboard />;
}

// Suspense wrapper for routes that don't render inside AppShell (print pages,
// public share, broker onboarding). AppShell already wraps its <Outlet />.
function withSuspense(node: ReactElement): ReactElement {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading"
          className="flex min-h-screen items-center justify-center bg-background"
        >
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      }
    >
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Standalone pages (no app shell — full-page layout)
  { path: "/broker-onboarding",                          element: withSuspense(<BrokerOnboarding />) },

  // Standalone print pages (no app shell — full-page printable layout)
  { path: "/offers/:offerId",                            element: withSuspense(<OfferPrintPage />) },
  { path: "/deals/:dealId/print/reservation-form",       element: withSuspense(<ReservationFormPrintPage />) },
  { path: "/deals/:dealId/print/spa-draft",              element: withSuspense(<SpaDraftPrintPage />) },
  { path: "/deals/:dealId/print/sales-offer",            element: withSuspense(<SalesOfferPrintPage />) },
  { path: "/payments/:paymentId/print/invoice",          element: withSuspense(<InvoicePrintPage />) },
  { path: "/payments/:paymentId/print/receipt",          element: withSuspense(<ReceiptPrintPage />) },
  // Public, unauthenticated client share view (no app shell, no Clerk).
  { path: "/share/u/:token",                             element: withSuspense(<PublicUnitView />) },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true,                                      element: <RoleAwareHome /> },
      { path: "dashboard",                                element: <ExecutiveDashboard /> },
      { path: "my-day",                                   element: <MyDayPage /> },
      { path: "projects",                                 element: <ProjectsPage /> },
      { path: "projects/:projectId",                      element: <ProjectDetailPage /> },
      { path: "projects/:projectId/settings",             element: <ProjectSettingsPage /> },
      { path: "projects/:projectId/units/new",            element: <UnitEditPage /> },
      { path: "projects/:projectId/units/bulk",           element: <UnitsBulkPage /> },
      { path: "projects/:projectId/units/:unitId",        element: <UnitDetailPage /> },
      { path: "projects/:projectId/units/:unitId/edit",   element: <UnitEditPage /> },
      { path: "units",                                    element: <UnitsPage /> },
      { path: "leads",                                    element: <LeadsPage /> },
      { path: "leads/new",                                element: <LeadEditPage /> },
      { path: "leads/:leadId",                            element: <LeadProfilePage /> },
      { path: "leads/:leadId/edit",                       element: <LeadEditPage /> },
      { path: "deals",                                    element: <DealsPage /> },
      { path: "deals/new",                                element: <DealCreatePage /> },
      { path: "deals/:dealId",                            element: <DealDetailPage /> },
      { path: "deals/:dealId/edit",                       element: <DealEditPage /> },
      { path: "brokers",                                  element: <BrokerPage /> },
      { path: "commissions",                              element: <CommissionDashboard /> },
      { path: "finance",                                  element: <FinanceDashboard /> },
      { path: "tasks",                                     element: <ActivitiesPage /> },
      { path: "inbox",                                     element: <HotInboxPage /> },
      { path: "compliance",                                element: <CompliancePage /> },
      { path: "payments",                                  element: <PaymentReportPage /> },
      { path: "payments/bulk-import",                      element: <BulkPaymentImportPage /> },
      { path: "contracts",                                 element: <ContractsPage /> },
      { path: "payment-plans",                            element: <PaymentPlansPage /> },
      { path: "payment-plans/new",                        element: <PaymentPlanEditPage /> },
      { path: "payment-plans/:planId/edit",               element: <PaymentPlanEditPage /> },
      { path: "reservations",                             element: <ReservationsPage /> },
      { path: "offers-list",                              element: <OffersPage /> },
      { path: "team",                                      element: <TeamPage /> },
      { path: "team/new",                                  element: <MemberEditPage /> },
      { path: "team/:userId",                              element: <MemberDetailPage /> },
      { path: "team/:userId/edit",                         element: <MemberEditPage /> },
      { path: "reports",                                   element: <ReportsPage /> },
      { path: "reports/agents",                            element: <AgentLeaderboardPage /> },
      { path: "contacts",                                  element: <ContactsPage /> },
      { path: "contacts/new",                              element: <ContactEditPage /> },
      { path: "contacts/:contactId",                       element: <ContactDetailPage /> },
      { path: "contacts/:contactId/edit",                  element: <ContactEditPage /> },
      // Settings tabs are real sub-routes (Phase D). /settings redirects to
      // /settings/company; each tab key is a deep-linkable URL.
      { path: "settings",                                  element: <SettingsPage /> },
      { path: "settings/:tabKey",                          element: <SettingsPage /> },
      { path: "profile/notifications",                     element: <NotificationPreferencesPage /> },
      // Phase 4 expansion routes — gated by feature flags so they're hidden
      // until an admin enables the corresponding module under Settings → Feature Flags.
      { path: "projects/:projectId/phases",                element: <PhasesPage /> },
      { path: "projects/:projectId/type-plans",            element: <UnitTypePlansPage /> },
      { path: "projects/:projectId/construction",          element: <FeatureFlagGate flag="constructionProgress"><ConstructionProgressPage /></FeatureFlagGate> },
      { path: "projects/:projectId/escrow",                element: <FeatureFlagGate flag="escrowModule"><EscrowPage /></FeatureFlagGate> },
      { path: "units/:unitId/snags",                       element: <FeatureFlagGate flag="snagList"><SnagListPage /></FeatureFlagGate> },
      { path: "deals/:dealId/handover",                    element: <FeatureFlagGate flag="handoverChecklist"><HandoverChecklistPage /></FeatureFlagGate> },
      { path: "deals/:dealId/parties",                     element: <DealJointOwnersPage /> },
      { path: "leads/:leadId/kyc",                         element: <FeatureFlagGate flag="kycVerification"><LeadKycPage /></FeatureFlagGate> },
      { path: "refunds",                                   element: <RefundsPage /> },
      { path: "commission-tiers",                          element: <FeatureFlagGate flag="commissionTiers"><CommissionTiersPage /></FeatureFlagGate> },
      { path: "*",                                        element: <NotFoundPage /> },
    ],
  },
]);
