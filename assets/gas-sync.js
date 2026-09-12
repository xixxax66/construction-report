/**
 * assets/gas-sync.js
 * ระบบเชื่อมต่อและซิงค์ข้อมูลอัตโนมัติผ่าน Google Apps Script (Auto-Sync Cloud)
 */

const GAS_SYNC_CONFIG = {
  defaultUrl: 'https://script.google.com/macros/s/AKfycbyNk1gc_9FAtu0ByIBbcgzmK561YpShTklJaf-gCnBnrRHwW0W-L4aeos5fXarrI3Ft/exec',
  autoSyncFileName: 'Project_Database_AutoSync.json',
  
  getGasUrl() {
    return localStorage.getItem('CONSTRUCTION_GAS_URL') || this.defaultUrl;
  }
};

/**
 * ดึงฐานข้อมูลล่าสุดจาก Cloud ลงมาทับ localStorage ในเครื่อง (Pull)
 */
async function pullDataFromCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getGasUrl();

  try {
    // ใส่ timestamp ป้องกัน Browser แคชข้อมูลเก่า
    const res = await fetch(`${gasUrl}?action=get_latest_project_database&_t=${Date.now()}`);
    const result = await res.json();

    if (result.status === 'success' && result.database) {
      let count = 0;
      const db = result.database;

      // เขียนทับทุก Key ลงใน LocalStorage
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
    } else if (result.status === 'empty') {
      if (!silent) alert('ยังไม่มีไฟล์ข้อมูลสำรองบน Google Drive ค่ะ กรุณากดสำรองข้อมูลจากเครื่องแรกก่อนนะคะ');
      return { success: false, empty: true };
    }
  } catch (err) {
    console.warn('Auto-pull failed or offline:', err);
    if (!silent) alert('ไม่สามารถเชื่อมต่อ Cloud ได้ โปรดตรวจสอบสัญญาณอินเทอร์เน็ต');
  }
  return { success: false };
}

/**
 * บันทึกและส่งข้อมูลในเครื่องทั้งหมดขึ้น Cloud (Push)
 */
async function pushDataToCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getGasUrl();
  const folderId = localStorage.getItem('SELECTED_DRIVE_FOLDER_ID') || 'root';

  // รวบรวมข้อมูลทั้งหมดใน localStorage
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
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.status === 'success') {
      const syncTime = new Date().toLocaleString('th-TH');
      localStorage.setItem('LAST_CLOUD_SYNC_TIME', syncTime);

      // บันทึก Log ลงประวัติ
      saveBackupHistoryRecord(syncTime);

      if (!silent) alert(`สำรองข้อมูลและส่งขึ้น Cloud เรียบร้อยแล้วค่ะ!\nเวลา: ${syncTime}`);
      return { success: true, fileUrl: result.fileUrl };
    }
  } catch (err) {
    console.error('Push data failed:', err);
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
