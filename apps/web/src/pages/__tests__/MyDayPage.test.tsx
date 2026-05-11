import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import type { ReactNode } from "react";
import MyDayPage from "@/pages/MyDayPage";

// Component test for the personal "My Day" home page (UX_AUDIT_2 Part B).
//
// We mock axios.get and stub responses per URL so /summary, /queue, the
// pipeline rollup, and the triage preview all land with canned data. The
// router is wrapped in MemoryRouter with a /leads/:id route so we can assert
// row clicks navigate to the lead detail page.

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;

const SUMMARY = {
  callsDue: 6,
  followUpsOverdue: 3,
  dealsStalled: 2,
  paymentsDueWeek: 4,
  paymentsDueWeekTotal: 240_000,
};

const QUEUE_ITEMS = [
  {
    kind: "TASK",
    id: "t_1",
    title: "John Doe",
    subtitle: "Call · Intro call",
    dueAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    leadId: "lead_1",
    overdue: true,
    overdueDays: 0,
  },
  {
    kind: "FOLLOW_UP",
    id: "a_1",
    title: "Aisha Khan",
    subtitle: "Follow-up · ping after viewing",
    dueAt: new Date().toISOString(),
    leadId: "lead_2",
    overdue: false,
    overdueDays: 0,
  },
  {
    kind: "SILENT_LEAD",
    id: "lead_3",
    title: "Mohammed S",
    subtitle: "8 days silent · QUALIFIED",
    dueAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
    leadId: "lead_3",
    overdue: true,
    overdueDays: 8,
  },
  {
    kind: "PAYMENT_DUE",
    id: "p_1",
    title: "Sara K · DL-1042",
    subtitle: "20% installment · AED 50,000",
    dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
    dealId: "deal_42",
    leadId: "lead_4",
    overdue: false,
    overdueDays: 0,
  },
];

const PIPELINE = [
  { stage: "QUALIFIED", count: 6, totalValue: 1_800_000 },
  { stage: "RESERVATION_PENDING", count: 2, totalValue: 600_000 },
];

const INBOX = [
  {
    id: "tr_1",
    channel: "WHATSAPP",
    fromAddress: "+971501234567",
    fromName: null,
    bodyPreview: "Hi, interested in 2BR",
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
];

function setupGetMock() {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/my-day/summary") return Promise.resolve({ data: SUMMARY });
    if (url === "/api/my-day/queue") return Promise.resolve({ data: { items: QUEUE_ITEMS } });
    if (url === "/api/reports/deals/by-stage") return Promise.resolve({ data: PIPELINE });
    if (url === "/api/triage") return Promise.resolve({ data: INBOX });
    return Promise.resolve({ data: {} });
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/my-day"]}>
          <Routes>
            <Route path="/my-day" element={children} />
            <Route path="/leads/:id" element={<div data-testid="lead-detail">Lead detail</div>} />
            <Route path="/deals/:id" element={<div data-testid="deal-detail">Deal detail</div>} />
            <Route path="/inbox" element={<div data-testid="inbox-page">Inbox</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(
    <Wrapper>
      <MyDayPage />
    </Wrapper>,
  );
}

describe("MyDayPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    setupGetMock();
  });

  it("renders the strip with all four metric pills", async () => {
    renderPage();

    // Wait for the summary to land and the 240,000 dirham value to show up —
    // that's the strongest signal the data has propagated past initial 0s.
    await waitFor(() => {
      expect(screen.getByText("240,000")).toBeInTheDocument();
    });

    const group = screen.getByRole("group", { name: /my day metrics/i });
    expect(within(group).getByText("6")).toBeInTheDocument();
    expect(within(group).getByText("3")).toBeInTheDocument();
    expect(within(group).getByText("2")).toBeInTheDocument();
    expect(within(group).getByText("240,000")).toBeInTheDocument();
  });

  it("renders all four queue rows from the canned feed", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("queue-row")).toHaveLength(4);
    });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Aisha Khan")).toBeInTheDocument();
    expect(screen.getByText("Mohammed S")).toBeInTheDocument();
    expect(screen.getByText(/Sara K · DL-1042/)).toBeInTheDocument();
  });

  it("navigates to the lead detail when a row with leadId is clicked", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("queue-row").length).toBeGreaterThan(0);
    });

    const rows = screen.getAllByTestId("queue-row");
    // First row is the task for John Doe → leadId: lead_1
    fireEvent.click(rows[0]);

    await waitFor(() => {
      expect(screen.getByTestId("lead-detail")).toBeInTheDocument();
    });
  });

  it("filters the queue when a strip pill is toggled (PAYMENT_DUE)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("queue-row")).toHaveLength(4);
    });

    const dueThisWeek = screen.getByRole("button", { name: /due this week/i });
    fireEvent.click(dueThisWeek);

    await waitFor(() => {
      const rows = screen.getAllByTestId("queue-row");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveAttribute("data-kind", "PAYMENT_DUE");
    });
  });

  it("renders the pipeline pulse rows from /reports/deals/by-stage", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("pipeline-row")).toHaveLength(2);
    });

    const pulseSection = screen.getByLabelText(/pipeline pulse/i);
    expect(within(pulseSection).getByText("Qualified")).toBeInTheDocument();
    expect(within(pulseSection).getByText("Res. pending")).toBeInTheDocument();
  });

  it("renders the hot inbox preview rows from /triage", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("inbox-row")).toHaveLength(1);
    });

    const inboxSection = screen.getByLabelText(/hot inbox/i);
    expect(within(inboxSection).getByText("+971501234567")).toBeInTheDocument();
    expect(within(inboxSection).getByText(/Hi, interested in 2BR/)).toBeInTheDocument();
  });
});
