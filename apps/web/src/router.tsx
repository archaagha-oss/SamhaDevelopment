import { createBrowserRouter } from "react-router-dom";
import AppShell from "./components/AppShell";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import ProjectDetailPage from "./components/ProjectDetailPage";
import UnitDetailPage from "./components/UnitDetailPage";
import UnitsPage from "./components/UnitsPage";
import LeadsPage from "./components/LeadsPage";
import LeadProfilePage from "./components/LeadProfilePage";
import DealsPage from "./components/DealsPage";
import DealDetailPage from "./components/DealDetailPage";
import BrokerPage from "./components/BrokerPage";
import CommissionDashboard from "./components/CommissionDashboard";
import FinanceDashboard from "./components/FinanceDashboard";
import PaymentReportPage from "./components/PaymentReportPage";
import BrokerOnboarding from "./components/BrokerOnboarding";
import ContractsPage from "./pages/ContractsPage";
import NotFoundPage from "./components/NotFoundPage";
import ProjectsPage from "./components/ProjectsPage";
import ProjectSettingsPage from "./components/ProjectSettingsPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import TeamPage from "./pages/TeamPage";
import MemberDetailPage from "./pages/MemberDetailPage";
import PaymentPlansPage from "./components/PaymentPlansPage";
import OfferPrintPage from "./components/OfferPrintPage";
import ReservationFormPrintPage from "./components/ReservationFormPrintPage";
import SpaDraftPrintPage from "./components/SpaDraftPrintPage";
import SalesOfferPrintPage from "./components/SalesOfferPrintPage";
import InvoicePrintPage from "./components/InvoicePrintPage";
import ReceiptPrintPage from "./components/ReceiptPrintPage";
import ReportsPage from "./pages/ReportsPage";
import ReservationsPage from "./components/ReservationsPage";
import OffersPage from "./components/OffersPage";
import SettingsPage from "./pages/SettingsPage";
import ContactsPage from "./pages/ContactsPage";
// Phase 4 expansion pages
import PhasesPage from "./pages/PhasesPage";
import UnitTypePlansPage from "./pages/UnitTypePlansPage";
import ConstructionProgressPage from "./pages/ConstructionProgressPage";
import SnagListPage from "./pages/SnagListPage";
import HandoverChecklistPage from "./pages/HandoverChecklistPage";
import RefundsPage from "./pages/RefundsPage";
import EscrowPage from "./pages/EscrowPage";
import CommissionTiersPage from "./pages/CommissionTiersPage";
import LeadKycPage from "./pages/LeadKycPage";
import DealJointOwnersPage from "./pages/DealJointOwnersPage";
import PublicUnitView from "./components/PublicUnitView";
import HotInboxPage from "./pages/HotInboxPage";
import CompliancePage from "./pages/CompliancePage";
import FeatureFlagGate from "./components/FeatureFlagGate";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";

export const router = createBrowserRouter([
  // Standalone pages (no app shell — full-page layout)
  { path: "/broker-onboarding",                          element: <BrokerOnboarding /> },

  // Standalone print pages (no app shell — full-page printable layout)
  { path: "/offers/:offerId",                            element: <OfferPrintPage /> },
  { path: "/deals/:dealId/print/reservation-form",       element: <ReservationFormPrintPage /> },
  { path: "/deals/:dealId/print/spa-draft",              element: <SpaDraftPrintPage /> },
  { path: "/deals/:dealId/print/sales-offer",            element: <SalesOfferPrintPage /> },
  { path: "/payments/:paymentId/print/invoice",          element: <InvoicePrintPage /> },
  { path: "/payments/:paymentId/print/receipt",          element: <ReceiptPrintPage /> },
  // Public, unauthenticated client share view (no app shell, no Clerk).
  { path: "/share/u/:token",                             element: <PublicUnitView /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true,                                      element: <ExecutiveDashboard /> },
      { path: "projects",                                 element: <ProjectsPage /> },
      { path: "projects/:projectId",                      element: <ProjectDetailPage /> },
      { path: "projects/:projectId/settings",             element: <ProjectSettingsPage /> },
      { path: "projects/:projectId/units/:unitId",        element: <UnitDetailPage /> },
      { path: "units",                                    element: <UnitsPage /> },
      { path: "leads",                                    element: <LeadsPage /> },
      { path: "leads/:leadId",                            element: <LeadProfilePage /> },
      { path: "deals",                                    element: <DealsPage /> },
      { path: "deals/:dealId",                            element: <DealDetailPage /> },
      { path: "brokers",                                  element: <BrokerPage /> },
      { path: "commissions",                              element: <CommissionDashboard /> },
      { path: "finance",                                  element: <FinanceDashboard /> },
      { path: "tasks",                                     element: <ActivitiesPage /> },
      { path: "inbox",                                     element: <HotInboxPage /> },
      { path: "compliance",                                element: <CompliancePage /> },
      { path: "payments",                                  element: <PaymentReportPage /> },
      { path: "contracts",                                 element: <ContractsPage /> },
      { path: "payment-plans",                            element: <PaymentPlansPage /> },
      { path: "reservations",                             element: <ReservationsPage /> },
      { path: "offers-list",                              element: <OffersPage /> },
      { path: "team",                                      element: <TeamPage /> },
      { path: "team/:userId",                              element: <MemberDetailPage /> },
      { path: "reports",                                   element: <ReportsPage /> },
      { path: "contacts",                                  element: <ContactsPage /> },
      { path: "settings",                                  element: <SettingsPage /> },
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
