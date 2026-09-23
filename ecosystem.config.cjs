module.exports = {
  apps: [
    {
      name: "almash",
      cwd: "/opt/almash/backend",
      script: "node_modules/.bin/tsx",
      args: "src/server.ts",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      time: true,
      env_production: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4105",
        COOKIE_SECURE: "true",
      },
    },
  ],
};
