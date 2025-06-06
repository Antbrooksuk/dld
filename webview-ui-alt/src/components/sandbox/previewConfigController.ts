import { vscode } from "@/utils/vscode";
import { Prop, PreviewConfig } from "./types";

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: PreviewConfig = {};

/**
 * Current configuration in memory
 */
let currentConfig: PreviewConfig = { ...DEFAULT_CONFIG };

/**
 * Load the preview configuration
 * In a real implementation, this would load from a file via the extension
 */
export const loadPreviewConfig = async (): Promise<PreviewConfig> => {
  try {
    // In a full implementation, we would send a message to the extension
    // to load the config from a file. For now, we'll use a simulated response.
    
    // For now, we'll just use console.log instead of actually sending a message
    // since we don't have the appropriate message type registered yet
    console.log('Would request preview config from extension');
    
    // For now, return the in-memory configuration
    return { ...currentConfig };
  } catch (error) {
    console.error('Failed to load preview configuration:', error);
    return { ...DEFAULT_CONFIG };
  }
};

/**
 * Save the preview configuration
 * In a real implementation, this would save to a file via the extension
 */
export const savePreviewConfig = async (config: PreviewConfig): Promise<void> => {
  try {
    // In a full implementation, we would send a message to the extension
    // to save the config to a file
    
    // For now, we'll just use console.log instead of actually sending a message
    console.log('Would save preview config to extension:', config);
    
    // Update the in-memory configuration
    currentConfig = { ...config };
  } catch (error) {
    console.error('Failed to save preview configuration:', error);
  }
};

/**
 * Add a prop to a component
 */
export const addProp = async (
  componentName: string,
  prop: Prop
): Promise<void> => {
  const config = await loadPreviewConfig();
  
  // Initialize component props array if it doesn't exist
  if (!config[componentName]) {
    config[componentName] = [];
  }
  
  // Add the prop
  config[componentName].push(prop);
  
  // Save the updated configuration
  await savePreviewConfig(config);
};

/**
 * Remove a prop from a component
 */
export const removeProp = async (
  componentName: string,
  propName: string
): Promise<void> => {
  const config = await loadPreviewConfig();
  
  // Check if component exists in config
  if (!config[componentName]) {
    return;
  }
  
  // Filter out the prop to remove
  config[componentName] = config[componentName].filter(
    (prop) => prop.propName !== propName
  );
  
  // Save the updated configuration
  await savePreviewConfig(config);
};

/**
 * Update a prop for a component
 */
export const updateProp = async (
  componentName: string,
  oldPropName: string,
  newProp: Prop
): Promise<void> => {
  const config = await loadPreviewConfig();
  
  // Check if component exists in config
  if (!config[componentName]) {
    return;
  }
  
  // Update the prop
  config[componentName] = config[componentName].map((prop) => 
    prop.propName === oldPropName ? newProp : prop
  );
  
  // Save the updated configuration
  await savePreviewConfig(config);
};

/**
 * Get all props for a component
 */
export const getComponentProps = async (
  componentName: string
): Promise<Prop[]> => {
  const config = await loadPreviewConfig();
  return config[componentName] || [];
};

// Initialize with some sample data for testing
const initializeSampleData = async () => {
  // Sample Button component props
  const buttonProps: Prop[] = [
    {
      propName: "text",
      propType: "string",
      defaultValue: "Click me"
    },
    {
      propName: "disabled",
      propType: "boolean",
      defaultValue: "false"
    },
    {
      propName: "onClick",
      propType: "function",
      defaultValue: "() => console.log('Button clicked')"
    }
  ];
  
  // Set the sample data
  currentConfig = {
    "Button": buttonProps
  };
};

// Initialize sample data
initializeSampleData(); 