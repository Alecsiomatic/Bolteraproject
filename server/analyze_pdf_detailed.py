import fitz  # PyMuPDF
import re
from collections import defaultdict

print("=" * 100)
print("ANÁLISIS DETALLADO DEL PDF - NUMERACIÓN Y GAPS POR SECCIÓN")
print("=" * 100)

doc = fitz.open(r"C:\Users\Alecs\Desktop\ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf")

print(f"\nPáginas en el PDF: {len(doc)}")

# Analizar todas las páginas
for page_num in range(len(doc)):
    page = doc[page_num]
    print(f"\n{'='*100}")
    print(f"PÁGINA {page_num + 1}")
    print(f"{'='*100}")
    
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
    
    # Ordenar por Y luego X
    all_texts.sort(key=lambda x: (round(x['y'], 0), x['x']))
    
    print(f"\nTotal de elementos de texto: {len(all_texts)}")
    
    # Mostrar TODO el contenido del PDF
    print("\n📄 CONTENIDO COMPLETO DEL PDF:")
    print("-" * 80)
    
    current_y = -1
    line_texts = []
    
    for t in all_texts:
        y_rounded = round(t['y'], 0)
        if y_rounded != current_y:
            if line_texts:
                print(f"Y={current_y:4.0f} | {' | '.join(line_texts)}")
            line_texts = [t['text']]
            current_y = y_rounded
        else:
            line_texts.append(t['text'])
    
    if line_texts:
        print(f"Y={current_y:4.0f} | {' | '.join(line_texts)}")

    # Buscar específicamente tablas con números
    print("\n" + "=" * 80)
    print("🔍 BUSCANDO PATRONES DE NUMERACIÓN DE ASIENTOS")
    print("=" * 80)
    
    # Buscar textos que parezcan rangos o números de asientos
    for t in all_texts:
        text = t['text']
        # Buscar patrones como "1-43", "Del 1 al 43", números grandes, etc.
        if re.search(r'\d+\s*[-–]\s*\d+', text):
            print(f"  Rango encontrado: '{text}' en Y={t['y']:.0f}, X={t['x']:.0f}")
        elif re.search(r'(del|from)\s*\d+\s*(al|to)\s*\d+', text, re.IGNORECASE):
            print(f"  Rango encontrado: '{text}' en Y={t['y']:.0f}, X={t['x']:.0f}")
    
    # Buscar textos con información de secciones
    print("\n🔍 INFORMACIÓN DE SECCIONES Y ZONAS:")
    for t in all_texts:
        text_upper = t['text'].upper()
        if any(kw in text_upper for kw in ['VIP', 'PLUS', 'PREFERENTE', 'SECC', 'ZONA', 'FILA', 'ASIENTO', 
                                            'DERECHA', 'IZQUIERDA', 'CENTRAL', 'TOTAL', 'CANTIDAD']):
            print(f"  Y={t['y']:5.0f} X={t['x']:5.0f} | {t['text']}")

doc.close()
print("\n✅ Análisis completado")
