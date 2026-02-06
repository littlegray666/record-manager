<script setup>
import { ref, computed, onMounted } from 'vue'
import { Html5QrcodeScanner } from "html5-qrcode"
import { getAllRecords, addRecordWithImage, deleteRecordFromDB, updateRecordStatus } from './db'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { exportData, importData } from './backup'

// State
const records = ref([])
const searchQuery = ref('')
const showScanner = ref(false)
const isSearchingNet = ref(false)
const isAnalyzingAI = ref(false)
const newRecord = ref({ 
  title: '', 
  artist: '', 
  type: 'Vinyl', 
  catalog: '', 
  barcode: '', 
  status: 'Owned',
  tracklist: '',
  description: '',
  marketPrice: '',
  links: ''
})
const newRecordImage = ref(null) // File object
const newRecordImagePreview = ref(null) // URL for preview
const geminiApiKey = ref(localStorage.getItem('gemini_api_key') || '')
const showSettings = ref(false)
const activeTab = ref('Owned') // Owned | Wishlist
const expandedId = ref(null) // Track which record is expanded

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

// Save API Key
const saveApiKey = () => {
  localStorage.setItem('gemini_api_key', geminiApiKey.value)
  showSettings.value = false
  alert('API Key 已儲存')
}

// AI Analysis
const analyzeImageWithAI = async (file) => {
  if (!geminiApiKey.value) {
    alert('請先點擊右上角 ⚙️ 設定 Gemini API Key 才能使用 AI 分析')
    showSettings.value = true
    return
  }

  isAnalyzingAI.value = true
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey.value)
    
    // Convert file to base64
    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(file)
    })

    const prompt = `Analyze this image of a music album (cover or back). 
    Extract the following details and return them in STRICT JSON format:
    {
      "artist": "Artist Name",
      "title": "Album Title",
      "catalog": "Catalog Number (if visible)",
      "barcode": "Barcode Number (if visible)",
      "type": "Vinyl or CD or Cassette (guess based on shape/spine)",
      "tracklist": "List of tracks if visible (separated by newline)",
      "description": "Brief description of the artist/album style in Traditional Chinese (繁體中文). Translate if necessary.",
      "marketPrice": "Estimated market value range (e.g. '$20-$50')",
      "links": "Relevant Discogs/Wikipedia links if known (separated by newline)"
    }
    If you can't find specific info, leave it empty string. Do not use code blocks.`

    // 1. Dynamic Model Discovery
    let selectedModel = "gemini-1.5-flash" // Default fallback
    try {
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey.value}`)
      if (listResp.ok) {
        const listData = await listResp.json()
        // Filter for Gemini models that support content generation
        const viableModels = listData.models
          .filter(m => 
            m.supportedGenerationMethods.includes("generateContent") && 
            m.name.includes("gemini")
          )
          .map(m => m.name.replace("models/", ""))
        
        console.log("Available models from API:", viableModels)

        // Sort by version number (descending) to find the "newest"
        // Extracts "1.5", "2.0", etc.
        viableModels.sort((a, b) => {
          const getVer = (s) => {
            const match = s.match(/(\d+)\.(\d+)/)
            return match ? parseFloat(match[0]) : 0
          }
          return getVer(b) - getVer(a)
        })

        if (viableModels.length > 0) {
          selectedModel = viableModels[0] // Pick the highest version model
          console.log(`Auto-selected newest model: ${selectedModel}`)
        }
      }
    } catch (e) {
      console.warn("Failed to list models, using default:", e)
    }

    console.log(`Using model: ${selectedModel}`)
    const model = genAI.getGenerativeModel({ model: selectedModel })
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } }
    ])

    const response = await result.response
    const text = response.text().replace(/```json|```/g, '').trim()
    const data = JSON.parse(text)

    // Auto-fill form
    if (data.title) newRecord.value.title = data.title
    if (data.artist) newRecord.value.artist = data.artist
    if (data.catalog) newRecord.value.catalog = data.catalog
    if (data.barcode) newRecord.value.barcode = data.barcode
    if (data.type) newRecord.value.type = data.type
    if (data.tracklist) newRecord.value.tracklist = data.tracklist
    if (data.description) newRecord.value.description = data.description
    if (data.marketPrice) newRecord.value.marketPrice = data.marketPrice
    if (data.links) newRecord.value.links = data.links

    alert(`🤖 AI 分析完成！\n藝人: ${data.artist}\n專輯: ${data.title}\n估價: ${data.marketPrice || '未知'}`)

  } catch (e) {
    console.error(e)
    alert('AI 分析失敗: ' + e.message)
  } finally {
    isAnalyzingAI.value = false
  }
}

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
  return records.value.filter(r => {
    // Filter by tab status
    const statusMatch = (r.status || 'Owned') === activeTab.value
    
    // Filter by search query
    const searchMatch = 
      r.title.toLowerCase().includes(q) || 
      r.artist.toLowerCase().includes(q) ||
      r.catalog.toLowerCase().includes(q) ||
      r.barcode.includes(q)
      
    return statusMatch && searchMatch
  })
})

// Backup Handlers
const handleExport = async () => {
  try {
    await exportData()
    alert('匯出成功！請妥善保存 JSON 檔案。')
  } catch (e) {
    console.error(e)
    alert('匯出失敗: ' + e.message)
  }
}

const handleImport = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  if(!confirm('匯入將會覆蓋/新增資料，確定嗎？')) return

  try {
    const count = await importData(file)
    alert(`成功匯入 ${count} 筆資料！`)
    // Refresh list
    records.value = await getAllRecords()
  } catch (e) {
    console.error(e)
    alert('匯入失敗: ' + e.message)
  }
}

// Move to Owned
const moveToOwned = async (record) => {
  try {
    await updateRecordStatus(record.id, 'Owned')
    // Update local UI
    const index = records.value.findIndex(r => r.id === record.id)
    if(index !== -1) records.value[index].status = 'Owned'
    alert('已移至收藏庫！')
  } catch (e) {
    console.error(e)
    alert('移動失敗')
  }
}

// Add Record
const addRecord = async () => {
  if (!newRecord.value.title) return
  
  try {
    // Set status based on active tab
    newRecord.value.status = activeTab.value
    
    const id = await addRecordWithImage(newRecord.value, newRecordImage.value)
    
    const savedRecord = { 
      ...newRecord.value, 
      id, 
      image: newRecordImage.value 
    }
    records.value.push(savedRecord)

    // Reset Form
    newRecord.value = { 
      title: '', artist: '', type: 'Vinyl', catalog: '', barcode: '', status: 'Owned',
      tracklist: '', description: '', marketPrice: '', links: '' 
    }
    newRecordImage.value = null
    newRecordImagePreview.value = null
  } catch (e) {
    alert('儲存失敗: ' + e.message)
  }
}

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
    
    // Trigger AI analysis if key is present, OR prompt to set it up
    if (geminiApiKey.value) {
      if(confirm('要使用 AI 自動分析這張圖片的資訊嗎？')) {
        analyzeImageWithAI(file)
      }
    } else {
      if(confirm('要使用 AI 自動分析圖片嗎？(需要設定 API Key)')) {
        showSettings.value = true
        // Delay alert slightly to let modal open
        setTimeout(() => alert('請在此輸入您的 Gemini API Key 以啟用 AI 辨識功能。'), 100)
      }
    }
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
    <header class="mb-8 border-b border-gray-700 pb-4">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold text-emerald-400">💿 唱片管理 <span class="text-xs text-gray-500">v0.5</span></h1>
        <div class="flex items-center gap-3">
          <button @click="showSettings = !showSettings" class="text-gray-400 hover:text-white transition">⚙️</button>
          <div class="text-sm bg-gray-800 px-2 py-1 rounded">{{ records.length }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2">
        <button @click="activeTab = 'Owned'" 
                class="flex-1 py-2 rounded font-bold transition border-b-2"
                :class="activeTab === 'Owned' ? 'text-emerald-400 border-emerald-500 bg-gray-800' : 'text-gray-500 border-transparent hover:bg-gray-800/50'">
          🎵 收藏庫
        </button>
        <button @click="activeTab = 'Wishlist'" 
                class="flex-1 py-2 rounded font-bold transition border-b-2"
                :class="activeTab === 'Wishlist' ? 'text-pink-400 border-pink-500 bg-gray-800' : 'text-gray-500 border-transparent hover:bg-gray-800/50'">
          ❤️ 願望清單
        </button>
      </div>
    </header>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="mb-8 bg-gray-800 p-4 rounded border border-gray-600 space-y-4">
      <div>
        <h3 class="font-bold mb-2 text-sm text-gray-400">Gemini API Key (AI 辨識)</h3>
        <div class="flex gap-2">
          <input type="password" v-model="geminiApiKey" placeholder="貼上 API Key" 
                 class="bg-gray-700 p-2 rounded flex-1 text-white text-sm" />
          <button @click="saveApiKey" class="bg-blue-600 hover:bg-blue-500 px-3 rounded font-bold text-sm">儲存</button>
        </div>
      </div>
      
      <div class="border-t border-gray-700 pt-4">
        <h3 class="font-bold mb-2 text-sm text-gray-400">資料備份</h3>
        <div class="flex gap-2">
          <button @click="handleExport" class="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-sm font-bold flex-1">
            📤 匯出 JSON
          </button>
          <label class="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded text-sm font-bold flex-1 text-center cursor-pointer">
            📥 匯入 JSON
            <input type="file" @change="handleImport" class="hidden" accept=".json" />
          </label>
        </div>
      </div>
    </div>

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
      <div v-if="isSearchingNet || isAnalyzingAI" class="absolute inset-0 bg-gray-900/80 z-10 flex items-center justify-center text-emerald-400 font-bold rounded">
        {{ isAnalyzingAI ? '🤖 AI 分析圖片中...' : '連線搜尋中...' }}
      </div>
      
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold" :class="activeTab === 'Wishlist' ? 'text-pink-400' : 'text-emerald-400'">
          {{ activeTab === 'Wishlist' ? '❤️ 新增願望' : '➕ 新增收藏' }}
        </h3>
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

        <!-- Expanded Details Fields -->
        <div class="md:col-span-2 space-y-4 border-t border-gray-700 pt-4 mt-2">
           <h4 class="font-bold text-gray-400 text-sm">📝 詳細資訊 (AI 自動填寫)</h4>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <textarea v-model="newRecord.tracklist" placeholder="曲目列表 (Tracklist)" rows="3" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none text-sm"></textarea>
             <textarea v-model="newRecord.description" placeholder="專輯介紹 / 藝人簡介" rows="3" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none text-sm"></textarea>
           </div>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input v-model="newRecord.marketPrice" placeholder="💰 市場估價" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none text-sm" />
             <input v-model="newRecord.links" placeholder="🔗 相關連結 (Discogs / Wiki)" class="bg-gray-700 p-2 rounded w-full focus:ring-2 ring-emerald-500 outline-none text-sm" />
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

        <div class="flex-1 min-w-0 cursor-pointer" @click="toggleExpand(rec.id)">
          <div class="font-bold text-lg truncate">{{ rec.title }}</div>
          <div class="text-gray-400 text-sm truncate">{{ rec.artist }} <span v-if="rec.catalog">• {{ rec.catalog }}</span></div>
          <div class="text-xs text-gray-500 mt-1 font-mono tracking-wider flex items-center gap-2">
            <span v-if="rec.barcode">BAR: {{ rec.barcode }}</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-gray-700 border border-gray-600">{{ rec.type }}</span>
          </div>
          
          <!-- Expanded Details View -->
          <div v-if="expandedId === rec.id" class="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-300 space-y-2 animate-fade-in cursor-auto" @click.stop>
            <div v-if="rec.description">
              <span class="text-emerald-400 font-bold">📝 介紹:</span>
              <p class="mt-1 bg-gray-900/50 p-2 rounded">{{ rec.description }}</p>
            </div>
            <div v-if="rec.tracklist">
              <span class="text-emerald-400 font-bold">🎵 曲目:</span>
              <pre class="mt-1 bg-gray-900/50 p-2 rounded whitespace-pre-wrap font-sans text-xs">{{ rec.tracklist }}</pre>
            </div>
            <div v-if="rec.marketPrice">
              <span class="text-emerald-400 font-bold">💰 估價:</span> {{ rec.marketPrice }}
            </div>
            <div v-if="rec.links">
              <span class="text-emerald-400 font-bold">🔗 連結:</span>
              <a v-for="(link, i) in rec.links.split('\n')" :key="i" :href="link" target="_blank" class="block text-blue-400 hover:underline truncate">{{ link }}</a>
            </div>
          </div>
        </div>

        <div class="text-right flex flex-col items-end gap-2">
          <div class="flex gap-2">
            <button v-if="rec.status === 'Wishlist'" @click="moveToOwned(rec)" class="text-xs font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm">
              ➕ 購入
            </button>
            <span class="text-xs font-bold px-2 py-1 rounded bg-gray-700 border border-gray-600">{{ rec.type }}</span>
          </div>
          <button @click="deleteRecord(rec.id)" class="text-gray-500 hover:text-red-400 text-sm p-1">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>
