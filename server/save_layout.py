#!/usr/bin/env python3
"""
Script para guardar el layoutJson actualizado en la DB
"""

import json
import subprocess

LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

def main():
    # Cargar JSON actualizado
    with open('/tmp/layout_updated.json', 'r', encoding='utf-8') as f:
        layout = json.load(f)
    
    # Convertir a string JSON y escapar comillas simples para MySQL
    layout_json_str = json.dumps(layout, ensure_ascii=False).replace("'", "''").replace("\\", "\\\\")
    
    # Guardar SQL de update
    with open('/tmp/update_layout.sql', 'w', encoding='utf-8') as f:
        f.write(f"UPDATE VenueLayout SET layoutJson = '{layout_json_str}' WHERE id = '{LAYOUT_ID}';\n")
    
    print('SQL de actualizacion guardado en /tmp/update_layout.sql')
    print(f'Tamano del JSON: {len(layout_json_str)} caracteres')
    
    # Ejecutar update
    result = subprocess.run([
        'mysql', '-u', 'boletera_user', '-pCer0un0cer0.com20182417', 
        'boletera_db'
    ], input=f"UPDATE VenueLayout SET layoutJson = '{layout_json_str}' WHERE id = '{LAYOUT_ID}';",
       capture_output=True, text=True)
    
    if result.returncode == 0:
        print('Layout actualizado en la DB correctamente!')
    else:
        print(f'Error: {result.stderr}')

if __name__ == '__main__':
    main()
