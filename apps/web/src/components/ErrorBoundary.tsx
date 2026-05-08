import React from "react";

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
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-red-700 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              The page hit an unexpected error. You can try reloading; if the
              problem persists, contact support.
            </p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-auto text-slate-700 mb-4">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Reload
              </button>
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
