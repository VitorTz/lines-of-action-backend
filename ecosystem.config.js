module.exports = {
  apps: [
    {
      name: 'lines-backend', // Nome da aplicação
      script: 'dist/index.js',   // O script de entrada (JS compilado)
      
      // Configuração de "watch"
      // O PM2 irá monitorar a pasta 'dist'
      watch: ['dist'],
      
      // Ignora subpastas ou arquivos ao assistir
      ignore_watch: ['node_modules'],

      // Opções do modo "watch"
      watch_options: {
        followSymlinks: false,
      },

      // Variáveis de ambiente
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      }
    },
  ],
};
