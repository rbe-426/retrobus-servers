#!/usr/bin/env node

/**
 * Test de la visibilité des véhicules
 * Vérifie que les véhicules avec isPublic=false ne sont pas visibles sur le site public
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:4000';

async function test() {
  console.log('\n🧪 Test de visibilité des véhicules\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // 1. Créer un véhicule privé (isPublic: false)
    console.log('1️⃣  Création d\'un véhicule privé...');
    const createRes = await fetch(`${BASE_URL}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-token-admin`
      },
      body: JSON.stringify({
        parc: `TEST-PRIVATE-${Date.now()}`,
        type: 'Véhicule test',
        modele: 'Test Model',
        marque: 'Test Brand',
        subtitle: 'Véhicule de test privé',
        etat: 'test',
        isPublic: false
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error('❌ Erreur création:', err);
      return;
    }

    const created = await createRes.json();
    const parcPrivate = created.vehicle.parc;
    console.log(`✅ Véhicule créé: ${parcPrivate} (isPublic: false)\n`);

    // 2. Créer un véhicule public (isPublic: true)
    console.log('2️⃣  Création d\'un véhicule public...');
    const createRes2 = await fetch(`${BASE_URL}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-token-admin`
      },
      body: JSON.stringify({
        parc: `TEST-PUBLIC-${Date.now()}`,
        type: 'Véhicule test',
        modele: 'Test Model',
        marque: 'Test Brand',
        subtitle: 'Véhicule de test public',
        etat: 'test',
        isPublic: true
      })
    });

    if (!createRes2.ok) {
      const err = await createRes2.text();
      console.error('❌ Erreur création:', err);
      return;
    }

    const created2 = await createRes2.json();
    const parcPublic = created2.vehicle.parc;
    console.log(`✅ Véhicule créé: ${parcPublic} (isPublic: true)\n`);

    // 3. Vérifier que le véhicule privé n'est pas dans /public/vehicles
    console.log('3️⃣  Récupération de la liste publique...');
    const publicListRes = await fetch(`${BASE_URL}/public/vehicles`);
    const publicList = await publicListRes.json();
    const hasPrivate = publicList.some(v => v.parc === parcPrivate);
    const hasPublic = publicList.some(v => v.parc === parcPublic);

    console.log(`   Total de véhicules visibles: ${publicList.length}`);
    console.log(`   - Véhicule privé ${parcPrivate} visible? ${hasPrivate ? '❌ OUI' : '✅ NON'}`);
    console.log(`   - Véhicule public ${parcPublic} visible? ${hasPublic ? '✅ OUI' : '❌ NON'}\n`);

    // 4. Vérifier l'accès direct
    console.log('4️⃣  Test d\'accès direct...');
    const directPrivate = await fetch(`${BASE_URL}/public/vehicles/${parcPrivate}`);
    const directPublic = await fetch(`${BASE_URL}/public/vehicles/${parcPublic}`);

    console.log(`   Accès direct au véhicule privé: ${directPrivate.status === 404 ? '✅ INTERDIT (404)' : `❌ AUTORISÉ (${directPrivate.status})`}`);
    console.log(`   Accès direct au véhicule public: ${directPublic.status === 200 ? '✅ AUTORISÉ (200)' : `❌ INTERDIT (${directPublic.status})`}\n`);

    // 5. Résumé
    const testPassed = !hasPrivate && hasPublic && directPrivate.status === 404 && directPublic.status === 200;
    if (testPassed) {
      console.log('🎉 TOUS LES TESTS SONT PASSÉS!\n');
    } else {
      console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n');
    }

  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  }
}

test();
