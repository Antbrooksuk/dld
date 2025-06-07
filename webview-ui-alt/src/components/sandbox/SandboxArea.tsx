import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { vscode } from "@/utils/vscode";
import { useExtensionState } from "@/context/ExtensionStateContext";

interface SandboxAreaProps {
  // Add any props you might need in the future
}

const SandboxContainer = styled.div`
  display: flex;
  flex: 2;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  overflow: hidden;
`;



const PreviewContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  background-color: white;
`;

const IframeContainer = styled.div`
  width: 100%;
  height: 100%;
  border: none;
  overflow: hidden;
`;

const PreviewIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

const StatusIndicator = styled.div<{ isRunning: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
`;

const StatusDot = styled.div<{ isRunning: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.isRunning ? '#4CAF50' : '#f44336'};
`;

const TabNavigation = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  background-color: var(--vscode-editorWidget-background);
`;

const TabButtons = styled.div`
  display: flex;
`;

const ServerControls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 16px;
`;

const TabButton = styled.button<{ isActive: boolean; disabled?: boolean }>`
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

const TabContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100% - 41px); // Account for tab header height
`;

const SandboxArea: React.FC<SandboxAreaProps> = () => {
  // Get navigation function from extension state
  const { navigateToSettings } = useExtensionState();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>('component');
  
  // Force iframe reload by adding a timestamp
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  
  // Server status based on iframe loading
  const [isServerRunning, setIsServerRunning] = useState<boolean>(false);

  // Handle iframe load events to update server status
  const handleIframeLoad = () => {
    setIsServerRunning(true);
  };

  const handleIframeError = () => {
    setIsServerRunning(false);
  };

  // Reset server status when key changes (reload)
  useEffect(() => {
    setIsServerRunning(false);
  }, [iframeKey]);

  // Stop the preview server
  const handleStopServer = () => {
    vscode.postMessage({
      type: 'stopPreviewServer'
    });
    setIsServerRunning(false);
  };

  // Handle tab clicks with settings tab opening Cline settings
  const handleTabClick = (tabValue: string) => {
    if (tabValue === 'settings') {
      // Use the navigation function to open Cline settings
      navigateToSettings();
      // Don't change the active tab for settings
      return;
    }
    setActiveTab(tabValue);
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'component':
        return (
          <PreviewContainer>
            <IframeContainer>
              <PreviewIframe 
                key={iframeKey}
                src="http://localhost:5174"
                title="Component Preview"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </IframeContainer>
          </PreviewContainer>
        );
      case 'layout':
        return (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '14px'
          }}>
            Layout tools coming soon...
          </div>
        );
      case 'journey':
        return (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '14px'
          }}>
            Journey mapping coming soon...
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SandboxContainer>
      <TabNavigation>
        <TabButtons>
          <TabButton 
            isActive={false} // Settings is not a tab state, just triggers action
            onClick={() => handleTabClick('settings')}
          >
            Settings
          </TabButton>
          <TabButton 
            isActive={activeTab === 'component'}
            onClick={() => handleTabClick('component')}
          >
            Component
          </TabButton>
          <TabButton 
            isActive={activeTab === 'layout'}
            disabled={true}
            onClick={() => handleTabClick('layout')}
          >
            Layout
          </TabButton>
          <TabButton 
            isActive={activeTab === 'journey'}
            disabled={true}
            onClick={() => handleTabClick('journey')}
          >
            Journey
          </TabButton>
        </TabButtons>
        <ServerControls>
          <StatusIndicator isRunning={isServerRunning}>
            <StatusDot isRunning={isServerRunning} />
            <span>{isServerRunning ? 'Server Running' : 'Server Stopped'}</span>
          </StatusIndicator>
          <button 
            onClick={() => setIframeKey(Date.now())}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: '1px solid #4CAF50',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
          <button 
            onClick={handleStopServer}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#f44336',
              color: 'white',
              border: '1px solid #f44336',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Stop Server
          </button>
        </ServerControls>
      </TabNavigation>
      <TabContent>
        {renderTabContent()}
      </TabContent>
    </SandboxContainer>
  );
};

export default SandboxArea; 