// Configuración común de las pruebas e2e: dónde está Chrome y dónde corre la app.
const path = require('path');
const fs = require('fs');

const RUTAS_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  linux: '/usr/bin/google-chrome',
};
const CHROME = process.env.CHROME_PATH || RUTAS_CHROME[process.platform];
const URL_BASE = process.env.APP_URL || 'http://localhost:5500';

// Las capturas van a tools/e2e/out/ (ignorada por git)
const salida = nombre => {
  const dir = path.join(__dirname, 'out');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, nombre);
};

module.exports = { CHROME, URL_BASE, salida };
