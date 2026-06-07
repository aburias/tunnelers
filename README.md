# 🚀 Nexus Tunnels

**The ultimate 1-click deployment dashboard for Vibe Coders.**

Stop fighting with complex deployment pipelines, fighting AWS configurations, or struggling with complicated command-line tools. Nexus Tunnels allows you to instantly share your local development sites with the world using Cloudflare's secure Argo network—entirely through a beautiful GUI.

If you are a **Vibe Coder** who loves building things locally and wants to show them off instantly, this is your holy grail.

## ✨ Features

- **⚡ Instant Publishing**: Click one button, and your `localhost:3000` is instantly available on the global internet with a fully secure `https://` connection.
- **🎨 Custom Domains**: Easily bind any local port to your own custom domains (e.g., `api.yourdomain.com`) without touching a single DNS record yourself.
- **🐳 Docker Native**: Designed to sit quietly alongside your Docker containers. It automatically scans your system for running apps and displays them in the dashboard.
- **💾 State Persistence**: When you expose a port, it remembers. Reboot your computer or restart Docker, and your tunnels will instantly boot back up in the background. No more repetitive typing.
- **🛡️ Built-in Safety Locks**: We've built in hardcore validation logic to ensure you can never accidentally overwrite your live root domains. 

## 🛠️ Installation & Setup

We designed Nexus Tunnels to be completely containerized so it never clutters your host machine. 

### Prerequisites
- Docker & Docker Compose installed.
- A Cloudflare account (if you want to use Custom Domains).

### Quick Start
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/nexus-tunnels.git
   cd nexus-tunnels
   ```

2. Spin up the entire stack using Docker Compose:
   ```bash
   docker-compose up -d --build
   ```

3. Open your browser and go to **[http://localhost:3001](http://localhost:3001)**. 
   
*Boom. You're in.*

## 🔒 Security & Privacy
This dashboard operates entirely locally. Your `tunnels.json` configuration and Cloudflare certificates are mapped directly to your local hard drive and are rigorously excluded via `.gitignore`. 

## 🏗️ Architecture
- **Frontend**: React (Vite) - High performance, glassmorphism UI.
- **Backend**: Node.js & Express - Manages the `cloudflared` binary lifecycles and provides a real-time event stream to the dashboard.
- **Network**: Uses `host.docker.internal` to seamlessly bridge your isolated Docker apps to the global internet.

---
*Built for developers who just want to code and share.*
