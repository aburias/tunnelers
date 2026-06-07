const { spawn } = require('child_process');
const path = require('path');

const CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared.exe');

const child = spawn(CLOUDFLARED_PATH, ['tunnel', 'login']);

child.stdout.on('data', (data) => console.log('STDOUT:', data.toString()));
child.stderr.on('data', (data) => console.log('STDERR:', data.toString()));

child.on('close', (code) => console.log('Exited with code:', code));
