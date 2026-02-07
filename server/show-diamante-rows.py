import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, sheet_name='FINAL', header=None)

# Mostrar filas 55-75 para ver la zona DIAMANTE completa
print('=== ZONA DIAMANTE (filas 55-75) ===\n')
for idx in range(55, 76):
    if idx < len(df):
        row = df.iloc[idx]
        values = [str(x) for x in row.values if pd.notna(x) and str(x) != 'nan']
        if values:
            print(f'Fila {idx}: {" | ".join(values)}')
