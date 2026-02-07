import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, sheet_name='FINAL', header=None)

print('=== ZONA VIP COMPLETA ===\n')

# Filas 47-57 contienen VIP
for idx in range(47, 58):
    if idx < len(df):
        row = df.iloc[idx]
        values = [str(x) for x in row.values if pd.notna(x) and str(x) != 'nan']
        if values:
            print(f'Fila {idx}: {" | ".join(values)}')

print('\n\n=== RESUMEN VIP ===')
print('''
VIP DERECHA (182 asientos):
  Fila 8: 24 asientos, nums 41-70 (30 nums pero 24 asientos??)
  Fila 7: 24 asientos, nums 45-68
  Fila 6: 23 asientos, nums 44-66
  Fila 5: 22 asientos, nums 42-63
  Fila 4: 23 asientos, nums 43-65
  Fila 3: 22 asientos, nums 41-62
  Fila 2: 22 asientos, nums 40-61
  Fila 1: 22 asientos, nums 38-59

VIP CENTRAL (144 asientos):
  Fila 8: 21 asientos, nums 26-46
  Fila 7: 20 asientos, nums 25-44
  Fila 6: 19 asientos, nums 25-43
  Fila 5: 18 asientos, nums 24-41
  Fila 4: 18 asientos, nums 25-42
  Fila 3: 17 asientos, nums 24-40
  Fila 2: 16 asientos, nums 24-39
  Fila 1: 15 asientos, nums 23-37

VIP IZQUIERDA (188 asientos):
  Fila 8: 25 asientos, nums 1-25
  Fila 7: 24 asientos, nums 1-24
  Fila 6: 24 asientos, nums 1-24
  Fila 5: 23 asientos, nums 1-23
  Fila 4: 24 asientos, nums 1-24
  Fila 3: 23 asientos, nums 1-23
  Fila 2: 23 asientos, nums 1-23
  Fila 1: 22 asientos, nums 1-22
''')
