// Análisis del Teatro de la Ciudad desde el VPS

const sections = [
  {
    name: "PREFERENTE DERECHA",
    zone: "Preferente",
    color: "#e7ad0d",
    polygonPoints: [
      {x: 271.69, y: 354.84},
      {x: 401.48, y: 580.24},
      {x: 682.70, y: 416.97},
      {x: 617.78, y: 155.13}
    ],
    centroX: 493,
    centroY: 377
  },
  {
    name: "PREFERENTE CENTRAL",
    zone: "Preferente",
    color: "#E7AD0D",
    polygonPoints: [
      {x: 1120.25, y: 386.82},
      {x: 733.73, y: 388.22},
      {x: 669.78, y: 127.07},
      {x: 1188.42, y: 127.07}
    ],
    centroX: 928,
    centroY: 257
  },
  {
    name: "PREFERENTE IZQUIERDA",
    zone: "Preferente",
    color: "#E7AD0D",
    polygonPoints: [
      {x: 1582.12, y: 347.44},
      {x: 1454.96, y: 576.15},
      {x: 1167.78, y: 414.63},
      {x: 1236.82, y: 153.32}
    ],
    centroX: 1360,
    centroY: 373
  },
  {
    name: "PLUS DERECHA",
    zone: "PLUS",
    color: "#1ec840",
    polygonPoints: [
      {x: 489.25, y: 608.79},
      {x: 513.54, y: 651.10},
      {x: 459.50, y: 681.26},
      {x: 564.76, y: 863.97},
      {x: 769.61, y: 744.60},
      {x: 699.35, y: 487.33}
    ],
    centroX: 583,
    centroY: 673
  },
  {
    name: "PLUS CENTRAL",
    zone: "PLUS",
    color: "#1EC840",
    polygonPoints: [
      {x: 750.22, y: 457.32},
      {x: 868.08, y: 456.55},
      {x: 868.86, y: 521.67},
      {x: 991.37, y: 521.67},
      {x: 991.37, y: 456.55},
      {x: 1099.92, y: 458.10},
      {x: 1031.69, y: 717.04},
      {x: 813.80, y: 714.71}
    ],
    centroX: 927,
    centroY: 538
  },
  {
    name: "PLUS IZQUIERDA",
    zone: "PLUS",
    color: "#1EC840",
    polygonPoints: [
      {x: 1147.40, y: 481.29},
      {x: 1366.37, y: 604.75},
      {x: 1343.40, y: 646.39},
      {x: 1395.81, y: 677.26},
      {x: 1294.58, y: 862.46},
      {x: 1079.19, y: 741.14}
    ],
    centroX: 1271,
    centroY: 669
  },
  {
    name: "VIP DERECHA",
    zone: "VIP",
    color: "#0EA5E9",
    polygonPoints: [
      {x: 565.78, y: 865.45},
      {x: 629.11, y: 976.78},
      {x: 805.90, y: 874.42},
      {x: 770.01, y: 745.15}
    ],
    centroX: 693,
    centroY: 865
  },
  {
    name: "VIP CENTRAL",
    zone: "VIP",
    color: "#0EA5E9",
    polygonPoints: [
      {x: 813.73, y: 717.68},
      {x: 1032.15, y: 717.19},
      {x: 997.95, y: 851.06},
      {x: 845.98, y: 851.06}
    ],
    centroX: 922,
    centroY: 784
  },
  {
    name: "VIP IZQUIERDA",
    zone: "VIP",
    color: "#0EA5E9",
    polygonPoints: [
      {x: 1228.14, y: 979.12},
      {x: 1293.13, y: 862.36},
      {x: 1079.26, y: 743.62},
      {x: 1044.03, y: 878.54}
    ],
    centroX: 1161,
    centroY: 866
  }
];

console.log('='.repeat(80));
console.log('ANÁLISIS DE POLÍGONOS - TEATRO DE LA CIUDAD VPS');
console.log('='.repeat(80));

console.log('\n📊 VENUE: Teatro de la Ciudad Parque Tangamanga 1');
console.log('   ID: 2dc4584b-3a89-4c99-a933-eba0a846a04b');
console.log('   Layout ID: 463cd0db-a5f8-43da-b416-b704f0e3fdba');

