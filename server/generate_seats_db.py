#!/usr/bin/env python3
"""
Script para generar asientos del Teatro Parque Tangamanga 1
Estructura correcta para la DB: Seat con sectionId en metadata
"""

import json
import uuid
from datetime import datetime

# Constantes
VENUE_ID = '2a8073f3-3b78-4394-8eab-79e7d988542a'
LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

# Mapeo de nombres de secciones del Excel a IDs de LayoutSection
SECTION_MAPPING = {
    'VIP IZQUIERDA': 'section-1769207137210',
    'VIP CENTRAL': 'section-1769207521457',
    'VIP DERECHA': 'section-1769207596584',
    'PLUS IZQUIERDA': 'section-1769207675202',
    'PLUS CENTRAL': 'section-1769207915218',
    'PLUS DERECHA': 'section-1769207998561',
    'PREFERENTE IZQUIERDA': 'section-1769208085369',
    'PREFERENTE CENTRAL': 'section-1769208201985',
    'PREFERENTE DERECHA': 'section-1769208355025',
}

# Nombres amigables para el canvas
SECTION_NAMES_CANVAS = {
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

# Prefijos cortos para labels unicos (VI=VIP Izq, VC=VIP Central, etc)
SECTION_PREFIX = {
    'VIP IZQUIERDA': 'VI',
    'VIP CENTRAL': 'VC',
    'VIP DERECHA': 'VD',
    'PLUS IZQUIERDA': 'PI',
    'PLUS CENTRAL': 'PC',
    'PLUS DERECHA': 'PD',
    'PREFERENTE IZQUIERDA': 'FI',
    'PREFERENTE CENTRAL': 'FC',
    'PREFERENTE DERECHA': 'FD',
}

# Colores por zona
ZONE_COLORS = {
    'VIP': '#0EA5E9',
    'PLUS': '#86B063',
    'PREFERENTE': '#E69E4C',
}

def get_zone_from_section(section_name):
    if 'VIP' in section_name.upper():
        return 'VIP'
    elif 'PLUS' in section_name.upper():
        return 'PLUS'
    elif 'PREFERENTE' in section_name.upper():
        return 'PREFERENTE'
    return 'UNKNOWN'

def get_polygon_bounds(polygon):
    xs = [p['x'] for p in polygon]
    ys = [p['y'] for p in polygon]
    return min(xs), max(xs), min(ys), max(ys)

# Poligonos de las secciones (de la DB)
SECTIONS_POLYGONS = {
    'section-1769207137210': [{"x":1057.79,"y":728.93},{"x":1273.63,"y":839.73},{"x":1187.61,"y":994.85},{"x":1012.93,"y":899.35}],
    'section-1769207521457': [{"x":1004.02,"y":710.12},{"x":780.58,"y":709.51},{"x":819.36,"y":870.14},{"x":964.63,"y":870.75}],
    'section-1769207596584': [{"x":778.94,"y":897.16},{"x":734.62,"y":728.54},{"x":522.26,"y":839.31},{"x":611.52,"y":995.63}],
    'section-1769207675202': [{"x":1375.08,"y":660.17},{"x":1275.79,"y":838.2},{"x":1059.07,"y":726.35},{"x":1113.84,"y":517.12}],
    'section-1769207915218': [{"x":1004.83,"y":708.24},{"x":1060.98,"y":497.17},{"x":728.3,"y":496.48},{"x":779.62,"y":707.02}],
    'section-1769207998561': [{"x":733.21,"y":725.82},{"x":681.63,"y":522.38},{"x":424.12,"y":670.83},{"x":520.47,"y":837.29}],
    'section-1769208085369': [{"x":1400.87,"y":610.77},{"x":1525.9,"y":389.83},{"x":1197.02,"y":205.04},{"x":1129.3,"y":459.7}],
    'section-1769208201985': [{"x":1145.79,"y":175.73},{"x":1078.15,"y":431.23},{"x":712.75,"y":429.94},{"x":650.28,"y":174.91}],
    'section-1769208355025': [{"x":598.29,"y":203.35},{"x":665.15,"y":461.47},{"x":394.11,"y":616.67},{"x":265.5,"y":394.17}],
}

def main():
    # Cargar datos del Excel
    with open('/tmp/tangamanga_seats.json', 'r') as f:
        excel_data = json.load(f)

    all_seats = []
    sql_inserts = []
    canvas_seats = []

    for excel_name, section_id in SECTION_MAPPING.items():
        if excel_name not in excel_data:
            print('Seccion no encontrada en Excel: ' + excel_name)
            continue
        
        section_data = excel_data[excel_name]
        filas_data = section_data['filas']
        polygon = SECTIONS_POLYGONS[section_id]
        zone = get_zone_from_section(excel_name)
        color = ZONE_COLORS.get(zone, '#666666')
        canvas_name = SECTION_NAMES_CANVAS.get(excel_name, excel_name)
        prefix = SECTION_PREFIX.get(excel_name, 'XX')
        
        min_x, max_x, min_y, max_y = get_polygon_bounds(polygon)
        width = max_x - min_x
        height = max_y - min_y
        
        num_filas = len(filas_data)
        margin_y = height * 0.08
        usable_height = height - (2 * margin_y)
        row_spacing = usable_height / (num_filas + 1)
        seat_radius = min(10, row_spacing * 0.35)
        
        print('Procesando: ' + excel_name + ' (' + str(len(filas_data)) + ' filas)')
        
        for row_idx, fila_info in enumerate(filas_data):
            fila_label = str(fila_info['fila'])
            num_asientos = fila_info['asientos']
            seat_numbers = fila_info.get('seat_numbers', list(range(1, num_asientos + 1)))
            
            row_y = min_y + margin_y + row_spacing * (row_idx + 1)
            
            # Encontrar intersecciones con el poligono
            intersections = []
            n = len(polygon)
            for i in range(n):
                p1 = polygon[i]
                p2 = polygon[(i + 1) % n]
                if (p1['y'] <= row_y <= p2['y']) or (p2['y'] <= row_y <= p1['y']):
                    if p1['y'] != p2['y']:
                        t = (row_y - p1['y']) / (p2['y'] - p1['y'])
                        if 0 <= t <= 1:
                            x = p1['x'] + t * (p2['x'] - p1['x'])
                            intersections.append(x)
            
            if len(intersections) < 2:
                intersections = [min_x + width * 0.1, max_x - width * 0.1]
            
            intersections.sort()
            row_min_x = intersections[0] + (intersections[-1] - intersections[0]) * 0.05
            row_max_x = intersections[-1] - (intersections[-1] - intersections[0]) * 0.05
            row_width = row_max_x - row_min_x
            
            if num_asientos > 1:
                seat_spacing = row_width / (num_asientos - 1)
            else:
                seat_spacing = 0
            
            for seat_idx in range(num_asientos):
                if num_asientos > 1:
                    seat_x = row_min_x + seat_spacing * seat_idx
                else:
                    seat_x = (row_min_x + row_max_x) / 2
                
                if seat_idx < len(seat_numbers):
                    seat_num = seat_numbers[seat_idx]
                else:
                    seat_num = seat_idx + 1
                
                seat_id = 'seat-' + section_id + '-' + fila_label + '-' + str(seat_num)
                # Label unico incluyendo prefijo de seccion (ej: VI-1-5 = VIP Izquierda fila 1 butaca 5)
                label = prefix + '-' + fila_label + '-' + str(seat_num)
                # Label para mostrar en el canvas (sin prefijo)
                display_label = fila_label + '-' + str(seat_num)
                
                # Metadata con posicion, color, seccion
                metadata = {
                    'sectionId': section_id,
                    'sectionName': canvas_name,
                    'color': color,
                    'canvas': {
                        'position': {'x': round(seat_x, 2), 'y': round(row_y, 2)},
                        'size': {'width': seat_radius * 2, 'height': seat_radius * 2},
                        'label': display_label
                    }
                }
                
                all_seats.append({
                    'id': seat_id,
                    'venueId': VENUE_ID,
                    'layoutId': LAYOUT_ID,
                    'label': label,
                    'rowLabel': fila_label,
                    'columnNumber': seat_num,
                    'status': 'AVAILABLE',
                    'metadata': metadata
                })
                
                # Objeto para el canvas (Fabric.js Circle)
                canvas_seats.append({
                    "type": "Circle",
                    "version": "6.9.0",
                    "originX": "center",
                    "originY": "center",
                    "left": round(seat_x, 2),
                    "top": round(row_y, 2),
                    "width": seat_radius * 2,
                    "height": seat_radius * 2,
                    "fill": color,
                    "stroke": "#ffffff",
                    "strokeWidth": 1,
                    "radius": seat_radius,
                    "opacity": 1,
                    "visible": True,
                    "selectable": True,
                    "evented": True,
                    "_customType": "seat",
                    "seatId": seat_id,
                    "row": fila_label,
                    "number": str(seat_num),
                    "section": canvas_name,
                    "sectionId": section_id,
                    "status": "available",
                    "price": 0
                })
                
                # SQL INSERT - escapar comillas
                metadata_json = json.dumps(metadata, ensure_ascii=False).replace("'", "''")
                sql_inserts.append("('" + seat_id + "', '" + VENUE_ID + "', '" + LAYOUT_ID + "', '" + label + "', '" + fila_label + "', " + str(seat_num) + ", 'AVAILABLE', '" + metadata_json + "', NOW(), NOW())")

    print('')
    print('Total asientos generados: ' + str(len(all_seats)))

    # Guardar SQL
    with open('/tmp/insert_seats.sql', 'w', encoding='utf-8') as f:
        f.write('-- Eliminar asientos existentes del venue\n')
        f.write("DELETE FROM Seat WHERE venueId = '" + VENUE_ID + "';\n\n")
        f.write('-- Insertar nuevos asientos\n')
        
        # Dividir en chunks de 100 para evitar queries muy largos
        chunk_size = 100
        for i in range(0, len(sql_inserts), chunk_size):
            chunk = sql_inserts[i:i+chunk_size]
            f.write('INSERT INTO Seat (id, venueId, layoutId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt) VALUES\n')
            f.write(',\n'.join(chunk))
            f.write(';\n\n')

    print('SQL guardado en /tmp/insert_seats.sql')

    # Guardar asientos para el canvas
    with open('/tmp/seats_for_canvas.json', 'w', encoding='utf-8') as f:
        json.dump(canvas_seats, f, ensure_ascii=False, indent=2)
    print('Asientos para canvas guardados en /tmp/seats_for_canvas.json')
    
    # Guardar datos completos
    with open('/tmp/all_seats_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_seats, f, ensure_ascii=False, indent=2)
    print('Datos completos guardados en /tmp/all_seats_data.json')

if __name__ == '__main__':
    main()
