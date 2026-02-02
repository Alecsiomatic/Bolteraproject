#!/usr/bin/env python3
import json

with open('/tmp/tangamanga_seats.json', 'r') as f:
    data = json.load(f)

print("=== ZONAS VIP ===\n")
for section in ['VIP IZQUIERDA', 'VIP CENTRAL', 'VIP DERECHA']:
    if section in data:
        info = data[section]
        print(f"{section}: Total declarado = {info['total']}")
        total_calculado = 0
        for fila in info['filas']:
            nums = fila.get('seat_numbers', [])
            print(f"  Fila {fila['fila']}: {fila['asientos']} asientos, nums: {nums}")
            total_calculado += fila['asientos']
        print(f"  Total calculado: {total_calculado}")
        print()
