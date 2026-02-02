import pandas as pd

excel_path = r'C:\Users\Alecs\Desktop\FINAL CON ZONA DIAMANTE DE TEATRO DE LA CIUDAD TANGAMANGA 1.xlsx'
df = pd.read_excel(excel_path, sheet_name='FINAL')

for seccion in ['VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA']:
    print(f'\n=== {seccion} (Excel) ===')
    vip = df[df['SECCION'] == seccion].copy()
    vip_grouped = vip.groupby('FILA').agg({
        'NUMERO': ['count', 'min', 'max']
    }).reset_index()
    vip_grouped.columns = ['Fila', 'Cantidad', 'Min', 'Max']
    vip_grouped = vip_grouped.sort_values('Fila', ascending=False)
    total = 0
    for _, row in vip_grouped.iterrows():
        print(f"Fila {row['Fila']}: {row['Cantidad']} asientos ({int(row['Min'])}-{int(row['Max'])})")
        total += row['Cantidad']
    print(f'TOTAL {seccion}: {total}')
