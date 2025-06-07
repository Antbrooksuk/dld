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
import SandboxArea from "./components/sandbox/SandboxArea"
import styled from "styled-components"

// Get the display context from the window global
declare global {
	interface Window {
		IS_IN_SIDEBAR?: boolean
	}
}

const ChatTabNavigation = styled.div`
  display: flex;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  background-color: var(--vscode-editorWidget-background);
`;

const ChatTabButton = styled.button<{ isActive: boolean; disabled?: boolean }>`
  padding: 8px 16px;
  background: ${props => props.isActive ? 'var(--vscode-tab-activeBackground)' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.isActive ? 'var(--vscode-focusBorder)' : 'transparent'};
  color: ${props => props.disabled ? 'var(--vscode-disabledForeground)' : 
          props.isActive ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 13px;
  font-weight: 400;
  transition: all 0.2s ease;
  opacity: ${props => props.disabled ? 0.6 : 1};

  &:hover:not(:disabled) {
    background-color: var(--vscode-tab-hoverBackground);
    color: var(--vscode-tab-hoverForeground);
  }
`;

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

	// Chat tab state
	const [activeChatTab, setActiveChatTab] = useState<string>('edit');

	// Check if we're in the sidebar or tab
	const isInSidebar = window.IS_IN_SIDEBAR === true

	// In tab view, always show chat (not welcome)
	const showWelcome = isInSidebar ? false : false

	// Render configure tab content
	const renderConfigureTab = () => (
		<div style={{ 
			flex: 1, 
			display: 'flex', 
			alignItems: 'center', 
			justifyContent: 'center',
			color: 'var(--vscode-descriptionForeground)',
			fontSize: '14px',
			flexDirection: 'column',
			gap: '10px'
		}}>
			<div>Component Configuration</div>
			<div style={{ fontSize: '12px', textAlign: 'center', maxWidth: '300px' }}>
				Configure props, state, and interactions for your components. This feature will allow you to toggle component properties and see real-time changes.
			</div>
		</div>
	);

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

	// In tab view, show split screen layout with sandbox and chat
	return (
		<div className="split-screen-container">
			<SandboxArea />
			<div className="chat-area">
				<ChatTabNavigation>
					<ChatTabButton 
						isActive={activeChatTab === 'edit'}
						onClick={() => setActiveChatTab('edit')}
					>
						Edit
					</ChatTabButton>
					<ChatTabButton 
						isActive={activeChatTab === 'configure'}
						onClick={() => setActiveChatTab('configure')}
					>
						Configure
					</ChatTabButton>
				</ChatTabNavigation>
				{showSettings && <SettingsView onDone={hideSettings} />}
				{showHistory && <HistoryView onDone={hideHistory} />}
				{showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
				{showAccount && <AccountView onDone={hideAccount} />}
				{/* Show different content based on active chat tab */}
				{activeChatTab === 'edit' && (
					<ChatView
						showHistoryView={navigateToHistory}
						isHidden={showSettings || showHistory || showMcp || showAccount}
						showAnnouncement={showAnnouncement}
						hideAnnouncement={hideAnnouncement}
					/>
				)}
				{activeChatTab === 'configure' && renderConfigureTab()}
			</div>
		</div>
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
