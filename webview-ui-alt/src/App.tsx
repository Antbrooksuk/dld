import { useEffect, useState } from "react"
import ChatView from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import AccountView from "./components/account/AccountView"
import { useExtensionState } from "./context/ExtensionStateContext"
import { UiServiceClient } from "./services/grpc-client"
import McpView from "./components/mcp/configuration/McpConfigurationView"
import { Providers } from "./Providers"
import { Boolean, EmptyRequest } from "@shared/proto/common"

// Get the display context from the window global
declare global {
	interface Window {
		IS_IN_SIDEBAR?: boolean
	}
}

const AppContent = () => {
	const {
		didHydrateState,
		showWelcome: originalShowWelcome,
		shouldShowAnnouncement,
		showMcp,
		mcpTab,
		showSettings,
		showHistory,
		showAccount,
		showAnnouncement,
		setShowAnnouncement,
		setShouldShowAnnouncement,
		closeMcpView,
		navigateToHistory,
		hideSettings,
		hideHistory,
		hideAccount,
		hideAnnouncement,
	} = useExtensionState()

	// Check if we're in the sidebar or tab
	const isInSidebar = window.IS_IN_SIDEBAR === true

	// In tab view, always show chat (not welcome)
	const showWelcome = isInSidebar ? false : false

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)

			// Use the gRPC client instead of direct WebviewMessage
			UiServiceClient.onDidShowAnnouncement({} as EmptyRequest)
				.then((response: Boolean) => {
					setShouldShowAnnouncement(response.value)
				})
				.catch((error) => {
					console.error("Failed to acknowledge announcement:", error)
				})
		}
	}, [shouldShowAnnouncement])

	if (!didHydrateState) {
		return null
	}

	// Always show settings in the sidebar
	if (isInSidebar) {
		return (
			<div className="alt-ui-container">
				<SettingsView onDone={() => {}} />
			</div>
		)
	}

	// In tab view, show chat UI with any overlays
	return (
		<>
			<div className="alt-ui-header">
				<h1>Cline Chat</h1>
			</div>
			{showSettings && <SettingsView onDone={hideSettings} />}
			{showHistory && <HistoryView onDone={hideHistory} />}
			{showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
			{showAccount && <AccountView onDone={hideAccount} />}
			{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
			<ChatView
				showHistoryView={navigateToHistory}
				isHidden={showSettings || showHistory || showMcp || showAccount}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={hideAnnouncement}
			/>
		</>
	)
}

const App = () => {
	return (
		<Providers>
			<AppContent />
		</Providers>
	)
}

export default App
