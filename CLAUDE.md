# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Developer-Led Design (DLD)** is a VSCode extension forked from Cline that enables developers to generate and iterate on component and journey alternatives directly in code. The goal is to disrupt traditional design-to-development workflows by enabling code-native design iteration using AI and established design systems (Tailwind themes).

### Key Product Vision
- Generate production-ready React components using shadcn/ui + Radix + CVA patterns
- Create design alternatives for stakeholder review without leaving VSCode
- Leverage existing Tailwind themes as design system foundations
- Maintain developer control and code quality (not a no-code solution)
- Reduce design tooling costs and streamline design-to-development handoff

### Target Architecture
- Component generation using established design patterns
- Design alternative creation and variation management
- Code-native design iteration within VSCode
- Integration with existing development workflows

## Development Commands

### Setup and Building
```bash
npm run install:all        # Install all dependencies (extension + webview)
npm run watch              # Watch mode for all components
npm run compile            # Compile TypeScript + lint
npm run package            # Production build
npm run protos             # Generate protobuf code + service configs (run after .proto changes)
```

### Testing
```bash
npm run test               # Run all tests (unit + integration)
npm run test:unit          # Unit tests with Mocha
npm run test:integration   # VS Code extension tests
npm run test:webview       # React component tests with Vitest
npm run test:ci            # CI-specific test runner
```

### Code Quality
```bash
npm run lint               # ESLint for src + webview
npm run format:fix         # Auto-fix Prettier formatting
npm run check-types        # TypeScript type checking
```

### Development Workflow
- Use `F5` in VS Code to launch extension in debug mode
- Use `npm run dev:webview` for frontend development
- Run `npm run protos` after updating any .proto files

## Architecture Overview

