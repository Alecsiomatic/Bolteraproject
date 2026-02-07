import pandas as pd

excel_path = r"C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx"
df = pd.read_excel(excel_path, header=None)

print("=== VIP DERECHA - EXCEL EXACTO ===\n")

# Buscar VIP DERECHA
for i, row in df.iterrows():
    for j, cell in enumerate(row):
        if pd.notna(cell) and 'VIP DERECHA' in str(cell).upper():
            print(f"Encontrado en fila {i}, columna {j}: {cell}")
            
            # Mostrar las siguientes filas (estructura de la sección)
            print("\nEstructura completa:")
            for k in range(i, min(i+15, len(df))):
                row_data = df.iloc[k].tolist()
                # Filtrar solo valores no nulos
                non_null = [(idx, v) for idx, v in enumerate(row_data) if pd.notna(v)]
                if non_null:
                    print(f"Excel fila {k}: {non_null[:10]}")  # Primeros 10 valores
            break
    else:
        continue
    break

# Ahora buscar el detalle de cada fila de asientos
print("\n\n=== DETALLE POR FILA ===")
for i, row in df.iterrows():
    row_str = str(row.tolist())
    # Buscar filas que tengan números de fila VIP (1-8) y números de asiento
    first_cell = df.iloc[i, 0] if pd.notna(df.iloc[i, 0]) else ""
    
    # Buscar en columnas específicas donde está VIP DERECHA (basado en análisis previo)
    # VIP está en las filas 47-56 aproximadamente
    if 47 <= i <= 60:
        vals = []
        for j, cell in enumerate(row):
            if pd.notna(cell):
                vals.append((j, cell))
        if vals:
            print(f"Fila Excel {i}: {vals}")
