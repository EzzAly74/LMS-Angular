export const environment = {
  production: true,
  apiBaseUrl: 'http://161.97.168.2:8088',
  // Plain ws:// straight to Reverb's port — matches the rest of this
  // deployment, which is plain HTTP (no TLS/reverse proxy in front of it
  // yet). Switch to { port: 443, scheme: 'wss' } once this server gets a
  // real domain + TLS cert and an nginx proxy is put in front of Reverb;
  // `key` must always match the backend's REVERB_APP_KEY.
  reverb: {
    key: 'wfgd053wx4o7pxjuaeau',
    host: '161.97.168.2',
    port: 8080,
    scheme: 'http' as 'http' | 'https' | 'wss',
  },
};