### Core Extension Structure
- **extension.ts**: VS Code extension entry point
- **core/**: Business logic including webview management, task execution, AI tools
- **api/**: LLM provider integrations (Anthropic, OpenAI, etc.)
- **integrations/**: VS Code integrations (terminal, git, diagnostics, etc.)
- **services/**: Supporting services (logging, storage, search, etc.)
- **shared/**: Shared types and utilities

### Frontend Architecture
- **webview-ui-alt/**: React frontend built with Vite + TypeScript
- Uses auto-generated gRPC client for extension communication
- Component structure mirrors extension functionality

### Build System
- **esbuild.js**: Custom esbuild configuration for extension
- **Vite**: React frontend bundling with SWC
- **Protocol Buffers**: Auto-generates TypeScript from .proto files
- Path aliases: @core, @api, @shared, @integrations, @services

### Key Technical Details
- gRPC-based communication between extension and webview
- Auto-generated service handlers from protobuf definitions
- Multiple TypeScript configurations for different build targets
- Tree-sitter integration for code parsing
- Model Context Protocol (MCP) server support
- Sophisticated context management for AI conversations

### Testing Architecture
- **Unit tests**: Mocha + TypeScript for core logic
- **Integration tests**: VS Code Test API for extension features
- **Frontend tests**: Vitest + React Testing Library
- **Custom ESLint rules**: Dedicated package in eslint-rules/

### DLD-Specific Development Notes
- This codebase is a fork of Cline being adapted for design tool functionality
- Focus on component generation patterns using shadcn/ui + Radix + CVA
- Tailwind theme integration is critical for design system foundations
- Always run `npm run protos` after modifying .proto files
- Use `npm run watch` for active development
- Extension uses ESM modules, tests use CommonJS
- The webview and extension have separate build processes
- All gRPC service handlers in core/controller/ are auto-generated

### Design Tool Integration Priorities
- Component generation tools using established design patterns
- Design alternative creation and management
- Tailwind theme parsing and utilization
- React component scaffolding with proper TypeScript typing
- Integration with popular design system patterns (shadcn/ui, Radix primitives)

## React Component Preview System (From react-preview-extension)

### Architecture Overview
The react-preview-extension provides a working model for live React component previews using webpack dev server and iframe embedding. Key components:

#### Core Implementation Pattern
1. **WebviewPanel Class**: Manages VSCode webview lifecycle and webpack dev server
2. **Dynamic Entry Point Generation**: Creates `preview/index.js` on-the-fly with current component
3. **Webpack Dev Server**: Runs on localhost:9132 for hot reloading
4. **iframe Integration**: Embeds dev server output in VSCode webview
5. **Prop Management System**: JSON configuration for component props

#### Key Files to Study
- `src/WebviewPanel.ts` - Main extension logic with webpack integration
- `src/utils/createWebpackConfig.ts` - Webpack configuration for component preview
- `src/utils/createJSTemplate.ts` - Dynamic React component entry point generation
- `app/components/PreviewPanel/PreviewIframe.tsx` - iframe implementation
- `preview/index.html` - Static HTML served by webpack dev server

### Critical Implementation Details

#### Webpack Dev Server Integration
```typescript
// Key pattern: Start webpack dev server programmatically
const compiler = Webpack(webpackConfig);
const devServerOptions = { ...webpackConfig.devServer, open: false };
this._previewServer = new WebpackDevServer(devServerOptions, compiler);
this._previewServer.startCallback(() => console.log("start preview"));
```

#### Dynamic Component Loading
```typescript
// Pattern: Generate entry point on file save
fs.writeFileSync(
  path.resolve(extensionPath, "preview", "index.js"),
  createJSTemplate(componentPath, componentName, propList)
);
```

#### iframe Preview Display
```typescript
// Pattern: Simple iframe pointing to localhost dev server
<iframe src="http://localhost:9132" />
```

### Integration Strategy for DLD
1. **Extend existing preview/** folder with webpack integration
2. **Add webpack dev server lifecycle management to webview system**
3. **Implement dynamic component entry point generation**
4. **Integrate with existing previewConfig.json system**
5. **Add support for TypeScript/TSX (extension only supports JS/JSX)**

### Known Issues to Address
- Extension only supports macOS (needs cross-platform webpack config)
- No TypeScript support (needs babel-preset-typescript)
- Basic prop type system (needs expansion for complex props)
- Fixed port 9132 (needs dynamic port allocation)

## React Component Preview Implementation - Problems Solved

### Critical Issues Encountered and Solutions

#### 1. **React 19 API Compatibility Issue**
**Problem**: `ReactDOM.render` is deprecated in React 19
**Error**: `react_dom__WEBPACK_IMPORTED_MODULE_1__.render is not a function`
**Solution**: Updated to use `createRoot` API
```javascript
// Old (broken)
ReactDOM.render(<Component />, container);

// New (working)  
const root = createRoot(container);
root.render(<Component />);
```

#### 2. **Babel Loader Resolution in VSCode Extension Context**
**Problem**: Webpack couldn't find babel presets when running from extension
**Error**: `Cannot find package '@babel/preset-env' imported from /babel-virtual-resolve-base.js`
**Solution**: Use `require.resolve()` for all babel loaders and presets
```typescript
// Fixed webpack config
loader: require.resolve('babel-loader'),
presets: [
  [require.resolve('@babel/preset-env'), { targets: { node: 'current' } }],
  [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
  [require.resolve('@babel/preset-typescript')]
]
```

#### 3. **VSCode Webview Content Security Policy (CSP) Blocking Iframes**
**Problem**: VSCode webview CSP blocked localhost iframes by default
**Symptom**: Iframe appeared but showed blank content, no console errors
**Root Cause**: Missing `frame-src` directive in CSP
**Solution**: Added localhost iframe support to both production and development CSP:
```typescript
// Production CSP
content="default-src 'none'; ... connect-src https: wss: http://localhost:*; frame-src http://localhost:*;"

// Development CSP  
csp = [..., `frame-src http://localhost:*`]
```

#### 4. **Iframe Content Not Updating After Component Changes**
**Problem**: Iframe didn't automatically reload when webpack dev server content changed
**Symptom**: Had to manually switch iframe URL to see updated components
**Root Cause**: React iframe doesn't detect external content changes
**Solution**: Added manual reload functionality with React key prop
```typescript
const [iframeKey, setIframeKey] = useState(Date.now());

// Force iframe reload
<iframe key={iframeKey} src={url} />
<button onClick={() => setIframeKey(Date.now())}>Reload</button>
```

#### 5. **ESBuild External Dependencies Issue**
**Problem**: ESBuild tried to bundle webpack and webpack-dev-server into extension
**Error**: Multiple build errors about missing Node.js modules
**Solution**: Added webpack dependencies to external list in esbuild config
```javascript
external: ["vscode", "webpack", "webpack-dev-server"]
```

### Debugging Techniques That Worked

1. **VSCode Webview Developer Tools**: `Cmd+Shift+P` → "Developer: Open Webview Developer Tools"
2. **CSP Testing**: Added test buttons to verify iframe can load different URLs
3. **Debug Overlays**: Added visual indicators showing iframe source URL
4. **Console Logging**: Added iframe load/error event handlers
5. **Step-by-step Isolation**: Tested each component (server, webpack, iframe, CSP) separately

### Key Architectural Insights

- **VSCode webviews have strict CSP by default** - must explicitly allow localhost iframes
- **Webpack dev server works fine in extension context** - just needs proper loader resolution  
- **Iframe content updates require manual intervention** - no automatic reload on server changes
- **React 19+ requires createRoot API** - old ReactDOM.render is removed
- **Extension bundling requires careful external dependency management** - can't bundle Node.js server tools

### Working Solution Architecture

1. **PreviewServerManager**: Manages webpack dev server lifecycle within extension
2. **ComponentTemplateGenerator**: Creates dynamic React entry points
3. **SandboxArea**: React component with iframe and manual reload controls
4. **Webpack Dev Server**: Serves dynamically generated component previews
5. **CSP Configuration**: Allows localhost iframe embedding in webview