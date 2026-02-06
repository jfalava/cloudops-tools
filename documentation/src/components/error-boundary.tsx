import React, { type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

const defaultFallback = (
  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
    <div className="font-semibold text-neutral-900">Something went wrong</div>
    <div className="mt-1 text-neutral-600">
      The documentation failed to load. Try refreshing the page.
    </div>
  </div>
);

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("Docs render error:", error);
  }

  override render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ?? defaultFallback;
    }
    return this.props.children;
  }
}
