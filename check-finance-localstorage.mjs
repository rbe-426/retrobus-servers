#!/usr/bin/env node

// Script pour afficher les données financières stockées en localStorage (fichier JSON)
// Simule une extraction des données comme si elles venaient du navigateur

import fs from 'fs';
import path from 'path';

// Chemins possibles où les données financières pourraient être stockées
const dataStorePaths = [
  'C:\\Users\\*\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Storage\\https_attractive-kindness-rbe-serveurs.up.railway.app_0.localstorage',
  'C:\\Users\\*\\AppData\\Roaming\\Firefox\\Profiles\\*\\storage\\default\\https+++attractive-kindness-rbe-serveurs.up.railway.app\\ls\\data.sqlite'
];

console.log('🔍 ===== AUDIT DONNÉES FINANCIÈRES =====\n');

// Essayons de lire les données depuis localStorage simulé
// Les données peuvent aussi être dans IndexedDB ou dans des fichiers de cache

// Pour cette démonstration, vérifiez directement dans le navigateur avec:
console.log('📊 DONNÉES STOCKÉES EN LOCALSTORAGE');
console.log('');
console.log('Pour vérifier les données financières en localStorage:');
console.log('');
console.log('Dans la console du navigateur (F12):');
console.log('  1. localStorage.getItem("rbe:finance:documents")     → Devis/Factures');
console.log('  2. localStorage.getItem("rbe:finance:transactions")  → Transactions');
console.log('  3. localStorage.getItem("rbe:finance:balance")       → Solde');
console.log('  4. localStorage.getItem("rbe:finance:scheduled")     → Opérations programmées');
console.log('');
console.log('Ou via le script ci-dessous:');
console.log('');
console.log(`JSON.stringify({
  documents: JSON.parse(localStorage.getItem('rbe:finance:documents') || '[]'),
  transactions: JSON.parse(localStorage.getItem('rbe:finance:transactions') || '[]'),
  balance: JSON.parse(localStorage.getItem('rbe:finance:balance') || '{}'),
  scheduled: JSON.parse(localStorage.getItem('rbe:finance:scheduled') || '[]')
}, null, 2)`);
console.log('');
console.log('✅ Lancez ce script depuis la console du navigateur');
console.log('   sur https://attractive-kindness-rbe-serveurs.up.railway.app/admin/finance-v2');
