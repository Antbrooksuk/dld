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

## React Component Preview System (Vite-based Implementation)

### Architecture Overview
The DLD preview system provides live React component previews using Vite dev server and iframe embedding. This system is fully generic and works with any codebase without hardcoded dependencies.

#### Core Implementation Pattern
1. **PreviewServerManager**: Manages Vite dev server lifecycle within extension
2. **Dynamic Theme Detection**: Scans workspace for theme files and generates CSS
3. **ComponentTemplateGenerator**: Creates React entry points with proper imports
4. **Dynamic CSS Generation**: Processes theme files to create Tailwind @source patterns
5. **Hot Reloading**: File watchers for both components and theme changes

#### Key Files
- `src/services/preview/PreviewServerManager.ts` - Main server and theme management
- `src/services/preview/ComponentTemplateGenerator.ts` - Dynamic React component generation
- `preview/tailwind.css` - Generated CSS with dynamic @source patterns
- `preview/index.jsx` - Generated component entry point
- `preview/index.html` - Static HTML served by Vite

### Critical Implementation Details

#### Vite Dev Server Integration
```typescript
// Key pattern: Start Vite dev server programmatically
this.viteServer = await createServer({
  root: previewRoot,
  plugins: [react()],
  server: { port: 5174, host: 'localhost', strictPort: true },
  css: {
    postcss: {
      plugins: [(await import('@tailwindcss/postcss')).default()]
    }
  }
});
await this.viteServer.listen(5174);
```

