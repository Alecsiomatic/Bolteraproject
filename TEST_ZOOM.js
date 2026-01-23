// TEST SCRIPT - Verificar que zoom y pan funcionan
// Pega esto en la consola del navegador (F12)

console.log('🧪 Iniciando pruebas de zoom...');

// Test 1: Wheel event
console.log('ℹ️  Prueba 1: Scroll con rueda del mouse sobre el canvas');
console.log('   Esperado: El zoom debería aumentar/disminuir');
console.log('   Instrucciones: Scroll hacia arriba (zoom in) y hacia abajo (zoom out)');

// Test 2: Pinch
console.log('ℹ️  Prueba 2: Pinch zoom (trackpad de laptop)');
console.log('   Esperado: Abrir dos dedos sobre el trackpad = zoom in, cerrar = zoom out');
console.log('   Instrucciones: Usa dos dedos en el trackpad');

// Test 3: Pan
console.log('ℹ️  Prueba 3: Pan del canvas');
console.log('   Esperado: Click en "Mover" y drag = pan del canvas');
console.log('   Instrucciones: Selecciona tool "Mover (Pan)" y arrastra el canvas');

// Test 4: Alt+Scroll
console.log('ℹ️  Prueba 4: Alt+Scroll en modo Select');
console.log('   Esperado: Zoom funcionando en modo Select con Alt presionado');
console.log('   Instrucciones: Selecciona tool "Select", presiona Alt y scroll');

// Monitorear eventos
const canvas = document.querySelector('canvas');
if (canvas) {
  let wheelCount = 0;
  let touchCount = 0;
  
  canvas.addEventListener('wheel', (e) => {
    wheelCount++;
    console.log(`✅ Wheel event #${wheelCount} capturado - deltaY: ${e.deltaY}`);
  }, { passive: false });
  
  canvas.addEventListener('touchmove', (e) => {
    touchCount++;
    if (e.touches.length === 2) {
      console.log(`✅ Touch pinch #${touchCount} detectado - 2 dedos`);
    }
  }, { passive: false });
  
  console.log('✅ Event listeners registrados en el canvas');
} else {
  console.error('❌ Canvas no encontrado');
}

console.log('\n🚀 Pruebas listas. Prueba cada acción arriba.');
