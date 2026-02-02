#!/usr/bin/env python3
"""
Script para actualizar layoutJson con los asientos generados
"""

import json
import subprocess

LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

def main():
    # Obtener layoutJson actual
    query = f"SELECT layoutJson FROM VenueLayout WHERE id = '{LAYOUT_ID}'"
    result = subprocess.run([
        'mysql', '-u', 'boletera_user', '-pCer0un0cer0.com20182417', 
        'boletera_db', '-N', '-e', query
    ], capture_output=True, text=True)

    layout_json_str = result.stdout.strip()
    if not layout_json_str:
        print('Error: No se encontro el layout')
        return
    
    layout = json.loads(layout_json_str)
    
    # La estructura es layout.canvas.objects
    canvas_objects = layout.get('canvas', {}).get('objects', [])
    print(f'Objetos originales en canvas.objects: {len(canvas_objects)}')

    # Cargar nuevos asientos para canvas
    with open('/tmp/seats_for_canvas.json', 'r') as f:
        new_seats = json.load(f)

    print(f'Asientos a agregar: {len(new_seats)}')

    # Remover asientos anteriores si existen
    objects = [obj for obj in canvas_objects if obj.get('_customType') != 'seat']
    print(f'Objetos sin asientos: {len(objects)}')

    # Agregar nuevos asientos
    objects.extend(new_seats)
    layout['canvas']['objects'] = objects

    print(f'Total objetos finales: {len(objects)}')

    # Guardar JSON actualizado
    with open('/tmp/layout_updated.json', 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False)

    print('Layout actualizado guardado en /tmp/layout_updated.json')

if __name__ == '__main__':
    main()
