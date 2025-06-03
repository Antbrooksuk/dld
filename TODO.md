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
   - Verify that it shows only the Settings view with "Sidebar" in the header
   - Open the alt UI in a tab (using the command)
   - Verify that it shows the full UI with "Tab" in the header 