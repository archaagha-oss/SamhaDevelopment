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
import PaymentReportPage from "./components/PaymentReportPage";
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
import ReportsPage from "./pages/ReportsPage";
import ReservationsPage from "./components/ReservationsPage";
import OffersPage from "./components/OffersPage";
import SettingsPage from "./pages/SettingsPage";
import ContactsPage from "./pages/ContactsPage";

export const router = createBrowserRouter([
  // Standalone print pages (no app shell — full-page printable layout)
  { path: "/offers/:offerId",                            element: <OfferPrintPage /> },
  { path: "/deals/:dealId/print/reservation-form",       element: <ReservationFormPrintPage /> },
  { path: "/deals/:dealId/print/spa-draft",              element: <SpaDraftPrintPage /> },
  { path: "/deals/:dealId/print/sales-offer",            element: <SalesOfferPrintPage /> },
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
      { path: "tasks",                                     element: <ActivitiesPage /> },
      { path: "payments",                                  element: <PaymentReportPage /> },
      { path: "contracts",                                 element: <ContractsPage /> },
      { path: "payment-plans",                            element: <PaymentPlansPage /> },
      { path: "reservations",                             element: <ReservationsPage /> },
      { path: "offers-list",                              element: <OffersPage /> },
      { path: "team",                                      element: <TeamPage /> },
      { path: "reports",                                   element: <ReportsPage /> },
      { path: "contacts",                                  element: <ContactsPage /> },
      { path: "settings",                                  element: <SettingsPage /> },
      { path: "*",                                        element: <NotFoundPage /> },
    ],
  },
]);
