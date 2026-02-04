import { openDB } from 'idb';

const DB_NAME = 'RecordManagerDB';
const DB_VERSION = 2; 
const STORE_NAME = 'records';

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

export const STORE_NAME_REF = STORE_NAME;

export async function getAllRecords() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

// Uses .put to Add or Update
export async function addRecordToDB(record) {
  const db = await dbPromise;
  // Ensure we are not passing a Vue proxy
  return db.put(STORE_NAME, JSON.parse(JSON.stringify(record))); 
}

export async function updateRecordStatus(id, status) {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const record = await tx.store.get(id);
  if (record) {
    record.status = status;
    await tx.store.put(record);
  }
  await tx.done;
}

export async function addRecordWithImage(record, imageFile) {
  const db = await dbPromise;
  const recordToSave = { ...record };
  if (imageFile) {
    recordToSave.image = imageFile; 
  }
  // Default status if not present
  if (!recordToSave.status) recordToSave.status = 'Owned';
  
  return db.put(STORE_NAME, recordToSave);
}

export async function deleteRecordFromDB(id) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, id);
}
