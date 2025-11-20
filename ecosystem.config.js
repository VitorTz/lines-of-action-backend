

module.exports = {
  apps: [
    {
      name: 'lines-backend',
      script: 'dist/index.js',
      watch: ['dist'],
      ignore_watch: ['node_modules'],
      watch_options: {
        followSymlinks: false,
      },      
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      }
    },
  ],
};
