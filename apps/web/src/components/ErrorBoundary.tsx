import React from "react";
import { Button } from "./ui/Button";
import { AlertTriangle, RotateCw } from "lucide-react";

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-card p-6 shadow-card">
            <div className="flex items-center gap-2 mb-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h1 className="text-base font-semibold">Something went wrong</h1>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              The page hit an unexpected error. You can try reloading; if the problem persists, contact support.
            </p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-ctrl p-3 max-h-40 overflow-auto text-slate-700 mb-4 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => this.setState({ error: null })}>
                Dismiss
              </Button>
              <Button onClick={() => window.location.reload()} leadingIcon={<RotateCw className="h-4 w-4" />}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
