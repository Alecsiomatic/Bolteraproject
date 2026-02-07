import pandas as pd

excel_path = r"C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx"
df = pd.read_excel(excel_path, header=None)

print("=== PREFERENTE CENTRAL - EXCEL ===\n")

# Buscar PREFERENTE CENTRAL
found = False
for row_idx in range(len(df)):
    for col_idx in range(len(df.columns)):
        cell = df.iloc[row_idx, col_idx]
        if pd.notna(cell) and 'PREFERENTE CENTRAL' in str(cell).upper():
            print(f"Encontrado en fila {row_idx}, columna {col_idx}")
            print(f"Valor: {cell}\n")
            
            # Mostrar las siguientes 25 filas para ver la estructura
            print("Datos crudos (siguientes 25 filas):")
            for i in range(row_idx + 1, min(row_idx + 26, len(df))):
                row_data = df.iloc[i, col_idx:col_idx+6].tolist()
                # Limpiar NaN
                row_clean = [str(x) if pd.notna(x) else '' for x in row_data]
                if any(row_clean):
                    print(f"  Row {i}: {row_clean}")
            
            found = True
            break
    if found:
        break

if not found:
    print("No se encontró PREFERENTE CENTRAL")
    print("\nBuscando todas las secciones PREFERENTE...")
    for row_idx in range(len(df)):
        for col_idx in range(len(df.columns)):
            cell = df.iloc[row_idx, col_idx]
            if pd.notna(cell) and 'PREFERENTE' in str(cell).upper():
                print(f"  Fila {row_idx}, Col {col_idx}: {cell}")
