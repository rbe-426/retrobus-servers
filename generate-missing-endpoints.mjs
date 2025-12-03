import fs from 'fs';

// Liste des modèles utilisés dans le code
const USED_MODELS = [
  'members',
  'vehicle',
  'event',
  'retroNews',
  'flash',
  'retro_request',
  'retro_request_file',
  'site_users',
  'document',
  'vehicle_maintenance',
  'vehicle_service_schedule',
  'usage',
  'vehicleControlTechnique',
  'vehicleCessionCertificate',
  'vehicleGrayscale',
  'vehicleInsurance',
  'vehicleInspection'
];

// Map pour transformer les noms en routes (kebab-case)
function modelToRoute(model) {
  // vehicleControlTechnique -> vehicle-control-technique
  return model
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

// Générer endpoints CRUD pour un modèle
function generateEndpoints(model) {
  const route = modelToRoute(model);
  const singular = model.charAt(0).toUpperCase() + model.slice(1);
  
  return `
// ============ ${model.toUpperCase()} CRUD ============

// GET - List all ${model}
app.get(['/api/${route}', '/${route}'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.${model}.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting ${model}:', e.message);
    res.status(500).json({ error: 'Failed to fetch ${model}', details: e.message });
  }
});

// GET - Get single ${model}
app.get(['/api/${route}/:id', '/${route}/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.${model}.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: '${model} not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting ${model}:', e.message);
    res.status(500).json({ error: 'Failed to fetch ${model}', details: e.message });
  }
});

// POST - Create new ${model}
app.post(['/api/${route}', '/${route}'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.${model}.create({
      data: {
        id: require('crypto').randomBytes(16).toString('hex'),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating ${model}:', e.message);
    res.status(500).json({ error: 'Failed to create ${model}', details: e.message });
  }
});

// PUT - Update ${model}
app.put(['/api/${route}/:id', '/${route}/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.${model}.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating ${model}:', e.message);
    res.status(500).json({ error: 'Failed to update ${model}', details: e.message });
  }
});

// DELETE - Remove ${model}
app.delete(['/api/${route}/:id', '/${route}/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.${model}.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting ${model}:', e.message);
    res.status(500).json({ error: 'Failed to delete ${model}', details: e.message });
  }
});
`;
}

// Lire server.js
const serverPath = 'src/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf-8');

// Trouver les endpoints manquants
const missingModels = USED_MODELS.filter(model => {
  const route = modelToRoute(model);
  // Vérifier si le modèle a déjà des endpoints POST/PUT/DELETE
  const routePattern = new RegExp(`app\\.(post|put|delete).*['\`].*/${route}['"\`]`, 'i');
  return !routePattern.test(serverContent);
});

console.log('📊 Analyse des endpoints...');
console.log(`✅ Modèles utilisés: ${USED_MODELS.length}`);
console.log(`⚠️  Modèles manquant endpoints CRUD: ${missingModels.length}`);
console.log(`Modèles à ajouter: ${missingModels.join(', ')}`);

// Générer le code à injecter
let endpointsCode = '\n\n// ============ AUTO-GENERATED CRUD ENDPOINTS ============\n';
missingModels.forEach(model => {
  endpointsCode += generateEndpoints(model);
});

// Injecter avant le graceful shutdown
const gracefulShutdownMarker = '// Graceful shutdown';
const insertionPoint = serverContent.indexOf(gracefulShutdownMarker);

if (insertionPoint !== -1) {
  serverContent = serverContent.slice(0, insertionPoint) + endpointsCode + '\n' + serverContent.slice(insertionPoint);
  
  // Sauvegarder
  fs.writeFileSync(serverPath, serverContent);
  console.log(`\n✅ ${missingModels.length} endpoints générés et injectés dans server.js`);
  console.log('📝 Fichiers modifiés: src/server.js');
} else {
  console.error('❌ Impossible de trouver le point d\'insertion dans server.js');
}
