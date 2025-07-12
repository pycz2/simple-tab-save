async function fetchSnapshots() {
  const { snapshots } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
  return snapshots || [];
}

function renderSnapshotsList(snapshots) {
  const list = document.getElementById('snapshots-list');
  list.innerHTML = '';
  if (!snapshots.length) {
    list.innerHTML = '<li>No saved snapshots</li>';
    return;
  }
  const template = document.getElementById('snapshot-item-template');
  snapshots.forEach((snap, idx) => {
    const li = template.content.firstElementChild.cloneNode(true);
    // Name and tab count on the first line, date on the second
    const labelElem = li.querySelector('.snapshot-label');
    while (labelElem.firstChild) {
      labelElem.removeChild(labelElem.firstChild);
    }
    // Name of snapshot
    const nameSpan = document.createElement('span');
    nameSpan.className = 'snapshot-label-name';
    nameSpan.textContent = snap.name || 'NoName';
    labelElem.appendChild(nameSpan);

    // Number of tabs
    const countSpan = document.createElement('span');
    countSpan.className = 'snapshot-label-count';
    countSpan.textContent = `(${snap.tabs.length})`;
    labelElem.appendChild(document.createTextNode(' '));
    labelElem.appendChild(countSpan);

    // New line
    labelElem.appendChild(document.createElement('br'));

    // Date
    const dateSpan = document.createElement('span');
    dateSpan.className = 'snapshot-label-date';
    dateSpan.textContent = snap.date;
    labelElem.appendChild(dateSpan);
    li.onclick = (event) => {
      // Do not open details if click is on input or button
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'BUTTON' ||
        event.target.classList.contains('edit-name-input') ||
        event.target.classList.contains('edit-name-btn') ||
        event.target.classList.contains('save-name-btn') ||
        event.target.classList.contains('delete-snapshot-btn')
      ) {
        return;
      }
      showSnapshotDetail(snap);
    };
    // Delete button
    li.querySelector('.delete-snapshot-btn').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this snapshot?')) return;
      const { snapshots: all } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
      const filtered = all.filter(s => s.id !== snap.id);
      await browser.storage.local.set({ snapshots: filtered });
      renderSnapshotsList(filtered);
    };
    // Edit name button
    const editBtn = li.querySelector('.edit-name-btn');
    const saveBtn = li.querySelector('.save-name-btn');
    const input = li.querySelector('.edit-name-input');
    editBtn.onclick = (e) => {
      e.stopPropagation();
      input.value = snap.name || '';
      input.style.display = 'inline-block';
      saveBtn.style.display = 'inline-block';
      editBtn.style.display = 'none';
      li.querySelector('.snapshot-label').style.display = 'none';
      input.focus();
    };
    // Save new name
    saveBtn.onclick = async (e) => {
      e.stopPropagation();
      const newName = input.value.trim();
      const { snapshots: all } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
      const updated = all.map(s => s.id === snap.id ? { ...s, name: newName } : s);
      await browser.storage.local.set({ snapshots: updated });
      renderSnapshotsList(updated);
    };
    // Enter in input saves
    input.onkeydown = (e) => {
      if (e.key === 'Enter') saveBtn.onclick(e);
      if (e.key === 'Escape') {
        input.style.display = 'none';
        saveBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
        li.querySelector('.snapshot-label').style.display = 'inline-block';
      }
    };
    list.appendChild(li);
  });
}

function showSnapshotsView() {
  document.getElementById('snapshots-view').classList.remove('hidden');
  document.getElementById('snapshot-detail').classList.add('hidden');
}

