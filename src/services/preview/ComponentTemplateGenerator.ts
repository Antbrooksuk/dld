import { Prop } from '../../shared/preview-types';

/**
 * Generates dynamic React component entry points for webpack dev server
 * Based on react-preview-extension createJSTemplate.ts
 */
export class ComponentTemplateGenerator {
  /**
   * Generate a React entry point that imports and renders a component
   */
  static generateTemplate(
    componentPath: string,
    componentName: string,
    props: Prop[] = []
  ): string {
    // Generate the template using React 19+ createRoot API
    // Use named export to match filename convention
    return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${componentName} } from "${componentPath}";

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
    React.createElement(${componentName}, {${this.generatePropsObject(props)}}),
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
      'Component: ${componentName}'
    )
  );
};

// Use React 18+ createRoot API
const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(App));
`;
  }

  /**
   * Generate a props object for the component
   */
  private static generatePropsObject(props: Prop[]): string {
    if (props.length === 0) return '';

    const propEntries = props.map(prop => {
      let value: string;
      
      switch (prop.propType) {
        case 'string':
          value = `"${prop.defaultValue}"`;
          break;
        case 'boolean':
          value = prop.defaultValue === 'true' ? 'true' : 'false';
          break;
        case 'number':
          value = prop.defaultValue;
          break;
        case 'function':
          value = `(${prop.defaultValue})`;
          break;
        default:
          value = prop.defaultValue;
      }
      
      return `${prop.propName}: ${value}`;
    });

    return propEntries.join(', ');
  }

  /**
   * Generate a simple test template for debugging
   */
  static generateTestTemplate(message: string = 'Component Preview Ready'): string {
    return `
import React from 'react';
import { createRoot } from 'react-dom/client';

const TestComponent = () => {
  return React.createElement('div', {
    style: {
      padding: '40px',
      textAlign: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }
  }, 
    React.createElement('h2', { 
      style: { margin: '0 0 10px 0', fontSize: '24px' } 
    }, '${message}'),
    React.createElement('p', { 
      style: { margin: 0, opacity: 0.9, fontSize: '16px' } 
    }, 'Dynamic entry point generation is working!')
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(TestComponent));
`;
  }
}