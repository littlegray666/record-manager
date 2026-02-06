import { getSince, addRecordToDB } from './db'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function syncData() {
  const lastSync = parseInt(localStorage.getItem('last_sync') || '0')
  
  // 1. Get local changes since last sync
  // Note: This naive approach sends ALL records modified after timestamp.
  // Ideally we should track "dirty" flags, but timestamp comparison works for simple cases.
  const localChanges = await getSince(lastSync)
  
  // Convert Blobs to Base64 for transport (heavy payload warning!)
  const payloadChanges = await Promise.all(localChanges.map(async r => {
    const item = { ...r }
    if (item.image instanceof Blob) {
      item.image = await blobToBase64(item.image)
      item._isImageBlob = true
    }
    return item
  }))

  try {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: payloadChanges,
        lastSync
      })
    })

    if (!res.ok) throw new Error('Sync failed')

    const { pulled, serverTime } = await res.json()

    // 2. Apply server changes
    let pullCount = 0
    for (const remoteRecord of pulled) {
      // Decode Base64 if needed
      if (remoteRecord._isImageBlob && typeof remoteRecord.image === 'string') {
        remoteRecord.image = await base64ToBlob(remoteRecord.image)
        delete remoteRecord._isImageBlob
      }
      
      // Upsert to local DB
      await addRecordToDB(remoteRecord)
      pullCount++
    }

    // Update sync timestamp
    localStorage.setItem('last_sync', serverTime.toString())
    
    return { pushed: payloadChanges.length, pulled: pullCount }

  } catch (e) {
    console.error('Sync Error:', e)
    throw e
  }
}

// Utils (Duplicated from backup.js, could refactor to shared utils)
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = async (base64) => {
  const res = await fetch(base64);
  return await res.blob();
};
