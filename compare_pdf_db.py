import pymysql
import fitz  # PyMuPDF
import re

# Conexión a la base de datos
conn = pymysql.connect(
    host='72.167.60.4',
    user='boletera_user',
    password='Cer0un0cer0.com20182417',
    database='boletera_db',
    charset='utf8mb4'
)

LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

print("=" * 80)
print("COMPARACIÓN: PDF vs BASE DE DATOS")
print("=" * 80)

# Obtener datos de la DB
cursor = conn.cursor()

# Verificar estado actual de filas en la DB
print("\n📊 ESTADO ACTUAL EN LA BASE DE DATOS:")
print("-" * 60)

# Para VIP
print("\n🔹 VIP - Relación Fila vs Posición Y:")
cursor.execute("""
    SELECT 
        sectionName,
        `row`,
        ROUND(AVG(y), 0) as avg_y,
        COUNT(*) as seats
    FROM Seat
    WHERE layoutId = %s AND zone = 'VIP'
    GROUP BY sectionName, `row`
    ORDER BY sectionName, avg_y DESC
""", (LAYOUT_ID,))
for row in cursor.fetchall():
    print(f"  {row[0]:15} | Fila {row[1]:2} | Y={row[2]:6.0f} | {row[3]} asientos")

# Para PLUS
print("\n🔹 PLUS - Relación Fila vs Posición Y:")
cursor.execute("""
    SELECT 
        sectionName,
        `row`,
        ROUND(AVG(y), 0) as avg_y,
        COUNT(*) as seats
    FROM Seat
    WHERE layoutId = %s AND zone = 'PLUS'
    GROUP BY sectionName, `row`
    ORDER BY sectionName, avg_y DESC
""", (LAYOUT_ID,))
for row in cursor.fetchall():
    print(f"  {row[0]:15} | Fila {row[1]:2} | Y={row[2]:6.0f} | {row[3]} asientos")

# Para PREFERENTE
print("\n🔹 PREFERENTE - Relación Fila vs Posición Y:")
cursor.execute("""
    SELECT 
        sectionName,
        `row`,
        ROUND(AVG(y), 0) as avg_y,
        COUNT(*) as seats
    FROM Seat
    WHERE layoutId = %s AND zone = 'PREFERENTE'
    GROUP BY sectionName, `row`
    ORDER BY sectionName, avg_y DESC
""", (LAYOUT_ID,))
for row in cursor.fetchall():
    print(f"  {row[0]:15} | Fila {row[1]:2} | Y={row[2]:6.0f} | {row[3]} asientos")

# Análisis del PDF
print("\n" + "=" * 80)
print("📄 ANÁLISIS DETALLADO DEL PDF")
print("=" * 80)

doc = fitz.open(r"C:\Users\Alecs\Desktop\ddu\BOLETERA PROJECT\boletera1\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf")
page = doc[0]

# Extraer todo el texto con posiciones
blocks = page.get_text("dict")["blocks"]

# Encontrar "ESCENARIO" para determinar orientación
escenario_y = None
for block in blocks:
    if "lines" in block:
        for line in block["lines"]:
            for span in line["spans"]:
                if "ESCENARIO" in span["text"].upper():
                    escenario_y = span["bbox"][1]
                    print(f"\n📍 ESCENARIO encontrado en Y = {escenario_y:.1f}")

# Buscar los números de asientos y sus filas
print("\n📊 ESTRUCTURA DE FILAS SEGÚN PDF:")
print("-" * 60)

# En el PDF, según la imagen:
# - ESCENARIO está ARRIBA (Y bajo)
# - Fila 8/P está más CERCA del escenario
# - Fila 1/A está más LEJOS del escenario

