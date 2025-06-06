/**
 * Represents a single prop for a React component
 */
export interface Prop {
  /** Name of the prop */
  propName: string;
  
  /** Type of the prop (string, number, boolean, etc.) */
  propType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'function';
  
  /** Default value of the prop (as a string) */
  defaultValue: string;
}

/**
 * Configuration for all components' props
 * Key is the component name, value is an array of props
 */
export interface PreviewConfig {
  [componentName: string]: Prop[];
} 