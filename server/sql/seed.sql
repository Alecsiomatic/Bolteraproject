INSERT INTO `User` (`id`, `name`, `email`, `password`, `role`, `status`, `created_at`, `updated_at`)
VALUES
  ('user-admin', 'Admin User', 'alecs@event.os', '$2a$10$2e07F11oytBuuFCQXvb7Tu7tH75R1N48YYeEQw362ew9cTYWwHcyK', 'ADMIN', 'ACTIVE', NOW(), NOW()),
  ('user-operator', 'Operador Principal', 'operaciones@boletera.com', '$2a$10$2e07F11oytBuuFCQXvb7Tu7tH75R1N48YYeEQw362ew9cTYWwHcyK', 'OPERATOR', 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `role` = VALUES(`role`),
  `status` = VALUES(`status`),
  `updated_at` = NOW();

INSERT INTO `Venue` (`id`, `name`, `slug`, `address`, `city`, `country`, `capacity`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('venue-teatro-nacional', 'Teatro Nacional', 'teatro-nacional', 'Av. Principal 123', 'Ciudad de México', 'México', 500, 'Venue principal para eventos premium', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `address` = VALUES(`address`),
  `capacity` = VALUES(`capacity`),
  `updatedAt` = NOW();

INSERT INTO `VenueLayout` (`id`, `venueId`, `name`, `version`, `layoutJson`, `metadata`, `isDefault`, `publishedAt`, `createdAt`, `updatedAt`)
VALUES
  ('layout-teatro-nacional-v1', 'venue-teatro-nacional', 'Layout Principal v1', 1, JSON_OBJECT('version', 1, 'zones', JSON_ARRAY('VIP', 'General')), JSON_OBJECT('source', 'seed'), 1, NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `version` = VALUES(`version`),
  `isDefault` = VALUES(`isDefault`),
  `updatedAt` = NOW();

INSERT INTO `VenueZone` (`id`, `venueId`, `name`, `color`, `basePrice`, `createdAt`, `updatedAt`)
VALUES
  ('zone-vip', 'venue-teatro-nacional', 'VIP', '#f97316', 1500.00, NOW(), NOW()),
  ('zone-general', 'venue-teatro-nacional', 'General', '#2563eb', 850.00, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `color` = VALUES(`color`),
  `basePrice` = VALUES(`basePrice`),
  `updatedAt` = NOW();

INSERT INTO `Seat` (`id`, `venueId`, `zoneId`, `label`, `rowLabel`, `columnNumber`, `seatType`, `basePrice`, `status`, `createdAt`, `updatedAt`)
VALUES
  ('seat-a-1', 'venue-teatro-nacional', 'zone-vip', 'A-1', 'A', 1, 'VIP', 1500.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-a-2', 'venue-teatro-nacional', 'zone-vip', 'A-2', 'A', 2, 'VIP', 1500.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-a-3', 'venue-teatro-nacional', 'zone-vip', 'A-3', 'A', 3, 'VIP', 1500.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-a-4', 'venue-teatro-nacional', 'zone-vip', 'A-4', 'A', 4, 'VIP', 1500.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-a-5', 'venue-teatro-nacional', 'zone-vip', 'A-5', 'A', 5, 'VIP', 1500.00, 'BLOCKED', NOW(), NOW()),
  ('seat-b-1', 'venue-teatro-nacional', 'zone-general', 'B-1', 'B', 1, 'STANDARD', 850.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-b-2', 'venue-teatro-nacional', 'zone-general', 'B-2', 'B', 2, 'STANDARD', 850.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-b-3', 'venue-teatro-nacional', 'zone-general', 'B-3', 'B', 3, 'STANDARD', 850.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-b-4', 'venue-teatro-nacional', 'zone-general', 'B-4', 'B', 4, 'STANDARD', 850.00, 'AVAILABLE', NOW(), NOW()),
  ('seat-b-5', 'venue-teatro-nacional', 'zone-general', 'B-5', 'B', 5, 'STANDARD', 850.00, 'RESERVED', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `zoneId` = VALUES(`zoneId`),
  `seatType` = VALUES(`seatType`),
  `basePrice` = VALUES(`basePrice`),
  `status` = VALUES(`status`),
  `updatedAt` = NOW();

INSERT INTO `Event` (`id`, `name`, `slug`, `description`, `status`, `venueId`, `createdById`, `createdAt`, `updatedAt`)
VALUES
  ('event-rock-2025', 'Concierto Rock 2025', 'concierto-rock-2025', 'El evento principal del año', 'PUBLISHED', 'venue-teatro-nacional', 'user-admin', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `status` = VALUES(`status`),
  `updatedAt` = NOW();

INSERT INTO `EventSession` (`id`, `eventId`, `title`, `layoutId`, `startsAt`, `endsAt`, `status`, `capacity`, `doorsOpenAt`, `salesOpenAt`, `salesCloseAt`, `createdAt`, `updatedAt`)
VALUES
  (
    'session-rock-main',
    'event-rock-2025',
    'Función Principal',
    'layout-teatro-nacional-v1',
    DATE_ADD(NOW(), INTERVAL 15 DAY),
    DATE_ADD(NOW(), INTERVAL 15 DAY) + INTERVAL 3 HOUR,
    'SALES_OPEN',
    500,
    DATE_ADD(NOW(), INTERVAL 15 DAY) - INTERVAL 2 HOUR,
    DATE_ADD(NOW(), INTERVAL 10 DAY),
    DATE_ADD(NOW(), INTERVAL 15 DAY),
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE
  `startsAt` = VALUES(`startsAt`),
  `endsAt` = VALUES(`endsAt`),
  `status` = VALUES(`status`),
  `layoutId` = VALUES(`layoutId`),
  `updatedAt` = NOW();

INSERT INTO `EventPriceTier` (`id`, `eventId`, `sessionId`, `zoneId`, `seatType`, `label`, `description`, `price`, `fee`, `currency`, `minQuantity`, `maxQuantity`, `capacity`, `isDefault`, `createdAt`, `updatedAt`)
VALUES
  (
    'tier-vip-principal',
    'event-rock-2025',
    'session-rock-main',
    'zone-vip',
    'VIP',
    'VIP Platinum',
    'Primera fila con beneficios premium',
    1800.00,
    120.00,
    'MXN',
    1,
    6,
    100,
    1,
    NOW(),
    NOW()
  ),
  (
    'tier-general-principal',
    'event-rock-2025',
    'session-rock-main',
    'zone-general',
    'STANDARD',
    'General',
    'Planta baja',
    950.00,
    80.00,
    'MXN',
    1,
    10,
    400,
    1,
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE
  `price` = VALUES(`price`),
  `fee` = VALUES(`fee`),
  `updatedAt` = NOW();

INSERT INTO `Ticket` (`id`, `sessionId`, `seatId`, `tierId`, `price`, `currency`, `status`, `createdAt`, `updatedAt`)
VALUES
  ('ticket-1', 'session-rock-main', 'seat-a-1', 'tier-vip-principal', 1800.00, 'MXN', 'SOLD', NOW(), NOW()),
  ('ticket-2', 'session-rock-main', 'seat-a-2', 'tier-vip-principal', 1800.00, 'MXN', 'RESERVED', NOW(), NOW()),
  ('ticket-3', 'session-rock-main', 'seat-b-1', 'tier-general-principal', 950.00, 'MXN', 'RESERVED', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `status` = VALUES(`status`),
  `tierId` = VALUES(`tierId`),
  `updatedAt` = NOW();
