#!/usr/bin/env python3
"""
Script para generar asientos del Teatro Parque Tangamanga 1
Version 2: Las filas siguen la inclinacion del poligono
"""

import json
import math

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

# Prefijos cortos para labels unicos
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

# Poligonos de las secciones (de la DB)
# Los puntos estan en orden: generalmente forman un cuadrilatero
SECTIONS_POLYGONS = {
    'section-1769207137210': [{"x":1057.79,"y":728.93},{"x":1273.63,"y":839.73},{"x":1187.61,"y":994.85},{"x":1012.93,"y":899.35}],  # VIP Izq
    'section-1769207521457': [{"x":1004.02,"y":710.12},{"x":780.58,"y":709.51},{"x":819.36,"y":870.14},{"x":964.63,"y":870.75}],      # VIP Central
    'section-1769207596584': [{"x":778.94,"y":897.16},{"x":734.62,"y":728.54},{"x":522.26,"y":839.31},{"x":611.52,"y":995.63}],       # VIP Der
    'section-1769207675202': [{"x":1375.08,"y":660.17},{"x":1275.79,"y":838.2},{"x":1059.07,"y":726.35},{"x":1113.84,"y":517.12}],    # PLUS Izq
    'section-1769207915218': [{"x":1004.83,"y":708.24},{"x":1060.98,"y":497.17},{"x":728.3,"y":496.48},{"x":779.62,"y":707.02}],      # PLUS Central
    'section-1769207998561': [{"x":733.21,"y":725.82},{"x":681.63,"y":522.38},{"x":424.12,"y":670.83},{"x":520.47,"y":837.29}],       # PLUS Der
    'section-1769208085369': [{"x":1400.87,"y":610.77},{"x":1525.9,"y":389.83},{"x":1197.02,"y":205.04},{"x":1129.3,"y":459.7}],      # PREF Izq
    'section-1769208201985': [{"x":1145.79,"y":175.73},{"x":1078.15,"y":431.23},{"x":712.75,"y":429.94},{"x":650.28,"y":174.91}],     # PREF Central
    'section-1769208355025': [{"x":598.29,"y":203.35},{"x":665.15,"y":461.47},{"x":394.11,"y":616.67},{"x":265.5,"y":394.17}],        # PREF Der
}

def distance(p1, p2):
    return math.sqrt((p2['x'] - p1['x'])**2 + (p2['y'] - p1['y'])**2)

def lerp_point(p1, p2, t):
    """Interpolar entre dos puntos"""
    return {
        'x': p1['x'] + (p2['x'] - p1['x']) * t,
        'y': p1['y'] + (p2['y'] - p1['y']) * t
    }

def get_polygon_edges(polygon):
    """Obtener los 4 lados del poligono como pares de puntos"""
    edges = []
    n = len(polygon)
    for i in range(n):
        edges.append((polygon[i], polygon[(i + 1) % n]))
    return edges

