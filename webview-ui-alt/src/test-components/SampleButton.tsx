import React from 'react';

interface SampleButtonProps {
  text?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}

const SampleButton: React.FC<SampleButtonProps> = ({ 
  text = 'Click me',
  variant = 'primary',
  disabled = false,
  onClick = () => console.log('Button clicked!')
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#0078d4',
          color: 'white',
          border: '1px solid #0078d4'
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: '#0078d4',
          border: '1px solid #0078d4'
        };
      case 'danger':
        return {
          backgroundColor: '#d13438',
          color: 'white',
          border: '1px solid #d13438'
        };
      default:
        return {
          backgroundColor: '#0078d4',
          color: 'white',
          border: '1px solid #0078d4'
        };
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...getVariantStyles(),
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {text}
    </button>
  );
};

export default SampleButton;