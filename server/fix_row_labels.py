# Script para corregir la numeración de filas
# El problema: las filas están etiquetadas al revés
# Fila 1/A tiene Y bajo (arriba) pero debería ser la más cercana al escenario (Y alto)

# Mapeo de intercambio de filas
vip_swap = {
    '1': '8', '2': '7', '3': '6', '4': '5',
    '5': '4', '6': '3', '7': '2', '8': '1'
}

alpha_swap = {
    'A': 'P', 'B': 'O', 'C': 'N', 'D': 'M', 'E': 'L', 'F': 'K', 'G': 'J', 'H': 'I',
    'I': 'H', 'J': 'G', 'K': 'F', 'L': 'E', 'M': 'D', 'N': 'C', 'O': 'B', 'P': 'A'
}

layout_id = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

# Generar SQL para actualizar rowLabels
# Usamos una tabla temporal para evitar colisiones

sql = []

sql.append("-- Script para corregir la numeración de filas")
sql.append("-- Paso 1: Agregar prefijo temporal a todos los rowLabels para evitar colisiones")
sql.append("")

# Para secciones VIP (filas numéricas 1-8)
for old_row, new_row in vip_swap.items():
    if old_row <= new_row:  # Solo procesar una vez cada par
        continue
    sql.append(f"-- Intercambiar fila {old_row} <-> {new_row} en VIP")
    
sql.append("")
sql.append("-- Actualizar VIP Central, VIP Derecha, VIP Izquierda")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';")
sql.append("")

for old_row, new_row in vip_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Actualizar PLUS Central, PLUS Derecha, PLUS Izquierda")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';")
sql.append("")

for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Actualizar PREFERENTE Central, PREFERENTE Derecha, PREFERENTE Izquierda")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';")
sql.append("")

for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Verificar que no queden filas con TEMP_")
sql.append(f"SELECT rowLabel, COUNT(*) FROM Seat WHERE layoutId = '{layout_id}' AND rowLabel LIKE 'TEMP_%' GROUP BY rowLabel;")

for line in sql:
    print(line)
