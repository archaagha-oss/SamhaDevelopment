import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div role="alert" className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-destructive">Something went wrong</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            The page hit an unexpected error. You can retry or return to the dashboard.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted/50 border border-border p-2 text-[11px] text-foreground whitespace-pre-wrap break-words">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2 justify-end">
            <a
              href="/"
              className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              Go home
            </a>
            <button
              type="button"
              onClick={this.reset}
              className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
