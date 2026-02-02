import fitz
doc = fitz.open(r'C:\Users\Alecs\Desktop\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf')
page = doc[0]

print('Dimensiones de la página:', page.rect)
print()

# Extraer bloques de texto con posiciones
blocks = page.get_text('dict')['blocks']

# Agrupar números por posición Y (filas)
rows = {}
for block in blocks:
    if 'lines' in block:
        for line in block['lines']:
            for span in line['spans']:
                text = span['text'].strip()
                y = round(span['bbox'][1], 0)
                x = round(span['bbox'][0], 0)
                
                if text:
                    if y not in rows:
                        rows[y] = []
                    rows[y].append((x, text))

# Ordenar filas por Y
print("=== ANÁLISIS DEL PDF - NUMERACIÓN POR FILAS ===")
print()

for y in sorted(rows.keys()):
    items = sorted(rows[y], key=lambda x: x[0])  # Ordenar por X
    texts = [t[1] for t in items]
    
    # Filtrar solo números o textos importantes
    nums = [t for t in texts if t.isdigit() or 'ZONA' in t or 'TOTAL' in t]
    if nums:
        print(f"Y={y:4.0f}: {' | '.join(texts[:20])}{'...' if len(texts) > 20 else ''}")
