import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

// Utilisateur admin: Waiyl BELAIDI (site_users)
const userId = 'cmi6m4kkp00005c2kqt66u7pt';

// Permissions admin complètes
const adminPermissions = [
  { resource: 'members', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'vehicles', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'events', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'finance', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'transactions', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'reports', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'permissions', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'users', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'news', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'documents', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'maintenance', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] },
  { resource: 'admin', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'] }
];

console.log(`✨ Ajout des permissions admin pour Waiyl BELAIDI (${userId})...`);

for (const perm of adminPermissions) {
  const permId = `perm_admin_${perm.resource}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  const res = await c.query(`
    INSERT INTO user_permissions (id, "userId", resource, actions, "grantedAt", "createdAt", "updatedAt", "grantedBy", reason)
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW(), 'system', 'Admin full permissions')
    RETURNING id, resource, actions
  `, [permId, userId, perm.resource, JSON.stringify(perm.actions)]);
  
  console.log(`✅ ${perm.resource}: ${perm.actions.join(', ')}`);
}

console.log('\n=== Permissions finales ===');
const finalRes = await c.query(`
  SELECT resource, actions
  FROM user_permissions
  WHERE "userId" = $1
  ORDER BY resource
`, [userId]);

finalRes.rows.forEach(r => {
  console.log(`  ${r.resource}: ${JSON.parse(r.actions).join(', ')}`);
});

// Mettre à jour le rôle à ADMIN
await c.query(`
  UPDATE site_users
  SET role = 'ADMIN', "updatedAt" = NOW()
  WHERE id = $1
`, [userId]);

console.log('\n🎖️ Rôle mis à jour à ADMIN');
console.log('✅ Permissions admin complètes rétablies pour Waiyl BELAIDI!');

await c.end();
