const { exec } = require('child_process');

function runCommand(command) {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            resolve(stdout || stderr || '');
        });
    });
}

async function getDockerPorts() {
    const ports = [];
    const portSet = new Set();
    
    // Get docker container names and their port mappings
    const dockerOutput = await runCommand('docker ps --format "{{.Names}}|{{.Ports}}"');
    if (dockerOutput && !dockerOutput.toLowerCase().includes('error')) {
        const lines = dockerOutput.trim().split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            const [name, portsStr] = line.split('|');
            if (!portsStr) continue;
            
            // Example portsStr: "0.0.0.0:8080->80/tcp, :::8080->80/tcp"
            const portMappings = portsStr.split(',');
            for (const mapping of portMappings) {
                // We want the host port, which is before the "->"
                const match = mapping.match(/:(\d+)->/);
                if (match && match[1]) {
                    const port = parseInt(match[1], 10);
                    if (!isNaN(port) && !portSet.has(port)) {
                        portSet.add(port);
                        ports.push({
                            port: port,
                            process: `🐳 ${name}`,
                            pid: 'docker',
                            ip: '0.0.0.0'
                        });
                    }
                }
            }
        }
    }
    return ports;
}

async function getListeningPorts(onlyDocker = false) {
    const dockerPorts = await getDockerPorts();
    if (onlyDocker) {
        return dockerPorts.sort((a, b) => a.port - b.port);
    }

    // 1. Get tasklist to map PID to Process Name
    const tasklistOutput = await runCommand('tasklist /fo csv');
    const pidToProcess = {};
    const lines = tasklistOutput.trim().split('\n');
    // skip header (first line)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const stripped = line.replace(/^"|"$/g, '');
        const parts = stripped.split('","');
        if (parts.length >= 2) {
            const processName = parts[0];
            const pid = parts[1];
            pidToProcess[pid] = processName;
        }
    }

    // 2. Get listening ports from netstat
    const netstatOutput = await runCommand('netstat -ano | findstr LISTENING');
    const ports = [];
    const portSet = new Set();

    const netLines = netstatOutput.trim().split('\n');
    for (const line of netLines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        // Netstat line: TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1160
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
            const localAddress = parts[1];
            const pid = parts[4];
            
            const lastColonIndex = localAddress.lastIndexOf(':');
            if (lastColonIndex === -1) continue;
            
            const ip = localAddress.substring(0, lastColonIndex);
            const port = parseInt(localAddress.substring(lastColonIndex + 1), 10);
            
            if (isNaN(port)) continue;
            
            if (!portSet.has(port)) {
                portSet.add(port);
                ports.push({
                    port: port,
                    process: pidToProcess[pid] || 'Unknown',
                    pid: pid,
                    ip: ip
                });
            }
        }
    }
    
    // Merge docker ports
    for (const dPort of dockerPorts) {
        if (!portSet.has(dPort.port)) {
            portSet.add(dPort.port);
            ports.push(dPort);
        } else {
            // Overwrite process name with docker info if it already exists
            const existing = ports.find(p => p.port === dPort.port);
            if (existing) {
                existing.process = dPort.process;
            }
        }
    }

    // Filter out some noisy/system ports (e.g. standard Windows RPC ports if needed)
    // For now, return all
    ports.sort((a, b) => a.port - b.port);
    return ports;
}

module.exports = { getListeningPorts };
