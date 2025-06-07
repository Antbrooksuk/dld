import * as vscode from "vscode"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { getTheme } from "@integrations/theme/getTheme"
import { Controller } from "@core/controller/index"
import { findLast } from "@shared/array"
import { readFile } from "fs/promises"
import path from "node:path"
import axios from "axios"

/**
 * TODO:
 * 1. In sidebar, show settings view
 * 2. In main window, show standard Cline chat view
 */

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
            (message) => {
                if (this.view) {
                    return this.view.webview.postMessage(message);
                }
                return undefined;
            }
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
        let html;
        if (process.env.IS_DEV) {
            html = await this.getHMRHtmlContent(webview);
        } else {
            html = await this.getHtmlForWebview(webview);
        }
        webview.html = html
        
        // Set up the message listener
        this.setWebviewMessageListener(webview)
        
        // Handle initial setup based on view type
        this.initializeViewContent(webview)
    }
    
    /**
     * Initialize the appropriate content based on view type
     * @param webview The webview to initialize
     */
    private initializeViewContent(webview: vscode.Webview): void {
        // Wait a short time to ensure the webview is ready
        setTimeout(() => {
            console.log(`Initializing ${this.isInSidebar ? 'sidebar' : 'tab'} view content`)
            this.outputChannel.appendLine(`Initializing ${this.isInSidebar ? 'sidebar' : 'tab'} view content`)
            
            // The React app will read window.IS_IN_SIDEBAR to determine which view to show
            // We don't need to send any initialization messages as the React app handles this
        }, 500) // Short delay to ensure webview is ready
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
        console.log("getHtmlForWebview called, isInSidebar:", this.isInSidebar)
        this.outputChannel.appendLine("getHtmlForWebview called, isInSidebar: " + this.isInSidebar)
        
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce()
        
        // Get the current isInSidebar value
        const isInSidebar = this.isInSidebar
        
        // Get the URI to the webview-ui-alt directory
        const webviewUri = getUri(webview, this.context.extensionUri, ["webview-ui-alt", "build"])
        
        // Get the URI to the index.js file - adjust the path based on your build output
        const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui-alt", "build", "assets", "index.js"])
        
        // Get the URI to the index.css file - adjust the path based on your build output
        const styleUri = getUri(webview, this.context.extensionUri, ["webview-ui-alt", "build", "assets", "index.css"])
        
        // Get the theme from VS Code
        const theme = getTheme()
        
        // Create the HTML content
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; connect-src https: wss: http://localhost:*; frame-src http://localhost:*;">
            <title>Cline ${isInSidebar ? 'Settings' : 'Chat'}</title>
            
            <link rel="stylesheet" type="text/css" href="${styleUri}">
            <script nonce="${nonce}">
                // Set the display context for the React app
                window.IS_IN_SIDEBAR = ${isInSidebar};
                window.acquireVsCodeApi = acquireVsCodeApi;
            </script>
        </head>
        <body class="${theme}">
            <div id="root"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`
    }

    /**
     * Connects to the local Vite dev server to allow HMR, with fallback to the bundled assets
     *
     * @param webview A reference to the extension webview
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
        const localPort = await this.getDevServerPort()
        const localServerUrl = `localhost:${localPort}`

        // Check if local dev server is running.
        try {
            await axios.get(`http://${localServerUrl}`)
        } catch (error) {
            vscode.window.showErrorMessage(
                "Cline: Local webview-alt dev server is not running, HMR will not work. Please run 'npm run dev:webview' before launching the extension to enable HMR. Using bundled assets.",
            )

            return this.getHtmlForWebview(webview)
        }

        const nonce = getNonce()
        const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui-alt", "build", "assets", "index.css"])
        const codiconsUri = getUri(webview, this.context.extensionUri, [
            "node_modules",
            "@vscode",
            "codicons",
            "dist",
            "codicon.css",
        ])

        const scriptEntrypoint = "src/main.tsx"
        const scriptUri = `http://${localServerUrl}/${scriptEntrypoint}`

        const reactRefresh = /*html*/ `
            <script nonce="${nonce}" type="module">
                import RefreshRuntime from "http://${localServerUrl}/@react-refresh"
                RefreshRuntime.injectIntoGlobalHook(window)
                window.$RefreshReg$ = () => {}
                window.$RefreshSig$ = () => (type) => type
                window.__vite_plugin_react_preamble_installed__ = true
            </script>
        `

        const csp = [
            "default-src 'none'",
            `font-src ${webview.cspSource} data:`,
            `style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
            `img-src ${webview.cspSource} https: data:`,
            `script-src 'unsafe-eval' https://* http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
            `connect-src https://* ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
            `frame-src http://localhost:*`,
        ]

        // Get the current isInSidebar value
        const isInSidebar = this.isInSidebar
        
        // Get the theme from VS Code
        const theme = getTheme()

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <script src="http://localhost:8097"></script> 
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                    <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
                    <link rel="stylesheet" type="text/css" href="${stylesUri}">
                    <link href="${codiconsUri}" rel="stylesheet" />
                    <title>Cline ${isInSidebar ? 'Settings' : 'Chat'}</title>
                    <script nonce="${nonce}">
                        // Set the display context for the React app
                        window.IS_IN_SIDEBAR = ${isInSidebar};
                        window.acquireVsCodeApi = acquireVsCodeApi;
                    </script>
                </head>
                <body class="${theme}">
                    <div id="root"></div>
                    ${reactRefresh}
                    <script type="module" src="${scriptUri}"></script>
                </body>
            </html>
        `
    }

    /**
     * Sets up message listener for the webview
     */
    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message) => {
                console.log("Message received from webview:", message)
                this.outputChannel.appendLine("Message received from webview: " + JSON.stringify(message))
                
                // Pass all messages to the controller
                this.controller.handleWebviewMessage(message)
            },
            null,
            this.disposables,
        )
    }
} 