import pandas as pd

excel_path = r"C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx"
df = pd.read_excel(excel_path, header=None)

print("=== PLUS IZQUIERDA - EXCEL EXACTO ===\n")

# Buscar PLUS IZQUIERDA
found = False
for i, row in df.iterrows():
    for j, cell in enumerate(row):
        if pd.notna(cell) and 'PLUS IZQUIERDA' in str(cell).upper():
            print(f"Encontrado en fila Excel {i}, columna {j}: {cell}")
            found = True
            
            # Mostrar las siguientes filas (estructura de la sección)
            print("\nEstructura completa:")
            for k in range(i, min(i+25, len(df))):
                row_data = df.iloc[k].tolist()
                # Filtrar solo valores no nulos
                non_null = [(idx, v) for idx, v in enumerate(row_data) if pd.notna(v)]
                if non_null:
                    # Mostrar solo las columnas relevantes para PLUS IZQUIERDA
                    relevant = [(idx, v) for idx, v in non_null if idx >= j-2]
                    if relevant:
                        print(f"Fila {k}: {relevant[:8]}")
            break
    if found:
        break

if not found:
    print("No encontré PLUS IZQUIERDA")
