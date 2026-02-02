import json

with open('/tmp/tangamanga_seats.json', 'r') as f:
    data = json.load(f)

for zone_name, zone_data in data.items():
    if 'VIP' in zone_name:
        total = sum(row['asientos'] for row in zone_data['filas'])
        print(f"\n=== {zone_name} - Total calculado: {total} ===")
        for row in zone_data['filas']:
            nums = row['seat_numbers']
            print(f"  Fila {row['fila']}: {row['asientos']} asientos, direccion: {row['direccion']}")
            print(f"    Generados: {len(nums)} asientos")
            if len(nums) != row['asientos']:
                print(f"    *** DIFERENCIA: dice {row['asientos']} pero tiene {len(nums)} ***")
