# React Component Preview - Implementation Plan

This document outlines the steps to implement React component preview functionality in the DLD codebase, following the approach used in react-preview-extension.

## Phase 1: Basic Preview Infrastructure

- [x] Create initial SandboxArea UI with static component preview
- [x] Create a basic configuration file structure for storing component props
  - [x] Define types for props (name, type, default value)
  - [x] Create a utility to read/write configuration from a JSON file
  - [x] Add initial sample components for testing

**Testable Outcome:** 
- The SandboxArea shows a visually correct preview panel with header and component area
- A `previewConfig.json` file exists with a sample component configuration
- The types are defined in the codebase and can be imported/used

## Phase 2: Webpack Dev Server Setup

- [ ] Add webpack dev server to the extension
  - [ ] Create webpack config similar to react-preview-extension
  - [ ] Set up entry point generation for dynamic component loading
  - [ ] Configure babel and other necessary loaders
- [ ] Create utilities to generate component import templates
  - [ ] Function to generate JS code that imports and renders a component
  - [ ] Handle prop injection based on configuration

**Testable Outcome:**
- Running `npm run start-webpack-preview` (or similar command) starts a webpack server
- Navigating to `http://localhost:9132` (or configured port) shows a blank page with no errors
- The server can load and render a simple test component from a manually created index.js file

## Phase 3: Component Detection

- [ ] Add file system watcher to detect React components
  - [ ] Focus on specific directories (e.g., src/components)
  - [ ] Filter for JSX/TSX files
  - [ ] Extract component names from files
- [ ] Implement active editor tracking
  - [ ] Listen for editor change events
  - [ ] Update preview when editing a component

**Testable Outcome:**
- Opening the extension and running a command shows a list of detected components in the console/output
- When you open a React component file, the console logs the detected component name
- Creating a new component file triggers detection automatically

## Phase 4: Props Management UI

- [ ] Create UI for managing component props
  - [ ] Form for adding new props (name, type, default value)
  - [ ] List of existing props with edit/delete functionality
  - [ ] Type-specific input controls for different prop types
- [ ] Implement prop update logic
  - [ ] Send messages between webview and extension
  - [ ] Update configuration file when props change
  - [ ] Trigger preview refresh on prop changes

**Testable Outcome:**
- The SandboxArea shows a form for adding props (name, type, default value)
- Adding a prop through the UI updates the previewConfig.json file
- A list of existing props is visible and each prop can be edited or deleted
- Changes to props are reflected in the config file immediately

## Phase 5: Preview Panel Integration

- [ ] Update SandboxArea to use dynamic preview
  - [ ] Display current component name
  - [ ] Create iframe that points to webpack dev server
  - [ ] Handle messages from extension for component changes
- [ ] Add component selector UI
  - [ ] Show list of available components
  - [ ] Allow switching between components

**Testable Outcome:**
- The SandboxArea shows the actual component being previewed, not just static content
- The component name in the header changes when switching components
- The iframe loads without errors and displays the correct component
- Props changes in the UI are immediately reflected in the preview
- A dropdown or list lets you select from available components

## Phase 6: Enhancements and Polish

- [ ] Add error handling for component loading
  - [ ] Display helpful error messages when components fail to load
  - [ ] Add fallback UI for invalid components
- [ ] Implement preview controls
  - [ ] Background color toggle
  - [ ] Responsive size controls
  - [ ] Reset button for props
- [ ] Performance optimizations
  - [ ] Debounce update events
  - [ ] Cache component metadata

**Testable Outcome:**
- Intentionally breaking a component shows a readable error message in the preview
- The preview area includes controls for changing background color
- There are controls to adjust the preview size to test responsiveness
- Changes to components are reflected in the preview with minimal delay
- A "reset props" button restores default values

## Testing Steps

For each phase:

1. Implement the minimal required functionality
2. Test in isolation using simple components
3. Verify integration with existing codebase
4. Document any issues or limitations encountered

## Technical Approach Details

### Component Loading

The component preview works by:
1. Generating a JavaScript file that imports the target component
2. Setting up props based on stored configuration
3. Rendering the component with ReactDOM
4. Using webpack to bundle and serve the result

### Messaging Architecture

The extension and webview communicate via:
- Extension → Webview: Updates about available components, current component
- Webview → Extension: Requests to change props, select different components

### Configuration Storage

Component props are stored in a JSON file with the structure:
```json
{
  "ComponentName": [
    { "propName": "text", "propType": "string", "defaultValue": "Hello" },
    { "propName": "onClick", "propType": "function", "defaultValue": "() => {}" }
  ]
}
``` 