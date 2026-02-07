import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, sheet_name='FINAL', header=None)

# Buscar VIP en el Excel
print('=== BUSCANDO VIP EN EXCEL ===\n')

for idx in range(len(df)):
    row = df.iloc[idx]
    values = [str(x) for x in row.values if pd.notna(x) and str(x) != 'nan']
    row_str = ' '.join(values)
    if 'VIP' in row_str.upper() and 'TOTAL' in row_str.upper():
        print(f'\n--- Fila {idx} (encabezado) ---')
        print(row_str[:300])
        # Mostrar las siguientes filas
        for i in range(1, 8):
            if idx + i < len(df):
                next_row = df.iloc[idx + i]
                next_values = [str(x) for x in next_row.values if pd.notna(x) and str(x) != 'nan']
                if next_values:
                    print(f'Fila {idx+i}: {" | ".join(next_values)}')
