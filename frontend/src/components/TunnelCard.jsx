import React, { useState, useEffect } from 'react';
import { Copy, Play, Square, ExternalLink, Activity } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const TunnelCard = ({ port, processName, status, url, error, onStart, onStop, provider, domain }) => {
  const [localSubdomain, setLocalSubdomain] = useState(() => localStorage.getItem(`nexus_subdomain_${port}`) || '');

  useEffect(() => {
    localStorage.setItem(`nexus_subdomain_${port}`, localSubdomain);
  }, [localSubdomain, port]);
  
  const handleCopy = () => {
    if (url) {
      navigator.clipboard.writeText(url);
    }
  };

  const isStarting = status === 'starting';
  const isActive = status === 'active';
  const hasError = status === 'error';

  return (
    <div className={`glass-panel ${isActive ? 'active' : ''} animate-fade-in`}>
      <div className="panel-header">
        <div className="port-info">
          <div className="port-number" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Port {port}
            <a href={`http://localhost:${port}`} target="_blank" rel="noreferrer" title="Open Localhost" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              <ExternalLink size={14} />
            </a>
            <span className="process-name">{processName}</span>
          </div>
        </div>
        
        <div className={`status-badge status-${status || 'stopped'}`}>
          <span className="status-dot"></span>
          {status || 'Available'}
        </div>
      </div>

      {hasError && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {url && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
          <div style={{ padding: '0.5rem', background: 'white', borderRadius: '8px', display: 'flex' }}>
            <QRCodeSVG value={url} size={128} />
          </div>
          <div className="tunnel-url" style={{ flex: 1, marginTop: 0 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-all' }}>
              {url}
              <ExternalLink size={14} style={{ flexShrink: 0 }} />
            </a>
            <button className="copy-btn" onClick={handleCopy} title="Copy URL">
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Action Section */}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Subdomain Input Group (Only show when stopped and persistent mode) */}
        {!isActive && !isStarting && provider === 'cloudflare_persistent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Custom Subdomain Required
            </label>
            <div style={{ display: 'flex', width: '100%' }}>
              <input 
                type="text" 
                value={localSubdomain} 
                onChange={(e) => setLocalSubdomain(e.target.value)}
                placeholder="e.g. api"
                style={{ background: 'var(--bg-secondary)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.6rem 0.75rem', borderRadius: '6px 0 0 6px', fontFamily: 'monospace', flex: 1, fontSize: '0.95rem', minWidth: '50px' }}
              />
              <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem 0.75rem', border: '1px solid var(--glass-border)', borderLeft: 'none', borderRadius: '0 6px 6px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'nowrap', userSelect: 'none' }}>
                .{domain || 'yourdomain.com'}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {isActive || isStarting ? (
            <button className="btn btn-danger" onClick={() => onStop(port)}>
              <Square size={16} /> {isStarting ? 'Cancel Start' : 'Stop Tunnel'}
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={() => onStart(port, localSubdomain)}
              disabled={provider === 'cloudflare_persistent' && ((!localSubdomain || localSubdomain.trim() === '') || (!domain || domain.trim() === ''))}
              style={{ 
                opacity: (provider === 'cloudflare_persistent' && ((!localSubdomain || localSubdomain.trim() === '') || (!domain || domain.trim() === ''))) ? 0.5 : 1, 
                cursor: (provider === 'cloudflare_persistent' && ((!localSubdomain || localSubdomain.trim() === '') || (!domain || domain.trim() === ''))) ? 'not-allowed' : 'pointer',
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem'
              }}
            >
              <Play size={16} /> {
                provider === 'cloudflare_persistent' 
                  ? (!domain || domain.trim() === '' 
                      ? 'Enter Base Domain Above' 
                      : (!localSubdomain || localSubdomain.trim() === '' ? 'Enter Subdomain to Expose' : 'Expose to Internet'))
                  : 'Expose to Internet'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TunnelCard;
