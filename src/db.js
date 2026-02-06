import { openDB } from 'idb';

const DB_NAME = 'RecordManagerDB';
const DB_VERSION = 3; 
const STORE_NAME = 'records';

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  async upgrade(db, oldVersion, newVersion, transaction) {
    // Migration to UUID-based ID
    if (oldVersion < 3) {
      const oldRecords = [];
      if (db.objectStoreNames.contains(STORE_NAME)) {
        const tx = transaction.objectStore(STORE_NAME);
        // We can't use getAll here easily inside upgrade? 
        // Actually we can iterate cursor.
        // Simplified: Since this is dev, we might accept data loss or just try to migrate.
        // Better: Rename old store, create new, migrate data.
        
        // However, standard idb pattern:
        // 1. Read old data (if store exists)
        // 2. Delete old store
        // 3. Create new store with UUID support
      }
      
      // For simplicity in this context, we will retain autoIncrement for compatibility 
      // but ENFORCE uuid field for sync.
      // Changing PK is destructive. Let's keep PK as local ID, add UUID for sync.
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
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
  const r = JSON.parse(JSON.stringify(record));
  r.updatedAt = Date.now(); // Update timestamp
  return db.put(STORE_NAME, r); 
}

export async function updateRecordStatus(id, status) {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const record = await tx.store.get(id);
  if (record) {
    record.status = status;
    record.updatedAt = Date.now();
    await tx.store.put(record);
  }
  await tx.done;
}

export async function addRecordWithImage(record, imageFile) {
  const db = await dbPromise;
  
  // Clone
  const recordToSave = JSON.parse(JSON.stringify(record));
  
  // Generate UUID for sync if not exists
  if (!recordToSave.uuid) {
    recordToSave.uuid = crypto.randomUUID();
  }
  
  recordToSave.updatedAt = Date.now();

  if (imageFile) {
    recordToSave.image = imageFile; 
  }
  
  if (!recordToSave.status) recordToSave.status = 'Owned';
  
  // Ensure optional fields
  recordToSave.tracklist = recordToSave.tracklist || '';
  recordToSave.description = recordToSave.description || '';
  recordToSave.marketPrice = recordToSave.marketPrice || '';
  recordToSave.links = recordToSave.links || '';

  return db.put(STORE_NAME, recordToSave);
}

// Soft delete for sync
export async function deleteRecordFromDB(id) {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const record = await tx.store.get(id);
  
  if (record) {
    // Ideally we keep it as "deleted" for sync, but that pollutes the local UI list if not filtered.
    // For V1 sync: let's just delete locally. 
    // If we want true sync, we need soft delete.
    // Let's implement soft delete flag.
    record.deleted = true;
    record.updatedAt = Date.now();
    await tx.store.put(record);
  }
  await tx.done;
}

export async function getSince(timestamp) {
  const db = await dbPromise;
  const records = await db.getAll(STORE_NAME);
  return records.filter(r => (r.updatedAt || 0) > timestamp);
}
