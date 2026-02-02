#!/bin/bash
# Eliminar asientos existentes y regenerar

mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "DELETE FROM Seat WHERE layoutSectionId IN (SELECT id FROM LayoutSection WHERE layoutId = (SELECT id FROM VenueLayout WHERE venueId = '2a8073f3-3b78-4394-8eab-79e7d988542a'));"

mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db < /tmp/insert_seats.sql

echo "Asientos regenerados"
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "SELECT layoutSectionId, COUNT(*) as seats FROM Seat WHERE layoutSectionId LIKE 'section-%' GROUP BY layoutSectionId;"
