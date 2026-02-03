<script setup>
import { ref, computed, onMounted } from 'vue'
import { Html5QrcodeScanner } from "html5-qrcode"
import { getAllRecords, addRecordWithImage, deleteRecordFromDB } from './db'

// State
const records = ref([])
const searchQuery = ref('')
const showScanner = ref(false)
const isSearchingNet = ref(false)
const newRecord = ref({ title: '', artist: '', type: 'Vinyl', catalog: '', barcode: '' })
const newRecordImage = ref(null) // File object
const newRecordImagePreview = ref(null) // URL for preview

// Load from DB on mount
onMounted(async () => {
  try {
    records.value = await getAllRecords()
  } catch (e) {
    console.error('Failed to load records:', e)
  }
})

// Filtered List
const filteredRecords = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return records.value.filter(r => 
    r.title.toLowerCase().includes(q) || 
    r.artist.toLowerCase().includes(q) ||
    r.catalog.toLowerCase().includes(q) ||
    r.barcode.includes(q)
  )
})

// Helper: Blob to URL
const getImageUrl = (blob) => {
  if (!blob) return null
  return URL.createObjectURL(blob)
}

// Actions
const handleNewImageSelect = (e) => {
  const file = e.target.files[0]
  if (file) {
    newRecordImage.value = file
    newRecordImagePreview.value = URL.createObjectURL(file)
  }
}

const addRecord = async () => {
  if (!newRecord.value.title) return
  
  try {
    // Add to DB
    const id = await addRecordWithImage(newRecord.value, newRecordImage.value)
    
    // Update local state (refresh list or push)
    // Reloading all is safer for ID syncing, but pushing is faster. 
    // Let's just push manually to UI state.
    const savedRecord = { 
      ...newRecord.value, 
      id, 
      image: newRecordImage.value 
    }
    records.value.push(savedRecord)

    // Reset Form
    newRecord.value = { title: '', artist: '', type: 'Vinyl', catalog: '', barcode: '' }
    newRecordImage.value = null
    newRecordImagePreview.value = null
  } catch (e) {
    alert('儲存失敗: ' + e.message)
  }
}

const deleteRecord = async (id) => {
  if(!confirm('確定刪除？')) return
  await deleteRecordFromDB(id)
  records.value = records.value.filter(r => r.id !== id)
}

