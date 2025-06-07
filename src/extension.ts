// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { setTimeout as setTimeoutPromise } from "node:timers/promises"
import * as vscode from "vscode"
import * as path from "path"
import pWaitFor from "p-wait-for"
import { Logger } from "./services/logging/Logger"
import { createClineAPI } from "./exports"
import "./utils/path" // necessary to have access to String.prototype.toPosix
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import assert from "node:assert"
import { posthogClientProvider } from "./services/posthog/PostHogClientProvider"
import { WebviewProvider } from "./core/webview"
import { AltWebviewProvider } from "./core/webview/alt-webview"
import { Controller } from "./core/controller"
import { ErrorService } from "./services/error/ErrorService"
import { initializeTestMode, cleanupTestMode } from "./services/test/TestMode"
import { telemetryService } from "./services/posthog/telemetry/TelemetryService"
import { v4 as uuidv4 } from "uuid"
import { PreviewServerManager } from "./services/preview/PreviewServerManager"

/*
Built using https://github.com/microsoft/vscode-webview-ui-toolkit

Inspired by
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra

*/

let outputChannel: vscode.OutputChannel

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel("Cline")
	context.subscriptions.push(outputChannel)

	ErrorService.initialize()
	Logger.initialize(outputChannel)
	Logger.log("Cline extension activated")

	// Version checking for autoupdate notification
	const currentVersion = context.extension.packageJSON.version
	const previousVersion = context.globalState.get<string>("clineVersion")
	// Create only the alt sidebar webview
	const altSidebarWebview = new AltWebviewProvider(context, outputChannel)
	
	// Add debug logging
	console.log("AltWebviewProvider created", AltWebviewProvider.sideBarId)
	outputChannel.appendLine("AltWebviewProvider created with ID: " + AltWebviewProvider.sideBarId)

	// Initialize test mode and add disposables to context
	context.subscriptions.push(...initializeTestMode(context, altSidebarWebview))

	vscode.commands.executeCommand("setContext", "cline.isDevMode", IS_DEV && IS_DEV === "true")

	// Register only the alt sidebar webview
	console.log("Registering AltWebviewProvider with ID:", AltWebviewProvider.sideBarId)
	outputChannel.appendLine("Registering AltWebviewProvider with ID: " + AltWebviewProvider.sideBarId)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AltWebviewProvider.sideBarId, altSidebarWebview, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)
	
	console.log("AltWebviewProvider registered")
	outputChannel.appendLine("AltWebviewProvider registered")

	// Add command to open AltWebviewProvider in a tab
	context.subscriptions.push(
		vscode.commands.registerCommand("claude-dev.openAltWebview", async () => {
			console.log("Opening AltWebviewProvider in tab")
			outputChannel.appendLine("Opening AltWebviewProvider in tab")
			
			// Create a new panel
			const panel = vscode.window.createWebviewPanel(
				AltWebviewProvider.tabPanelId,
				"Cline Alt",
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [context.extensionUri]
				}
			);
			
			// Create a new instance of AltWebviewProvider for the tab
			const altTabWebview = new AltWebviewProvider(context, outputChannel);
			
			// Set the HTML content and handle messages using the setupWebview method
			await altTabWebview.setupWebview(panel.webview, panel);
			
			// Set isInSidebar to false for the tab view
			altTabWebview.isInSidebar = false;
		})
	);

	// Perform post-update actions if necessary
	try {
		if (!previousVersion || currentVersion !== previousVersion) {
			Logger.log(`Cline version changed: ${previousVersion} -> ${currentVersion}. First run or update detected.`)
			const lastShownPopupNotificationVersion = context.globalState.get<string>("clineLastPopupNotificationVersion")

			if (currentVersion !== lastShownPopupNotificationVersion && previousVersion) {
				// Show VS Code popup notification as this version hasn't been notified yet without doing it for fresh installs
				const message = `Cline has been updated to v${currentVersion}`
				await vscode.commands.executeCommand("claude-dev.AltSidebarProvider.focus")
				await new Promise((resolve) => setTimeout(resolve, 200))
				vscode.window.showInformationMessage(message)
				// Record that we've shown the popup for this version.
				await context.globalState.update("clineLastPopupNotificationVersion", currentVersion)
			}
			// Always update the main version tracker for the next launch.
			await context.globalState.update("clineVersion", currentVersion)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`Error during post-update actions: ${errorMessage}, Stack trace: ${error.stack}`)
	}

	// backup id in case vscMachineID doesn't work
	let installId = context.globalState.get<string>("installId")

	if (!installId) {
		installId = uuidv4()
		await context.globalState.update("installId", installId)
	}

	telemetryService.captureExtensionActivated(installId)

	// Use only the alt webview for opening in a new tab
	const openClineInNewTab = async () => {
		Logger.log("Opening Cline Alt in new tab")
		const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One
		
		// Get existing sidebar instance if available
		const sidebarInstance = AltWebviewProvider.getSidebarInstance()
		
		// Create panel in the active editor column
		const panel = vscode.window.createWebviewPanel(
			AltWebviewProvider.tabPanelId,
			"Cline",
			column,
			{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
			},
		)
		
		if (sidebarInstance) {
			// If there's a sidebar instance, reuse its controller
			sidebarInstance.setupWebview(panel.webview, panel)
			sidebarInstance.isInSidebar = false
		} else {
			// Otherwise create a new instance
			const provider = new AltWebviewProvider(context, outputChannel)
			provider.setupWebview(panel.webview, panel)
			provider.isInSidebar = false
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand("cline.popoutButtonClicked", openClineInNewTab))
	context.subscriptions.push(vscode.commands.registerCommand("cline.openInNewTab", openClineInNewTab))
	context.subscriptions.push(vscode.commands.registerCommand("cline.openAltInNewTab", openClineInNewTab))

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.settingsButtonClicked", (webview: any) => {
			AltWebviewProvider.getAllInstances().forEach((instance) => {
				const openSettings = async (instance?: AltWebviewProvider) => {
					instance?.controller.postMessageToWebview({
						type: "action",
						action: "settingsButtonClicked",
					})
				}
				const isSidebar = !webview
				if (isSidebar) {
					openSettings(AltWebviewProvider.getSidebarInstance())
				} else {
					AltWebviewProvider.getTabInstances().forEach(openSettings)
				}
			})
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.historyButtonClicked", (webview: any) => {
			AltWebviewProvider.getAllInstances().forEach((instance) => {
				const openHistory = async (instance?: AltWebviewProvider) => {
					instance?.controller.postMessageToWebview({
						type: "action",
						action: "historyButtonClicked",
					})
				}
				const isSidebar = !webview
				if (isSidebar) {
					openHistory(AltWebviewProvider.getSidebarInstance())
				} else {
					AltWebviewProvider.getTabInstances().forEach(openHistory)
				}
			})
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.accountButtonClicked", (webview: any) => {
			AltWebviewProvider.getAllInstances().forEach((instance) => {
				const openAccount = async (instance?: AltWebviewProvider) => {
					instance?.controller.postMessageToWebview({
						type: "action",
						action: "accountButtonClicked",
					})
				}
				const isSidebar = !webview
				if (isSidebar) {
					openAccount(AltWebviewProvider.getSidebarInstance())
				} else {
					AltWebviewProvider.getTabInstances().forEach(openAccount)
				}
			})
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.plusButtonClicked", async (webview: any) => {
			const openChat = async (instance?: AltWebviewProvider) => {
				await instance?.controller.clearTask()
				await instance?.controller.postStateToWebview()
				await instance?.controller.postMessageToWebview({
					type: "action",
					action: "chatButtonClicked",
				})
			}
			const isSidebar = !webview
			if (isSidebar) {
				openChat(AltWebviewProvider.getSidebarInstance())
			} else {
				AltWebviewProvider.getTabInstances().forEach(openChat)
			}
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.mcpButtonClicked", (webview: any) => {
			const openMcp = (instance?: AltWebviewProvider) =>
				instance?.controller.postMessageToWebview({
					type: "action",
					action: "mcpButtonClicked",
				})
			const isSidebar = !webview
			if (isSidebar) {
				openMcp(AltWebviewProvider.getSidebarInstance())
			} else {
				AltWebviewProvider.getTabInstances().forEach(openMcp)
			}
		}),
	)

	/*
	We use the text document content provider API to show the left side for diff view by creating a virtual document for the original content. This makes it readonly so users know to edit the right side if they want to keep their changes.

	- This API allows you to create readonly documents in VSCode from arbitrary sources, and works by claiming an uri-scheme for which your provider then returns text contents. The scheme must be provided when registering a provider and cannot change afterwards.
	- Note how the provider doesn't create uris for virtual documents - its role is to provide contents given such an uri. In return, content providers are wired into the open document logic so that providers are always considered.
	https://code.visualstudio.com/api/extension-guides/virtual-documents
	*/
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider))

	// URI Handler
	const handleUri = async (uri: vscode.Uri) => {
		console.log("URI Handler called with:", {
			path: uri.path,
			query: uri.query,
			scheme: uri.scheme,
		})

		const path = uri.path
		const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
		const visibleWebview = AltWebviewProvider.getVisibleInstance()
		if (!visibleWebview) {
			return
		}
		switch (path) {
			case "/openrouter": {
				const code = query.get("code")
				if (code) {
					await visibleWebview?.controller.handleOpenRouterCallback(code)
				}
				break
			}
			case "/auth": {
				const token = query.get("token")
				const state = query.get("state")
				const apiKey = query.get("apiKey")

				console.log("Auth callback received:", {
					token: token,
					state: state,
					apiKey: apiKey,
				})

				// Validate state parameter
				if (!(await visibleWebview?.controller.validateAuthState(state))) {
					vscode.window.showErrorMessage("Invalid auth state")
					return
				}

				if (token && apiKey) {
					await visibleWebview?.controller.handleAuthCallback(token, apiKey)
				}
				break
			}
			default:
				break
		}
	}
	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register size testing commands in development mode
	if (IS_DEV && IS_DEV === "true") {
		// Use dynamic import to avoid loading the module in production
		import("./dev/commands/tasks")
			.then((module) => {
				const devTaskCommands = module.registerTaskCommands(context, altSidebarWebview.controller)
				context.subscriptions.push(...devTaskCommands)
				Logger.log("Cline dev task commands registered")
			})
			.catch((error) => {
				Logger.log("Failed to register dev task commands: " + error)
			})
	}

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.addToChat", async (range?: vscode.Range, diagnostics?: vscode.Diagnostic[]) => {
			await vscode.commands.executeCommand("cline.focusChatInput") // Ensure Cline is visible and input focused
			await pWaitFor(() => !!AltWebviewProvider.getVisibleInstance())
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				return
			}

			// Use provided range if available, otherwise use current selection
			// (vscode command passes an argument in the first param by default, so we need to ensure it's a Range object)
			const textRange = range instanceof vscode.Range ? range : editor.selection
			const selectedText = editor.document.getText(textRange)

			if (!selectedText) {
				return
			}

			// Get the file path and language ID
			const filePath = editor.document.uri.fsPath
			const languageId = editor.document.languageId

			const visibleWebview = AltWebviewProvider.getVisibleInstance()
			await visibleWebview?.controller.addSelectedCodeToChat(
				selectedText,
				filePath,
				languageId,
				Array.isArray(diagnostics) ? diagnostics : undefined,
			)
			telemetryService.captureButtonClick("codeAction_addToChat", visibleWebview?.controller.task?.taskId, true)
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.addTerminalOutputToChat", async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				return
			}

			// Save current clipboard content
			const tempCopyBuffer = await vscode.env.clipboard.readText()

			try {
				// Copy the *existing* terminal selection (without selecting all)
				await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

				// Get copied content
				let terminalContents = (await vscode.env.clipboard.readText()).trim()

				// Restore original clipboard content
				await vscode.env.clipboard.writeText(tempCopyBuffer)

				if (!terminalContents) {
					// No terminal content was copied (either nothing selected or some error)
					return
				}

				// [Optional] Any additional logic to process multi-line content can remain here
				// For example:
				/*
				const lines = terminalContents.split("\n")
				const lastLine = lines.pop()?.trim()
				if (lastLine) {
					let i = lines.length - 1
					while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
						i--
					}
					terminalContents = lines.slice(Math.max(i, 0)).join("\n")
				}
				*/

				// Send to sidebar provider
				const visibleWebview = AltWebviewProvider.getVisibleInstance()
				await visibleWebview?.controller.addSelectedTerminalOutputToChat(terminalContents, terminal.name)
			} catch (error) {
				// Ensure clipboard is restored even if an error occurs
				await vscode.env.clipboard.writeText(tempCopyBuffer)
				console.error("Error getting terminal contents:", error)
				vscode.window.showErrorMessage("Failed to get terminal contents")
			}
		}),
	)

	const CONTEXT_LINES_TO_EXPAND = 3
	const START_OF_LINE_CHAR_INDEX = 0
	const LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING = 1

	// Register code action provider
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			"*",
			new (class implements vscode.CodeActionProvider {
				public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Refactor]

				provideCodeActions(
					document: vscode.TextDocument,
					range: vscode.Range,
					context: vscode.CodeActionContext,
				): vscode.CodeAction[] {
					const actions: vscode.CodeAction[] = []
					const editor = vscode.window.activeTextEditor // Get active editor for selection check

					// Expand range to include surrounding 3 lines or use selection if broader
					const selection = editor?.selection
					let expandedRange = range
					if (
						editor &&
						selection &&
						!selection.isEmpty &&
						selection.contains(range.start) &&
						selection.contains(range.end)
					) {
						expandedRange = selection
					} else {
						expandedRange = new vscode.Range(
							Math.max(0, range.start.line - CONTEXT_LINES_TO_EXPAND),
							START_OF_LINE_CHAR_INDEX,
							Math.min(
								document.lineCount - LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING,
								range.end.line + CONTEXT_LINES_TO_EXPAND,
							),
							document.lineAt(
								Math.min(
									document.lineCount - LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING,
									range.end.line + CONTEXT_LINES_TO_EXPAND,
								),
							).text.length,
						)
					}

					// Add to Cline (Always available)
					const addAction = new vscode.CodeAction("Add to Cline", vscode.CodeActionKind.QuickFix)
					addAction.command = {
						command: "cline.addToChat",
						title: "Add to Cline",
						arguments: [expandedRange, context.diagnostics],
					}
					actions.push(addAction)

					// Explain with Cline (Always available)
					const explainAction = new vscode.CodeAction("Explain with Cline", vscode.CodeActionKind.RefactorExtract) // Using a refactor kind
					explainAction.command = {
						command: "cline.explainCode",
						title: "Explain with Cline",
						arguments: [expandedRange],
					}
					actions.push(explainAction)

					// Improve with Cline (Always available)
					const improveAction = new vscode.CodeAction("Improve with Cline", vscode.CodeActionKind.RefactorRewrite) // Using a refactor kind
					improveAction.command = {
						command: "cline.improveCode",
						title: "Improve with Cline",
						arguments: [expandedRange],
					}
					actions.push(improveAction)

					// Fix with Cline (Only if diagnostics exist)
					if (context.diagnostics.length > 0) {
						const fixAction = new vscode.CodeAction("Fix with Cline", vscode.CodeActionKind.QuickFix)
						fixAction.isPreferred = true
						fixAction.command = {
							command: "cline.fixWithCline",
							title: "Fix with Cline",
							arguments: [expandedRange, context.diagnostics],
						}
						actions.push(fixAction)
					}
					return actions
				}
			})(),
			{
				providedCodeActionKinds: [
					vscode.CodeActionKind.QuickFix,
					vscode.CodeActionKind.RefactorExtract,
					vscode.CodeActionKind.RefactorRewrite,
				],
			},
		),
	)

	// Register the command handler
	context.subscriptions.push(
		vscode.commands.registerCommand("cline.fixWithCline", async (range: vscode.Range, diagnostics: vscode.Diagnostic[]) => {
			// Add this line to focus the chat input first
			await vscode.commands.executeCommand("cline.focusChatInput")
			// Wait for a webview instance to become visible after focusing
			await pWaitFor(() => !!AltWebviewProvider.getVisibleInstance())
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				return
			}

			const selectedText = editor.document.getText(range)
			const filePath = editor.document.uri.fsPath
			const languageId = editor.document.languageId

			// Send to sidebar provider with diagnostics
			const visibleWebview = AltWebviewProvider.getVisibleInstance()
			await visibleWebview?.controller.fixWithCline(selectedText, filePath, languageId, diagnostics)
			telemetryService.captureButtonClick("codeAction_fixWithCline", visibleWebview?.controller.task?.taskId, true)
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.explainCode", async (range: vscode.Range) => {
			await vscode.commands.executeCommand("cline.focusChatInput") // Ensure Cline is visible and input focused
			await pWaitFor(() => !!AltWebviewProvider.getVisibleInstance())
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				return
			}
			const selectedText = editor.document.getText(range)
			if (!selectedText.trim()) {
				vscode.window.showInformationMessage("Please select some code to explain.")
				return
			}
			const filePath = editor.document.uri.fsPath
			const visibleWebview = AltWebviewProvider.getVisibleInstance()
			const fileMention = visibleWebview?.controller.getFileMentionFromPath(filePath) || filePath
			const prompt = `Explain the following code from ${fileMention}:\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``
			await visibleWebview?.controller.initTask(prompt)
			telemetryService.captureButtonClick("codeAction_explainCode", visibleWebview?.controller.task?.taskId, true)
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("cline.improveCode", async (range: vscode.Range) => {
			await vscode.commands.executeCommand("cline.focusChatInput") // Ensure Cline is visible and input focused
			await pWaitFor(() => !!AltWebviewProvider.getVisibleInstance())
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				return
			}
			const selectedText = editor.document.getText(range)
			if (!selectedText.trim()) {
				vscode.window.showInformationMessage("Please select some code to improve.")
				return
			}
			const filePath = editor.document.uri.fsPath
			const visibleWebview = AltWebviewProvider.getVisibleInstance()
			const fileMention = visibleWebview?.controller.getFileMentionFromPath(filePath) || filePath
			const prompt = `Improve the following code from ${fileMention} (e.g., suggest refactorings, optimizations, or better practices):\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``
			await visibleWebview?.controller.initTask(prompt)
			telemetryService.captureButtonClick("codeAction_improveCode", visibleWebview?.controller.task?.taskId, true)
		}),
	)

	// Register the focusChatInput command handler
	context.subscriptions.push(
		vscode.commands.registerCommand("cline.focusChatInput", async () => {
			let activeWebviewProvider: AltWebviewProvider | undefined = AltWebviewProvider.getVisibleInstance()

			// If a tab is visible and active, ensure it's fully revealed (might be redundant but safe)
			if (activeWebviewProvider?.view && activeWebviewProvider.view.hasOwnProperty("reveal")) {
				const panelView = activeWebviewProvider.view as vscode.WebviewPanel
				panelView.reveal(panelView.viewColumn)
			} else if (!activeWebviewProvider) {
				// No webview is currently visible, try to activate the sidebar
				await vscode.commands.executeCommand("claude-dev.AltSidebarProvider.focus")
				await new Promise((resolve) => setTimeout(resolve, 200)) // Allow time for focus
				activeWebviewProvider = AltWebviewProvider.getSidebarInstance()

				if (!activeWebviewProvider) {
					// Sidebar didn't become active (might be closed or not in current view container)
					// Check for existing tab panels
					const tabInstances = AltWebviewProvider.getTabInstances()
					if (tabInstances.length > 0) {
						const potentialTabInstance = tabInstances[tabInstances.length - 1] // Get the most recent one
						if (potentialTabInstance.view && potentialTabInstance.view.hasOwnProperty("reveal")) {
							const panelView = potentialTabInstance.view as vscode.WebviewPanel
							panelView.reveal(panelView.viewColumn)
							activeWebviewProvider = potentialTabInstance
						}
					}
				}

				if (!activeWebviewProvider) {
					// No existing Cline view found at all, open a new tab
					await vscode.commands.executeCommand("cline.openInNewTab")
					// After openInNewTab, a new webview is created. We need to get this new instance.
					// It might take a moment for it to register.
					await pWaitFor(
						() => {
							const visibleInstance = AltWebviewProvider.getVisibleInstance()
							// Ensure a boolean is returned
							return !!(visibleInstance?.view && visibleInstance.view.hasOwnProperty("reveal"))
						},
						{ timeout: 2000 },
					)
					activeWebviewProvider = AltWebviewProvider.getVisibleInstance()
				}
			}
			// At this point, activeWebviewProvider should be the one we want to send the message to.
			// It could still be undefined if opening a new tab failed or timed out.
			if (activeWebviewProvider) {
				activeWebviewProvider.controller.postMessageToWebview({
					type: "action",
					action: "focusChatInput",
				})
			} else {
				console.error("FocusChatInput: Could not find or activate a Cline webview to focus.")
				vscode.window.showErrorMessage(
					"Could not activate Cline view. Please try opening it manually from the Activity Bar.",
				)
			}
			telemetryService.captureButtonClick("command_focusChatInput", activeWebviewProvider?.controller.task?.taskId, true)
		}),
	)

	// Register the generateGitCommitMessage command handler
	context.subscriptions.push(
		vscode.commands.registerCommand("cline.generateGitCommitMessage", async () => {
			// Get the controller from any instance, without activating the view
			const controller = AltWebviewProvider.getAllInstances()[0]?.controller

			if (controller) {
				// Call the controller method to generate commit message
				await controller.generateGitCommitMessage()
			} else {
				// Create a temporary controller just for this operation
				const outputChannel = vscode.window.createOutputChannel("Cline Commit Generator")
				const tempController = new Controller(context, outputChannel, () => Promise.resolve(true))

				await tempController.generateGitCommitMessage()
				outputChannel.dispose()
			}
		}),
	)

	// Initialize Preview Server Manager
	let previewServerManager: PreviewServerManager | undefined;
	
	const getPreviewServerManager = (): PreviewServerManager => {
		if (!previewServerManager) {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				throw new Error("No workspace folder open");
			}
			const workspacePath = workspaceFolders[0].uri.fsPath;
			const extensionPath = context.extensionPath;
			previewServerManager = PreviewServerManager.getInstance(extensionPath, workspacePath);
		}
		return previewServerManager;
	};


	// Register the editWithDLD command handler for folders
	context.subscriptions.push(
		vscode.commands.registerCommand("cline.editWithDLD", async (resource: vscode.Uri) => {
			if (!resource) {
				vscode.window.showInformationMessage("Please select a folder in the explorer first.");
				return;
			}

			// Get folder path
			const folderPath = resource.fsPath;
			
			// Check if the path is a directory
			try {
				const stat = await vscode.workspace.fs.stat(resource);
				if (!(stat.type & vscode.FileType.Directory)) {
					vscode.window.showInformationMessage("This command can only be used on folders.");
					return;
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Error accessing folder: ${error}`);
				return;
			}

			// Find .tsx files in the folder
			try {
				const files = await vscode.workspace.fs.readDirectory(resource);
				const tsxFiles = files.filter(([name, type]) => 
					type === vscode.FileType.File && name.endsWith('.tsx')
				);

				if (tsxFiles.length === 0) {
					vscode.window.showInformationMessage("No .tsx files found in this folder.");
					return;
				}

				// If multiple .tsx files, let user choose or take the first one
				let selectedFile: string;
				if (tsxFiles.length === 1) {
					selectedFile = tsxFiles[0][0];
				} else {
					// Show quick pick for multiple files
					const picked = await vscode.window.showQuickPick(
						tsxFiles.map(([name]) => name),
						{ placeHolder: "Select a component to preview" }
					);
					if (!picked) return;
					selectedFile = picked;
				}

				// Get the full path to the selected file
				const componentPath = path.join(folderPath, selectedFile);
				const componentName = path.basename(selectedFile, '.tsx');

				// Start preview server and load component
				const manager = getPreviewServerManager();
				
				// Start server if not running
				if (!manager.isRunning()) {
					await manager.start();
				}
				
				// Load the component in preview
				await manager.updateComponent({
					name: componentName,
					path: componentPath,
					props: [] // Will be auto-detected or configured later
				});
				
				// Open Cline in a new tab instead of just loading the component
				await openClineInNewTab();
				
				vscode.window.showInformationMessage(`${componentName} component loaded in DLD preview`);
				
				// Track usage with telemetry
				telemetryService.captureButtonClick("command_editWithDLD", undefined, true);

			} catch (error) {
				vscode.window.showErrorMessage(`Failed to preview component: ${error}`);
			}
		}),
	)

	return createClineAPI(outputChannel, altSidebarWebview.controller)
}

// TODO: Find a solution for automatically removing DEV related content from production builds.
//  This type of code is fine in production to keep. We just will want to remove it from production builds
//  to bring down built asset sizes.
//
// This is a workaround to reload the extension when the source code changes
// since vscode doesn't support hot reload for extensions
const { IS_DEV, DEV_WORKSPACE_FOLDER } = process.env

// This method is called when your extension is deactivated
export async function deactivate() {
	// Dispose all webview instances
	await AltWebviewProvider.disposeAllInstances()

	// Clean up preview server
	try {
		const manager = PreviewServerManager.getInstance("", "");
		if (manager.isRunning()) {
			await manager.stop();
		}
		manager.dispose();
	} catch (error) {
		// Ignore errors during cleanup
	}

	await telemetryService.sendCollectedEvents()

	// Clean up test mode
	cleanupTestMode()
	await posthogClientProvider.shutdown()

	Logger.log("Cline extension deactivated")
}

// Set up development mode file watcher
if (IS_DEV && IS_DEV !== "false") {
	assert(DEV_WORKSPACE_FOLDER, "DEV_WORKSPACE_FOLDER must be set in development")
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(DEV_WORKSPACE_FOLDER, "src/**/*"))

	watcher.onDidChange(({ scheme, path }) => {
		console.info(`${scheme} ${path} changed. Reloading VSCode...`)

		vscode.commands.executeCommand("workbench.action.reloadWindow")
	})
}
