import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'

# Ver todas las hojas
xl = pd.ExcelFile(excel_path)
print('Hojas disponibles:', xl.sheet_names)

# Buscar DIAMANTE en todas las hojas
for sheet in xl.sheet_names:
    print(f'\n=== HOJA: {sheet} ===')
    df = pd.read_excel(excel_path, sheet_name=sheet, header=None)
    
    # Buscar filas que contengan DIAMANTE
    for idx, row in df.iterrows():
        row_str = ' '.join([str(x) for x in row.values if pd.notna(x)])
        if 'DIAMANTE' in row_str.upper():
            print(f'Fila {idx}: {row_str[:200]}')
