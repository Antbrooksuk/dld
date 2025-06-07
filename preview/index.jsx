
import React from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';
import { Button } from "@dld-skeleton/components/Button/Button.tsx";

// Render the component with props
const App = () => {
  return (
    <div className="p-5 min-h-screen flex items-center justify-center font-sans">
      <Button  />
      <div className="fixed bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-mono">
        Component: Button
      </div>
    </div>
  );
};

// Use React 18+ createRoot API
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
