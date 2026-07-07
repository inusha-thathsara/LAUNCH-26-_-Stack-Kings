"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { captureApiError } from "@/lib/observability/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Catches render errors in the telemetry dashboard and reports them to Sentry. */
export default class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureApiError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-200">
          <h1 className="text-lg font-bold text-red-400">Telemetry Console Error</h1>
          <p className="max-w-md text-sm text-zinc-400">
            The dashboard encountered an unexpected error: {this.state.message}
          </p>
          <button
            type="button"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
