-- Agregar campo stagePosition a la tabla Event
-- Valores posibles: 'top', 'bottom', 'left', 'right'
-- Default: 'top' (escenario arriba del mapa de asientos)

ALTER TABLE Event 
ADD COLUMN stagePosition VARCHAR(10) NOT NULL DEFAULT 'top';

-- Verificar que se agregó correctamente
DESCRIBE Event;
