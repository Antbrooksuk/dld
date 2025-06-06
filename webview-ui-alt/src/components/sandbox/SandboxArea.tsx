import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { vscode } from "@/utils/vscode";
import { Button, Card, Badge } from './sampleComponents.tsx';
import { Prop } from './types';
import { getComponentProps } from './previewConfigController';

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

const ComponentName = styled.span`
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  font-family: monospace;
`;

const PreviewContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: white;
`;

const PropList = styled.div`
  margin-top: 20px;
  width: 100%;
  max-width: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
`;

const PropListHeader = styled.div`
  background-color: #f5f5f5;
  padding: 8px 16px;
  font-weight: 500;
  border-bottom: 1px solid #e0e0e0;
`;

const PropItem = styled.div`
  padding: 8px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  
  &:last-child {
    border-bottom: none;
  }
`;

const PropName = styled.span`
  font-weight: 500;
`;

const PropValue = styled.span`
  color: #666;
  font-family: monospace;
`;

const SandboxArea: React.FC<SandboxAreaProps> = () => {
  // Currently selected component
  const [currentComponent, setCurrentComponent] = useState<string>('Button');
  
  // Props for the current component
  const [props, setProps] = useState<Prop[]>([]);
  
  // Load props for the current component
  useEffect(() => {
    const loadProps = async () => {
      const componentProps = await getComponentProps(currentComponent);
      setProps(componentProps);
    };
    
    loadProps();
  }, [currentComponent]);
  
  // Render the selected component with its props
  const renderComponent = () => {
    // Convert props array to props object
    const propsObject: Record<string, any> = {};
    props.forEach(prop => {
      // Convert prop value based on type
      let value: any = prop.defaultValue;
      
      switch (prop.propType) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = Number(value);
          break;
        case 'function':
          // For functions, we use eval in a controlled way
          // This is safe in this context since we control the input
          // eslint-disable-next-line no-eval
          value = eval(`(${value})`);
          break;
        // For other types (string, array, object), keep as is
      }
      
      propsObject[prop.propName] = value;
    });
    
    // Render the appropriate component
    switch (currentComponent) {
      case 'Button':
        return <Button {...propsObject} />;
      case 'Card':
        return <Card {...propsObject} />;
      case 'Badge':
        return <Badge {...propsObject} />;
      default:
        return <div>Unknown component: {currentComponent}</div>;
    }
  };

  return (
    <SandboxContainer>
      <Header>
        <Title>Component Preview</Title>
        <ComponentName>{currentComponent}</ComponentName>
      </Header>
      <PreviewContainer>
        {renderComponent()}
        
        <PropList>
          <PropListHeader>Component Props</PropListHeader>
          {props.length === 0 ? (
            <PropItem>No props defined</PropItem>
          ) : (
            props.map(prop => (
              <PropItem key={prop.propName}>
                <PropName>{prop.propName}</PropName>
                <PropValue>{prop.defaultValue}</PropValue>
              </PropItem>
            ))
          )}
        </PropList>
      </PreviewContainer>
    </SandboxContainer>
  );
};

export default SandboxArea; 