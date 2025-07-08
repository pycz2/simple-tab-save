document.getElementById('fetch-tabs').addEventListener('click', async () => {
  const [response] = await browser.runtime.sendMessage({ action: 'getTabsInfo' });
  document.getElementById('tabs-info').value = response || 'Ошибка получения информации.';
}); 