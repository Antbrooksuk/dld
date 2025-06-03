import React from 'react';

interface SandboxAreaProps {
  // Add any props you might need in the future
}

const SandboxArea: React.FC<SandboxAreaProps> = () => {
  return (
    <div className="sandbox-area">
      <div className="sandbox-label">sandbox</div>
    </div>
  );
};

export default SandboxArea; 