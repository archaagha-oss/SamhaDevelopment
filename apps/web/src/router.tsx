import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppShell from "./components/AppShell";
import NotFoundPage from "./components/NotFoundPage";

// Lazy-loaded screens — keeps the initial bundle small.
const ExecutiveDashboard       = lazy(() => import("./components/ExecutiveDashboard"));
const ProjectDetailPage        = lazy(() => import("./components/ProjectDetailPage"));
const UnitDetailPage           = lazy(() => import("./components/UnitDetailPage"));
const UnitsPage                = lazy(() => import("./components/UnitsPage"));
const LeadsPage                = lazy(() => import("./components/LeadsPage"));
const LeadProfilePage          = lazy(() => import("./components/LeadProfilePage"));
const DealsPage                = lazy(() => import("./components/DealsPage"));
const DealDetailPage           = lazy(() => import("./components/DealDetailPage"));
const BrokerPage               = lazy(() => import("./components/BrokerPage"));
const CommissionDashboard      = lazy(() => import("./components/CommissionDashboard"));
const PaymentReportPage        = lazy(() => import("./components/PaymentReportPage"));
const ContractsPage            = lazy(() => import("./pages/ContractsPage"));
const ProjectsPage             = lazy(() => import("./components/ProjectsPage"));
const ProjectSettingsPage      = lazy(() => import("./components/ProjectSettingsPage"));
const ActivitiesPage           = lazy(() => import("./pages/ActivitiesPage"));
const TeamPage                 = lazy(() => import("./pages/TeamPage"));
const PaymentPlansPage         = lazy(() => import("./components/PaymentPlansPage"));
const OfferPrintPage           = lazy(() => import("./components/OfferPrintPage"));
const ReservationFormPrintPage = lazy(() => import("./components/ReservationFormPrintPage"));
const SpaDraftPrintPage        = lazy(() => import("./components/SpaDraftPrintPage"));
const SalesOfferPrintPage      = lazy(() => import("./components/SalesOfferPrintPage"));
const InvoicePrintPage         = lazy(() => import("./components/InvoicePrintPage"));
const ReceiptPrintPage         = lazy(() => import("./components/ReceiptPrintPage"));
const ReportsPage              = lazy(() => import("./pages/ReportsPage"));
const ReservationsPage         = lazy(() => import("./components/ReservationsPage"));
const OffersPage               = lazy(() => import("./components/OffersPage"));
const SettingsPage             = lazy(() => import("./pages/SettingsPage"));
const ContactsPage             = lazy(() => import("./pages/ContactsPage"));

const RouteFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
  </div>
);

const lazyRoute = (Element: React.ComponentType) => (
  <Suspense fallback={<RouteFallback />}>
    <Element />
  </Suspense>
);

export const router = createBrowserRouter([
  // Standalone print pages (no app shell — full-page printable layout)
  { path: "/offers/:offerId",                            element: lazyRoute(OfferPrintPage) },
  { path: "/deals/:dealId/print/reservation-form",       element: lazyRoute(ReservationFormPrintPage) },
  { path: "/deals/:dealId/print/spa-draft",              element: lazyRoute(SpaDraftPrintPage) },
  { path: "/deals/:dealId/print/sales-offer",            element: lazyRoute(SalesOfferPrintPage) },
  { path: "/payments/:paymentId/print/invoice",          element: lazyRoute(InvoicePrintPage) },
  { path: "/payments/:paymentId/print/receipt",          element: lazyRoute(ReceiptPrintPage) },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true,                                      element: lazyRoute(ExecutiveDashboard) },
      { path: "projects",                                 element: lazyRoute(ProjectsPage) },
      { path: "projects/:projectId",                      element: lazyRoute(ProjectDetailPage) },
      { path: "projects/:projectId/settings",             element: lazyRoute(ProjectSettingsPage) },
      { path: "projects/:projectId/units/:unitId",        element: lazyRoute(UnitDetailPage) },
      { path: "units",                                    element: lazyRoute(UnitsPage) },
      { path: "leads",                                    element: lazyRoute(LeadsPage) },
      { path: "leads/:leadId",                            element: lazyRoute(LeadProfilePage) },
      { path: "deals",                                    element: lazyRoute(DealsPage) },
      { path: "deals/:dealId",                            element: lazyRoute(DealDetailPage) },
      { path: "brokers",                                  element: lazyRoute(BrokerPage) },
      { path: "commissions",                              element: lazyRoute(CommissionDashboard) },
      { path: "tasks",                                    element: lazyRoute(ActivitiesPage) },
      { path: "payments",                                 element: lazyRoute(PaymentReportPage) },
      { path: "contracts",                                element: lazyRoute(ContractsPage) },
      { path: "payment-plans",                            element: lazyRoute(PaymentPlansPage) },
      { path: "reservations",                             element: lazyRoute(ReservationsPage) },
      { path: "offers-list",                              element: lazyRoute(OffersPage) },
      { path: "team",                                     element: lazyRoute(TeamPage) },
      { path: "reports",                                  element: lazyRoute(ReportsPage) },
      { path: "contacts",                                 element: lazyRoute(ContactsPage) },
      { path: "settings",                                 element: lazyRoute(SettingsPage) },
      { path: "*",                                        element: <NotFoundPage /> },
    ],
  },
]);
