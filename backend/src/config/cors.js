// Exact origins shared by Express and both Socket.IO transports.
function createOriginPolicy(env = process.env) {
  const origins = (env.CORS_ORIGINS || env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (env.NODE_ENV !== 'production') origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  const allowed = new Set(origins.map((origin) => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins only.');
    }
    return url.origin;
  }));
  // Native clients and server-to-server requests may omit Origin. Authentication
  // still protects private endpoints; CORS is not an authorization mechanism.
  return (origin) => origin === undefined || allowed.has(origin);
}
module.exports = { createOriginPolicy };
