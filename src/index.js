require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 7000;

const server = app.listen(PORT, () => {
    console.log(`[stremio-skip-intro] Server running on http://localhost:${PORT}`);
    console.log(`[stremio-skip-intro] API docs: http://localhost:${PORT}/api`);
    console.log(`[stremio-skip-intro] Health:   http://localhost:${PORT}/api/health`);
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});

module.exports = server;