print("""
INTERPRETACIÓN DEL PDF:

┌─────────────────────────────────────────────────────────────┐
│                     ESCENARIO (arriba)                       │
├─────────────────────────────────────────────────────────────┤
│  VIP: Fila 8 ← más cerca del escenario (Y bajo en PDF)     │
│  VIP: Fila 7                                                 │
│  ...                                                         │
│  VIP: Fila 1 ← más lejos del escenario (Y alto en PDF)     │
├─────────────────────────────────────────────────────────────┤
│  PLUS/PREF: Fila P ← más cerca del escenario               │
│  PLUS/PREF: Fila O                                          │
│  ...                                                         │
│  PLUS/PREF: Fila A ← más lejos del escenario               │
└─────────────────────────────────────────────────────────────┘

PERO EN LA BASE DE DATOS (sistema de coordenadas):
- El escenario tiene Y ALTO (arriba del canvas)
- Filas más cerca del escenario deberían tener Y más ALTO

Por lo tanto:
- VIP Fila 8 (cerca escenario) → debe tener Y ALTO
- VIP Fila 1 (lejos escenario) → debe tener Y BAJO
- PLUS/PREF Fila P (cerca escenario) → debe tener Y ALTO  
- PLUS/PREF Fila A (lejos escenario) → debe tener Y BAJO
""")

# Verificar el estado actual
print("\n📋 VERIFICACIÓN DEL ESTADO ACTUAL EN DB:")
print("-" * 60)

# Para VIP Central como ejemplo
cursor.execute("""
    SELECT 
        `row`,
        ROUND(AVG(y), 0) as avg_y
    FROM Seat
    WHERE layoutId = %s AND sectionName = 'VIP Central'
    GROUP BY `row`
    ORDER BY avg_y DESC
""", (LAYOUT_ID,))

vip_rows = cursor.fetchall()
print("\n VIP Central (ordenado por Y DESC - de mayor a menor Y):")
for row in vip_rows:
    print(f"  Fila {row[0]:2} | Y = {row[1]:.0f}")

# Determinar si está correcto
if vip_rows:
    first_row = vip_rows[0][0]  # La fila con mayor Y
    last_row = vip_rows[-1][0]  # La fila con menor Y
    
    print(f"\n⚠️  ANÁLISIS:")
    print(f"  - Fila con Y más ALTO (más cerca del escenario): Fila {first_row}")
    print(f"  - Fila con Y más BAJO (más lejos del escenario): Fila {last_row}")
    
    # Según el PDF, fila 8 debe estar más cerca del escenario
    if str(first_row) == '8':
        print("\n  ✅ CORRECTO: Fila 8 está más cerca del escenario (Y alto)")
    else:
        print(f"\n  ❌ INCORRECTO: Fila {first_row} tiene el Y más alto, pero debería ser Fila 8")

# Para PLUS
cursor.execute("""
    SELECT 
        `row`,
        ROUND(AVG(y), 0) as avg_y
    FROM Seat
    WHERE layoutId = %s AND sectionName = 'PLUS Central'
    GROUP BY `row`
    ORDER BY avg_y DESC
""", (LAYOUT_ID,))

plus_rows = cursor.fetchall()
print("\n PLUS Central (ordenado por Y DESC):")
for row in plus_rows:
    print(f"  Fila {row[0]:2} | Y = {row[1]:.0f}")

if plus_rows:
    first_row = plus_rows[0][0]
    last_row = plus_rows[-1][0]
    
    print(f"\n⚠️  ANÁLISIS:")
    print(f"  - Fila con Y más ALTO (más cerca del escenario): Fila {first_row}")
    print(f"  - Fila con Y más BAJO (más lejos del escenario): Fila {last_row}")
    
    # Según el PDF, fila P debe estar más cerca del escenario
    if first_row == 'P':
        print("\n  ✅ CORRECTO: Fila P está más cerca del escenario (Y alto)")
    else:
        print(f"\n  ❌ INCORRECTO: Fila {first_row} tiene el Y más alto, pero debería ser Fila P")

print("\n" + "=" * 80)
print("RESUMEN FINAL")
print("=" * 80)

# Numeración de asientos
print("""
📝 NUMERACIÓN DE ASIENTOS (según PDF):

Para cada fila, los asientos se numeran:
- IZQUIERDA: empieza en 1
- CENTRAL: continúa 
- DERECHA: números más altos

Ejemplo PREFERENTE Fila P:
- PREF Izquierda: asientos 1-43
- PREF Central: asientos 44-100
- PREF Derecha: asientos 101-143

Esta numeración va de IZQUIERDA a DERECHA del espectador
(que sería de DERECHA a IZQUIERDA viendo desde el escenario)
""")

conn.close()
print("\n✅ Análisis completado")
