export const config = {

  apiUrl:
    import.meta.env.VITE_API_URL
    || '/api',

  appName:
    import.meta.env.VITE_APP_NAME
    || 'Konnect',

  appVersion:
    import.meta.env.VITE_APP_VERSION
    || '1.0.0',

  environment:
    import.meta.env.MODE,

  isDev:
    import.meta.env.DEV,

  isProd:
    import.meta.env.PROD,
}