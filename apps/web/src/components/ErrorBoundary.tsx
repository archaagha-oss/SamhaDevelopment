import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface for debugging; production would forward to a logger.
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-slate-500 mb-4">
            The page hit an unexpected error. The team has been notified — try again or
            return to the dashboard.
          </p>
          {this.state.error?.message && (
            <pre className="text-[11px] text-left bg-slate-50 border border-slate-100 rounded-lg p-2 mb-4 overflow-x-auto text-slate-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
