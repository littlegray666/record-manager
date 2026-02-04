# 💿 唱片管理系統 (Record Manager)

![Version](https://img.shields.io/badge/version-0.5-emerald) ![Status](https://img.shields.io/badge/status-active-blue)

這是一個基於 Vue 3 開發的現代化唱片收藏管理工具，專為黑膠與 CD 收藏家設計。支援 **離線使用 (PWA)** 與 **AI 智慧辨識**。

## ✨ 功能特色 (v0.5)

### 核心功能
- **📸 條碼掃描**：整合 `html5-qrcode`，透過鏡頭掃描條碼自動搜尋資料。
- **🤖 AI 智慧辨識**：上傳封面照片，利用 **Gemini AI** 自動分析並填寫藝人、專輯與格式資訊。
- **💾 本地資料庫**：使用 **IndexedDB** 技術，資料與圖片永久儲存於瀏覽器，不需後端伺服器。
- **📱 PWA 支援**：可安裝至手機桌面，支援**完全離線**使用。

### 管理功能
- **🎵 收藏 vs 願望清單**：區分已擁有與想購買的唱片，支援一鍵「購入」轉移。
- **📥 備份與還原**：支援匯出完整資料庫 (含圖片) 為 JSON 檔，輕鬆跨裝置轉移。
- **🔍 極速搜尋**：支援標題、藝人、編號、條碼即時過濾。

## 🛠️ 技術棧

- **Framework:** Vue 3 (Script Setup)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Database:** IndexedDB (via `idb`)
- **AI:** Google Gemini API
- **PWA:** vite-plugin-pwa

## 🚀 快速開始

### 1. 安裝與執行
```bash
# 安裝依賴
npm install

# 啟動開發環境
npm run dev
```

### 2. 部署 (GitHub Pages)
本專案已設定好 GitHub Actions，推送到 `main` 分支即可自動部署。
需在 GitHub Repo Settings -> Pages -> Source 選擇 "GitHub Actions"。

### 3. Docker / Podman 部署
```bash
# 建置映像檔
podman build -t record-manager .

# 執行容器
podman run -d -p 8080:80 record-manager
```

## ⚙️ 設定說明

- **AI 功能**：需在介面右上角「⚙️ 設定」中輸入您的 Google Gemini API Key (免費申請)。Key 僅儲存於本地瀏覽器。
- **資料安全**：資料儲存於您的設備上。請定期使用「匯出 JSON」功能進行備份。

## 📝 開發計畫
詳見 [PLAN.md](./PLAN.md)
