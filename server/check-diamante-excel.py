import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, sheet_name='FINAL')

print('Columnas del Excel:', df.columns.tolist())
print('Primeras filas:')
print(df.head(10))
print('\n=== DIAMANTE EN EXCEL ===\n')

# Buscar columna de sección
seccion_col = None
for col in df.columns:
    if 'SECC' in str(col).upper() or 'ZONA' in str(col).upper():
        seccion_col = col
        break

if not seccion_col:
    seccion_col = df.columns[0]
print(f'Columna de sección: {seccion_col}')
print(f'Valores únicos: {df[seccion_col].unique()}')

for seccion in ['DIAMANTE IZQUIERDA', 'DIAMANTE CENTRAL', 'DIAMANTE DERECHA']:
    print(f'\n=== {seccion} ===')
    data = df[df['SECCION'] == seccion].copy()
    
    if len(data) == 0:
        print('  NO ENCONTRADA')
        continue
    
    print(f'Total asientos: {len(data)}')
    print(f'Columnas: {data.columns.tolist()}')
    
    # Agrupar por fila
    grouped = data.groupby('FILA').agg({
        'NUMERO': ['count', 'min', 'max', list]
    }).reset_index()
    grouped.columns = ['Fila', 'Cantidad', 'Min', 'Max', 'Numeros']
    
    for _, row in grouped.iterrows():
        nums = sorted(row['Numeros'])
        print(f"  Fila {row['Fila']}: {row['Cantidad']} asientos, números {int(row['Min'])}-{int(row['Max'])}")
        print(f"    Primeros 5: {nums[:5]}")
        print(f"    Últimos 5: {nums[-5:]}")
