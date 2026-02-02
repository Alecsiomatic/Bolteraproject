# Script CORREGIDO para intercambiar filas
# Usa prefijos temporales para evitar conflictos de duplicados

layout_id = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

vip_swap = {'1': '8', '2': '7', '3': '6', '4': '5', '5': '4', '6': '3', '7': '2', '8': '1'}
alpha_swap = {
    'A': 'P', 'B': 'O', 'C': 'N', 'D': 'M', 'E': 'L', 'F': 'K', 'G': 'J', 'H': 'I',
    'I': 'H', 'J': 'G', 'K': 'F', 'L': 'E', 'M': 'D', 'N': 'C', 'O': 'B', 'P': 'A'
}

sql = []
sql.append("-- Script para corregir la numeración de filas")
sql.append("-- Usa prefijos temporales para evitar conflictos")
sql.append("")

# ========== PASO 1: Agregar prefijo TEMP_ a todos los labels ==========
sql.append("-- PASO 1: Agregar prefijo TEMP_ a todos los labels para evitar duplicados")
sql.append(f"UPDATE Seat SET label = CONCAT('TEMP_', label) WHERE layoutId = '{layout_id}';")
sql.append("")

# ========== PASO 2: Actualizar rowLabel ==========
sql.append("-- PASO 2: Actualizar rowLabel")
sql.append("")
sql.append("-- VIP")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';")
for old_row, new_row in vip_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_{old_row}';")

sql.append("")
sql.append("-- PLUS")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_{old_row}';")

sql.append("")
sql.append("-- PREFERENTE")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_{old_row}';")

sql.append("")

# ========== PASO 3: Actualizar label (quitando TEMP_ y poniendo nuevo rowLabel) ==========
sql.append("-- PASO 3: Actualizar label con nuevo rowLabel")
sql.append("")

# VIP Central
sql.append("-- VIP Central (VC-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('VC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Central';")

# VIP Derecha
sql.append("-- VIP Derecha (VD-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('VD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Derecha';")

# VIP Izquierda
sql.append("-- VIP Izquierda (VI-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('VI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Izquierda';")

# PLUS Central
sql.append("-- PLUS Central (PC-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Central';")

# PLUS Derecha
sql.append("-- PLUS Derecha (PD-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Derecha';")

# PLUS Izquierda
sql.append("-- PLUS Izquierda (PI-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Izquierda';")

# PREFERENTE Central
sql.append("-- PREFERENTE Central (PRC-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PRC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Central';")

# PREFERENTE Derecha
sql.append("-- PREFERENTE Derecha (PRD-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PRD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Derecha';")

# PREFERENTE Izquierda
sql.append("-- PREFERENTE Izquierda (PRI-X-Y)")
sql.append(f"UPDATE Seat SET label = CONCAT('PRI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Izquierda';")

sql.append("")

# ========== PASO 4: Actualizar metadata.canvas.label ==========
sql.append("-- PASO 4: Actualizar metadata.canvas.label")
sql.append(f"UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT(rowLabel, '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = '{layout_id}';")

for line in sql:
    print(line)
