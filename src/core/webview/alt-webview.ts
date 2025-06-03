import * as vscode from "vscode"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { getTheme } from "@integrations/theme/getTheme"
import { Controller } from "@core/controller/index"
import { findLast } from "@shared/array"
import { readFile } from "fs/promises"
import path from "node:path"

/**
 * Alternative WebviewProvider that uses a different UI implementation
 * while maintaining the same core functionality
 */
export class AltWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly sideBarId = "claude-dev.AltSidebarProvider"
    public static readonly tabPanelId = "claude-dev.AltTabPanelProvider"
    private static activeInstances: Set<AltWebviewProvider> = new Set()
    private context: vscode.ExtensionContext
    private outputChannel: vscode.OutputChannel
    private disposables: vscode.Disposable[] = []
    private webviewView?: vscode.WebviewView
    public view?: vscode.WebviewView | vscode.WebviewPanel
    public isInSidebar: boolean = false
    public controller: Controller

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context
        this.outputChannel = outputChannel
        this.controller = new Controller(
            context, 
            outputChannel, 
            (message) => this.webviewView?.webview.postMessage(message)
        )
        AltWebviewProvider.activeInstances.add(this)
    }

    async dispose() {
        if (this.webviewView) {
            // Type assertion to handle the dispose method
            (this.webviewView as unknown as { dispose: () => void }).dispose();
        }
        if (this.view) {
            // Type assertion to handle the dispose method
            (this.view as unknown as { dispose: () => void }).dispose();
        }
        while (this.disposables.length) {
            const disposable = this.disposables.pop()
            if (disposable) {
                disposable.dispose()
            }
        }
        await this.controller.dispose()
        AltWebviewProvider.activeInstances.delete(this)
    }

    public static getVisibleInstance(): AltWebviewProvider | undefined {
        return findLast(Array.from(this.activeInstances), (instance) => instance.webviewView?.visible === true)
    }

    public static getAllInstances(): AltWebviewProvider[] {
        return Array.from(this.activeInstances)
    }

    public static getSidebarInstance() {
        return Array.from(this.activeInstances).find((instance) => instance.webviewView && "onDidChangeVisibility" in instance.webviewView)
    }

    public static getTabInstances(): AltWebviewProvider[] {
        return Array.from(this.activeInstances).filter((instance) => instance.webviewView && "onDidChangeViewState" in instance.webviewView)
    }

    public static async disposeAllInstances() {
        const instances = Array.from(this.activeInstances)
        for (const instance of instances) {
            await instance.dispose()
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): void | Thenable<void> {
        this.webviewView = webviewView
        this.view = webviewView
        this.isInSidebar = true
        
        console.log("resolveWebviewView called for AltWebviewProvider")
        this.outputChannel.appendLine("resolveWebviewView called for AltWebviewProvider")

        this.setupWebview(webviewView.webview)
    }

    /**
     * Sets up a webview with the necessary options and content
     * @param webview The webview to set up
     * @param panel Optional WebviewPanel for tab view
     */
    public async setupWebview(webview: vscode.Webview, panel?: vscode.WebviewPanel): Promise<void> {
        if (panel) {
            this.view = panel;
            this.isInSidebar = false;
        }
        
        // Set webview options
        webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        }
        
        // Set the HTML content
        const html = await this.getHtmlForWebview(webview)
        webview.html = html
        
        // Handle messages from the webview
        webview.onDidReceiveMessage(
            message => {
                console.log("Message received from webview:", message)
                this.outputChannel.appendLine("Message received from webview: " + JSON.stringify(message))
                
                switch (message.type) {
                    case 'ready':
                        // Webview is ready, send a response
                        webview.postMessage({ type: 'response', text: 'Extension received your message' })
                        // Send different initialization based on sidebar status
                        if (this.isInSidebar) {
                            webview.postMessage({ type: 'action', action: 'settingsButtonClicked' })
                        } else {
                            webview.postMessage({ type: 'action', action: 'chatButtonClicked' })
                        }
                        break
                }
            },
            undefined,
            this.disposables
        )
    }

    /**
     * Gets the dev server port for development mode
     */
    private getDevServerPort(): Promise<number> {
        const DEFAULT_PORT = 25463

        const portFilePath = path.join(__dirname, "..", "webview-ui-alt", ".vite-port")

        return readFile(portFilePath, "utf8")
            .then((portFile) => {
                const port = parseInt(portFile.trim()) || DEFAULT_PORT
                console.info(`[getDevServerPort] Using dev server port ${port} from .vite-port file`)

                return port
            })
            .catch((err) => {
                console.warn(
                    `[getDevServerPort] Port file not found or couldn't be read at ${portFilePath}, using default port: ${DEFAULT_PORT}`,
                )
                return DEFAULT_PORT
            })
    }

    /**
     * Gets the HTML content for the webview
     * @param webview The webview to get HTML for
     * @returns The HTML content
     */
    public async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        // For debugging, use a simple HTML content
        console.log("getHtmlForWebview called, isInSidebar:", this.isInSidebar)
        this.outputChannel.appendLine("getHtmlForWebview called, isInSidebar: " + this.isInSidebar)
        
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce()
        
        // Get the current isInSidebar value
        const isInSidebar = this.isInSidebar
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <title>Cline Alt UI</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: white;
                    background-color: ${isInSidebar ? '#1e1e1e' : '#2d2d2d'};
                }
                h1 {
                    color: ${isInSidebar ? '#0078d7' : '#00b7c3'};
                }
            </style>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                window.IS_IN_SIDEBAR = ${isInSidebar};
                
                window.addEventListener('load', () => {
                    document.getElementById('info').textContent = 'Is in sidebar: ' + window.IS_IN_SIDEBAR;
                    document.getElementById('title').textContent = window.IS_IN_SIDEBAR ? 'Cline Settings (Sidebar)' : 'Cline Chat (Tab)';
                    
                    // Send a message to the extension
                    vscode.postMessage({
                        type: 'ready',
                        text: 'Webview is ready'
                    });
                });
            </script>
        </head>
        <body>
            <h1 id="title">Cline Alt UI - Debug</h1>
            <p>This is a simple HTML content for debugging.</p>
            <p id="info">Loading...</p>
        </body>
        </html>`
    }

    /**
     * Sets up message listener for the webview
     */
    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message) => {
                this.controller.handleWebviewMessage(message)
            },
            null,
            this.disposables,
        )
    }
} 