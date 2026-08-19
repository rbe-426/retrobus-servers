/**
 * Service d'identification de véhicules par plaque d'immatriculation
 * 
 * Sources de données disponibles :
 * 1. ApiPlaqueImmatriculation (package npm - RECOMMANDÉ) Tarif variable
 * 2. API-AUTO.com (API commerciale française) ~0.50€/requête
 * 3. SIV-Auto.fr (API commerciale alternative) ~100-200€/mois
 * 4. Base locale (SQLite/Prisma) - véhicules enregistrés par les membres
 * 5. API HistoVec (service gouvernemental gratuit mais limité)
 * 6. Données MOCK (pour développement/démo)
 * 
 * Pour utiliser ApiPlaqueImmatriculation (RECOMMANDÉ) :
 * 1. Obtenez un token sur https://apiplaqueimmatriculation.com
 * 2. Ajoutez dans .env : API_PLAQUE_TOKEN=votre_token
 * 3. Configurez : VEHICLE_API_PROVIDER=api_plaque
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import ApiPlaqueImmatriculation from 'apiplaqueimmatriculation';

const prisma = new PrismaClient();

// Configuration des providers
const PROVIDERS = {
  API_PLAQUE: 'api_plaque',  // https://apiplaqueimmatriculation.com (RECOMMANDÉ - déjà installé)
  API_AUTO: 'api_auto',      // https://www.api-auto.com (alternatif - payant)
  SIV_AUTO: 'siv_auto',      // https://www.siv-auto.fr (alternatif - payant)
  LOCAL: 'local',            // Base de données locale (gratuit)
  HISTOVEC: 'histovec',      // Service gouvernemental (gratuit mais limité)
  MOCK: 'mock'               // Données de test (développement)
};

// Provider actif (changez selon vos besoins)
// Options : 'api_plaque', 'api_auto', 'siv_auto', 'local', 'histovec', 'mock'
const ACTIVE_PROVIDER = process.env.VEHICLE_API_PROVIDER || PROVIDERS.MOCK;

console.log(`🚗 Service identification véhicules initialisé - Provider: ${ACTIVE_PROVIDER}`);

// Vérification du token API au démarrage si provider = api_plaque
if (ACTIVE_PROVIDER === PROVIDERS.API_PLAQUE) {
  const apiToken = process.env.API_PLAQUE_TOKEN;
  if (apiToken) {
    (async () => {
      try {
        const api = new ApiPlaqueImmatriculation(apiToken);
        const isValid = await api.checkToken();
        if (isValid) {
          console.log('✅ Token API vérifié et valide (pays: FR)');
        } else {
          console.error('❌ Token API invalide ou expiré');
        }
      } catch (error) {
        console.error('❌ Impossible de vérifier le token API:', error.message);
      }
    })();
  } else {
    console.warn('⚠️ API_PLAQUE_TOKEN non configuré - utilisera fallback sur mock');
  }
}

/**
 * Base de données mock pour les tests et démo
 * Utilisée en fallback si l'API principale échoue
 */
