/**
 * Shared types for component preview functionality
 * Used by both extension and webview
 */

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

/**
 * Information about a component being previewed
 */
export interface ComponentInfo {
  /** Name of the component */
  name: string;
  
  /** Full file path to the component */
  path: string;
  
  /** Props for the component */
  props: Prop[];
}