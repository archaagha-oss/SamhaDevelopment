import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster } from "sonner";
import { router } from "./router";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./contexts/SettingsContext";
import AuthSync from "./components/AuthSync";
import { installApiInterceptors } from "./lib/api";
import { clerkPublishableKey } from "./lib/auth";
import "./index.css";

// Install global axios interceptors before any component renders so the very
// first API request carries the Clerk session JWT (when one exists).
installApiInterceptors();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime:    1000 * 60 * 10,
      retry: 1,
    },
  },
});

const publishableKey = clerkPublishableKey();

const tree = (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <RouterProvider router={router} />
        {/* Sonner mounts each toast inside a section with role="status" /
            role="alert" + aria-live, so screen readers announce them.
            We add an explicit aria-label on the container so the toast
            region itself is identifiable when navigating by landmark. */}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </SettingsProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <AuthSync />
        {tree}
      </ClerkProvider>
    ) : (
      // Dev-only fallback: no Clerk key configured. The API runs with its
      // own mock-auth middleware that pins requests to dev-user-1, so the
      // app continues to work end-to-end without authentication setup.
      tree
    )}
  </React.StrictMode>
);
