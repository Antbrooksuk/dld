
import React from 'react';
import { createRoot } from 'react-dom/client';
import SampleButton from "/Users/an.brooks/Projects/dld/webview-ui-alt/src/test-components/SampleButton.tsx";

// Render the component with props
const App = () => {
  return React.createElement(
    'div',
    {
      style: {
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    },
    React.createElement(SampleButton, {text: "Hello DLD!", variant: "primary", disabled: false}),
    // Debug info
    React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }
      },
      'Component: SampleButton'
    )
  );
};

// Use React 18+ createRoot API
const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(App));
