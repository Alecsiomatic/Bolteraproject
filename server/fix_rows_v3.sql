-- Script para intercambiar filas (solo pares ·nicos)

-- PASO 1: Marcar todos los labels con TEMP_
UPDATE Seat SET label = CONCAT('TEMP_', label) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';

-- PASO 2: Intercambiar rowLabels

-- VIP: Marcar con OLD_
UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';
UPDATE Seat SET rowLabel = '8' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_1';
UPDATE Seat SET rowLabel = '1' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_8';
UPDATE Seat SET rowLabel = '7' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_2';
UPDATE Seat SET rowLabel = '2' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_7';
UPDATE Seat SET rowLabel = '6' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_3';
UPDATE Seat SET rowLabel = '3' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_6';
UPDATE Seat SET rowLabel = '5' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_4';
UPDATE Seat SET rowLabel = '4' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'OLD_5';

-- PLUS: Marcar con OLD_
UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';
UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_A';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_P';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_B';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_O';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_C';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_N';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_D';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_M';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_E';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_L';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_F';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_K';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_G';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_J';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'OLD_I';

-- PREFERENTE: Marcar con OLD_
UPDATE Seat SET rowLabel = CONCAT('OLD_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';
UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_A';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_P';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_B';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_O';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_C';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_N';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_D';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_M';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_E';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_L';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_F';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_K';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_G';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_J';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'OLD_I';

-- PASO 3: Actualizar labels con nuevo rowLabel

-- VIP Central
UPDATE Seat SET label = CONCAT('VC-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Central';
-- VIP Derecha
UPDATE Seat SET label = CONCAT('VD-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Derecha';
-- VIP Izquierda
UPDATE Seat SET label = CONCAT('VI-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'VIP Izquierda';
-- PLUS Central
UPDATE Seat SET label = CONCAT('PC-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Central';
-- PLUS Derecha
UPDATE Seat SET label = CONCAT('PD-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Derecha';
-- PLUS Izquierda
UPDATE Seat SET label = CONCAT('PI-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PLUS Izquierda';
-- PREFERENTE Central
UPDATE Seat SET label = CONCAT('PRC-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Central';
-- PREFERENTE Derecha
UPDATE Seat SET label = CONCAT('PRD-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Derecha';
-- PREFERENTE Izquierda
UPDATE Seat SET label = CONCAT('PRI-', rowLabel, '-', SUBSTRING_INDEX(label, '-', -1)) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) = 'PREFERENTE Izquierda';

-- PASO 4: Actualizar metadata.canvas.label
UPDATE Seat SET metadata = JSON_SET(metadata, '$.canvas.label', CONCAT(rowLabel, '-', SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.canvas.label')), '-', -1))) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';
