# Guía de Actualización VPS - Boletera

## Información del Servidor

| Campo | Valor |
|-------|-------|
| **IP** | 72.60.168.4 |
| **Usuario** | root |
| **Repositorio** | /var/www/update.compratuboleto.mx/ |
| **Ruta Backend** | /var/www/update.compratuboleto.mx/server/ |
| **Ruta Frontend** | /var/www/update.compratuboleto.mx/dist/ |
| **Dominio** | update.compratuboleto.mx |

---

## Conexión SSH

```powershell
ssh root@72.60.168.4
```

---

## Subir Archivos al VPS

### Subir un archivo específico:
```powershell
scp "C:\ruta\local\archivo.js" root@72.60.168.4:/var/www/update.compratuboleto.mx/server/
```

### Subir y ejecutar en un solo comando:
```powershell
scp "C:\ruta\local\script.js" root@72.60.168.4:/var/www/update.compratuboleto.mx/server/; ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && node script.js"
```

### Subir carpeta completa:
```powershell
scp -r "C:\ruta\local\carpeta" root@72.60.168.4:/var/www/update.compratuboleto.mx/server/
```

---

## Ejecutar Scripts en VPS

### Ejecutar script Node.js:
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && node mi-script.js"
```

### Ejecutar comando rápido:
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && node -e \"console.log('Hola')\""
```

---

## Actualización del Backend

### 1. Subir cambios del backend:
```powershell
# Desde la carpeta del proyecto local
scp -r "./server/*" root@72.60.168.4:/var/www/update.compratuboleto.mx/server/
```

### 2. Instalar dependencias (si hay cambios en package.json):
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && pnpm install"
```

### 3. Reiniciar el servidor:
```powershell
ssh root@72.60.168.4 "pm2 restart all"
```

### 4. Ver logs:
```powershell
ssh root@72.60.168.4 "pm2 logs"
```

---

## Actualización del Frontend

### 1. Build local:
```powershell
cd "C:\Users\Alecs\Desktop\ddu\BOLETERA PROJECT\boletera1"
pnpm build
```

### 2. Subir build al VPS:
```powershell
scp -r "./dist/*" root@72.60.168.4:/var/www/update.compratuboleto.mx/
```

---

## Base de Datos (Prisma)

### Ejecutar migraciones:
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && npx prisma migrate deploy"
```

### Generar cliente Prisma:
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && npx prisma generate"
```

### Abrir Prisma Studio (puerto 5555):
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && npx prisma studio"
```

---

## PM2 - Gestión de Procesos

| Comando | Descripción |
|---------|-------------|
| `pm2 list` | Ver procesos activos |
| `pm2 restart all` | Reiniciar todos los procesos |
| `pm2 restart <nombre>` | Reiniciar proceso específico |
| `pm2 logs` | Ver logs en tiempo real |
| `pm2 logs --lines 100` | Ver últimas 100 líneas |
| `pm2 stop all` | Detener todos los procesos |
| `pm2 start all` | Iniciar todos los procesos |

---

## Comandos Útiles

### Ver espacio en disco:
```powershell
ssh root@72.60.168.4 "df -h"
```

### Ver uso de memoria:
```powershell
ssh root@72.60.168.4 "free -h"
```

### Ver procesos:
```powershell
ssh root@72.60.168.4 "htop"
```

### Listar archivos en servidor:
```powershell
ssh root@72.60.168.4 "ls -la /var/www/update.compratuboleto.mx/server/"
```

### Descargar archivo del VPS a local:
```powershell
scp root@72.60.168.4:/var/www/update.compratuboleto.mx/server/archivo.json "C:\ruta\local\"
```

---

## Venue Teatro Tangamanga

| Campo | Valor |
|-------|-------|
| **Venue ID** | 2dc4584b-3a89-4c99-a933-eba0a846a04b |
| **Layout ID** | 463cd0db-a5f8-43da-b416-b704f0e3fdba |
| **Backup** | backup-restore.json (en servidor) |

### Secciones del venue:
- DIAMANTE IZQUIERDA, CENTRAL, DERECHA (80 + 40 + 80 = 200)
- VIP IZQUIERDA, CENTRAL, DERECHA (188 + 136 + 174 = 498)
- PLUS IZQUIERDA, CENTRAL, DERECHA (445 + 414 + 435 = 1294)
- PREFERENTE IZQUIERDA, CENTRAL, DERECHA (638 + 792 + 631 = 2061)

---

## Troubleshooting

### Si el servidor no responde:
```powershell
ssh root@72.60.168.4 "pm2 restart all"
```

### Si hay errores de Prisma:
```powershell
ssh root@72.60.168.4 "cd /var/www/update.compratuboleto.mx/server && npx prisma generate"
```

### Ver errores del servidor:
```powershell
ssh root@72.60.168.4 "pm2 logs --err"
```

### Reiniciar Nginx:
```powershell
ssh root@72.60.168.4 "systemctl restart nginx"
```

---

## Flujo Típico de Actualización

1. **Hacer cambios localmente**
2. **Probar en local** (`pnpm dev`)
3. **Build** (`pnpm build`)
4. **Subir al VPS** (scp)
5. **Instalar deps si es necesario** (`pnpm install`)
6. **Reiniciar servidor** (`pm2 restart all`)
7. **Verificar logs** (`pm2 logs`)
