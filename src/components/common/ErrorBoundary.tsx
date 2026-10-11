import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught Error in UI Boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #FCA5A5',
          padding: '2rem',
          margin: '1.5rem auto',
          maxWidth: '640px',
          textAlign: 'center',
          fontFamily: "'Poppins', sans-serif",
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <AlertTriangle size={24} />
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem 0' }}>
            {this.props.fallbackTitle || 'Component Render Issue'}
          </h3>
          
          <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Click below to reload this section.'}
          </p>

          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} /> Reload View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