def find_top_bottom_edges(polygon):
    """
    Encontrar los lados superior e inferior del poligono.
    Para un teatro, el lado superior es el mas cercano al escenario (Y menor)
    y el inferior es el mas lejano (Y mayor).
    Retorna: (lado_superior, lado_inferior, lado_izq, lado_der)
    """
    edges = get_polygon_edges(polygon)
    
    # Calcular el centro Y de cada lado
    edge_centers = []
    for e in edges:
        center_y = (e[0]['y'] + e[1]['y']) / 2
        center_x = (e[0]['x'] + e[1]['x']) / 2
        edge_centers.append({
            'edge': e,
            'center_y': center_y,
            'center_x': center_x,
            'length': distance(e[0], e[1])
        })
    
    # Ordenar por Y para encontrar superior e inferior
    sorted_by_y = sorted(edge_centers, key=lambda x: x['center_y'])
    
    # Los dos lados con Y menor son candidatos para ser "superior" o laterales
    # Los dos lados con Y mayor son candidatos para ser "inferior" o laterales
    
    # Usar una heuristica: los lados mas horizontales (menos diferencia en Y) son top/bottom
    horizontal_score = []
    for ec in edge_centers:
        dy = abs(ec['edge'][1]['y'] - ec['edge'][0]['y'])
        dx = abs(ec['edge'][1]['x'] - ec['edge'][0]['x'])
        # Mayor dx/dy = mas horizontal
        score = dx / (dy + 0.001)
        horizontal_score.append((ec, score))
    
    # Ordenar por score horizontal
    horizontal_score.sort(key=lambda x: x[1], reverse=True)
    
    # Los dos mas horizontales son top y bottom
    top_bottom = [horizontal_score[0][0], horizontal_score[1][0]]
    # Los dos menos horizontales son left y right
    left_right = [horizontal_score[2][0], horizontal_score[3][0]]
    
    # Determinar cual es top y cual es bottom por Y
    if top_bottom[0]['center_y'] < top_bottom[1]['center_y']:
        top_edge = top_bottom[0]['edge']
        bottom_edge = top_bottom[1]['edge']
    else:
        top_edge = top_bottom[1]['edge']
        bottom_edge = top_bottom[0]['edge']
    
    # Determinar left y right por X
    if left_right[0]['center_x'] < left_right[1]['center_x']:
        left_edge = left_right[0]['edge']
        right_edge = left_right[1]['edge']
    else:
        left_edge = left_right[1]['edge']
        right_edge = left_right[0]['edge']
    
    return top_edge, bottom_edge, left_edge, right_edge

def order_edge_points(edge, direction='left_to_right'):
    """Ordenar los puntos de un lado de izquierda a derecha"""
    if edge[0]['x'] <= edge[1]['x']:
        return edge[0], edge[1]
    else:
        return edge[1], edge[0]

