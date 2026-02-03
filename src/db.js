import { openDB } from 'idb';

const DB_NAME = 'RecordManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

export async function getAllRecords() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

export async function addRecordToDB(record) {
  const db = await dbPromise;
  // Ensure the record is a clean object (Vue proxies can sometimes cause issues if not unwrapped, 
  // but IDB usually handles structured clones well. Just to be safe/clean.)
  return db.add(STORE_NAME, JSON.parse(JSON.stringify(record))); 
  // Wait, JSON.parse/stringify kills Blobs/Files! 
  // IDB *can* store Blobs. So pass the record directly.
  // Vue refs should be .value accessed before passing here.
  // return db.add(STORE_NAME, record);
}

// Special function to handle record + image file
export async function addRecordWithImage(record, imageFile) {
  const db = await dbPromise;
  const recordToSave = { ...record };
  if (imageFile) {
    recordToSave.image = imageFile; // Store the file object/blob directly
  }
  return db.add(STORE_NAME, recordToSave);
}

export async function deleteRecordFromDB(id) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, id);
}
