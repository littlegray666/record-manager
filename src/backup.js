import { getAllRecords, dbPromise, STORE_NAME_REF } from './db'

// Convert Blob/File to Base64 string for JSON export
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Convert Base64 string back to Blob
const base64ToBlob = async (base64) => {
  const res = await fetch(base64);
  return await res.blob();
};

export async function exportData() {
  const records = await getAllRecords();
  
  // Process records to convert image Blobs to Base64 strings
  const exportableRecords = await Promise.all(records.map(async (record) => {
    const r = { ...record };
    if (r.image instanceof Blob) {
      r.image = await blobToBase64(r.image);
      r._isImageBlob = true; // Marker for import
    }
    return r;
  }));

  const data = JSON.stringify(exportableRecords, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `records_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const text = await file.text();
  const records = JSON.parse(text);
  
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME_REF, 'readwrite');
  
  let count = 0;
  for (const record of records) {
    // Convert Base64 back to Blob if marked
    if (record._isImageBlob && typeof record.image === 'string') {
      record.image = await base64ToBlob(record.image);
      delete record._isImageBlob;
    }
    
    // Use put to update existing (by ID) or add new
    await tx.store.put(record);
    count++;
  }
  
  await tx.done;
  return count;
}
