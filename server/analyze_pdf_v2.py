import fitz
doc = fitz.open(r'C:\Users\Alecs\Desktop\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf')
page = doc[0]

print("=" * 80)
print("ANÁLISIS DE NUMERACIÓN - PDF ZONIFICACIÓN TEATRO")
print("=" * 80)
print()

# Textos importantes encontrados en el PDF:
textos_importantes = """
ZONA PREFERENTE - TOTAL: 2,061
- SECC. PREFERENTE / IZQUIERDA: 638
- PREFERENTE / DERECHA: 631
- (Por deducción PREFERENTE CENTRAL: 792)

ZONA PLUS - TOTAL: 1,294
- SECC. PLUS CENTRAL TOTAL: 414
- SECC. PLUS DERECHA TOTAL: 435
- SECC. PLUS IZQUIERDA TOTAL: 445

ZONA BUTACAS VIP - TOTAL: 514
- SECC. BUTACAS VIP CENTRAL TOTAL: 144
- SECC. BUTACAS VIP / DERECHA TOTAL: 182
- SECC. BUTACAS VIP / IZQUIERDA TOTAL: 188

TOTAL DE BUTACAS: 3,869
"""
print(textos_importantes)

print("=" * 80)
print("ANÁLISIS DE FILAS (basado en posición Y en el PDF)")
print("=" * 80)
print()

# El PDF tiene el escenario ARRIBA (Y bajo) y las filas van hacia abajo
# Las filas se identifican por letras (A-P para PLUS/PREFERENTE) o números (1-8 para VIP)

# Extraer información de filas
blocks = page.get_text('dict')['blocks']
rows_data = {}

for block in blocks:
    if 'lines' in block:
        for line in block['lines']:
            for span in line['spans']:
                text = span['text'].strip()
                y = span['bbox'][1]
                x = span['bbox'][0]
                
                # Buscar identificadores de fila (letras sueltas A-P o números 1-8)
                if len(text) == 1 and (text.isalpha() and text.upper() in 'ABCDEFGHIJKLMNOP'):
                    if text not in rows_data:
                        rows_data[text] = []
                    rows_data[text].append((y, x))

print("Filas detectadas y sus posiciones Y (de arriba hacia abajo):")
for row in sorted(rows_data.keys()):
    positions = rows_data[row]
    avg_y = sum(p[0] for p in positions) / len(positions)
    print(f"  Fila {row}: Y promedio = {avg_y:.0f}, apariciones = {len(positions)}")

print()
print("=" * 80)
print("OBSERVACIONES CLAVE DEL PDF:")
print("=" * 80)
print("""
1. El PDF muestra el teatro desde ARRIBA (vista cenital)
2. El ESCENARIO está en la parte SUPERIOR del PDF (Y bajo)
3. Las filas van de P (más cerca del escenario) a A (más lejos)
4. Para VIP, las filas van de 8 (más cerca) a 1 (más lejos)

ORDEN EN EL PDF (de arriba/escenario hacia abajo):
- ZONA PREFERENTE: Filas P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A
- ZONA PLUS: Filas P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A
- ZONA VIP: Filas 8, 7, 6, 5, 4, 3, 2, 1

NUMERACIÓN DE ASIENTOS (de derecha a izquierda según el PDF):
- IZQUIERDA: empieza en 1
- CENTRAL: continúa la numeración
- DERECHA: termina con los números más altos

Por ejemplo en PREFERENTE fila P:
- Izquierda: 1-43
- Central: 44-100
- Derecha: 101-143
""")
