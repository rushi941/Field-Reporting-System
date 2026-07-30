/**
 * PM2 production config for company KVM / VPS.
 *
 * Usage (on server, from repo root):
 *   npm ci
 *   npm run build
 *   cp apps/api/.env.production.example apps/api/.env   # edit values
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "frs",
      cwd: __dirname,
      script: "scripts/start-prod.mjs",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 120000,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      // Logs (create /var/log/frs or change paths)
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
