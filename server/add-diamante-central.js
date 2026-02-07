// Script para añadir asientos DIAMANTE a los existentes
// IMPORTANTE: Este script AÑADE, no reemplaza
// Usa fetch nativo de Node 20+

const API_BASE = 'https://update.compratuboleto.mx/api';
const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// Datos DIAMANTE según Excel:
// DIAMANTE IZQUIERDA: A-D, asientos 1-20 (80 asientos)
// DIAMANTE CENTRAL: A-D, asientos 21-30 (40 asientos)
// DIAMANTE DERECHA: A-D, asientos 31-50 (80 asientos)

async function getLayout() {
  const res = await fetch(`${API_BASE}/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`);
  if (!res.ok) throw new Error(`Error getting layout: ${res.status}`);
  return res.json();
}

async function getCurrentSeatCount() {
  const res = await fetch(`${API_BASE}/venues/${VENUE_ID}`);
  const venue = await res.json();
  return venue.seats?.length || 0;
}

function findDiamanteSection(layout, name) {
  const sections = layout.data?.sections || [];
  return sections.find(s => s.name === name);
}

function getPolygonBounds(points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function generateDiamanteCentralSeats(section) {
  const seats = [];
  const sectionId = section.id;
  const bounds = getPolygonBounds(section.points);
  
  console.log('DIAMANTE CENTRAL bounds:', bounds);
  console.log('Width:', bounds.maxX - bounds.minX, 'Height:', bounds.maxY - bounds.minY);
  
  const rows = ['A', 'B', 'C', 'D'];
  const seatsPerRow = 10; // 21-30
  const startSeatNum = 21;
  
  // Calcular espaciado
  const rowHeight = (bounds.maxY - bounds.minY) / (rows.length + 1);
  const seatWidth = (bounds.maxX - bounds.minX) / (seatsPerRow + 1);
  
  const seatSize = 7;
  const fillColor = '#D946EF'; // Fuchsia para DIAMANTE
  const strokeColor = '#a21caf';
  
  rows.forEach((row, rowIdx) => {
    const y = bounds.minY + rowHeight * (rowIdx + 1);
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = startSeatNum + seatIdx;
      const x = bounds.minX + seatWidth * (seatIdx + 1);
      
      const seatId = `diamante-central-${row}-${seatNum}`;
      const label = `${row}-${seatNum}`;
      
      seats.push({
        id: seatId,
        type: 'seat',
        position: { x, y },
        size: { width: seatSize, height: seatSize },
        fill: fillColor,
        stroke: strokeColor,
        label: label,
        sectionId: sectionId,
        sectionName: 'DIAMANTE CENTRAL',
        row: row,
        seatNumber: seatNum,
        status: 'available'
      });
    }
  });
  
  return seats;
}

async function addSeatsToVenue(newSeats) {
  // Obtener asientos actuales
  const res = await fetch(`${API_BASE}/venues/${VENUE_ID}`);
  const venue = await res.json();
  const currentSeats = venue.seats || [];
  
  console.log(`Asientos actuales: ${currentSeats.length}`);
  console.log(`Nuevos asientos a añadir: ${newSeats.length}`);
  
  // Combinar asientos
  const combinedSeats = [...currentSeats];
  
  // Añadir nuevos asientos (verificando que no existan)
  const existingIds = new Set(currentSeats.map(s => s.id));
  newSeats.forEach(seat => {
    if (!existingIds.has(seat.id)) {
      combinedSeats.push(seat);
    } else {
      console.log(`Seat ${seat.id} ya existe, ignorando`);
    }
  });
  
  console.log(`Total asientos después de combinar: ${combinedSeats.length}`);
  
  return combinedSeats;
}

async function uploadSeats(seats) {
  // Obtener layout actual
  const layoutRes = await fetch(`${API_BASE}/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`);
  const layout = await layoutRes.json();
  
  // Preservar el layout existente
  const payload = {
    data: layout.data,
    seats: seats
  };
  
  console.log('Subiendo layout con', seats.length, 'asientos...');
  
  const res = await fetch(`${API_BASE}/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error uploading: ${res.status} - ${text}`);
  }
  
  return res.json();
}

async function main() {
  console.log('=== GENERADOR DIAMANTE CENTRAL ===');
  console.log('Este script AÑADE asientos, no reemplaza\n');
  
  // 1. Verificar estado actual
  const currentCount = await getCurrentSeatCount();
  console.log(`Asientos actuales en venue: ${currentCount}\n`);
  
  // 2. Obtener layout
  const layout = await getLayout();
  console.log('Layout version:', layout.version);
  console.log('Sections:', layout.data?.sections?.map(s => s.name));
  
  // 3. Buscar sección DIAMANTE CENTRAL
  const diamanteCentral = findDiamanteSection(layout, 'DIAMANTE CENTRAL');
  if (!diamanteCentral) {
    throw new Error('No se encontró la sección DIAMANTE CENTRAL');
  }
  console.log('\nSección DIAMANTE CENTRAL encontrada:', diamanteCentral.id);
  console.log('Points:', diamanteCentral.points?.length);
  
  // 4. Generar asientos
  const newSeats = generateDiamanteCentralSeats(diamanteCentral);
  console.log(`\nGenerados ${newSeats.length} asientos para DIAMANTE CENTRAL`);
  console.log('Primer asiento:', newSeats[0]?.id);
  console.log('Último asiento:', newSeats[newSeats.length-1]?.id);
  
  // 5. Combinar con existentes
  const combinedSeats = await addSeatsToVenue(newSeats);
  
  // 6. Subir
  console.log('\n¿Subir los asientos? (total:', combinedSeats.length, ')');
  
  const result = await uploadSeats(combinedSeats);
  console.log('\n✅ Upload exitoso!');
  console.log('Nueva versión:', result.version);
  
  // 7. Verificar
  const finalCount = await getCurrentSeatCount();
  console.log(`\nAsientos finales: ${finalCount}`);
  console.log(`Diferencia: +${finalCount - currentCount}`);
}

main().catch(console.error);
