import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { vscode } from "@/utils/vscode";

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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--vscode-editorWidget-background);
  border-bottom: 1px solid var(--vscode-editorWidget-border);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--vscode-foreground);
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

const SandboxArea: React.FC<SandboxAreaProps> = () => {
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

  return (
    <SandboxContainer>
      <Header>
        <Title>Component Preview</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>
      </Header>
      <PreviewContainer>
        <IframeContainer>
          <PreviewIframe 
            key={iframeKey}
            src="http://localhost:9132"
            title="Component Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </IframeContainer>
      </PreviewContainer>
    </SandboxContainer>
  );
};

export default SandboxArea; 