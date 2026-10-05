const app = require('./app.json');

module.exports = () => {
  const config = app.expo;
  const isGitHubPages = process.env.GITHUB_PAGES === 'true';

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(isGitHubPages ? { baseUrl: '/mytrip' } : {}),
    },
  };
};
