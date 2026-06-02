"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree so a failure in the Pixi.js
 * game canvas (shader/init/WebGL errors) shows a friendly recoverable screen
 * instead of white-screening the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface the error in the console for debugging; swap for real telemetry
    // (Sentry, etc.) when available.
    console.error("[ErrorBoundary] caught render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="flex max-w-md flex-col items-center gap-5 text-center">
            <h1 className="font-spice text-3xl text-gold sm:text-4xl">
              Whoa, mon.
            </h1>
            <p className="font-heading text-base text-gold-dim">
              Something went sideways loading the board. Give it another go.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={this.reset}
                className="interactive-btn wood-btn wood-btn-bamboo cursor-pointer rounded-2xl px-6 py-3 font-heading text-base font-bold text-night shadow-lg"
              >
                Try Again
              </button>
              <a
                href="/"
                className="interactive-btn cursor-pointer rounded-2xl border border-wood px-6 py-3 font-heading text-base text-gold-dim transition-colors hover:text-gold"
              >
                Home
              </a>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
