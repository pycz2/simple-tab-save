browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'getTabsInfo') {
    try {
      const [currentWindow] = await browser.windows.getAll({windowTypes: ['normal'], populate: false});
      const tabs = await browser.tabs.query({ windowId: currentWindow.id });
      let containers = [];
      if (browser.contextualIdentities) {
        containers = await browser.contextualIdentities.query({});
      }
      const containerMap = {};
      for (const c of containers) {
        containerMap[c.cookieStoreId] = c.name;
      }
      const info = tabs.map(tab => {
        const container = containerMap[tab.cookieStoreId] || 'Без контейнера';
        const pinned = tab.pinned ? 'Закреплена' : 'Обычная';
        let mainInfo = `Заголовок: ${tab.title}\nURL: ${tab.url}\nКонтейнер: ${container}\nТип: ${pinned}`;
        // Добавляем все остальные поля вкладки
        const skipKeys = ['title', 'url', 'cookieStoreId', 'pinned'];
        const extra = Object.entries(tab)
          .filter(([k]) => !skipKeys.includes(k))
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');
        return mainInfo + (extra ? `\n\nДанные вкладки:\n${extra}` : '') + '\n---';
      }).join('\n');
      sendResponse([info]);
    } catch (e) {
      sendResponse([`Ошибка: ${e.message}`]);
    }
    return true;
  }
}); 