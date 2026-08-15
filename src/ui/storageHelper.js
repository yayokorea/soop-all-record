/**
 * IndexedDB 기반 디렉토리 핸들 저장 및 복원 유틸리티
 */

import { page, log } from '../config/state.js';

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('soop-all-record', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('settings');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberDirectory(handle) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(handle, 'directory');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function recalledDirectory() {
  const db = await openDb();
  const handle = await new Promise((resolve, reject) => {
    const req = db.transaction('settings').objectStore('settings').get('directory');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

export async function chooseDirectory() {
  let handle = null;
  try {
    handle = await recalledDirectory();
  } catch (e) {
    log('warn', 'folder-recall', '폴더 복원 실패', { error: String(e) });
  }

  if (handle) {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (permission === 'granted') {
      return handle;
    }
  }

  handle = await page.showDirectoryPicker({ mode: 'readwrite', id: 'soop-all-record' });
  try {
    await rememberDirectory(handle);
  } catch (error) {
    log('warn', 'folder-memory', '폴더 기억 실패', { error: String(error) });
  }
  return handle;
}
