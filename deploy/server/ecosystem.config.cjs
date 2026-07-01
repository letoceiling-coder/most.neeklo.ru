module.exports = {
  apps: [
    {
      name: 'most-server',
      script: 'packages/server/dist/index.js',
      cwd: '/opt/most',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: '3035',
        SERVER_HOST: '127.0.0.1',
        DASHBOARD_DIST: '/opt/most/packages/dashboard/dist',
      },
    },
  ],
};
