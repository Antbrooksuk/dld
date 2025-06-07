import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// Import Vite dynamically to avoid import-time issues
import type { ViteDevServer } from 'vite';
import { ComponentTemplateGenerator } from './ComponentTemplateGenerator';
import { ComponentInfo } from '../../shared/preview-types';

/**
 * Manages the Vite dev server for component previews
 */
export class PreviewServerManager {
  private static instance: PreviewServerManager | undefined;
  private viteServer: ViteDevServer | undefined;
  private readonly port = 5174;
  private readonly host = 'localhost';
  private isStarting = false;
  private currentComponent: ComponentInfo | undefined;
  private themeWatcher: fs.FSWatcher | undefined;

  private constructor(
    private readonly extensionPath: string,
    private readonly workspacePath: string,
    private readonly outputChannel?: any
  ) {
    // Validate paths in constructor
    if (!extensionPath || typeof extensionPath !== 'string') {
      throw new Error(`Invalid extensionPath: ${extensionPath}`);
    }
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error(`Invalid workspacePath: ${workspacePath}`);
    }
  }

  public static getInstance(extensionPath: string, workspacePath: string): PreviewServerManager {
    if (!PreviewServerManager.instance) {
      // Validate paths before creating instance
      if (!extensionPath || !workspacePath) {
        throw new Error('PreviewServerManager requires valid extensionPath and workspacePath');
      }
      PreviewServerManager.instance = new PreviewServerManager(extensionPath, workspacePath);
    }
    return PreviewServerManager.instance;
  }

  /**
   * Start the Vite dev server
   */
  public async start(): Promise<void> {
    if (this.viteServer || this.isStarting) {
      console.log('Preview server already running or starting');
      return;
    }

    this.isStarting = true;
    
    try {
      console.log('Starting Vite preview server...');
      console.log('Extension path:', this.extensionPath);
      console.log('Workspace path:', this.workspacePath);
      
      const previewRoot = path.resolve(this.extensionPath, 'preview');
      console.log('Preview root:', previewRoot);
      
      // Check if preview directory exists
      try {
        const stat = fs.statSync(previewRoot);
        console.log('Preview directory exists:', stat.isDirectory());
        const files = fs.readdirSync(previewRoot);
        console.log('Preview directory contents:', files);
      } catch (error) {
        console.error('Preview directory check failed:', error);
        throw new Error(`Preview directory does not exist at: ${previewRoot}`);
      }
      
      // Dynamically import Vite to avoid import-time issues
      const { createServer } = await import('vite');
      const react = (await import('@vitejs/plugin-react')).default;
      
      // Create Vite server configuration
      console.log('About to call createServer with previewRoot:', previewRoot);
      
      this.viteServer = await createServer({
        root: previewRoot,
        plugins: [react()],
        server: {
          port: this.port,
          host: this.host,
          strictPort: true,
          open: false
        },
        css: {
          postcss: {
            plugins: [
              (await import('@tailwindcss/postcss')).default()
            ]
          }
        }
      });
      
      console.log('createServer succeeded, viteServer created');
      
      // Start the server
      await this.viteServer.listen(this.port);
      
      console.log(`✅ Vite preview server started on http://${this.host}:${this.port}`);
      
      // Start watching theme files for changes
      this.startThemeWatcher();
    } catch (error) {
      console.error('Error starting Vite preview server:', error);
      console.error('Extension path was:', this.extensionPath);
      console.error('Workspace path was:', this.workspacePath);
      this.viteServer = undefined;
      throw new Error(`Failed to start Vite server: ${error.message}. Extension path: ${this.extensionPath}, Workspace path: ${this.workspacePath}`);
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop the Vite dev server
   */
  public async stop(): Promise<void> {
    if (!this.viteServer) {
      console.log('Preview server not running');
      return;
    }

    try {
      console.log('Stopping Vite preview server...');
      
      // Stop theme watcher
      this.stopThemeWatcher();
      
      await this.viteServer.close();
      this.viteServer = undefined;
      
      console.log('✅ Vite preview server stopped');
    } catch (error) {
      console.error('Error stopping Vite preview server:', error);
      throw error;
    }
  }

  /**
   * Get the server URL
   */
  public getServerUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.viteServer !== undefined;
  }

  /**
   * Scan workspace theme folder and update CSS dynamically
   */
  private async updateTailwindCssWithThemes(): Promise<void> {
    try {
      console.log('Scanning workspace for theme files...');
      
      const foundThemes: string[] = [];
      const themeFolderPath = path.join(this.workspacePath, 'src', 'theme');
      
      if (fs.existsSync(themeFolderPath)) {
        console.log(`Found theme folder: ${themeFolderPath}`);
        
        const files = fs.readdirSync(themeFolderPath);
        const cssFiles = files.filter(file => file.endsWith('.css'));
        
        for (const file of cssFiles) {
          const aliasPath = `@dld-skeleton/theme/${file}`;
          foundThemes.push(aliasPath);
          console.log(`Found theme file: ${aliasPath}`);
        }
      } else {
        console.log('No theme folder found at src/theme');
      }
      
      // Generate the CSS content with dynamic imports
      const cssContent = await this.generateDynamicTailwindCss(foundThemes);
      
      // Write the updated CSS file
      const cssPath = path.resolve(this.extensionPath, 'preview', 'tailwind.css');
      fs.writeFileSync(cssPath, cssContent);
      
      console.log(`✅ Updated tailwind.css with ${foundThemes.length} theme imports`);
      
    } catch (error) {
      console.error('Error updating Tailwind CSS with themes:', error);
      // Continue with default CSS if theme detection fails
    }
  }

  /**
   * Parse CSS content to extract custom theme properties
   */
  private parseCustomThemeProperties(cssContent: string): {
    colors: Set<string>;
    spacing: Set<string>;
    textSizes: Set<string>;
    fonts: Set<string>;
  } {
    const colors = new Set<string>();
    const spacing = new Set<string>();
    const textSizes = new Set<string>();
    const fonts = new Set<string>();
    
    // Parse CSS variables like --color-primary-500, --spacing-3xl, etc.
    const cssVarRegex = /--([a-zA-Z][a-zA-Z0-9-]*)-([a-zA-Z0-9-]+):/g;
    let match;
    while ((match = cssVarRegex.exec(cssContent)) !== null) {
      const category = match[1];
      const name = match[2];
      
      if (category === 'color') {
        colors.add(name);
      } else if (category === 'spacing' || category === 'size') {
        spacing.add(name);
      } else if (category === 'text' || category === 'font-size') {
        textSizes.add(name);
      } else if (category === 'font' || category === 'font-family') {
        fonts.add(name);
      } else if (/^\d{2,3}$|^(50|950)$/.test(name)) {
        // This looks like a color scale (e.g., --primary-500)
        colors.add(category);
      }
    }
    
    // Parse @theme blocks looking for various property definitions
    const themeBlockRegex = /@theme\s+inline\s*\{([^}]+)\}/g;
    let themeMatch;
    while ((themeMatch = themeBlockRegex.exec(cssContent)) !== null) {
      const themeContent = themeMatch[1];
      
      // Colors: --color-primary-500
      const colorRegex = /--color-([a-zA-Z][a-zA-Z0-9-]*)-(?:\d{2,3}|50|950):/g;
      let colorMatch;
      while ((colorMatch = colorRegex.exec(themeContent)) !== null) {
        colors.add(colorMatch[1]);
      }
      
      // Spacing: --spacing-3xl, --size-massive
      const spacingRegex = /--(?:spacing|size)-([a-zA-Z0-9]+):/g;
      let spacingMatch;
      while ((spacingMatch = spacingRegex.exec(themeContent)) !== null) {
        spacing.add(spacingMatch[1]);
      }
      
      // Text sizes: --text-10xl, --font-size-massive
      const textRegex = /--(?:text|font-size)-([a-zA-Z0-9]+):/g;
      let textMatch;
      while ((textMatch = textRegex.exec(themeContent)) !== null) {
        textSizes.add(textMatch[1]);
      }
      
      // Fonts: --font-brand, --font-family-display
      const fontRegex = /--(?:font|font-family)-([a-zA-Z0-9-]+):/g;
      let fontMatch;
      while ((fontMatch = fontRegex.exec(themeContent)) !== null) {
        fonts.add(fontMatch[1]);
      }
    }
    
    console.log('Extracted custom properties:', {
      colors: Array.from(colors),
      spacing: Array.from(spacing),
      textSizes: Array.from(textSizes),
      fonts: Array.from(fonts)
    });
    
    return { colors, spacing, textSizes, fonts };
  }

  /**
   * Generate dynamic Tailwind CSS content with theme imports and parsed properties
   */
  private async generateDynamicTailwindCss(themeImports: string[]): Promise<string> {
    const imports = themeImports.map(theme => `@import "${theme}";`).join('\n');
    
    // Parse all theme files to extract custom properties
    const allCustomColors = new Set<string>();
    const allCustomSpacing = new Set<string>();
    const allCustomTextSizes = new Set<string>();
    const allCustomFonts = new Set<string>();
    
    for (const themeImport of themeImports) {
      try {
        // Convert alias path back to file system path
        const aliasPath = themeImport.replace('@dld-skeleton/', '');
        const filePath = path.join(this.workspacePath, 'src', aliasPath);
        
        if (fs.existsSync(filePath)) {
          const cssContent = fs.readFileSync(filePath, 'utf8');
          const { colors, spacing, textSizes, fonts } = this.parseCustomThemeProperties(cssContent);
          
          colors.forEach(color => allCustomColors.add(color));
          spacing.forEach(size => allCustomSpacing.add(size));
          textSizes.forEach(size => allCustomTextSizes.add(size));
          fonts.forEach(font => allCustomFonts.add(font));
        }
      } catch (error) {
        console.log(`Could not parse theme file ${themeImport}:`, error.message);
      }
    }
    
    // Generate dynamic @source patterns for discovered properties
    const customColorList = Array.from(allCustomColors);
    const customSpacingList = Array.from(allCustomSpacing);
    const customTextSizesList = Array.from(allCustomTextSizes);
    const customFontsList = Array.from(allCustomFonts);
    
    // Colors
    const allColors = [
      'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 
      'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 
      'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone',
      ...customColorList
    ];
    
    // Spacing (add to standard spacing scale)
    const allSpacing = [
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 
      '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', 
      '60', '64', '72', '80', '96',
      ...customSpacingList
    ];
    
    // Text sizes (add to standard text sizes)
    const allTextSizes = [
      'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
      ...customTextSizesList
    ];
    
    // Fonts (add to standard fonts)
    const allFonts = [
      'sans', 'serif', 'mono',
      ...customFontsList
    ];
    
    const dynamicColorPatterns = customColorList.length > 0 ? `
/* Dynamic color patterns for discovered custom colors: ${customColorList.join(', ')} */
@source inline('bg-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('text-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('hover:bg-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('border-{${allColors.join(',')}}-{50,100,200,300,400,500,600,700,800,900,950}');` : `
/* No custom colors found, using standard Tailwind colors */
@source inline('bg-{red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose,slate,gray,zinc,neutral,stone}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('text-{red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose,slate,gray,zinc,neutral,stone}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('hover:bg-{red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose,slate,gray,zinc,neutral,stone}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('border-{red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose,slate,gray,zinc,neutral,stone}-{50,100,200,300,400,500,600,700,800,900,950}');`;

    const dynamicSpacingPatterns = customSpacingList.length > 0 ? `
/* Dynamic spacing patterns for discovered custom sizes: ${customSpacingList.join(', ')} */
@source inline('px-{${allSpacing.join(',')}}');
@source inline('py-{${allSpacing.join(',')}}');
@source inline('p-{${allSpacing.join(',')}}');
@source inline('m-{${allSpacing.join(',')}}');` : '';

    const dynamicTextPatterns = customTextSizesList.length > 0 ? `
/* Dynamic text size patterns for discovered custom sizes: ${customTextSizesList.join(', ')} */
@source inline('text-{${allTextSizes.join(',')}}');` : '';

    const dynamicFontPatterns = customFontsList.length > 0 ? `
/* Dynamic font patterns for discovered custom fonts: ${customFontsList.join(', ')} */
@source inline('font-{${allFonts.join(',')}}');` : '';
    
    return `@import "tailwindcss";
${imports}

/* Include common utility patterns used in external components */
${dynamicSpacingPatterns || `@source inline('px-{0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}');
@source inline('py-{0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}');
@source inline('p-{0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}');
@source inline('m-{0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}');`}
${dynamicColorPatterns}
${dynamicTextPatterns || `@source inline('text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,8xl,9xl}');`}
${dynamicFontPatterns || `@source inline('font-{sans,serif,mono}');`}
@source inline('text-{white,black}');
@source inline('rounded{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('{flex,grid,block,inline,inline-block,inline-flex,inline-grid,hidden}');
@source inline('{items,justify}-{start,end,center,stretch,between,around,evenly}');
@source inline('min-h-{screen,full,fit,min,max}');
@source inline('{fixed,absolute,relative,static,sticky}');
@source inline('{top,right,bottom,left}-{0,1,2,3,4,5,6,7,8,9,10,11,12,auto}');
@source inline('bg-opacity-{0,5,10,20,25,30,40,50,60,70,75,80,90,95,100}');
@source inline('font-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}');
@source inline('{sm:,md:,lg:,xl:,2xl:}grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12}');
@source inline('{sm:,md:,lg:,xl:,2xl:}gap-{0,1,2,3,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32}');
`;
  }

  /**
   * Update the component being previewed
   * This will regenerate the entry point and trigger a reload
   */
  public async updateComponent(componentInfo: ComponentInfo): Promise<void> {
    try {
      console.log(`Updating preview component: ${componentInfo.name}`);
      
      // Store the current component
      this.currentComponent = componentInfo;
      
      // Update CSS with any themes before generating component
      await this.updateTailwindCssWithThemes();
      
      // Generate the new entry point
      const template = ComponentTemplateGenerator.generateTemplate(
        componentInfo.path,
        componentInfo.name,
        componentInfo.props
      );
      
      // Write the entry point file
      const entryPointPath = path.resolve(this.extensionPath, 'preview', 'index.jsx');
      fs.writeFileSync(entryPointPath, template);
      
      console.log('✅ Component entry point updated');
      
      // Vite will automatically detect the change and reload via HMR
    } catch (error) {
      console.error('Error updating component:', error);
      throw error;
    }
  }

  /**
   * Update component props without changing the component
   */
  public async updateComponentProps(props: ComponentInfo['props']): Promise<void> {
    if (!this.currentComponent) {
      throw new Error('No component currently loaded');
    }

    await this.updateComponent({
      ...this.currentComponent,
      props
    });
  }

  /**
   * Set a test component for debugging
   */
  public async setTestComponent(message?: string): Promise<void> {
    try {
      console.log('Setting test component for preview');
      
      // Generate test template
      const template = ComponentTemplateGenerator.generateTestTemplate(message);
      
      // Write the entry point file
      const entryPointPath = path.resolve(this.extensionPath, 'preview', 'index.jsx');
      fs.writeFileSync(entryPointPath, template);
      
      // Clear current component
      this.currentComponent = undefined;
      
      console.log('✅ Test component set');
    } catch (error) {
      console.error('Error setting test component:', error);
      throw error;
    }
  }

  /**
   * Get the currently previewed component
   */
  public getCurrentComponent(): ComponentInfo | undefined {
    return this.currentComponent;
  }

  /**
   * Start watching theme files for changes
   */
  private startThemeWatcher(): void {
    try {
      const themeFolderPath = path.join(this.workspacePath, 'src', 'theme');
      
      if (!fs.existsSync(themeFolderPath)) {
        console.log('No theme folder found, skipping theme watcher');
        return;
      }
      
      console.log('Starting theme file watcher...');
      
      this.themeWatcher = fs.watch(themeFolderPath, { recursive: true }, (_eventType, filename) => {
        if (filename && filename.endsWith('.css')) {
          console.log(`Theme file changed: ${filename}`);
          this.onThemeFileChanged();
        }
      });
      
      console.log('✅ Theme file watcher started');
    } catch (error) {
      console.error('Error starting theme watcher:', error);
    }
  }

  /**
   * Stop watching theme files
   */
  private stopThemeWatcher(): void {
    if (this.themeWatcher) {
      this.themeWatcher.close();
      this.themeWatcher = undefined;
      console.log('✅ Theme file watcher stopped');
    }
  }

  /**
   * Handle theme file changes by regenerating CSS
   */
  private async onThemeFileChanged(): Promise<void> {
    try {
      console.log('Regenerating CSS due to theme file change...');
      await this.updateTailwindCssWithThemes();
      console.log('✅ CSS regenerated successfully');
    } catch (error) {
      console.error('Error regenerating CSS after theme change:', error);
    }
  }

  /**
   * Dispose of the server manager
   */
  public dispose(): void {
    this.stopThemeWatcher();
    if (this.viteServer) {
      this.stop().catch(console.error);
    }
    PreviewServerManager.instance = undefined;
  }
}