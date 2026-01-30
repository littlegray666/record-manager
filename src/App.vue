<script setup>
import { ref, computed } from 'vue'
import { Html5QrcodeScanner } from "html5-qrcode"

// State
const records = ref([
  { id: 1, title: 'Symphony No. 6', artist: 'Toscanini', type: 'Vinyl', catalog: 'ALP 1129', barcode: '' },
  { id: 2, title: 'Dark Side of the Moon', artist: 'Pink Floyd', type: 'CD', catalog: 'CDP 7 46001 2', barcode: '077774600125' }
])

const searchQuery = ref('')
const showScanner = ref(false)
const isSearchingNet = ref(false)
const newRecord = ref({ title: '', artist: '', type: 'Vinyl', catalog: '', barcode: '' })

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

// Actions
const addRecord = () => {
  if (!newRecord.value.title) return
  records.value.push({ ...newRecord.value, id: Date.now() })
  newRecord.value = { title: '', artist: '', type: 'Vinyl', catalog: '', barcode: '' }
}

const deleteRecord = (id) => {
  records.value = records.value.filter(r => r.id !== id)
}

// MusicBrainz API Integration
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
      
      // Try to guess format
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

// Handler Wrappers
const fetchInfo = async (query, type) => {
  if (type === 'image') {
    alert(`🚧 圖片搜尋需要後端服務 (如 Google Vision 或 Discogs API)。\n此為純前端演示，暫無法實作影像辨識。`)
    // 模擬辨識結果
    // newRecord.value.title = "Simulated Image Result"
    return
  }
  await searchMusicBrainz(query, type)
}

const onScanSuccess = (decodedText, decodedResult) => {
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

const handleImageUpload = (e) => {
  const file = e.target.files[0]
  if(file) fetchInfo(file.name, 'image')
}

const autoFillByTitle = () => {
  if (!newRecord.value.title) return alert('請先輸入標題關鍵字')
  fetchInfo(newRecord.value.title, 'text')
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-3xl">
    <header class="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
      <h1 class="text-2xl font-bold text-emerald-400">💿 唱片管理系統 <span class="text-xs text-gray-500">v0.2</span></h1>
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
         <label class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-sm w-full text-center cursor-pointer transition">
           🖼️ 圖搜
           <input type="file" @change="handleImageUpload" class="hidden" accept="image/*" />
         </label>
      </div>
    </div>

    <!-- Scanner Area -->
    <div v-if="showScanner" id="reader" class="mb-8 bg-black rounded overflow-hidden shadow-lg"></div>

    <!-- Add Form -->
    <form @submit.prevent="addRecord" class="bg-gray-800 p-4 rounded mb-8 border border-gray-700 relative">
      <div v-if="isSearchingNet" class="absolute inset-0 bg-gray-900/80 z-10 flex items-center justify-center text-emerald-400 font-bold">
        連線搜尋中...
      </div>
      
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-gray-300">➕ 新增收藏</h3>
        <button type="button" @click="autoFillByTitle" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-emerald-400">
          🔍 用標題自動填寫
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <input v-model="newRecord.title" placeholder="標題 (輸入後點右上方自動填寫)" class="bg-gray-700 p-2 rounded focus:ring-2 ring-emerald-500 outline-none" required />
        <input v-model="newRecord.artist" placeholder="藝人" class="bg-gray-700 p-2 rounded focus:ring-2 ring-emerald-500 outline-none" />
        <input v-model="newRecord.catalog" placeholder="編號 (Catalog No.)" class="bg-gray-700 p-2 rounded focus:ring-2 ring-emerald-500 outline-none" />
        <input v-model="newRecord.barcode" placeholder="條碼 (掃描自動填入)" class="bg-gray-700 p-2 rounded focus:ring-2 ring-emerald-500 outline-none" />
        <select v-model="newRecord.type" class="bg-gray-700 p-2 rounded focus:ring-2 ring-emerald-500 outline-none">
          <option>Vinyl</option>
          <option>CD</option>
          <option>Cassette</option>
        </select>
      </div>
      <button class="bg-emerald-600 hover:bg-emerald-500 w-full py-2 rounded font-bold transition shadow-lg shadow-emerald-900/50">加入資料庫</button>
    </form>

    <!-- List -->
    <div class="space-y-3">
      <div v-for="rec in filteredRecords" :key="rec.id" 
           class="bg-gray-800 p-4 rounded flex justify-between items-center border-l-4 hover:bg-gray-750 transition"
           :class="rec.type === 'Vinyl' ? 'border-orange-500' : 'border-blue-500'">
        <div>
          <div class="font-bold text-lg">{{ rec.title }}</div>
          <div class="text-gray-400 text-sm">{{ rec.artist }} • {{ rec.catalog }}</div>
          <div class="text-xs text-gray-500 mt-1 font-mono tracking-wider">{{ rec.barcode }}</div>
        </div>
        <div class="text-right">
          <span class="text-xs font-bold px-2 py-1 rounded bg-gray-700 mr-2 border border-gray-600">{{ rec.type }}</span>
          <button @click="deleteRecord(rec.id)" class="text-red-400 hover:text-red-300 p-1">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>
