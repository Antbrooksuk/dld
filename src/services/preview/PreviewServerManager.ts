import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import { createPreviewWebpackConfig } from '../../preview/webpack.config';
import { ComponentTemplateGenerator } from './ComponentTemplateGenerator';
import { ComponentInfo } from '../../shared/preview-types';

/**
 * Manages the webpack dev server for component previews
 * Based on react-preview-extension architecture
 */
export class PreviewServerManager {
  private static instance: PreviewServerManager | undefined;
  private devServer: WebpackDevServer | undefined;
  private compiler: webpack.Compiler | undefined;
  private readonly port = 9132;
  private readonly host = 'localhost';
  private isStarting = false;
  private currentComponent: ComponentInfo | undefined;

  private constructor(
    private readonly extensionPath: string,
    private readonly workspacePath: string
  ) {}

  public static getInstance(extensionPath: string, workspacePath: string): PreviewServerManager {
    if (!PreviewServerManager.instance) {
      PreviewServerManager.instance = new PreviewServerManager(extensionPath, workspacePath);
    }
    return PreviewServerManager.instance;
  }

  /**
   * Start the webpack dev server
   */
  public async start(): Promise<void> {
    if (this.devServer || this.isStarting) {
      console.log('Preview server already running or starting');
      return;
    }

    this.isStarting = true;
    
    try {
      console.log('Starting preview server...');
      
      // Create webpack configuration
      const config = createPreviewWebpackConfig(this.extensionPath, this.workspacePath);
      
      // Create compiler
      this.compiler = webpack(config);
      
      // Create dev server
      const devServerOptions = { ...config.devServer, open: false };
      this.devServer = new WebpackDevServer(devServerOptions, this.compiler);
      
      // Start the server
      await new Promise<void>((resolve, reject) => {
        this.devServer!.startCallback((err) => {
          if (err) {
            console.error('Failed to start preview server:', err);
            reject(err);
          } else {
            console.log(`✅ Preview server started on http://${this.host}:${this.port}`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error starting preview server:', error);
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop the webpack dev server
   */
  public async stop(): Promise<void> {
    if (!this.devServer) {
      console.log('Preview server not running');
      return;
    }

    try {
      console.log('Stopping preview server...');
      
      await new Promise<void>((resolve) => {
        this.devServer!.stopCallback(() => {
          console.log('✅ Preview server stopped');
          resolve();
        });
      });
      
      this.devServer = undefined;
      this.compiler = undefined;
    } catch (error) {
      console.error('Error stopping preview server:', error);
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
    return this.devServer !== undefined;
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
      const entryPointPath = path.resolve(this.extensionPath, 'preview', 'index.js');
      fs.writeFileSync(entryPointPath, template);
      
      console.log('✅ Component entry point updated');
      
      // If server is running, webpack will automatically detect the change and reload
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
      const entryPointPath = path.resolve(this.extensionPath, 'preview', 'index.js');
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
    if (this.devServer) {
      this.stop().catch(console.error);
    }
    PreviewServerManager.instance = undefined;
  }
}