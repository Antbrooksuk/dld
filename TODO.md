# Cline Development Tasks

## Current Tasks

1. **✅ Modify 'Open in Editor' Button Behavior**
   - ✅ Change the button to open inline with other files
   - ✅ Remove the code that creates a new editor group
   - ✅ Update the relevant command handler in `extension.ts`

2. **✅ Create Separate Webview UI**
   - ✅ Create a new webview UI implementation while keeping the original
   - ✅ Set up the infrastructure to support both UIs
   - ✅ Ensure the new UI can be selected/activated independently

3. **✅ Context-Aware UI Display**
   - ✅ Modify the new UI to show different content (Settings only) based on context:
     - ✅ When opened in the file navigation window (sidebar)
     - ✅ When opened as a tab
   - ✅ Add detection logic to determine the current display context

4. **✅ Implement View-Specific Content**
   - ✅ In sidebar, show settings view only
   - ✅ In main window, show standard Cline chat view
   - ✅ Ensure proper initialization of each view type
   - ✅ Add smooth transitions between views

5. **✅ Fix TypeScript Errors**
   - ✅ Add `view` property to `AltWebviewProvider` class
   - ✅ Update references to use the new property
   - ✅ Ensure proper type safety throughout the codebase

6. **✅ Build React App for Production**
   - ✅ Run build process for webview-ui-alt
   - ✅ Ensure proper bundling of assets
   - ✅ Test the built version in both sidebar and tab contexts

## Implementation Details

1. **'Open in Editor' Button Behavior**
   - Modified `openClineInNewTab` function in `extension.ts` to use the active editor column
   - Removed code that creates a new editor group
   - Removed code that locks the editor group

2. **Separate Webview UI**
   - Created `AltWebviewProvider` in `src/core/webview/alt-webview.ts`
   - Duplicated the `webview-ui` directory as `webview-ui-alt`
   - Added registration for the alt webview in `extension.ts`
   - Added new commands and views in `package.json`

3. **Context-Aware UI Display**
   - Added `IS_IN_SIDEBAR` flag to detect display context
   - Modified `App.tsx` in alt UI to show different content based on context
   - Added CSS styles for the alt UI header

4. **View-Specific Content**
   - Updated the `getHtmlForWebview` method to load the React application
   - Set up proper context passing between extension and webview
   - Leveraged existing React components from the original UI
   - Used `window.IS_IN_SIDEBAR` flag to control view rendering in React
   - Added toggle buttons to switch between welcome and chat views for testing

5. **TypeScript Error Fixes**
   - Added `view` property to `AltWebviewProvider` class
   - Updated `setupWebview` method to handle both WebviewView and WebviewPanel
   - Fixed type safety issues in extension.ts

## How to Test

1. **'Open in Editor' Button**
   - Open Cline in the sidebar
   - Click the "Open in Editor" button
   - Verify that it opens in the current editor group

2. **Separate Webview UI**
   - Open the command palette (Cmd+Shift+P / Ctrl+Shift+P)
   - Run "Cline: Open Alt UI In New Tab"
   - Verify that the alt UI opens in a tab

3. **Context-Aware UI Display**
   - Open the alt UI in the sidebar (click on the Cline Alt icon in the activity bar)
   - Verify that it shows only the Settings view
   - Open the alt UI in a tab (using the command)
   - Verify that it shows the full UI with Chat view 