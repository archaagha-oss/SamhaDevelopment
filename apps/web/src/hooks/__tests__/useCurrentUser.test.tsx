import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import type { ReactNode } from "react";
import { useCurrentUser, useCurrentRole } from "@/hooks/useCurrentUser";

// Hook test:
// - Mock axios.get so no real network is performed.
// - Wrap renderHook in a fresh QueryClientProvider per test, with retry off
//   so a transient mock-injection lag doesn't surface as a long delay.
// - Assert loading -> success transition and that the role is what the API
//   returned.
//
// This exercises the same path used everywhere in the app for role-based UI
// gating, so a regression in the response shape would break sidebar/nav.

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

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useCurrentUser", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("starts in loading state, then resolves to the user payload", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        id: "u_1",
        clerkId: "clk_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "ADMIN",
        status: "ACTIVE",
        jobTitle: "Founder",
        avatarUrl: null,
        phone: null,
        managerId: null,
      },
    });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith("/api/users/me");
    expect(result.current.data?.role).toBe("ADMIN");
    expect(result.current.data?.name).toBe("Ada Lovelace");
  });

  it("useCurrentRole returns null while loading and the role on success", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        id: "u_2",
        clerkId: "clk_2",
        name: "Grace Hopper",
        email: "grace@example.com",
        role: "MANAGER",
        status: "ACTIVE",
        jobTitle: null,
        avatarUrl: null,
        phone: null,
        managerId: null,
      },
    });

    const { result } = renderHook(() => useCurrentRole(), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).toBe("MANAGER"));
  });
});