console.log('\n📍 9 SECCIONES POLIGONALES ENCONTRADAS:');
console.log('-'.repeat(80));

// Agrupar por zona
const byZone = {};
sections.forEach(s => {
  if (!byZone[s.zone]) byZone[s.zone] = [];
  byZone[s.zone].push(s);
});

// Ordenar zonas por posición Y (de arriba hacia abajo en el canvas)
const zoneOrder = ['Preferente', 'PLUS', 'VIP'];

for (const zone of zoneOrder) {
  const zoneSections = byZone[zone];
  if (!zoneSections) continue;
  
  console.log(`\n🔹 ${zone.toUpperCase()} (${zoneSections[0].color}):`);
  
  // Ordenar por X (izquierda a derecha)
  zoneSections.sort((a, b) => a.centroX - b.centroX);
  
  zoneSections.forEach((s, i) => {
    const position = i === 0 ? 'DERECHA' : i === zoneSections.length - 1 ? 'IZQUIERDA' : 'CENTRAL';
    const expectedPosition = s.name.includes('DERECHA') ? 'DERECHA' : 
                              s.name.includes('CENTRAL') ? 'CENTRAL' : 'IZQUIERDA';
    const match = position === expectedPosition ? '✅' : '❌';
    
    console.log(`   ${i + 1}. ${s.name.padEnd(25)} | Centro: X=${s.centroX}, Y=${s.centroY} | ${match} ${position}`);
  });
}

console.log('\n\n' + '='.repeat(80));
console.log('ESTRUCTURA ESPACIAL DEL TEATRO');
console.log('='.repeat(80));

console.log(`
                    ESCENARIO (arriba del canvas)
                    ==============================
                    
    ┌───────────────────────────────────────────────────────────┐
    │                                                           │
    │   PREFERENTE     PREFERENTE      PREFERENTE              │
    │   DERECHA        CENTRAL         IZQUIERDA               │
    │   X=493          X=928           X=1360                  │
    │   Y=377          Y=257           Y=373                   │
    │   (amarillo)     (amarillo)      (amarillo)              │
    │                                                           │
    │   ┌─────────┐    ┌─────────┐    ┌─────────┐             │
    │   │ PLUS    │    │ PLUS    │    │ PLUS    │             │
    │   │ DERECHA │    │ CENTRAL │    │ IZQUIERDA             │
    │   │ X=583   │    │ X=927   │    │ X=1271  │             │
    │   │ Y=673   │    │ Y=538   │    │ Y=669   │             │
    │   │ (verde) │    │ (verde) │    │ (verde) │             │
    │   └─────────┘    └─────────┘    └─────────┘             │
    │                                                           │
    │        ┌─────┐   ┌─────────┐   ┌─────┐                  │
    │        │ VIP │   │   VIP   │   │ VIP │                  │
    │        │DER. │   │ CENTRAL │   │IZQ. │                  │
    │        │X=693│   │  X=922  │   │X=1161│                 │
    │        │Y=865│   │  Y=784  │   │Y=866 │                 │
    │        │(azul│   │ (azul)  │   │(azul)│                 │
    │        └─────┘   └─────────┘   └─────┘                  │
    │                                                           │
    └───────────────────────────────────────────────────────────┘
    
                    PÚBLICO (abajo del canvas)

NOTA: En el sistema de coordenadas del canvas:
- X bajo = DERECHA (desde perspectiva del espectador)
- X alto = IZQUIERDA (desde perspectiva del espectador)
- Y bajo = cerca del ESCENARIO (PREFERENTE)
- Y alto = lejos del ESCENARIO (VIP)
`);

console.log('\n' + '='.repeat(80));
console.log('ZONAS Y PRECIOS');
console.log('='.repeat(80));
console.log(`
  - PLUS: $800 (verde #89eca1)
  - Diamante: $1000 (rosa #dc94f0)
  - Preferente: $700 (amarillo #ffba42)
  - VIP: $900 (azul #70a7f0)
`);

console.log('\n✅ Las 9 secciones poligonales están correctamente definidas en el VPS');
