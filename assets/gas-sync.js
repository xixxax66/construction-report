/**
 * assets/gas-sync.js
 * ระบบ Auto-Sync ข้ามอุปกรณ์ รองรับ iPadOS / iOS 100% ด้วยเทคนิค JSONP
 */

const GAS_SYNC_CONFIG = {
  defaultUrl: 'https://script.google.com/macros/s/AKfycbz9T8I8iojUCXX9D71RRftcemcLsv5-mG1ND1pVbJugwHuDCffxMLHkIKU6V_y6zieJ5A/exec',
  autoSyncFileName: 'Project_Database_AutoSync.json',
  
  getGasUrl() {
    return localStorage.getItem('CONSTRUCTION_GAS_URL') || this.defaultUrl;
  }
};

/**
 * Shared helpers for project-scoped local data. Keeping keys in one place
 * prevents reports from different projects, months, and weeks being mixed.
 */
function getActiveProjectData() {
  try {
    return JSON.parse(localStorage.getItem('LOCAL_BASIC_INFO') || '{}');
  } catch (error) {
    console.warn('Invalid LOCAL_BASIC_INFO:', error);
    return {};
  }
}

function getActiveProjectId(projectData = getActiveProjectData()) {
  if (projectData.projectID) return String(projectData.projectID);
  const contractNo = String(projectData.contractNo || 'DEFAULT_PROJECT');
  return `PROJ_${contractNo.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function getActiveReportMonth(projectId = getActiveProjectId()) {
  const params = new URLSearchParams(window.location.search);
  return params.get('month') || localStorage.getItem(`LAST_ACTIVE_REPORT_MONTH_${projectId}`) || 'SEP_2569';
}

function getMonthlyInfoKey(projectId = getActiveProjectId()) {
  return `MONTHLY_REPORT_INFO_DATA_${projectId}`;
}

function getWeeklyReferenceKey(projectId = getActiveProjectId(), reportMonth = getActiveReportMonth(projectId)) {
  return `CONSTRUCTION_WEEKLY_REF_DB_${projectId}_${reportMonth}`;
}

function getWeeklyProgressKey(week, projectId = getActiveProjectId(), reportMonth = getActiveReportMonth(projectId)) {
  return `WEEK_PROGRESS_DATA_${projectId}_${reportMonth}_${week}`;
}

function getWeeklyReportKey(section, week, projectId = getActiveProjectId(), reportMonth = getActiveReportMonth(projectId)) {
  return `WEEK_REPORT_${section}_${projectId}_${reportMonth}_${week}`;
}

function getMonthlySectionKey(section, projectId = getActiveProjectId(), reportMonth = getActiveReportMonth(projectId)) {
  return `MONTHLY_${section}_${projectId}_${reportMonth}`;
}

function getContractDurationDays(projectData = {}) {
  const originalDays = Number(projectData.durationDays) || ((Number(projectData.durationWeeks) || 0) * 7);
  const extensionDays = Number(projectData.extensionDays || projectData.totalExtendedDays || projectData.extDays) || 0;
  return Math.max(0, originalDays + extensionDays);
}

function getProgressStatus(actual, planned, tolerance = 0.01) {
  const actualValue = Number(actual) || 0;
  const plannedValue = Number(planned) || 0;
  if (actualValue + tolerance < plannedValue) return 'ช้ากว่าแผน';
  if (actualValue > plannedValue + tolerance) return 'เร็วกว่าแผน';
  return 'ตามแผน';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function safeImageUrl(value) {
  const url = String(value || '').trim();
  return /^(data:image\/(?:png|jpe?g|webp|gif);base64,|https:\/\/)/i.test(url) ? url : '';
}

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
 * บันทึกและส่งข้อมูลในเครื่องทั้งหมดขึ้น Cloud (Push)
 */
async function pushDataToCloud(silent = false) {
  const gasUrl = GAS_SYNC_CONFIG.getGasUrl();
  // เปลี่ยนจาก 'root' เป็น Folder ID ของคุณอรรถวัต
  const folderId = localStorage.getItem('SELECTED_DRIVE_FOLDER_ID') || '11fiWOEZwAqUlZ7W3MuYv3Oi6Vbkfo2jd';
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

    if (!res.ok) throw new Error(`Cloud returned HTTP ${res.status}`);

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
