// Script para crear usuarios de prueba usando el API
const API_URL = 'http://localhost:4000';

async function createUser(name, email, password, role = 'VIEWER') {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 409) {
        console.log(`⚠️  Usuario ${email} ya existe`);
        return null;
      }
      throw new Error(data.message || 'Error al crear usuario');
    }
    
    console.log(`✅ Usuario creado: ${email}`);
    
    // Si es admin, actualizar el rol
    if (role === 'ADMIN') {
      console.log(`🔧 Actualizando rol a ADMIN para ${email}...`);
      // Necesitaremos hacer esto manualmente o con otro endpoint
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Error creando ${email}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Creando usuarios de prueba...\n');
  
  // Usuario Admin
  await createUser('Administrador', 'admin@boletera.com', 'Admin123!', 'ADMIN');
  
  // Usuario Normal  
  await createUser('Usuario Normal', 'user@boletera.com', 'User123!', 'VIEWER');
  
  console.log('\n📋 Credenciales:');
  console.log('\n👤 ADMIN:');
  console.log('   Email: admin@boletera.com');
  console.log('   Password: Admin123!');
  console.log('\n👤 USUARIO:');
  console.log('   Email: user@boletera.com');
  console.log('   Password: User123!');
  console.log('\n⚠️  NOTA: El usuario admin se creó como VIEWER. Necesitas actualizarlo manualmente a ADMIN en la DB.');
}

main();
