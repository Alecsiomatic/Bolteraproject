#!/usr/bin/env python3
"""
Script para generar asientos del Teatro Parque Tangamanga 1
Genera asientos dentro de cada polígono basándose en el Excel de configuración
"""

import json
import math
import uuid
from typing import List, Dict, Tuple

# Mapeo de nombres del canvas a nombres del Excel
SECTION_MAPPING = {
    'VIP Izquierda': 'VIP IZQUIERDA',
    'VIP Central': 'VIP CENTRAL',
    'VIP Derecha': 'VIP DERECHA',
    'PLUS Izquierda': 'PLUS IZQUIERDA',
    'PLUS Central': 'PLUS CENTRAL',
    'PLUS Derecha': 'PLUS DERECHA',
    'PREFERENTE Izquierda': 'PREFERENTE IZQUIERDA',
    'PREFERENTE Central': 'PREFERENTE CENTRAL',
    'PREFERENTE Derecha': 'PREFERENTE DERECHA',
}

# Colores por zona
ZONE_COLORS = {
    'VIP': '#0EA5E9',
    'PLUS': '#86B063',
    'PREFERENTE': '#E69E4C',
}

def get_zone_from_section(section_name: str) -> str:
    """Obtiene la zona basándose en el nombre de la sección"""
    if 'VIP' in section_name.upper():
        return 'VIP'
    elif 'PLUS' in section_name.upper():
        return 'PLUS'
    elif 'PREFERENTE' in section_name.upper():
        return 'PREFERENTE'
    return 'UNKNOWN'

def point_in_polygon(x: float, y: float, polygon: List[Dict]) -> bool:
    """Verifica si un punto está dentro de un polígono usando ray casting"""
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]['x'], polygon[i]['y']
        xj, yj = polygon[j]['x'], polygon[j]['y']
        
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside

def get_polygon_bounds(polygon: List[Dict]) -> Tuple[float, float, float, float]:
    """Obtiene los límites del polígono (min_x, max_x, min_y, max_y)"""
    xs = [p['x'] for p in polygon]
    ys = [p['y'] for p in polygon]
    return min(xs), max(xs), min(ys), max(ys)

def interpolate_edge(p1: Dict, p2: Dict, t: float) -> Tuple[float, float]:
    """Interpola un punto en el borde entre p1 y p2"""
    x = p1['x'] + (p2['x'] - p1['x']) * t
    y = p1['y'] + (p2['y'] - p1['y']) * t
    return x, y

def generate_seats_in_polygon(
    polygon: List[Dict],
    filas_data: List[Dict],
    section_name: str,
    seat_color: str,
    is_right_section: bool = False,
    is_center_section: bool = False
) -> List[Dict]:
    """
    Genera asientos dentro de un polígono
    Los asientos se distribuyen en filas siguiendo la forma del polígono
    """
    seats = []
    
    # Obtener límites del polígono
    min_x, max_x, min_y, max_y = get_polygon_bounds(polygon)
    width = max_x - min_x
    height = max_y - min_y
    
    num_filas = len(filas_data)
    
    # Calcular el espaciado vertical entre filas
    # Dejamos un margen del 5% arriba y abajo
    margin_y = height * 0.05
    usable_height = height - (2 * margin_y)
    row_spacing = usable_height / (num_filas + 1)
    
    # Tamaño del asiento (ajustable)
    seat_radius = min(12, row_spacing * 0.35)
    
    for row_idx, fila_info in enumerate(filas_data):
        fila_label = fila_info['fila']
        num_asientos = fila_info['asientos']
        seat_numbers = fila_info.get('seat_numbers', list(range(1, num_asientos + 1)))
        
        # Posición Y de esta fila (de arriba hacia abajo)
        row_y = min_y + margin_y + row_spacing * (row_idx + 1)
        
        # Encontrar los puntos de intersección del polígono con esta línea horizontal
        intersections = []
        n = len(polygon)
        for i in range(n):
            p1 = polygon[i]
            p2 = polygon[(i + 1) % n]
            
            # Verificar si la línea horizontal cruza este borde
            if (p1['y'] <= row_y <= p2['y']) or (p2['y'] <= row_y <= p1['y']):
                if p1['y'] != p2['y']:
                    t = (row_y - p1['y']) / (p2['y'] - p1['y'])
                    if 0 <= t <= 1:
                        x = p1['x'] + t * (p2['x'] - p1['x'])
                        intersections.append(x)
        
        if len(intersections) < 2:
            # Si no hay suficientes intersecciones, usar los límites
            intersections = [min_x + width * 0.1, max_x - width * 0.1]
        
        intersections.sort()
        row_min_x = intersections[0]
        row_max_x = intersections[-1]
        
        # Margen horizontal dentro de la fila
        margin_x = (row_max_x - row_min_x) * 0.05
        row_min_x += margin_x
        row_max_x -= margin_x
        
        row_width = row_max_x - row_min_x
        
        # Calcular espaciado entre asientos
        if num_asientos > 1:
            seat_spacing = row_width / (num_asientos - 1)
        else:
            seat_spacing = 0
        
        # Ajustar si el espaciado es muy pequeño
        min_spacing = seat_radius * 2.2
        if seat_spacing < min_spacing and num_asientos > 1:
            seat_spacing = min_spacing
            # Recalcular el ancho necesario
            needed_width = seat_spacing * (num_asientos - 1)
            # Centrar los asientos si no caben
            start_x = row_min_x + (row_width - needed_width) / 2
            if start_x < row_min_x:
                start_x = row_min_x
        else:
            start_x = row_min_x
        
        # Generar los asientos de esta fila
        for seat_idx in range(num_asientos):
            # Posición X del asiento
            if num_asientos > 1:
                seat_x = start_x + seat_spacing * seat_idx
            else:
                seat_x = (row_min_x + row_max_x) / 2
            
            # Número del asiento
            if seat_idx < len(seat_numbers):
                seat_num = seat_numbers[seat_idx]
            else:
                seat_num = seat_idx + 1
            
            # Crear el objeto asiento (formato Fabric.js Circle)
            seat = {
                "type": "Circle",
                "version": "6.9.0",
                "originX": "center",
                "originY": "center",
                "left": round(seat_x, 2),
                "top": round(row_y, 2),
                "width": seat_radius * 2,
                "height": seat_radius * 2,
                "fill": seat_color,
                "stroke": "#ffffff",
                "strokeWidth": 1,
                "radius": seat_radius,
                "opacity": 1,
                "visible": True,
                "selectable": True,
                "evented": True,
                "_customType": "seat",
                "seatId": f"seat-{section_name.replace(' ', '-')}-{fila_label}-{seat_num}",
                "row": str(fila_label),
                "number": str(seat_num),
                "section": section_name,
                "status": "available",
                "price": 0
            }
            seats.append(seat)
    
    return seats

