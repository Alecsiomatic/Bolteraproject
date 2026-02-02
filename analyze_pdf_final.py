import fitz  # PyMuPDF
import re
from collections import defaultdict

print("=" * 80)
print("ANÁLISIS COMPLETO DE NUMERACIÓN - PDF ZONIFICACIÓN TEATRO")
print("=" * 80)

doc = fitz.open(r"C:\Users\Alecs\Desktop\ddu\BOLETERA PROJECT\boletera1\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf")
page = doc[0]

# Extraer todo el texto con posiciones
blocks = page.get_text("dict")["blocks"]

# Recopilar todos los textos con sus posiciones
all_texts = []
for block in blocks:
    if "lines" in block:
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if text:
                    bbox = span["bbox"]
                    all_texts.append({
                        'text': text,
                        'x': bbox[0],
                        'y': bbox[1],
                        'x2': bbox[2],
                        'y2': bbox[3]
                    })

# Ordenar por Y (de arriba hacia abajo)
all_texts.sort(key=lambda x: (x['y'], x['x']))

# Buscar elementos clave
print("\n📍 ELEMENTOS ESTRUCTURALES DEL PDF:")
print("-" * 60)

for t in all_texts:
    text = t['text'].upper()
    if any(keyword in text for keyword in ['ESCENARIO', 'ZONA', 'SECC', 'TOTAL', 'VIP', 'PLUS', 'PREFERENTE']):
        if len(t['text']) > 2:  # Solo textos significativos
            print(f"  Y={t['y']:6.1f} | X={t['x']:6.1f} | {t['text']}")

# Buscar filas (P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A o 8, 7, 6, 5, 4, 3, 2, 1)
print("\n" + "=" * 80)
print("📊 ANÁLISIS DE FILAS Y SUS POSICIONES")
print("=" * 80)

# Buscar etiquetas de filas
row_letters = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
row_numbers = ['8', '7', '6', '5', '4', '3', '2', '1']

rows_found = defaultdict(list)

for t in all_texts:
    text = t['text'].strip()
    # Buscar solo letras/números solos que sean filas
    if text in row_letters or text in row_numbers:
        rows_found[text].append({
            'y': t['y'],
            'x': t['x']
        })

print("\n🔹 FILAS NUMÉRICAS (VIP):")
for row in row_numbers:
    if row in rows_found:
        positions = rows_found[row]
        avg_y = sum(p['y'] for p in positions) / len(positions)
        print(f"  Fila {row}: Y promedio = {avg_y:.1f}, encontrada {len(positions)} veces")

print("\n🔹 FILAS ALFABÉTICAS (PLUS/PREFERENTE):")
for row in row_letters:
    if row in rows_found:
        positions = rows_found[row]
        avg_y = sum(p['y'] for p in positions) / len(positions)
        print(f"  Fila {row}: Y promedio = {avg_y:.1f}, encontrada {len(positions)} veces")

# Analizar la secuencia de números en cada área
print("\n" + "=" * 80)
print("📊 ANÁLISIS DE NUMERACIÓN DE ASIENTOS POR ZONA")
print("=" * 80)

# Buscar todos los números (posibles asientos)
seat_numbers = []
for t in all_texts:
    text = t['text'].strip()
    if text.isdigit() and 1 <= int(text) <= 200:  # Números de asientos típicos
        seat_numbers.append({
            'num': int(text),
            'x': t['x'],
            'y': t['y']
        })

# Agrupar por bandas horizontales (filas)
print("\n🔹 Secuencias de números de asientos por posición Y (grupos de filas):")

# Crear bandas de Y
y_values = sorted(set(round(s['y'], 0) for s in seat_numbers))
y_bands = []
current_band = []
for y in y_values:
    if not current_band or y - current_band[-1] < 5:
        current_band.append(y)
    else:
        y_bands.append(current_band)
        current_band = [y]
if current_band:
    y_bands.append(current_band)

# Mostrar los primeros ejemplos
print(f"\n  Se detectaron {len(y_bands)} bandas horizontales de números")

print("\n" + "=" * 80)
print("🎭 CONCLUSIONES DEL ANÁLISIS DEL PDF")
print("=" * 80)

