#!/usr/bin/env python3
"""
Script para actualizar la capacidad de cada seccion
"""
import json
import subprocess

LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

# Conteo de asientos por seccion
SECTION_COUNTS = {
    'section-1769207137210': 188,  # VIP Izquierda
    'section-1769207521457': 136,  # VIP Central
    'section-1769207596584': 174,  # VIP Derecha
    'section-1769207675202': 445,  # PLUS Izquierda
    'section-1769207915218': 414,  # PLUS Central
    'section-1769207998561': 435,  # PLUS Derecha
    'section-1769208085369': 638,  # PREFERENTE Izquierda
    'section-1769208201985': 792,  # PREFERENTE Central
    'section-1769208355025': 631,  # PREFERENTE Derecha
}

def main():
    updates = []
    for section_id, capacity in SECTION_COUNTS.items():
        updates.append(f"UPDATE LayoutSection SET capacity = {capacity} WHERE id = '{section_id}';")
    
    sql = '\n'.join(updates)
    
    result = subprocess.run([
        'mysql', '-u', 'boletera_user', '-pCer0un0cer0.com20182417', 
        'boletera_db'
    ], input=sql, capture_output=True, text=True)
    
    if result.returncode == 0:
        print('Capacidades actualizadas correctamente!')
    else:
        print(f'Error: {result.stderr}')
    
    # Verificar
    result = subprocess.run([
        'mysql', '-u', 'boletera_user', '-pCer0un0cer0.com20182417', 
        'boletera_db', '-e',
        f"SELECT name, capacity FROM LayoutSection WHERE layoutId = '{LAYOUT_ID}' ORDER BY name"
    ], capture_output=True, text=True)
    
    print(result.stdout)

if __name__ == '__main__':
    main()
