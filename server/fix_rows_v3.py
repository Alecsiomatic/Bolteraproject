# Script CORREGIDO para intercambiar filas
# Solo intercambia cada par UNA VEZ

layout_id = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b'

# Solo los pares únicos (evitamos duplicados)
vip_pairs = [('1', '8'), ('2', '7'), ('3', '6'), ('4', '5')]
alpha_pairs = [('A', 'P'), ('B', 'O'), ('C', 'N'), ('D', 'M'), ('E', 'L'), ('F', 'K'), ('G', 'J'), ('H', 'I')]

sql = []
sql.append("-- Script para intercambiar filas (solo pares únicos)")
sql.append("")

# ========== PASO 1: Agregar prefijo TEMP_ a todos los labels ==========
sql.append("-- PASO 1: Marcar todos los labels con TEMP_")
sql.append(f"UPDATE Seat SET label = CONCAT('TEMP_', label) WHERE layoutId = '{layout_id}';")
sql.append("")

# ========== PASO 2: Intercambiar rowLabels usando prefijos ==========
sql.append("-- PASO 2: Intercambiar rowLabels")
sql.append("")

# VIP
sql.append("-- VIP: Marcar con OLD_")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';")
for old, new in vip_pairs:
    sql.append(f"UPDATE Seat SET rowLabel = '{new}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_{old}';")
    sql.append(f"UPDATE Seat SET rowLabel = '{old}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_{new}';")

sql.append("")

# PLUS
sql.append("-- PLUS: Marcar con OLD_")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';")
for old, new in alpha_pairs:
    sql.append(f"UPDATE Seat SET rowLabel = '{new}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_{old}';")
    sql.append(f"UPDATE Seat SET rowLabel = '{old}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_{new}';")

sql.append("")

# PREFERENTE
sql.append("-- PREFERENTE: Marcar con OLD_")
sql.append(f"UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';")
for old, new in alpha_pairs:
    sql.append(f"UPDATE Seat SET rowLabel = '{new}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_{old}';")
    sql.append(f"UPDATE Seat SET rowLabel = '{old}' WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_{new}';")

sql.append("")

# ========== PASO 3: Actualizar labels con nuevo rowLabel ==========
sql.append("-- PASO 3: Actualizar labels con nuevo rowLabel")
sql.append("")

sections = [
    ('VIP Central', 'VC'),
    ('VIP Derecha', 'VD'),
    ('VIP Izquierda', 'VI'),
    ('PLUS Central', 'PC'),
    ('PLUS Derecha', 'PD'),
    ('PLUS Izquierda', 'PI'),
    ('PREFERENTE Central', 'PRC'),
    ('PREFERENTE Derecha', 'PRD'),
    ('PREFERENTE Izquierda', 'PRI'),
]

for section_name, prefix in sections:
    sql.append(f"-- {section_name}")
    sql.append(f"UPDATE Seat SET label = CONCAT('{prefix}-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = '{layout_id}' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = '{section_name}';")

sql.append("")

# ========== PASO 4: Actualizar metadata.canvas.label ==========
sql.append("-- PASO 4: Actualizar metadata.canvas.label")
sql.append(f"UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT(rowLabel, '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = '{layout_id}';")

for line in sql:
    print(line)