const MOCK_DATABASE = {
  // Format standard FIV (depuis 2009)
  'AR-920-BE': {
    licensePlate: 'AR-920-BE',
    plateType: 'standard',
    make: 'Citroën',
    model: '2CV',
    year: 1965,
    color: 'Gris',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1965-03-15',
    source: 'mock'
  },
  'AR920BE': { // Sans tirets
    licensePlate: 'AR-920-BE',
    plateType: 'standard',
    make: 'Citroën',
    model: '2CV',
    year: 1965,
    color: 'Gris',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1965-03-15',
    source: 'mock'
  },
  
  // Ancien format (1950-2009)
  '0920 RB 91': {
    licensePlate: '0920 RB 91',
    plateType: 'old',
    make: 'Renault',
    model: '4L',
    year: 1972,
    color: 'Bleu',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1972-06-20',
    source: 'mock'
  },
  '0920RB91': { // Sans espaces
    licensePlate: '0920 RB 91',
    plateType: 'old',
    make: 'Renault',
    model: '4L',
    year: 1972,
    color: 'Bleu',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1972-06-20',
    source: 'mock'
  },
  
  'FG 920 RE': {
    licensePlate: 'FG 920 RE',
    plateType: 'old',
    make: 'Renault',
    model: 'R8',
    year: 1968,
    color: 'Beige',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1968-05-12',
    source: 'mock'
  },
  'FG920RE': { // Sans espaces
    licensePlate: 'FG 920 RE',
    plateType: 'old',
    make: 'Renault',
    model: 'R8',
    year: 1968,
    color: 'Beige',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1968-05-12',
    source: 'mock'
  },
  
  '1234 AB 75': {
    licensePlate: '1234 AB 75',
    plateType: 'old',
    make: 'Porsche',
    model: '911',
    year: 1985,
    color: 'Argenté',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1985-11-03',
    source: 'mock'
  },
  '1234AB75': {
    licensePlate: '1234 AB 75',
    plateType: 'old',
    make: 'Porsche',
    model: '911',
    year: 1985,
    color: 'Argenté',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1985-11-03',
    source: 'mock'
  },
  
  '5678 CD 92': {
    licensePlate: '5678 CD 92',
    plateType: 'old',
    make: 'Peugeot',
    model: '504',
    year: 1975,
    color: 'Vert',
    energy: 'Diesel',
    category: 'VP',
    firstRegistration: '1975-08-22',
    source: 'mock'
  },
  '5678CD92': {
    licensePlate: '5678 CD 92',
    plateType: 'old',
    make: 'Peugeot',
    model: '504',
    year: 1975,
    color: 'Vert',
    energy: 'Diesel',
    category: 'VP',
    firstRegistration: '1975-08-22',
    source: 'mock'
  },
  
  '777 ABC 91': {
    licensePlate: '777 ABC 91',
    plateType: 'old',
    make: 'Citroën',
    model: 'DS',
    year: 1970,
    color: 'Bordeaux',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1970-03-15',
    source: 'mock'
  },
  '777ABC91': {
    licensePlate: '777 ABC 91',
    plateType: 'old',
    make: 'Citroën',
    model: 'DS',
    year: 1970,
    color: 'Bordeaux',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1970-03-15',
    source: 'mock'
  },
  
  '234 BC 78': {
    licensePlate: '234 BC 78',
    plateType: 'old',
    make: 'Simca',
    model: '1000',
    year: 1963,
    color: 'Blanc',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1963-07-10',
    source: 'mock'
  },
  '234BC78': {
    licensePlate: '234 BC 78',
    plateType: 'old',
    make: 'Simca',
    model: '1000',
    year: 1963,
    color: 'Blanc',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1963-07-10',
    source: 'mock'
  },
  
  // Plaque collection
  '123-ABC-45': {
    licensePlate: '123-ABC-45',
    plateType: 'collection',
    make: 'Peugeot',
    model: '203',
    year: 1958,
    color: 'Noir',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1958-09-10',
    source: 'mock'
  },
  '123ABC45': {
    licensePlate: '123-ABC-45',
    plateType: 'collection',
    make: 'Peugeot',
    model: '203',
    year: 1958,
    color: 'Noir',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1958-09-10',
    source: 'mock'
  },
  
  // Format FIV standard (exemples récents)
  'AB-123-CD': {
    licensePlate: 'AB-123-CD',
    plateType: 'standard',
    make: 'Volkswagen',
    model: 'Combi T1',
    year: 1967,
    color: 'Rouge et Blanc',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1967-04-22',
    source: 'mock'
  },
  'AB123CD': {
    licensePlate: 'AB-123-CD',
    plateType: 'standard',
    make: 'Volkswagen',
    model: 'Combi T1',
    year: 1967,
    color: 'Rouge et Blanc',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1967-04-22',
    source: 'mock'
  },
  
  'CD-456-EF': {
    licensePlate: 'CD-456-EF',
    plateType: 'standard',
    make: 'Renault',
    model: 'Estafette',
    year: 1965,
    color: 'Jaune',
    energy: 'Essence',
    category: 'CTTE',
    firstRegistration: '1965-11-20',
    source: 'mock'
  },
  'CD456EF': {
    licensePlate: 'CD-456-EF',
    plateType: 'standard',
    make: 'Renault',
    model: 'Estafette',
    year: 1965,
    color: 'Jaune',
    energy: 'Essence',
    category: 'CTTE',
    firstRegistration: '1965-11-20',
    source: 'mock'
  },
  
  'EF-789-GH': {
    licensePlate: 'EF-789-GH',
    plateType: 'standard',
    make: 'Citroën',
    model: 'HY',
    year: 1960,
    color: 'Gris',
    energy: 'Essence',
    category: 'CTTE',
    firstRegistration: '1960-02-14',
    source: 'mock'
  },
  'EF789GH': {
    licensePlate: 'EF-789-GH',
    plateType: 'standard',
    make: 'Citroën',
    model: 'HY',
    year: 1960,
    color: 'Gris',
    energy: 'Essence',
    category: 'CTTE',
    firstRegistration: '1960-02-14',
    source: 'mock'
  },
  
  'GH-321-IJ': {
    licensePlate: 'GH-321-IJ',
    plateType: 'standard',
    make: 'Panhard',
    model: 'PL17',
    year: 1962,
    color: 'Bleu',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1962-06-18',
    source: 'mock'
  },
  'GH321IJ': {
    licensePlate: 'GH-321-IJ',
    plateType: 'standard',
    make: 'Panhard',
    model: 'PL17',
    year: 1962,
    color: 'Bleu',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1962-06-18',
    source: 'mock'
  },
  
  'IJ-654-KL': {
    licensePlate: 'IJ-654-KL',
    plateType: 'standard',
    make: 'Triumph',
    model: 'TR6',
    year: 1973,
    color: 'Rouge',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1973-09-05',
    source: 'mock'
  },
  'IJ654KL': {
    licensePlate: 'IJ-654-KL',
    plateType: 'standard',
    make: 'Triumph',
    model: 'TR6',
    year: 1973,
    color: 'Rouge',
    energy: 'Essence',
    category: 'VP',
    firstRegistration: '1973-09-05',
    source: 'mock'
  }
};

