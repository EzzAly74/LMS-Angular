export const environment = {
  production: true,
  apiBaseUrl: 'http://161.97.168.2:8088',
  // TODO: point at the production Reverb deployment once it's stood up
  // (a reverse proxy terminating wss:// in front of `reverb:start` is the
  // usual setup — see Laravel Reverb's production docs). `key` must match
  // the backend's REVERB_APP_KEY for that environment.
  reverb: {
    key: 'wfgd053wx4o7pxjuaeau',
    host: '161.97.168.2',
    port: 443,
    scheme: 'wss' as 'http' | 'https' | 'wss',
  },
};
