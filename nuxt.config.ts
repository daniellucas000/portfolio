export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  modules: ['@pinia/nuxt'],
  app: {
    head: {
      title: 'Daniel Dev',
      link: [
        {
          rel: 'preconnect',
          href: 'https://win-xp-7ht.pages.dev',
        },
        {
          rel: 'preload',
          href: '/scene.gltf',
          as: 'fetch',
          crossorigin: 'anonymous',
        },
      ],
    },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'three';
            }
          },
        },
      },
    },
  },
});