/**
 * Normalise une plaque d'immatriculation pour la recherche
 */
function normalizePlate(plate) {
  return plate.toUpperCase().replace(/[-\s]/g, '');
}

/**
 * Recherche dans la base de données locale (Prisma)
 */
async function searchLocalDatabase(licensePlate) {
  try {
    const normalized = normalizePlate(licensePlate);
    
    // Recherche dans la table Vehicle (le champ s'appelle 'immat')
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { immat: licensePlate },
          { immat: normalized }
        ]
      }
    });
    
    if (vehicle) {
      return {
        licensePlate: vehicle.immat,
        plateType: detectPlateType(vehicle.immat || licensePlate),
        make: vehicle.marque || 'Inconnu',
        model: vehicle.modele || 'Inconnu',
        year: vehicle.miseEnCirculation ? new Date(vehicle.miseEnCirculation).getFullYear() : null,
        color: null,
        energy: vehicle.energie,
        category: vehicle.type,
        source: 'local'
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche locale:', error.message);
    return null;
  }
}

/**
 * Recherche dans la base de données mock
 */
function searchMockDatabase(licensePlate) {
  const normalized = normalizePlate(licensePlate);
  
  // Recherche directe
  if (MOCK_DATABASE[licensePlate]) {
    return MOCK_DATABASE[licensePlate];
  }
  
  // Recherche normalisée
  if (MOCK_DATABASE[normalized]) {
    return MOCK_DATABASE[normalized];
  }
  
  // Recherche dans toutes les clés normalisées
  for (const [key, value] of Object.entries(MOCK_DATABASE)) {
    if (normalizePlate(key) === normalized) {
      return value;
    }
  }
  
  return null;
}

/**
 * Recherche via ApiPlaqueImmatriculation (package npm)
 * Documentation : https://apiplaqueimmatriculation.com
 * Avantages : Simple, package npm installé, données officielles SIV françaises
 */
