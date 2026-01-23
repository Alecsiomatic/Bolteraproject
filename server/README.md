# Boletera API (Fastify + MySQL)

## Requisitos
- Node.js 20+
- PNPM 9+
- Servidor MySQL accesible (credenciales en `.env`)

## Variables de entorno
Crea `server/.env` (ya ignorado por git) con los campos:

```ini
DATABASE_URL="mysql://usuario:password@host:3306/base"
DB_HOST=host
DB_PORT=3306
DB_USER=usuario
DB_PASSWORD=password
DB_NAME=base
PORT=4000
NODE_ENV=development
```

## Instalación
```bash
cd server
pnpm install
```

## Inicializar base de datos
Los scripts usan `mysql2` y ejecutan los archivos SQL ubicados en `server/sql`:

```bash
pnpm db:init   # Crea todas las tablas desde sql/schema.sql
pnpm db:seed   # Inserta datos de ejemplo desde sql/seed.sql
```

> Si la base ya tiene datos, omite `db:init` y ejecuta solamente `db:seed` o tus propios scripts.

Credenciales sembradas para pruebas:

- **Admin:** `alecs@event.os` / `Alecs.com2006`
- **Operador:** `operaciones@boletera.com` / `Alecs.com2006`

## Ejecutar la API en modo dev
```bash
pnpm dev
```
Esto levanta Fastify en `http://localhost:4000` con los endpoints:
- `GET /health`
- `GET /api/events`
- `GET /api/events/:id-or-slug`
- `GET /api/venues`
- `GET /api/venues/:id-or-slug`
- `GET /api/users`

## Flujo de trabajo sugerido
1. Diseña un venue/zona en el canvas (front-end).
2. Exporta los datos y persístelos mediante tus propios endpoints POST (pendientes por implementar).
3. Consume los endpoints anteriores desde las páginas de admin para mostrar información en tiempo real.

## Notas
- Toda la lógica usa SQL directo (`mysql2/promise`).
- `server/sql/schema.sql` puede personalizarse para nuevos campos/índices.
- `server/sql/seed.sql` deja datos ficticios que coinciden con el front actual y sirven para pruebas rápidas.