def main():
    # Cargar datos del Excel (previamente procesados)
    with open('tangamanga_seats.json', 'r', encoding='utf-8') as f:
        excel_data = json.load(f)
    
    # Cargar el layout actual del venue
    with open('/tmp/layout.json', 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    canvas = layout_data.get('canvas', {})
    objects = canvas.get('objects', [])
    
    all_seats = []
    sections_processed = []
    
    # Procesar cada sección del canvas
    for obj in objects:
        if obj.get('_customType') != 'section':
            continue
        
        canvas_name = obj.get('name', '')
        excel_name = SECTION_MAPPING.get(canvas_name)
        
        if not excel_name or excel_name not in excel_data:
            print(f"⚠️  Sección no encontrada en Excel: {canvas_name}")
            continue
        
        print(f"\n📦 Procesando: {canvas_name}")
        
        # Obtener el polígono de la sección
        sub_objects = obj.get('objects', [])
        polygon = None
        for sub in sub_objects:
            if sub.get('type') == 'Polygon':
                polygon = sub.get('points', [])
                break
        
        if not polygon:
            print(f"  ❌ No se encontró polígono para {canvas_name}")
            continue
        
        # Obtener datos del Excel
        section_data = excel_data[excel_name]
        filas_data = section_data['filas']
        
        # Determinar el color según la zona
        zone = get_zone_from_section(canvas_name)
        seat_color = ZONE_COLORS.get(zone, '#666666')
        
        # Determinar si es sección derecha o central
        is_right = 'Derecha' in canvas_name or 'DERECHA' in canvas_name
        is_center = 'Central' in canvas_name or 'CENTRAL' in canvas_name
        
        # Generar asientos
        seats = generate_seats_in_polygon(
            polygon=polygon,
            filas_data=filas_data,
            section_name=canvas_name,
            seat_color=seat_color,
            is_right_section=is_right,
            is_center_section=is_center
        )
        
        all_seats.extend(seats)
        sections_processed.append({
            'name': canvas_name,
            'seats': len(seats),
            'filas': len(filas_data)
        })
        
        print(f"  ✅ Generados {len(seats)} asientos en {len(filas_data)} filas")
    
    # Resumen
    print("\n" + "=" * 60)
    print("RESUMEN DE GENERACIÓN")
    print("=" * 60)
    total_seats = 0
    for sec in sections_processed:
        print(f"  {sec['name']}: {sec['seats']} asientos")
        total_seats += sec['seats']
    print(f"\n  TOTAL: {total_seats} asientos generados")
    
    # Crear nuevo layout con los asientos
    # Agregar los asientos al canvas
    new_objects = []
    for obj in objects:
        new_objects.append(obj)
    
    # Agregar todos los asientos
    new_objects.extend(all_seats)
    
    # Actualizar el layout
    layout_data['canvas']['objects'] = new_objects
    
    # Guardar el nuevo layout
    output_path = '/tmp/layout_with_seats.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(layout_data, f, ensure_ascii=False)
    
    print(f"\n✅ Layout guardado en: {output_path}")
    
    # También guardar solo los asientos para referencia
    seats_only_path = '/tmp/tangamanga_seats_generated.json'
    with open(seats_only_path, 'w', encoding='utf-8') as f:
        json.dump(all_seats, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Asientos guardados en: {seats_only_path}")
    
    return all_seats

if __name__ == '__main__':
    main()
