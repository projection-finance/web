"use client";

import React, { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  userId?: string | null;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false, error: null, reported: false };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (this.state.reported) return;
    this.setState({ reported: true });

    console.error("Uncaught error:", error, info);

    // Fire-and-forget error report to API (logs to DB + sends email)
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        userId: this.props.userId ?? undefined,
      }),
    }).catch(() => {
      // silent
    });
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, reported: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-4">
          <img
            src="/favicon.svg"
            alt="logo"
            width={40}
            height={40}
            className="opacity-50"
          />
          <div className="text-center">
            <h1 className="text-lg font-semibold text-[#303549] mb-1">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-500 max-w-md">
              An unexpected error occurred. The team has been notified and will look into it.
            </p>
          </div>

          {this.state.error && (
            <details className="w-full max-w-md">
              <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600">
                Technical details
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-[10px] text-gray-500 overflow-x-auto max-h-[120px] overflow-y-auto">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack?.split("\n").slice(0, 5).join("\n")}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-sm font-medium text-[#303549] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-medium text-white bg-[#303549] rounded-lg hover:bg-[#1e2333] transition-colors"
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
