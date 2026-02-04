# Record Manager - Podman Deployment Guide

This app is a static SPA (Single Page Application). You can deploy it using any static web server (Nginx, Apache, Caddy).

## 🐳 Build & Run with Podman

### 1. Build Image
```bash
podman build -t record-manager .
```

### 2. Run Container
```bash
podman run -d -p 8080:80 --name record-app record-manager
```

Now open: http://localhost:8080

### 💾 Data Persistence (Important!)
Since this app uses **IndexedDB (Browser Storage)**, all data is stored on the **client side (your device)**.
The container **does not** store your records.
- **Pros:** No backend database required. Privacy first.
- **Cons:** If you clear browser data, records are gone.
- **Solution:** Use the **Export/Import** feature in Settings to backup your data regularly.

## 🛠️ Development (Hot Reload)
If you want to develop inside a container:
```bash
podman run -it --rm -p 5173:5173 -v $(pwd):/app -w /app node:20-alpine sh -c "npm install && npm run dev -- --host"
```
