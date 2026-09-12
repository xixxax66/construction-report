const CENTRAL_GAS_URL = 'https://script.google.com/macros/s/AKfycbz9T8I8iojUCXX9D71RRftcemcLsv5-mG1ND1pVbJugwHuDCffxMLHkIKU6V_y6zieJ5A/exec';
localStorage.setItem('CONSTRUCTION_GAS_URL', CENTRAL_GAS_URL);

async function syncDataToCloud(actionType, payloadData) {
  try {
    const payload = { action: actionType, ...payloadData, clientSyncedAt: new Date().toISOString() };
    const response = await fetch(CENTRAL_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.warn('Sync to cloud error (saved locally):', error);
    return { status: 'offline', message: error.toString() };
  }
}

// assets/gas-sync.js

const GAS_SYNC_CONFIG = {
  getStorageUrl: () => localStorage.getItem('CONSTRUCTION_GAS_URL') || 'https://script.google.com/macros/s/AKfycbyNk1gc_9FAtu0ByIBbcgzmK561YpShTklJaf-gCnBnrRHwW0W-L4aeos5fXarrI3Ft/exec',
  autoSyncFileName: 'Project_Database_AutoSync.json'
};

// ฟังก์ชันดึงข้อมูลจาก Cloud มาอัปเดตลงเครื่องปัจจุบัน (Pull)
async function pullDataFromCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getStorageUrl();
  const folderId = localStorage.getItem('SELECTED_DRIVE_FOLDER_ID') || 'root';

  try {
    const res = await fetch(`${gasUrl}?action=get_latest_project_database&folderId=${folderId}`);
    const result = await res.json();

    if (result.status === 'success' && result.database) {
      // เขียนข้อมูลทับลงใน localStorage ของเครื่องปัจจุบัน
      for (const [key, value] of Object.entries(result.database)) {
        const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
        localStorage.setItem(key, valueToStore);
      }

      localStorage.setItem('LAST_CLOUD_SYNC_TIME', new Date().toLocaleString('th-TH'));

      if (!silent) {
        alert('ดึงข้อมูลล่าสุดจาก Cloud เรียบร้อยแล้วค่ะ!');
        location.reload();
      }
      return true;
    } else if (result.status === 'empty' && !silent) {
      alert('ยังไม่มีไฟล์ฐานข้อมูลบน Cloud ค่ะ');
    }
  } catch (err) {
    console.warn('Auto pull failed or offline:', err);
    if (!silent) alert('ไม่สามารถเชื่อมต่อ Cloud ได้ โปรดตรวจสอบสัญญาณอินเทอร์เน็ต');
  }
  return false;
}

// ฟังก์ชันส่งข้อมูลจากเครื่องปัจจุบันขึ้น Cloud (Push)
async function pushDataToCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getStorageUrl();
  const folderId = localStorage.getItem('SELECTED_DRIVE_FOLDER_ID') || 'root';

  // รวบรวมข้อมูลทั้งหมดใน localStorage
  const projectDatabase = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
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
      localStorage.setItem('LAST_CLOUD_SYNC_TIME', new Date().toLocaleString('th-TH'));
      if (!silent) alert('บันทึกและส่งข้อมูลขึ้น Cloud สำเร็จแล้วค่ะ!');
      return true;
    }
  } catch (err) {
    console.error('Push data failed:', err);
    if (!silent) alert('เกิดข้อผิดพลาดในการส่งข้อมูลขึ้น Cloud');
  }
  return false;
}