async function searchApiPlaqueImmatriculation(licensePlate) {
  const apiToken = process.env.API_PLAQUE_TOKEN;
  
  if (!apiToken) {
    console.warn('⚠️ API_PLAQUE_TOKEN non configuré');
    return null;
  }
  
  try {
    // Création de l'instance du client API avec options
    const api = new ApiPlaqueImmatriculation(apiToken, {
      timeout: 10000, // 10 secondes
      baseUrl: 'https://api.apiplaqueimmatriculation.com'
    });
    
    console.log(`📡 Recherche via ApiPlaqueImmatriculation: ${licensePlate} (pays: FR)`);
    
    // Appel à l'API avec le pays FR (France)
    const data = await api.getPlaque(licensePlate, 'FR');
    
    // Vérifier si le véhicule a été trouvé
    if (!data || !data.marque) {
      console.log('⚠️ ApiPlaqueImmatriculation: Véhicule non trouvé ou données incomplètes');
      return null;
    }
    
    // Transformation du format API vers notre format interne
    return {
      licensePlate: data.immatriculation || licensePlate,
      plateType: detectPlateType(licensePlate),
      make: data.marque,
      model: data.modele || data.modeleExact || data.denomination || data.modeleCommercial,
      year: data.annee || (data.dateMiseCirculation ? new Date(data.dateMiseCirculation).getFullYear() : null),
      color: data.couleur,
      energy: data.energie || data.carburant,
      category: data.categorie || data.genre,
      firstRegistration: data.dateMiseCirculation || data.datePremiereImmatriculation,
      co2: data.co2,
      power: data.puissanceFiscale || data.puissance,
      seats: data.nombrePlaces || data.places,
      vin: data.vin || data.numeroVIN,
      source: 'api_plaque'
    };
  } catch (error) {
    console.error('❌ Erreur ApiPlaqueImmatriculation:', error.message);
    
    // Si l'erreur indique un problème de token, le mentionner
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('❌ Token API invalide ou expiré. Vérifiez votre configuration.');
    }
    
    return null;
  }
}

/**
 * Recherche via API-AUTO.com (API commerciale française)
 * Documentation : https://www.api-auto.com/documentation
 * Tarif : ~0.50€ par requête, essai gratuit disponible
 */
async function searchApiAuto(licensePlate) {
  const apiKey = process.env.API_AUTO_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ API_AUTO_KEY non configurée');
    return null;
  }
  
  try {
    const normalized = normalizePlate(licensePlate);
    
    const response = await fetch('https://www.api-auto.com/api/vehicule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        immatriculation: normalized
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ API-AUTO réponse ${response.status}:`, errorText);
      return null;
    }
    
    const data = await response.json();
    
    // API-AUTO retourne un objet avec les données du véhicule
    if (!data || !data.marque) {
      return null;
    }
    
    return {
      licensePlate: data.immatriculation || licensePlate,
      plateType: detectPlateType(licensePlate),
      make: data.marque,
      model: data.modele || data.denomination_commerciale,
      year: data.date_premiere_immatriculation ? new Date(data.date_premiere_immatriculation).getFullYear() : null,
      color: data.couleur,
      energy: data.energie || data.carburant,
      category: data.categorie || data.genre,
      firstRegistration: data.date_premiere_immatriculation,
      co2: data.co2,
      power: data.puissance_fiscale,
      seats: data.nombre_places,
      source: 'api_auto'
    };
  } catch (error) {
    console.error('❌ Erreur API-AUTO:', error.message);
    return null;
  }
}

/**
 * Recherche via l'API SIV-Auto (alternative commerciale)
 * Documentation : https://www.siv-auto.fr/documentation
 */
async function searchSivAuto(licensePlate) {
  const apiKey = process.env.SIV_AUTO_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ SIV_AUTO_API_KEY non configurée');
    return null;
  }
  
  try {
    const normalized = normalizePlate(licensePlate);
    
    const response = await fetch(`https://api.siv-auto.fr/vehicule/${normalized}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (!data || !data.marque) {
      return null;
    }
    
    return {
      licensePlate: data.immatriculation || licensePlate,
      plateType: detectPlateType(licensePlate),
      make: data.marque,
      model: data.modele,
      year: data.annee_modele || (data.date_mise_circulation ? new Date(data.date_mise_circulation).getFullYear() : null),
      color: data.couleur,
      energy: data.energie,
      category: data.genre,
      firstRegistration: data.date_mise_circulation,
      source: 'siv_auto'
    };
  } catch (error) {
    console.error('❌ Erreur API SIV-Auto:', error.message);
    return null;
  }
}

/**
 * Recherche via HistoVec (service gouvernemental gratuit)
 * Limité aux véhicules d'occasion
 */
async function searchHistoVec(licensePlate) {
  // Note: HistoVec nécessite le consentement du propriétaire
  // et un code d'accès fourni par ce dernier
  // Cette fonction est un placeholder pour l'intégration future
  
  console.log('ℹ️ HistoVec nécessite le consentement du propriétaire');
  return null;
}

/**
 * Détecte le type de plaque d'immatriculation
 */
function detectPlateType(licensePlate) {
  const plate = licensePlate.replace(/[-\s]/g, '');
  
  // Format FIV (depuis 2009) : XX-123-XX ou XX123XX
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate)) {
    return 'standard';
  }
  
  // Ancien format (1950-2009) : 1234 AB 75 ou 1234AB75
  if (/^\d{1,4}[A-Z]{1,3}\d{2,3}$/.test(plate)) {
    return 'old';
  }
  
  return 'unknown';
}

