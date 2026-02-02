#!/usr/bin/env python3
import json
import subprocess

LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

result = subprocess.run([
    'mysql', '-u', 'boletera_user', '-pCer0un0cer0.com20182417', 
    'boletera_db', '-N', '-e',
    f"SELECT layoutJson FROM VenueLayout WHERE id = '{LAYOUT_ID}'"
], capture_output=True, text=True)

layout_json_str = result.stdout.strip()
layout = json.loads(layout_json_str)

# Verificar estructura
print('Keys:', list(layout.keys()))
if 'canvas' in layout:
    print('Canvas keys:', list(layout['canvas'].keys()))
    if 'objects' in layout['canvas']:
        print('Objetos en canvas.objects:', len(layout['canvas']['objects']))
        types = {}
        for obj in layout['canvas']['objects']:
            t = obj.get('_customType', obj.get('type', 'unknown'))
            types[t] = types.get(t, 0) + 1
        print('Tipos:', types)
