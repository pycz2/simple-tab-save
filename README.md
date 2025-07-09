# TabSave Extension

Firefox extension to save and restore tabs of the current window, including containers and pinned tabs.

## Installation

1. Clone or download the contents of this folder.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click "Load Temporary Add-on" and select the `manifest.json` file from this folder.

## Features

- Save all tabs of the current window as a snapshot (including container and pinned status)
- Restore all tabs from any saved snapshot (in a new window)
- Edit snapshot names
- Delete individual snapshots or clear all
- Export all snapshots to a JSON file
- Light, dark, or system theme selection

## Usage

1. Click the extension icon.
2. (Optional) Enter a name for the snapshot in the input field.
3. Click the "Save current tabs" button to save all tabs as a snapshot.
4. View, edit, or delete saved snapshots in the list below.
5. Click a snapshot to view its details (tab list, URLs, containers, pinned status).
6. Click "Restore tabs" to open all tabs from the snapshot in a new window.
7. Use the gear icon to change the theme or export snapshots as JSON.
8. Use "Clear all snapshots" to remove all saved snapshots.

## Build

No build required — all files are ready to be loaded into Firefox.

## Structure
- `manifest.json` — extension manifest
- `popup.html` — popup interface
- `popup.js` — popup logic and UI
- `background.js` — background logic (tab info, saving, restoring)
- `icon.svg` — extension icon
- `build.py` — script to package the extension (optional) 