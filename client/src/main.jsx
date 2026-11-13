import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './WorkspaceApp.jsx'

// Dynamic backend URL resolution for multi-host deployment (Render / Hostinger / Desktop)
const isRenderOrLocal = 
  window.location.hostname.includes('onrender.com') || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1';

export const BACKEND_URL = isRenderOrLocal ? '' : 'https://sct-slack.onrender.com';
window.BACKEND_URL = BACKEND_URL;

// Automatically route API requests to the live Render backend when hosted under Hostinger /sct or desktop
if (BACKEND_URL) {
  const originalFetch = window.fetch;
  window.fetch = (url, options) => {
    if (typeof url === 'string') {
      if (url.startsWith('/api') || url.startsWith('/uploads') || url.startsWith('/download')) {
        url = `${BACKEND_URL}${url}`;
      }
    }
    return originalFetch(url, options);
  };
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1A1D21] text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-[#222529] border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-gray-400 max-w-md mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-[#1164A3] hover:bg-[#1164A3]/80 text-white font-semibold text-xs transition-colors shadow-md"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
