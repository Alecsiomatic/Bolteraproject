#!/bin/bash
mysql -u boletera_user -pCer0un0cer0.com20182417 boletera_db -e "SELECT COUNT(*) as total_seats FROM Seat WHERE venueId = '2a8073f3-3b78-4394-8eab-79e7d988542a'"
