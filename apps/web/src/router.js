import { jsx as _jsx } from "react/jsx-runtime";
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
export const router = createBrowserRouter([
    // Standalone pages (no app shell — full-page layout)
    { path: "/broker-onboarding", element: _jsx(BrokerOnboarding, {}) },
    // Standalone print pages (no app shell — full-page printable layout)
    { path: "/offers/:offerId", element: _jsx(OfferPrintPage, {}) },
    { path: "/deals/:dealId/print/reservation-form", element: _jsx(ReservationFormPrintPage, {}) },
    { path: "/deals/:dealId/print/spa-draft", element: _jsx(SpaDraftPrintPage, {}) },
    { path: "/deals/:dealId/print/sales-offer", element: _jsx(SalesOfferPrintPage, {}) },
    { path: "/payments/:paymentId/print/invoice", element: _jsx(InvoicePrintPage, {}) },
    { path: "/payments/:paymentId/print/receipt", element: _jsx(ReceiptPrintPage, {}) },
    // Public, unauthenticated client share view (no app shell, no Clerk).
    { path: "/share/u/:token", element: _jsx(PublicUnitView, {}) },
    {
        path: "/",
        element: _jsx(AppShell, {}),
        children: [
            { index: true, element: _jsx(ExecutiveDashboard, {}) },
            { path: "projects", element: _jsx(ProjectsPage, {}) },
            { path: "projects/:projectId", element: _jsx(ProjectDetailPage, {}) },
            { path: "projects/:projectId/settings", element: _jsx(ProjectSettingsPage, {}) },
            { path: "projects/:projectId/units/:unitId", element: _jsx(UnitDetailPage, {}) },
            { path: "units", element: _jsx(UnitsPage, {}) },
            { path: "leads", element: _jsx(LeadsPage, {}) },
            { path: "leads/:leadId", element: _jsx(LeadProfilePage, {}) },
            { path: "deals", element: _jsx(DealsPage, {}) },
            { path: "deals/:dealId", element: _jsx(DealDetailPage, {}) },
            { path: "brokers", element: _jsx(BrokerPage, {}) },
            { path: "commissions", element: _jsx(CommissionDashboard, {}) },
            { path: "finance", element: _jsx(FinanceDashboard, {}) },
            { path: "tasks", element: _jsx(ActivitiesPage, {}) },
            { path: "inbox", element: _jsx(HotInboxPage, {}) },
            { path: "compliance", element: _jsx(CompliancePage, {}) },
            { path: "payments", element: _jsx(PaymentReportPage, {}) },
            { path: "contracts", element: _jsx(ContractsPage, {}) },
            { path: "payment-plans", element: _jsx(PaymentPlansPage, {}) },
            { path: "reservations", element: _jsx(ReservationsPage, {}) },
            { path: "offers-list", element: _jsx(OffersPage, {}) },
            { path: "team", element: _jsx(TeamPage, {}) },
            { path: "reports", element: _jsx(ReportsPage, {}) },
            { path: "contacts", element: _jsx(ContactsPage, {}) },
            { path: "settings", element: _jsx(SettingsPage, {}) },
            // Phase 4 expansion routes
            { path: "projects/:projectId/phases", element: _jsx(PhasesPage, {}) },
            { path: "projects/:projectId/type-plans", element: _jsx(UnitTypePlansPage, {}) },
            { path: "projects/:projectId/construction", element: _jsx(ConstructionProgressPage, {}) },
            { path: "projects/:projectId/escrow", element: _jsx(EscrowPage, {}) },
            { path: "units/:unitId/snags", element: _jsx(SnagListPage, {}) },
            { path: "deals/:dealId/handover", element: _jsx(HandoverChecklistPage, {}) },
            { path: "deals/:dealId/parties", element: _jsx(DealJointOwnersPage, {}) },
            { path: "leads/:leadId/kyc", element: _jsx(LeadKycPage, {}) },
            { path: "refunds", element: _jsx(RefundsPage, {}) },
            { path: "commission-tiers", element: _jsx(CommissionTiersPage, {}) },
            { path: "*", element: _jsx(NotFoundPage, {}) },
        ],
    },
]);
