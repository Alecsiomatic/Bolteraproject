-- Script para corregir la numeraci¾n de filas
-- Paso 1: Agregar prefijo temporal a todos los rowLabels para evitar colisiones

-- Intercambiar fila 5 <-> 4 en VIP
-- Intercambiar fila 6 <-> 3 en VIP
-- Intercambiar fila 7 <-> 2 en VIP
-- Intercambiar fila 8 <-> 1 en VIP

-- Actualizar VIP Central, VIP Derecha, VIP Izquierda
UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%';

UPDATE Seat SET rowLabel = '8' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_1';
UPDATE Seat SET rowLabel = '7' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_2';
UPDATE Seat SET rowLabel = '6' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_3';
UPDATE Seat SET rowLabel = '5' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_4';
UPDATE Seat SET rowLabel = '4' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_5';
UPDATE Seat SET rowLabel = '3' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_6';
UPDATE Seat SET rowLabel = '2' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_7';
UPDATE Seat SET rowLabel = '1' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'VIP%' AND rowLabel = 'TEMP_8';

-- Actualizar PLUS Central, PLUS Derecha, PLUS Izquierda
UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%';

UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_A';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_B';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_C';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_D';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_E';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_F';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_G';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_I';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_J';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_K';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_L';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_M';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_N';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_O';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PLUS%' AND rowLabel = 'TEMP_P';

-- Actualizar PREFERENTE Central, PREFERENTE Derecha, PREFERENTE Izquierda
UPDATE Seat SET rowLabel = CONCAT('TEMP_', rowLabel) WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%';

UPDATE Seat SET rowLabel = 'P' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_A';
UPDATE Seat SET rowLabel = 'O' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_B';
UPDATE Seat SET rowLabel = 'N' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_C';
UPDATE Seat SET rowLabel = 'M' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_D';
UPDATE Seat SET rowLabel = 'L' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_E';
UPDATE Seat SET rowLabel = 'K' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_F';
UPDATE Seat SET rowLabel = 'J' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_G';
UPDATE Seat SET rowLabel = 'I' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_H';
UPDATE Seat SET rowLabel = 'H' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_I';
UPDATE Seat SET rowLabel = 'G' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_J';
UPDATE Seat SET rowLabel = 'F' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_K';
UPDATE Seat SET rowLabel = 'E' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_L';
UPDATE Seat SET rowLabel = 'D' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_M';
UPDATE Seat SET rowLabel = 'C' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_N';
UPDATE Seat SET rowLabel = 'B' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_O';
UPDATE Seat SET rowLabel = 'A' WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sectionName')) LIKE 'PREFERENTE%' AND rowLabel = 'TEMP_P';

-- Verificar que no queden filas con TEMP_
SELECT rowLabel, COUNT(*) FROM Seat WHERE layoutId = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b' AND rowLabel LIKE 'TEMP_%' GROUP BY rowLabel;
