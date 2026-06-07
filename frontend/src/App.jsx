import React, { useState, useEffect } from 'react';
import { Network, RefreshCw, Activity, ShieldCheck } from 'lucide-react';
import TunnelCard from './components/TunnelCard';

const API_URL = '/api';

function App() {
  const [ports, setPorts] = useState([]);
  const [tunnels, setTunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dockerOnly, setDockerOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cloudflare Settings
  const [provider, setProvider] = useState(() => localStorage.getItem('nexus_provider') || 'cloudflare');
  const [domain, setDomain] = useState(() => localStorage.getItem('nexus_domain') || '');
  const [subdomain, setSubdomain] = useState(() => localStorage.getItem('nexus_subdomain') || '');
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexus_provider', provider);
    localStorage.setItem('nexus_domain', domain);
    localStorage.setItem('nexus_subdomain', subdomain);
  }, [provider, domain, subdomain]);

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/cloudflare/status`).then(r => r.json());
      if (res.success) setIsAuthorized(res.authorized);
    } catch (err) {
      console.error('Failed to check auth status', err);
    }
  };

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      // This will spawn the login process which opens the browser automatically on Windows
      const res = await fetch(`${API_URL}/cloudflare/login`, { method: 'POST' }).then(r => r.json());
      if (res.success && res.url) {
        // We can poll auth status now until it becomes authorized
        const poll = setInterval(async () => {
          const statusRes = await fetch(`${API_URL}/cloudflare/status`).then(r => r.json());
          if (statusRes.success && statusRes.authorized) {
            setIsAuthorized(true);
            setIsAuthorizing(false);
            clearInterval(poll);
          }
        }, 2000);
      } else {
        setIsAuthorizing(false);
      }
    } catch (err) {
      console.error('Failed to start login', err);
      setIsAuthorizing(false);
    }
  };

  const fetchData = async () => {
    setRefreshing(true);
    fetchAuthStatus();
    try {
      const [portsRes, tunnelsRes] = await Promise.all([
        fetch(`${API_URL}/ports?dockerOnly=${dockerOnly}`).then(r => r.json()),
        fetch(`${API_URL}/tunnels`).then(r => r.json())
      ]);

      if (portsRes.success) setPorts(portsRes.data);
      if (tunnelsRes.success) setTunnels(tunnelsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dockerOnly]);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success) {
          setTunnels(data.data);
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStartTunnel = async (port, tunnelSubdomain) => {
    setTunnels(prev => [...prev.filter(t => t.port !== port), { port, status: 'starting' }]);
    
    try {
      await fetch(`${API_URL}/tunnels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, provider, domain, subdomain: tunnelSubdomain || '' })
      });
    } catch (err) {
      console.error('Failed to start tunnel', err);
      fetchData();
    }
  };

  const handleStopTunnel = async (port) => {
    setTunnels(prev => prev.filter(t => t.port !== port));
    
    try {
      await fetch(`${API_URL}/tunnels/${port}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to stop tunnel', err);
      fetchData();
    }
  };
  
  const tunneledPorts = new Set(tunnels.map(t => t.port));
  const activeTunnels = tunnels;
  const availablePorts = ports.filter(p => !tunneledPorts.has(p.port));
  const filteredAvailablePorts = availablePorts.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return p.port.toString().includes(query) || (p.process && p.process.toLowerCase().includes(query));
  });

  return (
    <div className="app-container">
      <header className="header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="header-title">
            <Network size={36} className="header-icon" />
            <h1>Nexus Tunnels</h1>
          </div>
          <button 
            className="btn" 
            onClick={fetchData} 
            disabled={refreshing}
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh Ports'}
          </button>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>Domain Settings</h3>
            
            {provider === 'cloudflare_persistent' && !isAuthorized && (
               <button className="btn" onClick={handleAuthorize} disabled={isAuthorizing} style={{ background: 'var(--primary)', color: 'white' }}>
                 {isAuthorizing ? 'Waiting for browser...' : 'Authorize Cloudflare'}
               </button>
            )}
            {provider === 'cloudflare_persistent' && isAuthorized && (
               <span style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                 <div className="status-dot" style={{ background: 'var(--success)' }}></div>
                 Account Authorized
               </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '200px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tunnel Mode</label>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value)}
                style={{ background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '6px', fontFamily: 'inherit', fontSize: '0.95rem' }}
              >
                <option value="cloudflare">Cloudflare Quick (Random URLs)</option>
                <option value="cloudflare_persistent">Custom Domain (Persistent URLs)</option>
              </select>
            </div>
            
            {provider === 'cloudflare_persistent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Base Domain</label>
                <input 
                  type="text" 
                  value={domain} 
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. mycoolapp.com"
                  style={{ background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.95rem' }}
                />
              </div>
            )}
          </div>
          
          {provider === 'cloudflare_persistent' && !isAuthorized && (
            <div style={{ fontSize: '0.85rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
              ⚠️ You must click "Authorize Cloudflare" above to grant the dashboard access to your domains.
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="loading-spinner">
          <RefreshCw size={32} />
        </div>
      ) : (
        <div className="dashboard-grid">
          <div>
            <h2 className="section-title">
              <Activity size={20} color="var(--success)" />
              Active Tunnels
            </h2>
            <div className="list-container">
              {activeTunnels.length === 0 ? (
                <div className="empty-state">
                  <ShieldCheck size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <p>No active tunnels. Select an available port to expose it securely to the internet.</p>
                </div>
              ) : (
                activeTunnels.map(tunnel => {
                  const portInfo = ports.find(p => p.port === tunnel.port);
                  return (
                    <TunnelCard
                      key={tunnel.port}
                      port={tunnel.port}
                      processName={portInfo ? portInfo.process : 'Custom Port'}
                      status={tunnel.status}
                      url={tunnel.url}
                      error={tunnel.error}
                      onStart={handleStartTunnel}
                      onStop={handleStopTunnel}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Network size={20} color="var(--accent)" />
                Available Local Ports
              </div>
              <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 400 }}>
                <input 
                  type="checkbox" 
                  checked={dockerOnly} 
                  onChange={(e) => setDockerOnly(e.target.checked)} 
                  style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                />
                🐳 Docker only
              </label>
            </div>
            
            <input
              type="text"
              placeholder="Search by port or process name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />

            <div className="list-container" style={{ marginTop: 0 }}>
              {filteredAvailablePorts.length === 0 ? (
                <div className="empty-state">
                  <p>No listening ports matched your search.</p>
                </div>
              ) : (
                filteredAvailablePorts.map(portInfo => (
                  <TunnelCard
                    key={portInfo.port}
                    port={portInfo.port}
                    processName={portInfo.process}
                    status={null}
                    onStart={handleStartTunnel}
                    onStop={handleStopTunnel}
                    provider={provider}
                    domain={domain}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
