/**
 * PM2 Ecosystem Config — Samha CRM Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js            # start all apps
 *   pm2 start ecosystem.config.js --env dev  # start in dev mode
 *   pm2 reload ecosystem.config.js           # zero-downtime reload
 *   pm2 save                                 # persist process list
 *   pm2 startup                              # auto-start on reboot
 */

module.exports = {
  apps: [
    // ── API Server ─────────────────────────────────────────────────────────
    {
      name: "samha-api",
      script: "dist/index.js",
      cwd: "./apps/api",
      instances: 2,                    // cluster mode — 2 workers
      exec_mode: "cluster",
      max_memory_restart: "512M",

      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },

      // Logging
      out_file: "logs/api-out.log",
      error_file: "logs/api-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Restart policy
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",

      // Graceful shutdown — wait for in-flight requests
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    // ── Background Job Worker ──────────────────────────────────────────────
    {
      name: "samha-worker",
      script: "dist/worker.js",
      cwd: "./apps/api",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",

      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },

      out_file: "logs/worker-out.log",
      error_file: "logs/worker-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
    },

    // ── Web (Vite preview — or use Nginx to serve the static dist) ─────────
    // Uncomment if you want PM2 to serve the built frontend.
    // Production best practice: serve dist/ with Nginx instead.
    // {
    //   name: "samha-web",
    //   script: "npx",
    //   args: "vite preview --host --port 3000",
    //   cwd: "./apps/web",
    //   instances: 1,
    //   exec_mode: "fork",
    //   env_production: { NODE_ENV: "production" },
    //   out_file: "logs/web-out.log",
    //   error_file: "logs/web-error.log",
    // },
  ],
};