// MusicBrainz API Integration (Unchanged logic)
const searchMusicBrainz = async (query, type) => {
  isSearchingNet.value = true
  let apiQuery = ''
  
  if (type === 'barcode') {
    apiQuery = `barcode:${query}`
  } else if (type === 'text') {
    apiQuery = `release:${query} OR artist:${query}`
  }

  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(apiQuery)}&fmt=json`, {
      headers: { 'User-Agent': 'VinylManagerDemo/0.1 ( littlegray666@example.com )' }
    })
    const data = await response.json()
    
    if (data.releases && data.releases.length > 0) {
      const match = data.releases[0]
      newRecord.value.title = match.title
      newRecord.value.artist = match['artist-credit']?.[0]?.name || 'Unknown'
      newRecord.value.catalog = match['label-info']?.[0]?.['catalog-number'] || ''
      if (type === 'barcode') newRecord.value.barcode = query // Keep scanned barcode
      
      const format = match.media?.[0]?.format?.toLowerCase() || ''
      if (format.includes('vinyl') || format.includes('record')) newRecord.value.type = 'Vinyl'
      else if (format.includes('cd') || format.includes('compact')) newRecord.value.type = 'CD'
      else if (format.includes('cassette')) newRecord.value.type = 'Cassette'
      
      alert(`✅ 找到資料：\n${match.title} - ${newRecord.value.artist}`)
    } else {
      alert('❌ 找不到相關資料')
    }
  } catch (e) {
    console.error(e)
    alert('⚠️ 網路搜尋失敗')
  } finally {
    isSearchingNet.value = false
  }
}

// Handlers
const fetchInfo = async (query, type) => {
  if (type === 'image') {
    alert(`🚧 圖片搜尋需要後端服務。目前僅支援儲存圖片到本地資料庫。`)
    return
  }
  await searchMusicBrainz(query, type)
}

const onScanSuccess = (decodedText) => {
  newRecord.value.barcode = decodedText
  showScanner.value = false
  fetchInfo(decodedText, 'barcode')
}

const startScanner = () => {
  showScanner.value = !showScanner.value
  if (showScanner.value) {
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render(onScanSuccess);
    }, 100)
  }
}

const autoFillByTitle = () => {
  if (!newRecord.value.title) return alert('請先輸入標題關鍵字')
  fetchInfo(newRecord.value.title, 'text')
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-3xl">
    <header class="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
      <h1 class="text-2xl font-bold text-emerald-400">💿 唱片管理系統 <span class="text-xs text-gray-500">v0.3 (Local DB)</span></h1>
      <div class="text-sm">Total: {{ records.length }}</div>
    </header>

    <!-- Search & Tools -->
    <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <input v-model="searchQuery" placeholder="🔍 搜尋 標題 / 藝人 / 編號 / 條碼..." 
             class="bg-gray-800 border border-gray-700 rounded p-2 text-white w-full" />
      
      <div class="flex gap-2">
         <button @click="startScanner" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm w-full transition">
           {{ showScanner ? '關閉掃描' : '📷 掃條碼' }}
         </button>
         <!-- Image search placeholder -->
         <button class="bg-purple-600/50 cursor-not-allowed px-4 py-2 rounded text-sm w-full transition text-gray-400">
           🖼️ 圖搜 (WIP)
         </button>
      </div>
    </div>

    <!-- Scanner Area -->
    <div v-if="showScanner" id="reader" class="mb-8 bg-black rounded overflow-hidden shadow-lg"></div>

    <!-- Add Form -->
    <form @submit.prevent="addRecord" class="bg-gray-800 p-4 rounded mb-8 border border-gray-700 relative">
      <div v-if="isSearchingNet" class="absolute inset-0 bg-gray-900/80 z-10 flex items-center justify-center text-emerald-400 font-bold rounded">
        連線搜尋中...
      </div>
      
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-gray-300">➕ 新增收藏</h3>
        <button type="button" @click="autoFillByTitle" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-emerald-400">
          🔍 用標題自動填寫
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="space-y-4">
          <input v-model="newRecord.title" placeholder="標題 (必填)" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none" required />
          <input v-model="newRecord.artist" placeholder="藝人" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none" />
          <input v-model="newRecord.catalog" placeholder="編號 (Catalog No.)" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none" />
        </div>
        
        <div class="space-y-4">
          <input v-model="newRecord.barcode" placeholder="條碼 (掃描自動填入)" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none" />
          <select v-model="newRecord.type" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none">
            <option>Vinyl</option>
            <option>CD</option>
            <option>Cassette</option>
          </select>
          
          <!-- Image Upload for Record -->
          <div class="flex items-center gap-2">
            <label class="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded cursor-pointer text-sm flex-1 text-center transition">
              📂 上傳封面
              <input type="file" @change="handleNewImageSelect" class="hidden" accept="image/*" />
            </label>
            <div v-if="newRecordImagePreview" class="w-10 h-10 rounded overflow-hidden border border-gray-500">
              <img :src="newRecordImagePreview" class="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
      <button class="bg-emerald-600 hover:bg-emerald-500 w-full py-2 rounded font-bold transition shadow-lg shadow-emerald-900/50">
        儲存到本地資料庫
      </button>
    </form>

    <!-- List -->
    <div class="space-y-3">
      <div v-if="filteredRecords.length === 0" class="text-center text-gray-500 py-8">
        資料庫是空的，快新增第一張唱片吧！
      </div>

      <div v-for="rec in filteredRecords" :key="rec.id" 
           class="bg-gray-800 p-4 rounded flex gap-4 items-start border-l-4 hover:bg-gray-750 transition relative group"
           :class="rec.type === 'Vinyl' ? 'border-orange-500' : 'border-blue-500'">
        
        <!-- Image Thumbnail -->
        <div class="w-16 h-16 bg-gray-900 rounded flex-shrink-0 overflow-hidden border border-gray-700">
          <img v-if="rec.image" :src="getImageUrl(rec.image)" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-2xl">🎵</div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-bold text-lg truncate">{{ rec.title }}</div>
          <div class="text-gray-400 text-sm truncate">{{ rec.artist }} <span v-if="rec.catalog">• {{ rec.catalog }}</span></div>
          <div class="text-xs text-gray-500 mt-1 font-mono tracking-wider flex items-center gap-2">
            <span v-if="rec.barcode">BAR: {{ rec.barcode }}</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-gray-700 border border-gray-600">{{ rec.type }}</span>
          </div>
        </div>

        <button @click="deleteRecord(rec.id)" class="text-gray-600 hover:text-red-400 p-2 absolute top-2 right-2 group-hover:opacity-100 opacity-0 transition">
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>
