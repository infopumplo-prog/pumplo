import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold">Něco se pokazilo</h1>
            <p className="text-muted-foreground text-sm">
              Došlo k neočekávané chybě. Zkuste obnovit stránku nebo se vrátit na hlavní stránku.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={this.handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Zkusit znovu
              </Button>
              <Button onClick={this.handleGoHome}>
                Hlavní stránka
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mt-4 p-3 bg-muted rounded-lg text-xs">
                <summary className="cursor-pointer font-medium">Detaily chyby</summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-destructive">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