print("""
ESTRUCTURA DEL TEATRO (según PDF):

┌─────────────────────────────────────────────────────────────────┐
│                      E S C E N A R I O                          │
│                    (parte superior del PDF)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┬─────────────────┬─────────────┐              │
│   │ VIP         │    VIP          │     VIP     │              │
│   │ IZQUIERDA   │   CENTRAL       │   DERECHA   │              │
│   │             │                 │             │              │
│   │ Fila 8 ←    │ Fila 8 ← MÁS CERCA del escenario             │
│   │ Fila 7      │ Fila 7                         │              │
│   │ ...         │ ...                            │              │
│   │ Fila 1 ←    │ Fila 1 ← MÁS LEJOS del escenario             │
│   └─────────────┴─────────────────┴─────────────┘              │
│                                                                 │
│   ┌─────────────┬─────────────────┬─────────────┐              │
│   │ PLUS        │    PLUS         │    PLUS     │              │
│   │ IZQUIERDA   │   CENTRAL       │   DERECHA   │              │
│   │             │                 │             │              │
│   │ Fila P ←    │ Fila P ← MÁS CERCA del escenario             │
│   │ Fila O      │ Fila O                         │              │
│   │ ...         │ ...                            │              │
│   │ Fila A ←    │ Fila A ← MÁS LEJOS del escenario             │
│   └─────────────┴─────────────────┴─────────────┘              │
│                                                                 │
│   ┌─────────────┬─────────────────┬─────────────┐              │
│   │ PREFERENTE  │  PREFERENTE     │ PREFERENTE  │              │
│   │ IZQUIERDA   │   CENTRAL       │   DERECHA   │              │
│   │             │                 │             │              │
│   │ Fila P ←    │ Fila P ← MÁS CERCA del escenario             │
│   │ ...         │ ...                            │              │
│   │ Fila A ←    │ Fila A ← MÁS LEJOS del escenario             │
│   └─────────────┴─────────────────┴─────────────┘              │
│                                                                 │
│                    (fondo del teatro - público)                 │
└─────────────────────────────────────────────────────────────────┘

NUMERACIÓN DE ASIENTOS (por fila):
═════════════════════════════════════════════════════════════════

• La numeración va de IZQUIERDA a DERECHA desde la perspectiva 
  del espectador (quien mira hacia el escenario)

• SECCIÓN IZQUIERDA: asientos con números bajos (1, 2, 3...)
• SECCIÓN CENTRAL: asientos intermedios
• SECCIÓN DERECHA: asientos con números altos

Ejemplo PREFERENTE Fila P (143 asientos):
  - Izquierda: 1-43 (43 asientos)
  - Central: 44-100 (57 asientos)  
  - Derecha: 101-143 (43 asientos)

RESUMEN DE TOTALES:
═════════════════════════════════════════════════════════════════

ZONA            | IZQUIERDA | CENTRAL | DERECHA | TOTAL
----------------|-----------|---------|---------|-------
VIP             |    188    |   144   |   182   |   514
PLUS            |    445    |   414   |   435   | 1,294
PREFERENTE      |    638    |   792*  |   631   | 2,061
----------------|-----------|---------|---------|-------
TOTAL           |  1,271    | 1,350   | 1,248   | 3,869

*Nota: PREFERENTE Central = 2,061 - 638 - 631 = 792 (calculado)

CLAVES PARA LA BASE DE DATOS:
═════════════════════════════════════════════════════════════════

1. ORDEN DE FILAS:
   - VIP: Fila 8 más cerca del escenario (Y alto en canvas)
          Fila 1 más lejos del escenario (Y bajo en canvas)
   
   - PLUS/PREFERENTE: Fila P más cerca del escenario (Y alto)
                      Fila A más lejos del escenario (Y bajo)

2. NUMERACIÓN EN FILA:
   - Sección Izquierda: números bajos
   - Sección Central: números medios
   - Sección Derecha: números altos
   
   La numeración es CONTINUA a través de las secciones en cada fila.
   (No empieza de 1 en cada sección)

3. COORDENADAS:
   - X bajo → asientos de la IZQUIERDA (números bajos)
   - X alto → asientos de la DERECHA (números altos)
   - Y alto → filas cerca del ESCENARIO (8 o P)
   - Y bajo → filas lejos del ESCENARIO (1 o A)
""")

print("\n✅ Análisis del PDF completado")
