import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, header=None)

print('=== BUSCANDO PLUS DERECHA EN EL EXCEL ===')
print()

# Buscar filas que contengan "PLUS DERECHA"
for i, row in df.iterrows():
    row_str = ' '.join([str(x) for x in row.values if pd.notna(x)])
    if 'PLUS' in row_str.upper() and 'DERECHA' in row_str.upper():
        print(f'Fila {i}: {row.values[:10]}')

print()
print('=== Mostrando filas 0-50 del Excel ===')
for i in range(min(50, len(df))):
    row = df.iloc[i]
    vals = [str(x) if pd.notna(x) else '' for x in row.values[:8]]
    if any(v for v in vals):
        print(f'{i:3}: {vals}')