def generate_seats_in_polygon(polygon, filas_data, section_id, canvas_name, color, prefix):
    """
    Generar asientos dentro de un poligono siguiendo su forma.
    Las filas van del lado superior al inferior, siguiendo la inclinacion.
    """
    seats = []
    canvas_seats = []
    sql_inserts = []
    
    # Encontrar los 4 lados
    top_edge, bottom_edge, left_edge, right_edge = find_top_bottom_edges(polygon)
    
    # Ordenar puntos de los lados horizontales (de izq a der)
    top_left, top_right = order_edge_points(top_edge)
    bottom_left, bottom_right = order_edge_points(bottom_edge)
    
    num_filas = len(filas_data)
    
    # Margen del borde del poligono
    margin = 0.08
    
    for row_idx, fila_info in enumerate(filas_data):
        fila_label = str(fila_info['fila'])
        num_asientos = fila_info['asientos']
        seat_numbers = fila_info.get('seat_numbers', list(range(1, num_asientos + 1)))
        
        # Calcular el parametro t para esta fila (0 = top, 1 = bottom)
        t_row = margin + (1 - 2 * margin) * (row_idx + 0.5) / num_filas
        
        # Interpolar los puntos de inicio y fin de esta fila
        row_start = lerp_point(top_left, bottom_left, t_row)
        row_end = lerp_point(top_right, bottom_right, t_row)
        
        # Calcular el radio del asiento basado en el espacio disponible
        row_length = distance(row_start, row_end)
        seat_spacing = row_length / (num_asientos + 1)
        seat_radius = min(10, seat_spacing * 0.4)
        
        for seat_idx in range(num_asientos):
            # Calcular posicion del asiento a lo largo de la fila
            t_seat = (seat_idx + 1) / (num_asientos + 1)
            seat_pos = lerp_point(row_start, row_end, t_seat)
            
            if seat_idx < len(seat_numbers):
                seat_num = seat_numbers[seat_idx]
            else:
                seat_num = seat_idx + 1
            
            seat_id = f'seat-{section_id}-{fila_label}-{seat_num}'
            label = f'{prefix}-{fila_label}-{seat_num}'
            display_label = f'{fila_label}-{seat_num}'
            
            metadata = {
                'sectionId': section_id,
                'sectionName': canvas_name,
                'color': color,
                'canvas': {
                    'position': {'x': round(seat_pos['x'], 2), 'y': round(seat_pos['y'], 2)},
                    'size': {'width': seat_radius * 2, 'height': seat_radius * 2},
                    'label': display_label
                }
            }
            
            seats.append({
                'id': seat_id,
                'venueId': VENUE_ID,
                'layoutId': LAYOUT_ID,
                'label': label,
                'rowLabel': fila_label,
                'columnNumber': seat_num,
                'status': 'AVAILABLE',
                'metadata': metadata
            })
            
            canvas_seats.append({
                "type": "Circle",
                "version": "6.9.0",
                "originX": "center",
                "originY": "center",
                "left": round(seat_pos['x'], 2),
                "top": round(seat_pos['y'], 2),
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
            
            metadata_json = json.dumps(metadata, ensure_ascii=False).replace("'", "''")
            sql_inserts.append(f"('{seat_id}', '{VENUE_ID}', '{LAYOUT_ID}', '{label}', '{fila_label}', {seat_num}, 'AVAILABLE', '{metadata_json}', NOW(), NOW())")
    
    return seats, canvas_seats, sql_inserts

def main():
    # Cargar datos del Excel
    with open('/tmp/tangamanga_seats.json', 'r') as f:
        excel_data = json.load(f)

    all_seats = []
    all_canvas_seats = []
    all_sql_inserts = []

    for excel_name, section_id in SECTION_MAPPING.items():
        if excel_name not in excel_data:
            print(f'Seccion no encontrada en Excel: {excel_name}')
            continue
        
        section_data = excel_data[excel_name]
        filas_data = section_data['filas']
        polygon = SECTIONS_POLYGONS[section_id]
        zone = get_zone_from_section(excel_name)
        color = ZONE_COLORS.get(zone, '#666666')
        canvas_name = SECTION_NAMES_CANVAS.get(excel_name, excel_name)
        prefix = SECTION_PREFIX.get(excel_name, 'XX')
        
        print(f'Procesando: {excel_name} ({len(filas_data)} filas)')
        
        seats, canvas_seats, sql_inserts = generate_seats_in_polygon(
            polygon, filas_data, section_id, canvas_name, color, prefix
        )
        
        all_seats.extend(seats)
        all_canvas_seats.extend(canvas_seats)
        all_sql_inserts.extend(sql_inserts)

    print(f'\nTotal asientos generados: {len(all_seats)}')

    # Guardar SQL
    with open('/tmp/insert_seats.sql', 'w', encoding='utf-8') as f:
        f.write('-- Eliminar asientos existentes del venue\n')
        f.write(f"DELETE FROM Seat WHERE venueId = '{VENUE_ID}';\n\n")
        f.write('-- Insertar nuevos asientos\n')
        
        chunk_size = 100
        for i in range(0, len(all_sql_inserts), chunk_size):
            chunk = all_sql_inserts[i:i+chunk_size]
            f.write('INSERT INTO Seat (id, venueId, layoutId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt) VALUES\n')
            f.write(',\n'.join(chunk))
            f.write(';\n\n')

    print('SQL guardado en /tmp/insert_seats.sql')

    # Guardar asientos para el canvas
    with open('/tmp/seats_for_canvas.json', 'w', encoding='utf-8') as f:
        json.dump(all_canvas_seats, f, ensure_ascii=False, indent=2)
    print('Asientos para canvas guardados en /tmp/seats_for_canvas.json')
    
    # Guardar datos completos
    with open('/tmp/all_seats_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_seats, f, ensure_ascii=False, indent=2)
    print('Datos completos guardados en /tmp/all_seats_data.json')

if __name__ == '__main__':
    main()
