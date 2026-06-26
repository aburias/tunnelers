const { spawn, exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);
const { CLOUDFLARED_PATH } = require('./downloadCloudflared');

const STATE_FILE = path.join(__dirname, 'data', 'tunnels.json');

class TunnelManager {
    constructor() {
        this.tunnels = new Map();
        this.onUpdate = null;
        // loadState() is called explicitly by server.js after cloudflared is downloaded
    }

    loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = fs.readFileSync(STATE_FILE, 'utf8');
                const state = JSON.parse(data);
                for (const t of state) {
                    console.log(`Auto-starting saved tunnel on port ${t.port}...`);
                    this.startTunnel(t.port, t.provider, t.domain, t.subdomain);
                }
            }
        } catch (e) {
            console.error('Failed to load tunnel state:', e);
        }
    }

    saveState() {
        const state = [];
        for (const [port, info] of this.tunnels.entries()) {
            if (info.status === 'active' || info.status === 'starting') {
                state.push({
                    port,
                    provider: info.provider,
                    domain: info.domain,
                    subdomain: info.subdomain
                });
            }
        }
        try {
            if (!fs.existsSync(path.dirname(STATE_FILE))) {
                fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
            }
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        } catch (e) {
            console.error('Failed to save tunnel state:', e);
        }
    }

    notify() {
        if (this.onUpdate) {
            this.onUpdate(this.getTunnels());
        }
    }

    async startTunnel(port, provider = 'cloudflare', domain = '', subdomain = '') {
        if (this.tunnels.has(port)) {
            return this.tunnels.get(port);
        }

        const tunnelInfo = {
            process: null,
            url: null,
            status: 'starting',
            logs: [],
            error: null,
            provider: provider,
            domain: domain,
            subdomain: subdomain
        };
        this.tunnels.set(port, tunnelInfo);
        this.notify();

        if (provider === 'cloudflare_persistent') {
            if (!domain || domain.trim() === '') {
                tunnelInfo.status = 'error';
                tunnelInfo.error = 'Safety Lock: Base Domain is required.';
                this.notify();
                return tunnelInfo;
            }
            if (!subdomain || subdomain.trim() === '') {
                tunnelInfo.status = 'error';
                tunnelInfo.error = 'Safety Lock: Subdomain is required. Routing to the root domain is disabled to prevent overwriting your live website.';
                this.notify();
                return tunnelInfo;
            }

            const tunnelName = `nexus-port-${port}`;
            const hostname = `${subdomain}.${domain}`;
            const hostTarget = process.env.RUNNING_IN_DOCKER ? 'host.docker.internal' : 'localhost';
            
            try {
                // 1. Check if tunnel already exists
                let tunnelExists = false;
                try {
                    const { stdout } = await execPromise(`"${CLOUDFLARED_PATH}" tunnel info ${tunnelName} 2>&1`);
                    tunnelExists = true;
                } catch (e) {
                    // Tunnel doesn't exist yet, create it
                    await execPromise(`"${CLOUDFLARED_PATH}" tunnel create ${tunnelName}`);
                }

                // 2. Route DNS — always attempt it, but ignore "already exists" errors
                try {
                    await execPromise(`"${CLOUDFLARED_PATH}" tunnel route dns ${tunnelName} ${hostname}`);
                } catch (dnsErr) {
                    const msg = dnsErr.message || dnsErr.stderr || '';
                    if (msg.includes('already exists')) {
                        console.log(`DNS record for ${hostname} already exists, continuing...`);
                    } else {
                        throw dnsErr; // Re-throw unexpected DNS errors
                    }
                }

                // 3. Run tunnel
                const child = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://${hostTarget}:${port}`, 'run', tunnelName]);
                tunnelInfo.process = child;
                tunnelInfo.url = `https://${hostname}`;
                tunnelInfo.status = 'active';
                this.notify();
                this.saveState();

                child.stderr.on('data', (data) => {
                    tunnelInfo.logs.push(data.toString());
                    if (tunnelInfo.logs.length > 50) tunnelInfo.logs.shift();
                });

                child.on('error', (err) => {
                    tunnelInfo.status = 'error';
                    tunnelInfo.error = err.message;
                    this.notify();
                });

                child.on('close', (code) => {
                    tunnelInfo.status = 'stopped';
                    this.notify();
                });

            } catch (err) {
                tunnelInfo.status = 'error';
                tunnelInfo.error = err.message || 'Failed to setup persistent tunnel';
                this.notify();
            }
        } else {
            // Cloudflare Quick Tunnels
            const hostTarget = process.env.RUNNING_IN_DOCKER ? 'host.docker.internal' : 'localhost';
            try {
                const child = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://${hostTarget}:${port}`]);
                tunnelInfo.process = child;

                child.stderr.on('data', (data) => {
                    const output = data.toString();
                    tunnelInfo.logs.push(output);

                    if (tunnelInfo.logs.length > 50) {
                        tunnelInfo.logs.shift();
                    }

                    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
                    if (match && tunnelInfo.status !== 'active') {
                        tunnelInfo.url = match[0];
                        tunnelInfo.status = 'active';
                        this.notify();
                    }
                });

                child.on('error', (err) => {
                    tunnelInfo.status = 'error';
                    if (err.code === 'ENOENT') {
                        tunnelInfo.error = 'cloudflared is not installed or not in PATH.';
                    } else {
                        tunnelInfo.error = err.message;
                    }
                    this.notify();
                });

                child.on('close', (code) => {
                    tunnelInfo.status = 'stopped';
                    this.notify();
                });
            } catch (err) {
                tunnelInfo.status = 'error';
                tunnelInfo.error = `Failed to start cloudflared: ${err.message}`;
                this.notify();
            }
        }

        return tunnelInfo;
    }

    stopTunnel(port) {
        const tunnelInfo = this.tunnels.get(port);
        if (tunnelInfo && tunnelInfo.process) {
            tunnelInfo.process.kill();
            this.tunnels.delete(port);
            this.notify();
            this.saveState();
            return true;
        }
        return false;
    }

    getTunnels() {
        const result = [];
        for (const [port, info] of this.tunnels.entries()) {
            result.push({
                port: port,
                url: info.url,
                status: info.status,
                error: info.error
            });
        }
        return result;
    }
}

module.exports = new TunnelManager();
