// Carga los datos y el motor fuera del navegador. Es lo que permite medir el
// juego —cuántas rondas salen de cada tipo, si alguna se queda sin pregunta—
// sin abrir una pestaña, y la razón de que motor.js no toque el DOM.
//
//   node tools/prueba.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = path.join(__dirname, '..');
const codigo = fs.readFileSync(path.join(raiz, 'data/mlb-data.js'), 'utf8')
  + fs.readFileSync(path.join(raiz, 'motor.js'), 'utf8');
const ctx = { module: { exports: {} }, console, Math };
vm.createContext(ctx);
vm.runInContext(codigo, ctx);
module.exports = ctx.module.exports;
