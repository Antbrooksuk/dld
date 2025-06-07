import { Prop } from "../../shared/preview-types"

/**
 * Generates dynamic React component entry points for webpack dev server
 * Based on react-preview-extension createJSTemplate.ts
 */
export class ComponentTemplateGenerator {
	/**
	 * Generate a React entry point that imports and renders a component
	 */
	static generateTemplate(componentPath: string, componentName: string, props: Prop[] = [], extensionPath?: string): string {
		// Convert absolute paths to relative paths from preview folder
		const importPath = this.convertToRelativePath(componentPath, extensionPath);
		
		// Generate the template using React 19+ createRoot API
		// Use named export to match filename convention
		return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';
import { ${componentName} } from "${importPath}";

// Render the component with props
const App = () => {
  return (
    <div className="p-5 min-h-screen flex items-center justify-center font-sans">
      <${componentName} ${this.generateJSXProps(props)} />
      <div className="fixed bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-mono">
        Component: ${componentName}
      </div>
    </div>
  );
};

// Use React 18+ createRoot API
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
`
	}

	/**
	 * Generate JSX props for the component
	 */
	private static generateJSXProps(props: Prop[]): string {
		if (props.length === 0) {
			return ""
		}

		const propEntries = props.map((prop) => {
			let value: string

			switch (prop.propType) {
				case "string":
					value = `"${prop.defaultValue}"`
					break
				case "boolean":
					value = prop.defaultValue === "true" ? "{true}" : "{false}"
					break
				case "number":
					value = `{${prop.defaultValue}}`
					break
				case "function":
					value = `{${prop.defaultValue}}`
					break
				default:
					value = `"${prop.defaultValue}"`
			}

			return `${prop.propName}=${value}`
		})

		return propEntries.join(" ")
	}

	/**
	 * Generate a props object for the component (legacy)
	 */
	private static generatePropsObject(props: Prop[]): string {
		if (props.length === 0) {
			return ""
		}

		const propEntries = props.map((prop) => {
			let value: string

			switch (prop.propType) {
				case "string":
					value = `"${prop.defaultValue}"`
					break
				case "boolean":
					value = prop.defaultValue === "true" ? "true" : "false"
					break
				case "number":
					value = prop.defaultValue
					break
				case "function":
					value = `(${prop.defaultValue})`
					break
				default:
					value = prop.defaultValue
			}

			return `${prop.propName}: ${value}`
		})

		return propEntries.join(", ")
	}

	/**
	 * Convert absolute file paths to relative paths from preview folder
	 */
	private static convertToRelativePath(componentPath: string, extensionPath?: string): string {
		if (!extensionPath) {
			return componentPath; // Fallback to original path
		}
		
		const previewRoot = require('path').resolve(extensionPath, 'preview');
		const relativePath = require('path').relative(previewRoot, componentPath);
		return relativePath;
	}

	/**
	 * Generate a simple test template for debugging
	 */
	static generateTestTemplate(message: string = "Component Preview Ready"): string {
		return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';

const TestComponent = () => {
  return (
    <div className="p-10 text-center font-sans bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg shadow-lg">
      <h2 className="mb-2 text-2xl font-bold">${message}</h2>
      <p className="opacity-90">Dynamic entry point generation is working!</p>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<TestComponent />);
`
	}
}
