/**
 * assets/gas-sync.js
 * ระบบ Auto-Sync ข้ามอุปกรณ์ รองรับ iPadOS / iOS 100% ด้วยเทคนิค JSONP
 */

const GAS_SYNC_CONFIG = {
  defaultUrl: 'https://script.google.com/macros/s/AKfycbyNk1gc_9FAtu0ByIBbcgzmK561YpShTklJaf-gCnBnrRHwW0W-L4aeos5fXarrI3Ft/exec',
  autoSyncFileName: 'Project_Database_AutoSync.json',
  
  getGasUrl() {
    return localStorage.getItem('CONSTRUCTION_GAS_URL') || this.defaultUrl;
  }
};

/**
 * ดึงข้อมูลด้วย JSONP เพื่อข้ามข้อจำกัด CORS / Redirect บน iPad
 */
function fetchJsonp(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gas_callback_' + Math.round(100000 * Math.random());
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Connection timed out'));
    }, timeout);

    function cleanup() {
      if (window[callbackName]) delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackName}&_t=${Date.now()}`;
    script.onerror = function() {
      cleanup();
      reject(new Error('Script load error'));
    };

    document.head.appendChild(script);
  });
}

/**
 * ดึงฐานข้อมูลล่าสุดจาก Cloud ลงมาทับ localStorage (Pull)
 */
async function pullDataFromCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getGasUrl();

  try {
    const fetchUrl = `${gasUrl}?action=get_latest_project_database`;
    const result = await fetchJsonp(fetchUrl);

    if (result && result.status === 'success' && result.database) {
      let count = 0;
      const db = result.database;

      Object.keys(db).forEach(key => {
        const val = db[key];
        const valToStore = typeof val === 'object' ? JSON.stringify(val) : String(val);
        localStorage.setItem(key, valToStore);
        count++;
      });

      const syncTime = new Date().toLocaleString('th-TH');
      localStorage.setItem('LAST_CLOUD_SYNC_TIME', syncTime);

      if (!silent) {
        alert(`ดึงข้อมูลล่าสุดจาก Cloud สำเร็จ (${count} รายการ)\nอัปเดตเมื่อ: ${syncTime}`);
        location.reload();
      }
      return { success: true, count, lastUpdated: result.lastUpdated };
    } else if (result && result.status === 'empty') {
      if (!silent) alert('ยังไม่มีไฟล์ข้อมูลสำรองบน Google Drive ค่ะ');
      return { success: false, empty: true };
    }
  } catch (err) {
    console.warn('Auto-pull failed via JSONP:', err);
    if (!silent) alert('ไม่สามารถเชื่อมต่อ Cloud ได้ โปรดตรวจสอบว่าได้อัปเดต Code.gs เป็น New Version หรือยังนะคะ');
  }
  return { success: false };
}

/**
 * ส่งข้อมูลขึ้น Cloud (Push)
 */
async function pushDataToCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getGasUrl();
  const folderId = localStorage.getItem('SELECTED_DRIVE_FOLDER_ID') || 'root';

  const projectDatabase = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k === 'LAST_CLOUD_SYNC_TIME') continue;
    const val = localStorage.getItem(k);
    try {
      projectDatabase[k] = JSON.parse(val);
    } catch (e) {
      projectDatabase[k] = val;
    }
  }

  const payload = {
    action: 'save_full_project_database',
    fileName: GAS_SYNC_CONFIG.autoSyncFileName,
    folderId: folderId,
    timestamp: new Date().toLocaleString('th-TH'),
    database: projectDatabase
  };

  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.status === 'success') {
      const syncTime = new Date().toLocaleString('th-TH');
      localStorage.setItem('LAST_CLOUD_SYNC_TIME', syncTime);
      saveBackupHistoryRecord(syncTime);

      if (!silent) alert(`สำรองข้อมูลและส่งขึ้น Cloud เรียบร้อยแล้วค่ะ!\nเวลา: ${syncTime}`);
      return { success: true, fileUrl: result.fileUrl };
    }
  } catch (err) {
    console.error('Push failed:', err);
    if (!silent) alert('เกิดข้อผิดพลาดในการส่งข้อมูลขึ้น Cloud');
  }
  return { success: false };
}

function saveBackupHistoryRecord(timeStr) {
  try {
    let history = JSON.parse(localStorage.getItem('PROJECT_BACKUP_HISTORY') || '[]');
    history.unshift({
      date: timeStr,
      source: /iPad|iPhone|Macintosh/.test(navigator.userAgent) ? 'iPad / Apple' : 'Notebook / PC'
    });
    if (history.length > 20) history.pop();
    localStorage.setItem('PROJECT_BACKUP_HISTORY', JSON.stringify(history));
  } catch(e) {}
}