let currentSnapshot = null;
function showSnapshotDetail(snapshot) {
  currentSnapshot = snapshot;
  document.getElementById('snapshots-view').classList.add('hidden');
  document.getElementById('snapshot-detail').classList.remove('hidden');
  document.getElementById('detail-title').textContent = snapshot.name ? `Save: ${snapshot.name}` : `Snapshot from ${snapshot.date}`;
  const tabsList = document.getElementById('tabs-list');
  tabsList.innerHTML = '';
  snapshot.tabs.forEach(tab => {
    let li = document.createElement('li');
    let pinEmoji = tab.pinned ? '📌 ' : '';
    let colorBox = tab.containerColor ? `<span style='display:inline-block;width:14px;height:14px;border-radius:3px;background:${tab.containerColor};margin-right:6px;vertical-align:middle;border:1px solid #bbb;box-shadow:0 1px 2px #aaa;'></span>` : '';
    let iconHtml = tab.favIconUrl ? `<img src="${tab.favIconUrl}" alt="icon" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;border-radius:3px;box-shadow:0 1px 2px #aaa;">` : '';
    li.innerHTML = `${pinEmoji}${colorBox}${iconHtml}<b>${tab.title}</b><br>URL: <a href="${tab.url}" target="_blank">${tab.url}</a>`;
    tabsList.appendChild(li);
  });
}

document.getElementById('restore-tabs').addEventListener('click', async () => {
  if (!currentSnapshot) return;
  if (!confirm('Restore all tabs from this snapshot in the current window?')) return;
  try {
    const win = await browser.windows.getCurrent();
    await browser.runtime.sendMessage({ action: 'restoreTabs', snapshot: currentSnapshot, windowId: win.id });
  } catch (e) {
    alert('Error while restoring: ' + e.message);
  }
});

document.getElementById('fetch-tabs').addEventListener('click', async () => {
  document.getElementById('fetch-tabs').disabled = true;
  document.getElementById('fetch-tabs').textContent = 'Saving...';
  try {
    const win = await browser.windows.getCurrent();
    const name = document.getElementById('snapshot-name').value.trim();
    const res = await browser.runtime.sendMessage({ action: 'getTabsInfo', windowId: win.id, name });
    if (res && res.success) {
      const snapshots = await fetchSnapshots();
      renderSnapshotsList(snapshots);
    } else {
      alert('Error while saving: ' + (res && res.error ? res.error : 'Unknown'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
  document.getElementById('fetch-tabs').disabled = false;
  document.getElementById('fetch-tabs').textContent = 'Save current tabs';
});

document.getElementById('back-btn').addEventListener('click', showSnapshotsView);

document.getElementById('clear-snapshots').addEventListener('click', async () => {
  if (!confirm('Delete all saved snapshots?')) return;
  await browser.storage.local.set({ snapshots: [] });
  renderSnapshotsList([]);
});

const downloadJsonBtn = document.getElementById('download-json-btn');
if (downloadJsonBtn) {
  downloadJsonBtn.addEventListener('click', async () => {
    const snapshots = await fetchSnapshots();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshots, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'tabsave_snapshots.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    document.body.removeChild(dlAnchor);
  });
}

// --- Theme ---
function applyTheme(theme) {
  const body = document.body;
  if (theme === 'light' || theme === 'dark') {
    body.setAttribute('data-theme', theme);
  } else {
    body.removeAttribute('data-theme');
  }
}

const themeSelect = document.getElementById('theme-select');
const themeSelectWrapper = document.getElementById('theme-select-wrapper');
const themeGearBtn = document.getElementById('theme-gear-btn');

if (themeGearBtn && themeSelectWrapper) {
  themeGearBtn.addEventListener('click', () => {
    themeSelectWrapper.style.display = themeSelectWrapper.style.display === 'none' ? 'block' : 'none';
  });
}

if (themeSelect) {
  // При изменении селектора
  themeSelect.addEventListener('change', (e) => {
    const value = e.target.value;
    localStorage.setItem('tabsave_theme', value);
    applyTheme(value);
  });
  // При загрузке
  const saved = localStorage.getItem('tabsave_theme') || 'system';
  themeSelect.value = saved;
  applyTheme(saved);
}

// Инициализация
fetchSnapshots().then(renderSnapshotsList); 