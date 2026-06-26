const express = require('express');
const cors = require('cors');
const { getListeningPorts } = require('./portScanner');
const tunnelManager = require('./tunnelManager');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { CLOUDFLARED_PATH } = require('./downloadCloudflared');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from /frontend/dist
const frontendPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
}

app.get('/api/ports', async (req, res) => {
    try {
        const onlyDocker = req.query.dockerOnly === 'true';
        const ports = await getListeningPorts(onlyDocker);
        res.json({ success: true, data: ports });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/tunnels', (req, res) => {
    res.json({ success: true, data: tunnelManager.getTunnels() });
});

// --- Cloudflare Auth Endpoints ---

const getCertPath = () => path.join(os.homedir(), '.cloudflared', 'cert.pem');

app.get('/api/cloudflare/status', (req, res) => {
    const isAuthorized = fs.existsSync(getCertPath());
    res.json({ success: true, authorized: isAuthorized });
});

app.post('/api/cloudflare/login', (req, res) => {
    const child = spawn(CLOUDFLARED_PATH, ['tunnel', 'login']);
    let urlFound = false;

    child.stderr.on('data', (data) => {
        const output = data.toString();
        const match = output.match(/https:\/\/dash\.cloudflare\.com\/argotunnel[^\s]+/);
        if (match && !urlFound) {
            urlFound = true;
            res.json({ success: true, url: match[0] });
        }
    });

    child.on('close', (code) => {
        if (!urlFound) {
            res.status(500).json({ success: false, error: 'Login failed or timed out.' });
        }
    });
});

// ---------------------------------

app.post('/api/tunnels', async (req, res) => {
    const port = parseInt(req.body.port, 10);
    const provider = req.body.provider || 'cloudflare';
    const domain = req.body.domain || '';
    const subdomain = req.body.subdomain || '';

    if (!port) {
        return res.status(400).json({ success: false, error: 'Port is required' });
    }
    const tunnelInfo = await tunnelManager.startTunnel(port, provider, domain, subdomain);
    res.json({ success: true, data: { port, status: tunnelInfo.status, error: tunnelInfo.error } });
});

app.delete('/api/tunnels/:port', (req, res) => {
    const port = parseInt(req.params.port, 10);
    const stopped = tunnelManager.stopTunnel(port);
    res.json({ success: true, data: { stopped } });
});

// SSE Endpoint
let clients = [];
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE

    clients.push(res);
    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// Broadcast updates
tunnelManager.onUpdate = (tunnels) => {
    const data = `data: ${JSON.stringify({ success: true, data: tunnels })}\n\n`;
    clients.forEach(client => client.write(data));
};

const { downloadCloudflared } = require('./downloadCloudflared');

// Fallback for React Router
app.use((req, res) => {
    if (fs.existsSync(frontendPath)) {
        res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
        res.status(404).send('Frontend not built.');
    }
});

const PORT = 3001;

downloadCloudflared()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend server running on http://localhost:${PORT}`);
            // Now that cloudflared is downloaded and server is ready, restore saved tunnels
            tunnelManager.loadState();
        });
    })
    .catch((err) => {
        console.error('Failed to download or find cloudflared:', err);
        process.exit(1);
    });
