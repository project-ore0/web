// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  srcDir: 'src/',

  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(`${process.env.PORT}`) || 3000,
  },

  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/scripts',
    '@nuxt/ui'
  ]
})