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