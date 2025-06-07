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
   * Update the component being previewed
   * This will regenerate the entry point and trigger a reload
   */
  public async updateComponent(componentInfo: ComponentInfo): Promise<void> {
    try {
      console.log(`Updating preview component: ${componentInfo.name}`);
      
      // Store the current component
      this.currentComponent = componentInfo;
      
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
   * Dispose of the server manager
   */
  public dispose(): void {
    if (this.viteServer) {
      this.stop().catch(console.error);
    }
    PreviewServerManager.instance = undefined;
  }
}