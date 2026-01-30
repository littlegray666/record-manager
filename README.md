# 💿 唱片管理系統 (Vinyl & CD Manager)

這是一個基於 Vue 3 開發的唱片收藏管理工具，專為實體音樂收藏家設計。

## ✨ 功能特色

- **條碼掃描**：整合 `html5-qrcode`，支援透過鏡頭掃描專輯條碼。
- **自動資料抓取**：串接 **MusicBrainz API**，掃碼或輸入標題即可自動填寫專輯資訊。
- **快速搜尋**：支援標題、藝人、編號 (Catalog No.) 及條碼的即時過濾。
- **極速體驗**：使用 Vite + Tailwind CSS 建構，介面簡潔流暢（暗黑模式）。
- **響應式設計**：支援手機與桌面瀏覽。

## 🛠️ 技術棧

- Vue 3 (Composition API)
- Vite
- Tailwind CSS
- html5-qrcode

## 🚀 快速開始

### 安裝依賴
```bash
npm install
```

### 啟動開發伺服器
```bash
npm run dev
```

開啟瀏覽器訪問 `http://localhost:5173`。

## 📝 待辦清單 (Todo)
- [ ] 實作後端資料庫 (目前為純前端儲存)
- [ ] 串接 Discogs API 以取得更完整的封面圖片
- [ ] 匯出/匯入收藏清單 (JSON/CSV)
