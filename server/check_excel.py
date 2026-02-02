#!/usr/bin/env python3
import json

with open('/tmp/tangamanga_seats.json', 'r') as f:
    data = json.load(f)

for section, info in data.items():
    print(f'=== {section} ===')
    for fila in info['filas']:
        print(f'  Fila {fila["fila"]}: {fila["asientos"]} asientos')
        if 'seat_numbers' in fila:
            nums = fila['seat_numbers']
            if len(nums) > 10:
                print(f'    Numeros: {nums[:5]} ... {nums[-5:]}')
            else:
                print(f'    Numeros: {nums}')
        else:
            print(f'    Numeros: 1 a {fila["asientos"]}')
    print()
