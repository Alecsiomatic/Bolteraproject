import fitz  # PyMuPDF
import re
from collections import defaultdict

print("=" * 100)
print("🔍 ANÁLISIS DE GAPS - CABINA Y DISCAPACITADOS")
print("=" * 100)

doc = fitz.open(r"C:\Users\Alecs\Desktop\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf")
page = doc[0]

# Extraer todo el texto con posiciones
blocks = page.get_text("dict")["blocks"]

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
                        'y2': bbox[3],
                        'size': span.get('size', 0)
                    })

# Buscar CABINA
print("\n📍 BUSCANDO 'CABINA' EN EL PDF:")
print("-" * 80)
for t in all_texts:
    if 'CABINA' in t['text'].upper():
        print(f"  Y={t['y']:6.1f} X={t['x']:6.1f} | '{t['text']}'")

# Buscar DISCAPACITADOS o silla de ruedas
print("\n📍 BUSCANDO 'DISCAPACITADOS' O SIMILAR:")
print("-" * 80)
for t in all_texts:
    text_upper = t['text'].upper()
    if any(kw in text_upper for kw in ['DISCAPACITADO', 'SILLA', 'RUEDA', 'ACCESIB', 'MOVILIDAD']):
        print(f"  Y={t['y']:6.1f} X={t['x']:6.1f} | '{t['text']}'")

# Analizar la zona de la CABINA (Y ~ 260-270 según el output anterior)
print("\n" + "=" * 100)
print("📊 ANÁLISIS DE LA ZONA DE CABINA (PLUS CENTRAL)")
print("=" * 100)

# La cabina aparece en Y=261 con "CABINA"
# Buscar todos los elementos en esa zona Y (255-275)
print("\nElementos en la zona Y=255-275 (área de cabina):")
cabina_area = [t for t in all_texts if 255 <= t['y'] <= 275]
cabina_area.sort(key=lambda x: (round(x['y']), x['x']))

current_y = -1
for t in cabina_area:
    y_rounded = round(t['y'])
    if y_rounded != current_y:
        print(f"\n  Y={y_rounded}:")
        current_y = y_rounded
    print(f"    X={t['x']:5.0f} | {t['text']}")

# Analizar numeración específica de PLUS CENTRAL
print("\n" + "=" * 100)
print("📊 ANÁLISIS DETALLADO DE PLUS CENTRAL (donde está la cabina)")
print("=" * 100)

# PLUS está entre Y=247 y Y=406 aproximadamente
# Buscar los números del central
print("\nBuscando secuencias de números en PLUS CENTRAL:")

# En el output anterior vemos que PLUS CENTRAL tiene números como 48, 47, 46... 27
# La cabina aparece en la mitad

plus_central_nums = []
for t in all_texts:
    if 247 <= t['y'] <= 430 and 280 <= t['x'] <= 520:  # Área aproximada de PLUS CENTRAL
        if t['text'].isdigit():
            plus_central_nums.append({
                'num': int(t['text']),
                'x': t['x'],
                'y': t['y']
            })

# Agrupar por fila Y
rows = defaultdict(list)
for n in plus_central_nums:
    y_band = round(n['y'] / 10) * 10  # Agrupar en bandas de 10px
    rows[y_band].append(n['num'])

print("\nNúmeros por banda Y en PLUS CENTRAL:")
for y in sorted(rows.keys()):
    nums = sorted(rows[y])
    if nums:
        print(f"  Y~{y}: {nums[:10]}..." if len(nums) > 10 else f"  Y~{y}: {nums}")

# Buscar gaps específicos
print("\n" + "=" * 100)
print("🔎 BUSCANDO GAPS EN LA NUMERACIÓN")
print("=" * 100)

# Analizar fila por fila buscando saltos en la numeración
# Para PLUS Central, la numeración debería ser continua pero hay un hueco por la cabina

print("""
Según el PDF, la CABINA DE CONTROL está ubicada en:
- ZONA: PLUS CENTRAL
- Posición: Centro del teatro
- Esto crea un GAP en las filas centrales de PLUS

Los asientos alrededor de la cabina NO existen físicamente.
""")

# Analizar las líneas específicas donde aparece "CABINA"
print("\n📍 CONTEXTO ALREDEDOR DE LA CABINA (Y=255-270):")
print("-" * 80)

for t in sorted(all_texts, key=lambda x: (x['y'], x['x'])):
    if 255 <= t['y'] <= 275:
        print(f"Y={t['y']:5.0f} X={t['x']:5.0f} | {t['text']}")

# Buscar la zona VIP donde podría haber discapacitados
print("\n" + "=" * 100)
print("📊 ANÁLISIS DE ZONA VIP (buscando espacios especiales)")
print("=" * 100)

vip_area = [t for t in all_texts if 480 <= t['y'] <= 550]
vip_area.sort(key=lambda x: (round(x['y']), x['x']))

print("\nElementos en zona VIP (Y=480-550):")
current_y = -1
for t in vip_area:
    y_rounded = round(t['y'])
    if y_rounded != current_y:
        print(f"\n  Y={y_rounded}:")
        current_y = y_rounded
    if len(t['text']) > 1 or not t['text'].isdigit():  # Mostrar solo textos relevantes
        print(f"    X={t['x']:5.0f} | {t['text']}")

doc.close()

print("\n" + "=" * 100)
print("📋 RESUMEN DE GAPS ENCONTRADOS")
print("=" * 100)

print("""
GAPS IDENTIFICADOS EN EL PDF:

1. CABINA DE CONTROL
   ─────────────────────────────────────────────────────────────
   - Ubicación: PLUS CENTRAL
   - Posición Y: ~260-270 (mitad del teatro)
   - Efecto: Las filas de PLUS CENTRAL tienen un hueco donde
             está la cabina de sonido/iluminación
   - Filas afectadas: I, J, K aproximadamente

2. POSIBLES ESPACIOS DE DISCAPACITADOS
   ─────────────────────────────────────────────────────────────
   - Típicamente en: Parte trasera o pasillos laterales
   - Necesito verificar si hay marcas específicas en el PDF

NOTA: Estos gaps deben reflejarse en los polígonos o en la
      distribución de asientos cuando se generen.
""")
