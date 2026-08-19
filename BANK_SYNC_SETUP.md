# 🏦 Synchronisation Bancaire - GoCardless (Nordigen)

## Configuration

Les credentials GoCardless ont été ajoutées dans `.env`:
```env
NORDIGEN_SECRET_ID=N2KPi7oTvN03D5N4oqCrsQAN1MAcVGUvri2GWoxiUc7NIV6LIXL9mw7Z1RnVVBh-
NORDIGEN_SECRET_KEY=oPZ4MTb-kU2-ELDOahzkyxMhrPUCBoCbM1H1hZS_GgTNWXgJnw7vdIF-6UMqC8WA
FRONTEND_URL=http://localhost:5173
```

## Installation

Le package `nordigen-node` a été installé:
```bash
npm install nordigen-node
```

## Architecture

### Fichiers créés:

1. **Service bancaire** : `src/services/bankSync.service.js`
   - Gestion de l'API GoCardless
   - Récupération des banques
   - Création de liens de connexion
   - Import des transactions

2. **Routes API** : `src/routes/bankSync.routes.js`
   - `GET /api/finance/bank-sync/banks` - Liste des banques FR
   - `POST /api/finance/bank-sync/connect-bank` - Initier connexion
   - `GET /api/finance/bank-sync/bank-callback` - Callback après connexion
   - `POST /api/finance/bank-sync/sync-bank` - Synchronisation manuelle

## Utilisation

### 1. Lister les banques disponibles

```javascript
const response = await fetch('/api/finance/bank-sync/banks');
const banks = await response.json();

// banks contient la liste des banques françaises avec:
// - id: identifiant unique
// - name: nom de la banque
// - bic: code BIC
// - logo: URL du logo
```

### 2. Connecter une banque

```javascript
const response = await fetch('/api/finance/bank-sync/connect-bank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bankId: 'SANDBOXFINANCE_SFIN0000' })
});

const { linkUrl } = await response.json();

// Rediriger l'utilisateur vers linkUrl
window.location.href = linkUrl;
```

### 3. Callback automatique

Après que l'utilisateur se connecte à sa banque, GoCardless le redirige vers:
```
http://localhost:5173/finance/bank-callback?ref=REQUISITION_ID
```

L'API importe automatiquement toutes les transactions des 90 derniers jours.

## Frontend - Composant React à créer

```jsx
// src/pages/FinanceBankConnect.jsx
import { useState, useEffect } from 'react';
import { Button, VStack, HStack, Text, Spinner, Badge } from '@chakra-ui/react';

export default function FinanceBankConnect() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      const response = await fetch('/api/finance/bank-sync/banks');
      const data = await response.json();
      setBanks(data.slice(0, 10)); // Top 10 banques
    } catch (error) {
      console.error('Erreur chargement banques:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectBank = async (bankId) => {
    try {
      const response = await fetch('/api/finance/bank-sync/connect-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId })
      });
      
      const { linkUrl } = await response.json();
      window.location.href = linkUrl;
    } catch (error) {
      console.error('Erreur connexion banque:', error);
    }
  };

  if (loading) return <Spinner />;

  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="xl" fontWeight="bold">
        🏦 Connecter votre banque
      </Text>
      <Text color="gray.600">
        Synchronisez automatiquement vos transactions bancaires
      </Text>

      {banks.map(bank => (
        <HStack
          key={bank.id}
          p={4}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          justify="space-between"
        >
          <HStack>
            {bank.logo && <img src={bank.logo} alt={bank.name} width="40" />}
            <VStack align="start" spacing={0}>
              <Text fontWeight="600">{bank.name}</Text>
              <Text fontSize="sm" color="gray.500">{bank.bic}</Text>
            </VStack>
          </HStack>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => connectBank(bank.id)}
          >
            Connecter
          </Button>
        </HStack>
      ))}
    </VStack>
  );
}
```

## Page de callback à créer

```jsx
// src/pages/FinanceBankCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner, VStack, Text } from '@chakra-ui/react';

export default function FinanceBankCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('success');
    const imported = searchParams.get('imported');
    const error = searchParams.get('error');

    if (success) {
      setTimeout(() => {
        navigate('/finance', { 
          state: { 
            message: `✅ Banque connectée! ${imported} transactions importées.` 
          }
        });
      }, 2000);
    } else if (error) {
      navigate('/finance', { 
        state: { 
          error: '❌ Erreur lors de la synchronisation bancaire' 
        }
      });
    }
  }, [searchParams, navigate]);

  return (
    <VStack h="100vh" justify="center" spacing={4}>
      <Spinner size="xl" />
      <Text>Synchronisation en cours...</Text>
    </VStack>
  );
}
```

## TODO

- [ ] Ajouter le modèle `bank_connections` au schéma Prisma
- [ ] Implémenter l'authentification dans les routes
- [ ] Créer les composants React frontend
- [ ] Ajouter la synchronisation automatique quotidienne (cron job)
- [ ] Ajouter la catégorisation automatique des transactions
- [ ] Gérer les duplicatas lors de l'import
- [ ] Ajouter un système de logs pour le suivi des imports

## Banque de test (Sandbox)

Pour tester, utilise:
- **ID Banque**: `SANDBOXFINANCE_SFIN0000`
- **Credentials**: n'importe quel login/password (mode sandbox)

## Limites

- **90 jours** de transactions maximum par import
- **180 jours** de validité de la connexion bancaire
- **Gratuit** en mode sandbox
- **Gratuit** en production pour usage non-commercial

## Support

Documentation GoCardless: https://nordigen.com/en/docs/
