import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import axios from "axios";

// Test isolation:
//
// 1. Reset axios mocks (and any module mocks) between tests so HTTP stubs from
//    one test never leak into the next.
// 2. Unmount any rendered React tree — RTL's cleanup is autoexecuted in v16
//    when running under Vitest globals, but we call it explicitly for safety
//    in case future Vitest config disables `globals`.
// 3. Stub `window.matchMedia`. next-themes / tailwind-animate / Radix Dialog
//    occasionally read it during render in jsdom (which doesn't implement it).

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  cleanup();
  // Clear any axios interceptor state mounted by axiosBootstrap during tests.
  axios.interceptors.request.clear();
  axios.interceptors.response.clear();
});

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom doesn't implement ResizeObserver; Radix popovers/dialogs touch it.
if (typeof globalThis.ResizeObserver === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