/**
 * Sauvegarde le résultat de recherche dans la base locale
 * pour améliorer les futures recherches
 */
async function cacheVehicleData(vehicleData) {
  try {
    await prisma.vehicleCache.upsert({
      where: { licensePlate: vehicleData.licensePlate },
      update: {
        ...vehicleData,
        lastSearched: new Date(),
        searchCount: { increment: 1 }
      },
      create: {
        ...vehicleData,
        lastSearched: new Date(),
        searchCount: 1
      }
    });
  } catch (error) {
    // Table n'existe peut-être pas encore, on continue sans bloquer
    console.log('ℹ️ Cache non disponible:', error.message);
  }
}

/**
 * Fonction principale : Recherche un véhicule par plaque d'immatriculation
 * Utilise une stratégie de fallback pour maximiser les chances de succès
 */
export async function identifyVehicle(licensePlate) {
  console.log(`🔍 Recherche véhicule: ${licensePlate} (provider: ${ACTIVE_PROVIDER})`);
  
  let result = null;
  
  // Stratégie de recherche selon le provider actif
  switch (ACTIVE_PROVIDER) {
    case PROVIDERS.API_PLAQUE:
      // Priorité à ApiPlaqueImmatriculation (package npm installé)
      result = await searchApiPlaqueImmatriculation(licensePlate);
      if (!result) {
        console.log('⚠️ ApiPlaqueImmatriculation échoué, tentative avec base locale...');
        result = await searchLocalDatabase(licensePlate);
      }
      if (!result) {
        console.log('⚠️ Base locale vide, fallback sur données mock...');
        result = searchMockDatabase(licensePlate);
      }
      break;
      
    case PROVIDERS.API_AUTO:
      // API-AUTO (alternative commerciale)
      result = await searchApiAuto(licensePlate);
      if (!result) {
        console.log('⚠️ API-AUTO échoué, tentative avec base locale...');
        result = await searchLocalDatabase(licensePlate);
      }
      if (!result) {
        console.log('⚠️ Base locale vide, fallback sur données mock...');
        result = searchMockDatabase(licensePlate);
      }
      break;
      
    case PROVIDERS.LOCAL:
      result = await searchLocalDatabase(licensePlate);
      if (!result) {
        console.log('⚠️ Base locale vide, fallback sur données mock...');
        result = searchMockDatabase(licensePlate);
      }
      break;
      
    case PROVIDERS.SIV_AUTO:
      result = await searchSivAuto(licensePlate);
      if (!result) {
        console.log('⚠️ SIV-AUTO échoué, fallback sur base locale...');
        result = await searchLocalDatabase(licensePlate);
      }
      if (!result) {
        result = searchMockDatabase(licensePlate);
      }
      break;
      
    case PROVIDERS.HISTOVEC:
      result = await searchHistoVec(licensePlate);
      if (!result) {
        result = searchMockDatabase(licensePlate);
      }
      break;
      
    case PROVIDERS.MOCK:
    default:
      // Mode mock uniquement (développement/démo)
      result = searchMockDatabase(licensePlate);
      break;
  }
  
  // Sauvegarder en cache si trouvé et si ce n'est pas du mock
  if (result && result.source !== 'mock') {
    await cacheVehicleData(result);
    console.log(`✅ Véhicule trouvé via ${result.source}: ${result.make} ${result.model} (${result.year})`);
  } else if (result) {
    console.log(`✅ Véhicule trouvé (mock): ${result.make} ${result.model} (${result.year})`);
  } else {
    console.log(`❌ Véhicule non trouvé: ${licensePlate}`);
  }
  
  return result;
}

/**
 * Ajoute un véhicule manuellement dans la base locale
 */
export async function addVehicleToDatabase(vehicleData) {
  try {
    const vehicle = await prisma.vehicle.create({
      data: vehicleData
    });
    
    console.log(`✅ Véhicule ajouté: ${vehicleData.licensePlate}`);
    return vehicle;
  } catch (error) {
    console.error('❌ Erreur ajout véhicule:', error.message);
    throw error;
  }
}

export default {
  identifyVehicle,
  addVehicleToDatabase,
  PROVIDERS
};
