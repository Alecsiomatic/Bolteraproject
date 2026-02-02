# Script para corregir completamente la numeración de filas
# Intercambia rowLabel Y actualiza label y metadata.canvas.label

layout_id = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

# Mapeo de intercambio de filas
vip_swap = {'1': '8', '2': '7', '3': '6', '4': '5', '5': '4', '6': '3', '7': '2', '8': '1'}
alpha_swap = {
    'A': 'P', 'B': 'O', 'C': 'N', 'D': 'M', 'E': 'L', 'F': 'K', 'G': 'J', 'H': 'I',
    'I': 'H', 'J': 'G', 'K': 'F', 'L': 'E', 'M': 'D', 'N': 'C', 'O': 'B', 'P': 'A'
}

sql = []
sql.append("-- Script para corregir la numeración de filas completamente")
sql.append("-- Actualiza rowLabel, label, y metadata.canvas.label")
sql.append("")

# ========== VIP ==========
sql.append("-- ========== VIP ==========")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';")
sql.append("")

for old_row, new_row in vip_swap.items():
    # Actualizar rowLabel
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Actualizar label (VC-1-23 -> VC-8-23, etc)")
for old_row, new_row in vip_swap.items():
    # VIP Central: VC-X-Y
    sql.append(f"UPDATE Seat SET label = CONCAT('VC-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Central' AND rowLabel = '{new_row}' AND label LIKE 'VC-{old_row}-%';")
    # VIP Derecha: VD-X-Y
    sql.append(f"UPDATE Seat SET label = CONCAT('VD-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Derecha' AND rowLabel = '{new_row}' AND label LIKE 'VD-{old_row}-%';")
    # VIP Izquierda: VI-X-Y
    sql.append(f"UPDATE Seat SET label = CONCAT('VI-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Izquierda' AND rowLabel = '{new_row}' AND label LIKE 'VI-{old_row}-%';")

sql.append("")
sql.append("-- Actualizar metadata.canvas.label")
for old_row, new_row in vip_swap.items():
    sql.append(f"UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT('{new_row}', '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = '{new_row}';")

sql.append("")

# ========== PLUS ==========
sql.append("-- ========== PLUS ==========")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';")
sql.append("")

for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Actualizar label (PC-A-23 -> PC-P-23, etc)")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET label = CONCAT('PC-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Central' AND rowLabel = '{new_row}' AND label LIKE 'PC-{old_row}-%';")
    sql.append(f"UPDATE Seat SET label = CONCAT('PD-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Derecha' AND rowLabel = '{new_row}' AND label LIKE 'PD-{old_row}-%';")
    sql.append(f"UPDATE Seat SET label = CONCAT('PI-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Izquierda' AND rowLabel = '{new_row}' AND label LIKE 'PI-{old_row}-%';")

sql.append("")
sql.append("-- Actualizar metadata.canvas.label")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT('{new_row}', '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = '{new_row}';")

sql.append("")

# ========== PREFERENTE ==========
sql.append("-- ========== PREFERENTE ==========")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';")
sql.append("")

for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET rowLabel = '{new_row}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_{old_row}';")

sql.append("")
sql.append("-- Actualizar label (PRC-A-23 -> PRC-P-23, etc)")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET label = CONCAT('PRC-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Central' AND rowLabel = '{new_row}' AND label LIKE 'PRC-{old_row}-%';")
    sql.append(f"UPDATE Seat SET label = CONCAT('PRD-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Derecha' AND rowLabel = '{new_row}' AND label LIKE 'PRD-{old_row}-%';")
    sql.append(f"UPDATE Seat SET label = CONCAT('PRI-', '{new_row}', '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Izquierda' AND rowLabel = '{new_row}' AND label LIKE 'PRI-{old_row}-%';")

sql.append("")
sql.append("-- Actualizar metadata.canvas.label")
for old_row, new_row in alpha_swap.items():
    sql.append(f"UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT('{new_row}', '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = '{new_row}';")

for line in sql:
    print(line)
