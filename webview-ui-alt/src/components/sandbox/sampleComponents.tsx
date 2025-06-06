import React from 'react';

/**
 * Sample Button component for testing the preview functionality
 */
interface ButtonProps {
  text?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ 
  text = 'Click me', 
  disabled = false, 
  onClick = () => console.log('Button clicked') 
}) => {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      style={{
        padding: '8px 16px',
        backgroundColor: disabled ? '#cccccc' : '#0078d4',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      {text}
    </button>
  );
};

/**
 * Sample Card component for testing the preview functionality
 */
interface CardProps {
  title?: string;
  description?: string;
  imageUrl?: string;
}

export const Card: React.FC<CardProps> = ({
  title = 'Card Title',
  description = 'This is a sample card component for testing the preview functionality.',
  imageUrl = 'https://via.placeholder.com/300x200'
}) => {
  return (
    <div
      style={{
        width: '300px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <img 
        src={imageUrl} 
        alt={title}
        style={{
          width: '100%',
          height: '200px',
          objectFit: 'cover'
        }} 
      />
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h3>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>{description}</p>
      </div>
    </div>
  );
};

/**
 * Sample Badge component for testing the preview functionality
 */
interface BadgeProps {
  label?: string;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export const Badge: React.FC<BadgeProps> = ({
  label = 'Badge',
  color = 'blue',
  size = 'medium'
}) => {
  // Determine size-based styles
  const sizeStyles = {
    small: {
      padding: '2px 6px',
      fontSize: '10px'
    },
    medium: {
      padding: '4px 8px',
      fontSize: '12px'
    },
    large: {
      padding: '6px 12px',
      fontSize: '14px'
    }
  };

  return (
    <span
      style={{
        ...sizeStyles[size],
        backgroundColor: color,
        color: 'white',
        borderRadius: '12px',
        fontWeight: 'bold',
        display: 'inline-block'
      }}
    >
      {label}
    </span>
  );
}; 