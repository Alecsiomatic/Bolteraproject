# Script para generar SQL de asientos faltantes
# VIP Central - sectionId: section-1769207521457, prefix: VC
# VIP Derecha - sectionId: section-1769207596584, prefix: VD

vip_central_missing = {
    '1': 37,  # falta el 37
    '2': 39,  # falta el 39
    '3': 40,  # falta el 40
    '4': 42,  # falta el 42
    '5': 41,  # falta el 41
    '6': 43,  # falta el 43
    '7': 44,  # falta el 44
    '8': 46,  # falta el 46
}

vip_derecha_missing = {
    '1': 59,  # falta el 59
    '2': 61,  # falta el 61
    '3': 62,  # falta el 62
    '4': 65,  # falta el 65
    '5': 63,  # falta el 63
    '6': 66,  # falta el 66
    '7': 68,  # falta el 68
    '8': 70,  # falta el 70
}

# Generar SQL
sql_statements = []
layout_id = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'
venue_id = '2a8073f3-3b78-4394-8eab-79e7d988542a'

# VIP Central
section_id = 'section-1769207521457'
for row, seat_num in vip_central_missing.items():
    seat_id = f'seat-{section_id}-{row}-{seat_num}'
    label = f'VC-{row}-{seat_num}'
    metadata = '{"sectionId": "' + section_id + '", "sectionName": "VIP Central", "color": "#0EA5E9", "canvas": {"position": {"x": 785, "y": 730}, "size": {"width": 11.36, "height": 11.36}, "label": "' + f'{row}-{seat_num}' + '"}}'
    
    sql = f"INSERT INTO Seat (id, venueId, layoutId, label, rowLabel, status, metadata, createdAt, updatedAt) VALUES ('{seat_id}', '{venue_id}', '{layout_id}', '{label}', '{row}', 'AVAILABLE', '{metadata}', NOW(), NOW());"
    sql_statements.append(sql)

# VIP Derecha
section_id = 'section-1769207596584'
for row, seat_num in vip_derecha_missing.items():
    seat_id = f'seat-{section_id}-{row}-{seat_num}'
    label = f'VD-{row}-{seat_num}'
    metadata = '{"sectionId": "' + section_id + '", "sectionName": "VIP Derecha", "color": "#0EA5E9", "canvas": {"position": {"x": 530, "y": 860}, "size": {"width": 8.49, "height": 8.49}, "label": "' + f'{row}-{seat_num}' + '"}}'
    
    sql = f"INSERT INTO Seat (id, venueId, layoutId, label, rowLabel, status, metadata, createdAt, updatedAt) VALUES ('{seat_id}', '{venue_id}', '{layout_id}', '{label}', '{row}', 'AVAILABLE', '{metadata}', NOW(), NOW());"
    sql_statements.append(sql)

print('-- SQL para agregar 16 asientos faltantes')
print()
for sql in sql_statements:
    print(sql)
    print()

print(f'-- Total: {len(sql_statements)} asientos')
