import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  portal?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PortalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PORTAL_ERROR] ${this.props.portal || "Global"}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive ring-1 ring-destructive/20 shadow-soft">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight mb-2 uppercase italic">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-8">
            An error occurred while loading this part of the {this.props.portal || "portal"}. 
            Our team has been notified.
          </p>
          <Button 
            onClick={this.handleRetry}
            className="rounded-2xl shadow-glow font-bold gap-2 px-8 h-12"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry Action
          </Button>
          
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border text-left overflow-auto max-w-full">
              <p className="text-[10px] font-mono font-bold text-destructive uppercase tracking-widest mb-2">Diagnostic Data</p>
              <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
