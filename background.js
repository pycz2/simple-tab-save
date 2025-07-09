browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] Message received:', message, 'sender:', sender);
  if (message.action === 'getTabsInfo') {
    (async () => {
      try {
        let windowId = undefined;
        if (message.windowId !== undefined) {
          windowId = message.windowId;
          console.log('[background] Using windowId from message:', windowId);
        }
        let currentWindow = null;
        if (windowId !== undefined) {
          currentWindow = await browser.windows.get(windowId);
          console.log('[background] Window received by windowId:', currentWindow);
        } else {
          const windows = await browser.windows.getAll({windowTypes: ['normal'], populate: false});
          console.log('[background] Windows:', windows);
          currentWindow = windows[0];
        }
        if (!currentWindow) {
          console.log('[background] No active window');
          sendResponse(['No active window']);
          return;
        }
        const tabs = await browser.tabs.query({ windowId: currentWindow.id });
        console.log('[background] Tabs:', tabs);
        let containers = [];
        if (browser.contextualIdentities) {
          containers = await browser.contextualIdentities.query({});
          console.log('[background] Containers:', containers);
        }
        const containerInfoMap = {};
        for (const c of containers) {
          containerInfoMap[c.cookieStoreId] = { name: c.name, color: c.color };
        }
        // Form a snapshot for saving
        const snapshotTabs = tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          pinned: !!tab.pinned,
          container: containerInfoMap[tab.cookieStoreId]?.name || 'No container',
          containerColor: containerInfoMap[tab.cookieStoreId]?.color || '',
          favIconUrl: tab.favIconUrl || ''
        }));
        // Format date as dd.mm.yy HH:MM
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const dateStr = `${pad(now.getDate())}.${pad(now.getMonth()+1)}.${now.getFullYear().toString().slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const snapshot = {
          id: Date.now(),
          date: dateStr,
          tabs: snapshotTabs,
          name: message.name && message.name.trim() ? message.name : 'NoName'
        };
        // Save snapshot to storage.local
        const prev = await browser.storage.local.get('snapshots');
        const snapshots = Array.isArray(prev.snapshots) ? prev.snapshots : [];
        snapshots.push(snapshot);
        await browser.storage.local.set({ snapshots });
        console.log('[background] Snapshot saved:', snapshot);
        sendResponse({ success: true });
      } catch (e) {
        console.error('[background] Error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  if (message.action === 'getSnapshots') {
    console.log('[background] getSnapshots request received');
    browser.storage.local.get('snapshots').then(data => {
      console.log('[background] Sending snapshots:', data.snapshots);
      sendResponse({ snapshots: Array.isArray(data.snapshots) ? data.snapshots : [] });
    });
    return true;
  }
  if (message.action === 'restoreTabs') {
    (async () => {
      try {
        const { snapshot } = message;
        console.log('[background] Restoring tabs from snapshot:', snapshot);
        if (!snapshot || !Array.isArray(snapshot.tabs)) throw new Error('No data to restore');
        // Create a new window
        let newWin = null;
        try {
          newWin = await browser.windows.create({
            titlePreface: "TabSave",
            focused: true,
            url: "https://google.com",
            incognito: false,
          });
          console.log('[background] New window created:', newWin);
        } catch (winErr) {
          console.error('[background] Error creating window:', winErr);
          sendResponse({ success: false, error: 'Error creating window: ' + winErr.message });
          return;
        }
        const windowId = newWin.id;
        const firstTabId = newWin.tabs && newWin.tabs.length ? newWin.tabs[0].id : null;
        // First pinned, then regular
        const pinnedTabs = snapshot.tabs.filter(tab => !!tab.pinned);
        const unpinnedTabs = snapshot.tabs.filter(tab => !tab.pinned);
        for (const tab of [...pinnedTabs, ...unpinnedTabs]) {
          let createProps = {
            windowId: windowId,
            url: tab.url,
            pinned: !!tab.pinned
          };
          console.log('[background] Preparing to create tab:', createProps, 'container:', tab.container);
          // Find container id by name, if any
          if (tab.container && tab.container !== 'No container' && browser.contextualIdentities) {
            const containers = await browser.contextualIdentities.query({});
            const found = containers.find(c => c.name === tab.container);
            if (found) {
              createProps.cookieStoreId = found.cookieStoreId;
              console.log('[background] Added cookieStoreId:', found.cookieStoreId);
            } else {
              console.warn('[background] Container not found:', tab.container);
            }
          }
          try {
            await browser.tabs.create(createProps);
            console.log('[background] Tab created:', createProps);
          } catch (tabErr) {
            console.error('[background] Error creating tab:', createProps, tabErr);
          }
        }
        // Close the first tab, if any
        if (firstTabId) {
          try {
            await browser.tabs.remove(firstTabId);
            console.log('[background] First tab of new window closed:', firstTabId);
          } catch (closeErr) {
            console.error('[background] Error closing first tab:', closeErr);
          }
        }
        console.log('[background] Tabs restored successfully');
        sendResponse({ success: true });
      } catch (e) {
        console.error('[background] Restore error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
}); 