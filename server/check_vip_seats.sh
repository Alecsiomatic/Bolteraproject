#!/bin/bash
echo "=== VIP IZQUIERDA (section-1769207137210) ==="
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "SELECT rowLabel, label, columnNumber FROM Seat WHERE id LIKE 'seat-section-1769207137210%' ORDER BY rowLabel, columnNumber DESC LIMIT 10"

echo ""
echo "=== VIP CENTRAL (section-1769207521457) ==="
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "SELECT rowLabel, label, columnNumber FROM Seat WHERE id LIKE 'seat-section-1769207521457%' ORDER BY rowLabel, columnNumber DESC LIMIT 10"

echo ""
echo "=== VIP DERECHA (section-1769207596584) ==="
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "SELECT rowLabel, label, columnNumber FROM Seat WHERE id LIKE 'seat-section-1769207596584%' ORDER BY rowLabel, columnNumber DESC LIMIT 10"

echo ""
echo "=== CONTEOS POR SECCIÓN VIP ==="
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "
SELECT 
    CASE 
        WHEN id LIKE 'seat-section-1769207137210%' THEN 'VIP Izquierda'
        WHEN id LIKE 'seat-section-1769207521457%' THEN 'VIP Central'
        WHEN id LIKE 'seat-section-1769207596584%' THEN 'VIP Derecha'
    END as seccion,
    COUNT(*) as total
FROM Seat 
WHERE id LIKE 'seat-section-1769207%'
GROUP BY 
    CASE 
        WHEN id LIKE 'seat-section-1769207137210%' THEN 'VIP Izquierda'
        WHEN id LIKE 'seat-section-1769207521457%' THEN 'VIP Central'
        WHEN id LIKE 'seat-section-1769207596584%' THEN 'VIP Derecha'
    END
"
