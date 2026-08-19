#!/usr/bin/env node

/**
 * Diagnostic complet Prisma & Server.js
 * Vérifie que toutes les tables Prisma ont des endpoints de création/modification/suppression
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lire le schéma Prisma
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Extraire tous les modèles Prisma
const prismaModels = new Set();
const modelMatches = schemaContent.matchAll(/^model\s+(\w+)\s*\{/gm);
for (const match of modelMatches) {
  prismaModels.add(match[1]);
}

// Lire server.js
const serverPath = path.join(__dirname, 'src', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf-8');

// Extraire tous les modèles utilisés dans server.js (prisma.XXX)
const serverModels = new Set();
const prismaCallMatches = serverContent.matchAll(/prisma\.(\w+)\./gm);
for (const match of prismaCallMatches) {
  const modelName = match[1];
  // Vérifier si c'est vraiment un modèle (commence par majuscule ou est en snake_case)
  if (modelName[0] === modelName[0].toUpperCase() || modelName.includes('_')) {
    serverModels.add(modelName);
  }
}

// Extraire les endpoints POST/PUT/DELETE pour les modèles
const endpoints = {
  POST: new Map(),
  PUT: new Map(),
  DELETE: new Map(),
  GET: new Map()
};

const endpointMatches = serverContent.matchAll(/app\.(post|put|delete|get)\(['"`]\/api\/([^'"`]+)['"`]/gm);
for (const match of endpointMatches) {
  const method = match[1].toUpperCase();
  const path = match[2];
  if (!endpoints[method].has(path)) {
    endpoints[method].set(path, true);
  }
}

// Analyser les modèles
console.log('\n' + '═'.repeat(80));
console.log('  📊 DIAGNOSTIC COMPLET PRISMA & SERVEUR');
console.log('═'.repeat(80));

console.log('\n📋 RÉSUMÉ:');
console.log(`   • Modèles Prisma: ${prismaModels.size}`);
console.log(`   • Modèles utilisés en serveur: ${serverModels.size}`);
console.log(`   • Endpoints POST: ${endpoints.POST.size}`);
console.log(`   • Endpoints PUT: ${endpoints.PUT.size}`);
console.log(`   • Endpoints DELETE: ${endpoints.DELETE.size}`);
console.log(`   • Endpoints GET: ${endpoints.GET.size}`);

// Vérifier la couverture
const modelsNotInServer = Array.from(prismaModels).filter(m => !serverModels.has(m));
const modelsNotInPrisma = Array.from(serverModels).filter(m => !prismaModels.has(m));

console.log('\n⚠️  PROBLÈMES IDENTIFIÉS:\n');

if (modelsNotInPrisma.length > 0) {
  console.log('❌ Modèles utilisés en serveur mais NON DÉFINIS en Prisma:');
  modelsNotInPrisma.forEach(m => {
    const usageCount = (serverContent.match(new RegExp(`prisma\\.${m}\\.`, 'g')) || []).length;
    console.log(`   • ${m.padEnd(40)} (${usageCount} utilisations)`);
  });
  console.log('');
}

if (modelsNotInServer.length > 0) {
  console.log(`⚠️  Modèles Prisma NON UTILISÉS en serveur (${modelsNotInServer.length}):`);
  modelsNotInServer.forEach(m => {
    console.log(`   • ${m}`);
  });
  console.log('');
}

// Vérifier les endpoints CRUD pour chaque modèle
console.log('\n📍 COUVERTURE CRUD PAR MODÈLE:\n');

const crudCoverage = new Map();

for (const model of Array.from(prismaModels).sort()) {
  const hasCreate = Array.from(endpoints.POST.keys()).some(p => 
    p.includes(model.toLowerCase()) || p.includes(model)
  );
  const hasRead = Array.from(endpoints.GET.keys()).some(p => 
    p.includes(model.toLowerCase()) || p.includes(model)
  );
  const hasUpdate = Array.from(endpoints.PUT.keys()).some(p => 
    p.includes(model.toLowerCase()) || p.includes(model)
  );
  const hasDelete = Array.from(endpoints.DELETE.keys()).some(p => 
    p.includes(model.toLowerCase()) || p.includes(model)
  );

  const coverage = [
    hasCreate ? 'C' : '-',
    hasRead ? 'R' : '-',
    hasUpdate ? 'U' : '-',
    hasDelete ? 'D' : '-'
  ].join('');

  const status = coverage === 'CRUD' ? '✅' : coverage === '----' ? '❌' : '⚠️ ';
  
  console.log(`${status} ${model.padEnd(40)} [${coverage}]`);
  
  crudCoverage.set(model, { create: hasCreate, read: hasRead, update: hasUpdate, delete: hasDelete });
}

// Statistiques finales
console.log('\n' + '═'.repeat(80));
const fullyCovered = Array.from(crudCoverage.values()).filter(c => c.create && c.read && c.update && c.delete).length;
const notCovered = Array.from(crudCoverage.values()).filter(c => !c.create && !c.read && !c.update && !c.delete).length;
const partiallyCovered = crudCoverage.size - fullyCovered - notCovered;

console.log(`\n📊 STATISTIQUES FINALES:`);
console.log(`   ✅ Modèles avec CRUD complet: ${fullyCovered}/${crudCoverage.size}`);
console.log(`   ⚠️  Modèles partiellement couverts: ${partiallyCovered}/${crudCoverage.size}`);
console.log(`   ❌ Modèles sans endpoints: ${notCovered}/${crudCoverage.size}`);

console.log('\n' + '═'.repeat(80) + '\n');

// Export pour autres scripts
export { prismaModels, serverModels, endpoints, crudCoverage };