#### Dynamic Theme Detection and CSS Generation
```typescript
// Pattern: Scan workspace for theme files and generate CSS
const themeFolderPath = path.join(this.workspacePath, 'src', 'theme');
const cssFiles = fs.readdirSync(themeFolderPath).filter(file => file.endsWith('.css'));

// Parse CSS content for custom properties
const { colors, spacing, textSizes, fonts, utilityDefinitions } = 
  this.parseCustomThemeProperties(cssContent);

// Generate dynamic @source patterns
const dynamicPatterns = `
@source inline('bg-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('text-{${allTextSizes.join(',')}}');
@source inline('{${utilityNames.join(',')}}');
`;
```

#### Universal Component Import Resolution
```typescript
// Pattern: Calculate relative paths from preview folder to any workspace
const previewRoot = path.resolve(extensionPath, 'preview');
const relativePath = path.relative(previewRoot, componentPath);
const importPath = relativePath; // No hardcoded aliases needed
```

#### Hot Reloading File Watcher
```typescript
// Pattern: Watch theme files for changes
this.themeWatcher = fs.watch(themeFolderPath, { recursive: true }, (_eventType, filename) => {
  if (filename && filename.endsWith('.css')) {
    console.log(`Theme file changed: ${filename}`);
    this.onThemeFileChanged(); // Regenerate CSS
  }
});
```

### Dynamic Theme Detection System

#### Supported Theme Patterns
1. **CSS Variables**: `--color-primary-500`, `--spacing-3xl`, `--text-10xl`, `--font-brand`
2. **@theme Blocks**: Tailwind 4 theme definitions with CSS variables
3. **@utility Definitions**: Custom utility classes like `body-m`, `heading-lg`
4. **Color Scales**: Automatic detection of color naming patterns
5. **Custom Properties**: Spacing, text sizes, font families

#### CSS Parsing Patterns
```typescript
// CSS Variables: --category-name-variant:
const cssVarRegex = /--([a-zA-Z][a-zA-Z0-9-]*)-([a-zA-Z0-9-]+):/g;

// @utility blocks: @utility name { ... }
const utilityRegex = /@utility\s+([a-zA-Z][a-zA-Z0-9-]*)\s*\{([^}]+)\}/g;

// @theme blocks: @theme inline { ... }
const themeBlockRegex = /@theme\s+inline\s*\{([^}]+)\}/g;
```

### Universal Workspace Support

#### Generic Path Resolution
- **No hardcoded project names** - works with any workspace structure
- **Relative path calculation** - from preview folder to workspace files
- **Theme folder detection** - automatically finds `src/theme/` in any project
- **Dynamic import generation** - creates proper relative imports for components

#### Workspace Structure Requirements
```
any-project/
├── src/
│   ├── theme/
│   │   ├── theme.css          # Will be auto-detected
│   │   ├── colors.css         # Will be auto-detected  
│   │   └── utilities.css      # Will be auto-detected
│   └── components/
│       └── Button/
│           └── Button.tsx     # Can be previewed
```

### Known Issues and Limitations

#### Current Limitations
- **@layer base conflicts**: Tailwind compilation fails with @layer base + @source patterns
- **Theme folder assumption**: Currently assumes `src/theme/` structure
- **CSS-only themes**: Only parses CSS files, not JS/TS theme objects
- **Single workspace**: Designed for one workspace at a time

#### @layer base Issue (Temporarily Resolved)
**Problem**: @layer base blocks cause 500 errors during CSS compilation
**Current Solution**: Comment out @layer base in theme files
**Future Work**: Investigate Tailwind 4 @layer + @source compatibility

## Preview System Implementation - Problems Solved

### Migration from Webpack to Vite

#### 1. **React 19 API Compatibility**
**Problem**: `ReactDOM.render` is deprecated in React 19
**Solution**: Updated to use `createRoot` API in ComponentTemplateGenerator
```javascript
// Generated template uses modern React API
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
```

#### 2. **Tailwind 4 @source Directive Integration**
**Problem**: Traditional safelist approach is inefficient for dynamic themes
**Solution**: Implemented dynamic @source pattern generation
```typescript
// Dynamic patterns based on discovered theme properties
@source inline('bg-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('text-{${allTextSizes.join(',')}}');
@source inline('{${utilityNames.join(',')}}');
```

#### 3. **Generic Workspace Support**
**Problem**: Hardcoded project paths like `@dld-skeleton` break universality
**Solution**: Dynamic relative path calculation for any workspace
```typescript
// Universal path resolution
const previewRoot = path.resolve(extensionPath, 'preview');
const relativePath = path.relative(previewRoot, componentPath);
// Results in: "../../any-project/src/components/Button/Button.tsx"
```

#### 4. **Theme Detection and Hot Reloading**
**Problem**: No automatic detection of theme changes across different projects
**Solution**: File watcher system with CSS parsing
```typescript
// Automatic theme file discovery and change detection
const themeFolderPath = path.join(workspacePath, 'src', 'theme');
this.themeWatcher = fs.watch(themeFolderPath, { recursive: true }, ...);
```

#### 5. **@layer base Compilation Conflicts**
**Problem**: @layer base blocks cause 500 errors with @source patterns
**Temporary Solution**: Remove @layer base from theme files during parsing
**Long-term**: Need to investigate Tailwind 4 layer processing order

### Debugging Techniques for Theme System

1. **Console Logging**: Added extensive logging for theme file discovery and parsing
2. **CSS Content Inspection**: Log parsed theme properties and generated @source patterns
3. **Path Resolution Testing**: Verify relative path calculations are correct
4. **File Existence Checks**: Ensure theme files are found at expected locations
5. **CSS Compilation Monitoring**: Watch for 500 errors during CSS generation

### Key Architectural Insights

- **Vite dev server works perfectly in extension context** - simpler than webpack setup
- **Tailwind 4 @source directives are powerful** - but require careful pattern generation
- **Universal path resolution is critical** - avoid hardcoded project assumptions
- **Theme parsing must be robust** - handle various CSS variable naming conventions
- **Hot reloading requires file watchers** - Vite HMR doesn't detect external theme changes
- **CSP still requires localhost iframe permissions** - inherited from original implementation

### Current Working Architecture

1. **PreviewServerManager**: 
   - Manages Vite dev server lifecycle (port 5174)
   - Handles dynamic theme detection and CSS generation
   - Provides file watching for theme changes
   - Universal workspace path resolution

2. **ComponentTemplateGenerator**: 
   - Creates React entry points with proper relative imports
   - Supports any workspace structure without aliases
   - Generates clean JSX with component props

3. **Dynamic CSS Generation**:
   - Scans `src/theme/` for CSS files
   - Parses CSS variables, @theme blocks, @utility definitions
   - Generates Tailwind @source patterns for discovered properties
   - Supports colors, spacing, text sizes, fonts, and custom utilities

4. **SandboxArea**: React component with iframe for preview display

5. **Theme File Processing**:
   - Automatic discovery of theme files
   - Regex-based parsing for multiple CSS patterns
   - Deduplication of properties and imports
   - Hot reloading when theme files change

### Development Workflow

1. **Start preview server**: `PreviewServerManager.start()`
2. **Scan for themes**: Automatically detects `src/theme/*.css` files
3. **Parse theme properties**: Extract colors, spacing, utilities, etc.
4. **Generate dynamic CSS**: Create @source patterns for discovered properties
5. **Update component**: Generate entry point with relative imports
6. **Hot reload**: File watchers trigger CSS regeneration on theme changes