#!/usr/bin/env python3
"""
Script para corregir la numeración de asientos de Tangamanga
usando el JSON corregido como fuente de verdad
"""
import json
import mysql.connector

# Cargar JSON corregido
with open('/tmp/tangamanga_corrected.json') as f:
    sections = json.load(f)

# Mapeo de nombres de secciones del Excel a nombres en la BD
SECTION_MAPPING = {
    'VIP IZQUIERDA': 'VIP Izquierda',
    'VIP CENTRAL': 'VIP Central',
    'VIP DERECHA': 'VIP Derecha',
    'PLUS IZQUIERDA': 'PLUS Izquierda',
    'PLUS CENTRAL': 'PLUS Central',
    'PLUS DERECHA': 'PLUS Derecha',
    'PREFERENTE IZQUIERDA': 'PREFERENTE Izquierda',
    'PREFERENTE CENTRAL': 'PREFERENTE Central',
    'PREFERENTE DERECHA': 'PREFERENTE Derecha',
}

conn = mysql.connector.connect(
    host='localhost',
    user='boletera_user',
    password='Cer0un0cer0.com20182417',
    database='boletera_db'
)
cursor = conn.cursor()

venue_id = '2a8073f3-3b78-4394-8eab-79e7d988542a'
updates = 0
errors = 0

for excel_section, data in sections.items():
    db_section = SECTION_MAPPING.get(excel_section)
    if not db_section:
        print(f'Seccion no mapeada: {excel_section}')
        continue
    
    for fila in data['filas']:
        row_label = str(fila['fila'])
        seat_numbers = fila['seat_numbers']
        
        # Obtener asientos de esta seccion/fila ordenados por posicion X
        query = """
            SELECT id, columnNumber, 
                   JSON_EXTRACT(metadata, '$.canvas.position.x') as posX
            FROM Seat 
            WHERE venueId = %s 
              AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = %s
              AND rowLabel = %s
            ORDER BY CAST(JSON_EXTRACT(metadata, '$.canvas.position.x') AS DECIMAL(10,2)) ASC
        """
        cursor.execute(query, (venue_id, db_section, row_label))
        seats = cursor.fetchall()
        
        if len(seats) != len(seat_numbers):
            print(f'ERROR {db_section} Fila {row_label}: BD tiene {len(seats)}, Excel tiene {len(seat_numbers)}')
            errors += 1
            continue
        
        # Actualizar cada asiento con el numero correcto
        for i, (seat_id, old_num, _) in enumerate(seats):
            new_num = seat_numbers[i]
            if old_num != new_num:
                update_query = """
                    UPDATE Seat 
                    SET columnNumber = %s,
                        label = CONCAT(
                            SUBSTRING_INDEX(label, '-', 2),
                            '-',
                            %s
                        ),
                        metadata = JSON_SET(
                            metadata,
                            '$.canvas.label',
                            CONCAT(%s, '-', %s)
                        )
                    WHERE id = %s
                """
                cursor.execute(update_query, (new_num, new_num, row_label, new_num, seat_id))
                updates += 1

conn.commit()
print(f'Actualizados: {updates} asientos')
print(f'Errores: {errors}')
cursor.close()
conn.close()
