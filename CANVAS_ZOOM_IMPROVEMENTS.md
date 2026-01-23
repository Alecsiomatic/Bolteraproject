# 🎨 Mejoras del Canvas - Zoom & Pan

## 📋 Resumen de Mejoras

Se han implementado mejoras significativas en el sistema de zoom y pan (movimiento) del canvas en Boletera1.

---

## 🔍 Problemas Identificados y Solucionados

### 1. **Zoom No Funcionaba - CRÍTICO** ✅
**Problema**: El scroll de mouse no hacía zoom en el canvas
**Solución Implementada**:
- Se agregaron event listeners DIRECTOS en el `containerRef` y `canvasRef`
- Los eventos wheel ahora se capturan con `passive: false` para poder llamar `preventDefault()`
- Se valida que el mouse esté dentro del canvas antes de aplicar zoom
- Se agregó soporte para **pinch zoom** (touchmove con 2 dedos)

**Ubicación**: [Canvas.tsx](src/components/Canvas.tsx#L1880) - nuevo useEffect con listeners directos

```tsx
// DIRECTO en el container
container.addEventListener('wheel', handleContainerWheel, { passive: false });
container.addEventListener('touchmove', handleContainerTouchMove, { passive: false });

// DIRECTO en el canvas HTML
htmlCanvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
```

### 2. **Pinch Zoom (Trackpad/Touch)** ✅
**Nuevo**: Se agregó soporte para pinch zoom
**Características**:
- Detecta cuando hay 2 dedos tocando (trackpad o pantalla táctil)
- Calcula la distancia entre los dos puntos
- Aumenta/disminuye zoom según el delta
- Zoom apuntado al punto medio entre los dos dedos
- Escala de 5% por evento (configurable)

**Ubicación**: [Canvas.tsx](src/components/Canvas.tsx#L1900) - `handleContainerTouchMove`

```tsx
const handleContainerTouchMove = (e: TouchEvent) => {
  if (e.touches.length !== 2) return;
  
  // Calcular distancia entre dedos
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Delta y scale
  const scale = delta > 0 ? 1.05 : 0.95;
  
  // Zoom al punto medio
  const midX = (touch1.clientX + touch2.clientX) / 2;
  const midY = (touch1.clientY + touch2.clientY) / 2;
  fabricCanvas.zoomToPoint(new Point(midX, midY), newZoom);
};
```

### 3. **Tool "Hand" Mejora Crítica** ✅
**Problema**: El botón "Mover" permitía seleccionar objetos además de hacer pan
**Solución**: 
- Se agregó deselección automática de objetos cuando se presiona mouse:down en modo 'hand'
- Se llama `canvas.discardActiveObject()` para limpiar selecciones previas
- El cursor cambia a 'grabbing' para feedback visual

**Ubicación**: [Canvas.tsx](src/components/Canvas.tsx#L1574) - evento `mouse:down`

### 4. **Pan (Arrastre) Mejorado** ✅
**Características**:
- Cálculo explícito de delta (deltaX, deltaY)
- Limitación de viewport después de cada cambio
- Renderizado inmediato

**Ubicación**: [Canvas.tsx](src/components/Canvas.tsx#L1819) - evento `mouse:move`

### 5. **Zoom al Cursor (Ya Implementado)** ✅
**Estado**: Ya funcionaba correctamente
**Características**:
- El wheel zoom usa `e.offsetX` y `e.offsetY` para zoom al punto del cursor
- Factor de zoom responsivo (`ZOOM_CONFIG.WHEEL_FACTOR`)
- Throttling a ~60fps para evitar zoom muy rápido
- Limites de zoom configurables (MIN: 0.1, MAX: 5)

**Ubicación**: [useZoomController.ts](src/hooks/useZoomController.ts#L170)

### 6. **Controles de Zoom Mejorados (Ya Implementado)** ✅
**Estado**: Ya completamente implementado
**Características**:
- Botones +/- (15% por paso)
- Slider continuo para zoom fino
- Porcentaje clickeable (reset a 100%)
- Botón "Fit to Screen"
- Presets rápidos (25%, 50%, 75%, 100%, 150%, 200%, 300%)
- Tooltips con atajos de teclado
- Variantes de diseño (default, minimal, floating)

**Ubicación**: [ZoomControls.tsx](src/components/canvas/ZoomControls.tsx)

### 5. **Viewport Limitado** ✅
**Función**: `limitViewport()` del useZoomController
**Beneficios**:
- Impide que el canvas "se pierda" fuera del viewport
- Permite overscroll configurable (`VIEWPORT_CONFIG.OVERSCROLL`)
- Centra el canvas cuando el contenido es más pequeño que el container

---

## 🎯 Características del Sistema de Zoom

### Zoom Responsivo
- **Wheel**: Zoom al punto del cursor
- **Botones**: Zoom al centro del viewport
- **Slider**: Control fino y continuo
- **Presets**: Acceso rápido a zoom específicos

### Limitaciones de Zoom
```javascript
ZOOM_CONFIG = {
  MIN: 0.1,           // Zoom mínimo: 10%
  MAX: 5,             // Zoom máximo: 500%
  WHEEL_FACTOR: 1.15, // Factor por evento wheel: 15%
  STEP: 1.15,         // Factor por botón: 15%
  FIT_PADDING: 0.95   // Padding cuando fit-to-screen
}
```

### Viewport Limitado
```javascript
VIEWPORT_CONFIG = {
  OVERSCROLL: 0.1  // Permite 10% de overscroll
}
```

---

## 🖱️ Comportamiento de Herramientas

### Modo "Select" (Seleccionar)
- ✅ Seleccionar objetos individuales
- ✅ Selección múltiple
- ✅ Alt + Drag = Pan temporal del canvas
- ✅ Wheel = Zoom al cursor

### Modo "Hand" (Mover Canvas)
- ✅ Drag = Pan del canvas (no selecciona objetos)
- ✅ Wheel = Zoom al cursor
- ✅ Cursor = Grab/Grabbing
- ✅ Objetos = No seleccionables
- ✅ Selección = Deshabilitada automáticamente

### Alt Key (Combo)
- ✅ Alt + Drag en modo Select = Pan temporal
- ✅ Alt + Wheel = Zoom normal

---

## 📝 Cambios Técnicos Realizados

### 1. Canvas.tsx - mouse:down
```tsx
// ANTES: No deseleccionaba objetos
if (activeTool === "hand" || evt.altKey) {
  setIsDragging(true);
  // ...
}

// DESPUÉS: Deselecciona y limpia el canvas
if (activeTool === "hand" || evt.altKey) {
  setIsDragging(true);
  setLastPosX(evt.clientX);
  setLastPosY(evt.clientY);
  canvas.defaultCursor = 'grabbing';
  opt.e.preventDefault();
  opt.e.stopPropagation();
  canvas.discardActiveObject();        // ← NUEVA LÍNEA
  canvas.requestRenderAll();           // ← NUEVA LÍNEA
}
```

### 2. Canvas.tsx - mouse:move
```tsx
// MEJORADO: Cálculo explícito de delta y comentarios claros
if (isDragging && (activeTool === "hand" || e.altKey)) {
  const vpt = canvas.viewportTransform;
  if (vpt) {
    // Calcular delta del movimiento
    const deltaX = e.clientX - lastPosX;
    const deltaY = e.clientY - lastPosY;
    
    // Aplicar delta al viewport
    vpt[4] += deltaX;
    vpt[5] += deltaY;
    
    // Limitar viewport después del pan
    limitViewport();
    canvas.requestRenderAll();
    
    // Actualizar posición del último mouse
    setLastPosX(e.clientX);
    setLastPosY(e.clientY);
  }
}
```

---

## ✨ Mejoras de UX

1. **Feedback Visual**
   - Cursor cambia según modo (select/grab/grabbing)
   - Grid visible para referencia
   - Viewport limitado evita "perder" el canvas

2. **Accesibilidad**
   - Tooltips en botones de zoom
   - Atajos de teclado mostrados
   - Alt key para pan temporal en cualquier modo

3. **Responsividad**
   - Throttling en wheel para ~60fps
   - Renderizado inmediato en mouse:move
   - Slider continuo para zoom fino

4. **Presets Rápidos**
   - Porcentajes comunes accesibles
   - Fit-to-screen para ver todo
   - Reset a 100% con click en porcentaje

---

## 🚀 Cómo Usar

### Zoom
- **Rueda del mouse**: Zoom al punto del cursor
- **Botones +/-**: Zoom al centro (+15% o -15%)
- **Slider**: Control fino (5% de paso)
- **Presets dropdown**: Zoom rápido a porcentajes
- **Fit**: Ajustar todo al viewport

### Pan (Movimiento)
- **Modo Hand**: Drag = pan del canvas
- **Modo Select + Alt**: Hold Alt + Drag = pan temporal
- **Cursor**: Indica modo actual (grab vs default)

### Teclas
- `Ctrl +`: Zoom in
- `Ctrl -`: Zoom out
- `Ctrl 0`: Fit to screen (potencial)
- `Alt + Drag`: Pan en cualquier modo

---

## 📦 Componentes Relacionados

- **[Canvas.tsx](src/components/Canvas.tsx)** - Canvas principal
- **[useZoomController.ts](src/hooks/useZoomController.ts)** - Lógica de zoom
- **[ZoomControls.tsx](src/components/canvas/ZoomControls.tsx)** - Controles UI
- **[canvas-constants.ts](src/lib/canvas-constants.ts)** - Configuración

---

## 🎓 Referencias

- Fabric.js Viewport: https://fabricjs.com/docs/api/Canvas.html#viewportTransform
- Mouse Events: https://fabricjs.com/docs/api/Canvas.html#mouse:move
- Zoom Configuration: [canvas-constants.ts](src/lib/canvas-constants.ts#ZOOM_CONFIG)

---

## ✅ Pruebas Recomendadas

- [ ] Zoom con wheel en modo Select
- [ ] Zoom con wheel en modo Hand
- [ ] Pan con Alt+Drag en modo Select
- [ ] Pan normal en modo Hand
- [ ] Fit-to-screen con contenido pequeño
- [ ] Presets de zoom funcionan correctamente
- [ ] Cursor cambia apropiadamente
- [ ] Viewport limitado previene salida del canvas

---

## 📅 Fecha de Implementación
Enero 15, 2026

## 👤 Cambios por
GitHub Copilot
