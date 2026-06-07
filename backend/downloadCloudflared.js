const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
let CLOUDFLARED_URL = '';
let CLOUDFLARED_PATH = '';

if (platform === 'win32') {
    CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
    CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared.exe');
} else if (platform === 'linux') {
    CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
    CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared');
} else if (platform === 'darwin') {
    CLOUDFLARED_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64';
    CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared');
} else {
    throw new Error('Unsupported platform for cloudflared');
}

async function downloadCloudflared() {
    if (fs.existsSync(CLOUDFLARED_PATH)) {
        const stats = fs.statSync(CLOUDFLARED_PATH);
        if (stats.size > 1000000) { // check if it's > 1MB
            console.log('cloudflared already exists locally and size seems correct.');
            return CLOUDFLARED_PATH;
        } else {
            console.log('cloudflared file exists but is too small or empty. Redownloading...');
            fs.unlinkSync(CLOUDFLARED_PATH);
        }
    }

    console.log('Downloading cloudflared.exe via fetch...');
    const response = await fetch(CLOUDFLARED_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch cloudflared: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(CLOUDFLARED_PATH, buffer);
    
    if (platform !== 'win32') {
        fs.chmodSync(CLOUDFLARED_PATH, 0o755);
    }
    
    console.log('cloudflared downloaded successfully. Size:', buffer.length);
    return CLOUDFLARED_PATH;
}

module.exports = { downloadCloudflared, CLOUDFLARED_PATH };
