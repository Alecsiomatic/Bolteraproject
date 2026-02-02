-- Script para corregir la numeraci¾n de filas
-- Usa prefijos temporales para evitar conflictos

-- PASO 1: Agregar prefijo TEMP_ a todos los labels para evitar duplicados
UPDATE Seat SET label = CONCAT('TEMP_', label) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';

-- PASO 2: Actualizar rowLabel

-- VIP
UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';
UPDATE Seat SET rowLabel = '8' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_1';
UPDATE Seat SET rowLabel = '7' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_2';
UPDATE Seat SET rowLabel = '6' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_3';
UPDATE Seat SET rowLabel = '5' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_4';
UPDATE Seat SET rowLabel = '4' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_5';
UPDATE Seat SET rowLabel = '3' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_6';
UPDATE Seat SET rowLabel = '2' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_7';
UPDATE Seat SET rowLabel = '1' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'SWAP_8';

-- PLUS
UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';
UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_A';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_B';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_C';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_D';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_E';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_F';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_G';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_I';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_J';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_K';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_L';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_M';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_N';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_O';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'SWAP_P';

-- PREFERENTE
UPDATE Seat SET rowLabel = CONCAT('SWAP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';
UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_A';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_B';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_C';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_D';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_E';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_F';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_G';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_I';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_J';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_K';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_L';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_M';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_N';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_O';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'SWAP_P';

-- PASO 3: Actualizar label con nuevo rowLabel

-- VIP Central (VC-X-Y)
UPDATE Seat SET label = CONCAT('VC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Central';
-- VIP Derecha (VD-X-Y)
UPDATE Seat SET label = CONCAT('VD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Derecha';
-- VIP Izquierda (VI-X-Y)
UPDATE Seat SET label = CONCAT('VI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Izquierda';
-- PLUS Central (PC-X-Y)
UPDATE Seat SET label = CONCAT('PC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Central';
-- PLUS Derecha (PD-X-Y)
UPDATE Seat SET label = CONCAT('PD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Derecha';
-- PLUS Izquierda (PI-X-Y)
UPDATE Seat SET label = CONCAT('PI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Izquierda';
-- PREFERENTE Central (PRC-X-Y)
UPDATE Seat SET label = CONCAT('PRC-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Central';
-- PREFERENTE Derecha (PRD-X-Y)
UPDATE Seat SET label = CONCAT('PRD-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Derecha';
-- PREFERENTE Izquierda (PRI-X-Y)
UPDATE Seat SET label = CONCAT('PRI-', rowLabel, '-', SUBSTRING_INDEX(SUBSTRING_INDEX(label, '-', -1), '_', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Izquierda';

-- PASO 4: Actualizar metadata.canvas.label
UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT(rowLabel, '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';
