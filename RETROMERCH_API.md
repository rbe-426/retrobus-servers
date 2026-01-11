# API RétroMerch - Documentation

## Vue d'ensemble

L'API RétroMerch fournit les endpoints nécessaires pour gérer la boutique en ligne RétroBus Essonne, incluant:
- **Produits**: Création, lecture, mise à jour, suppression
- **Catégories**: Gestion des catégories de produits
- **Commandes**: Suivi des commandes clients
- **Statistiques**: Métriques et analytics

**URL de base**: `http://localhost:4000/api/retromerch` (développement)

---

## Authentification

Tous les endpoints `POST`, `PUT`, `DELETE` nécessitent une authentification.

Headers requis:
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## PRODUITS

### GET /products
Récupère la liste complète des produits avec leurs catégories.

**Réponse (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "T-shirt RetroRB",
      "description": "T-shirt vintage RBE",
      "price": 25.00,
      "stock": 50,
      "image": "https://...",
      "active": true,
      "categoryId": "uuid",
      "category": {
        "id": "uuid",
        "name": "Vêtements"
      },
      "createdAt": "2026-01-11T10:00:00Z",
      "updatedAt": "2026-01-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

### GET /products/:id
Récupère un produit spécifique par son ID.

**Paramètres**:
- `id` (string) - ID du produit

**Réponse (200)**:
```json
{
  "success": true,
  "data": { /* product object */ }
}
```

**Erreur (404)**:
```json
{ "error": "Product not found" }
```

### POST /products
Crée un nouveau produit.

**Headers**: Authentification requise

**Corps de la requête**:
```json
{
  "name": "T-shirt RetroRB",
  "description": "T-shirt vintage de qualité",
  "price": 25.00,
  "stock": 50,
  "categoryId": "uuid (optionnel)",
  "image": "https://...",
  "active": true
}
```

**Réponse (201)**:
```json
{
  "success": true,
  "message": "Product created",
  "data": { /* product object */ }
}
```

**Erreur (400)**:
```json
{ "error": "Name and price are required" }
```

### PUT /products/:id
Met à jour un produit existant.

**Headers**: Authentification requise

**Paramètres**:
- `id` (string) - ID du produit

**Corps de la requête** (champs optionnels):
```json
{
  "name": "T-shirt RetroRB Édition",
  "price": 28.00,
  "stock": 45,
  "active": false
}
```

**Réponse (200)**:
```json
{
  "success": true,
  "message": "Product updated",
  "data": { /* updated product */ }
}
```

### DELETE /products/:id
Supprime un produit.

**Headers**: Authentification requise

**Paramètres**:
- `id` (string) - ID du produit

**Réponse (200)**:
```json
{ "success": true, "message": "Product deleted" }
```

---

## CATÉGORIES

### GET /categories
Récupère toutes les catégories avec le compte de produits.

**Réponse (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Vêtements",
      "description": "Vêtements et accessoires",
      "productCount": 5,
      "createdAt": "2026-01-11T10:00:00Z",
      "updatedAt": "2026-01-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /categories
Crée une nouvelle catégorie.

**Headers**: Authentification requise

**Corps de la requête**:
```json
{
  "name": "Vêtements",
  "description": "Tous les vêtements RBE"
}
```

**Réponse (201)**:
```json
{
  "success": true,
  "message": "Category created",
  "data": { /* category object */ }
}
```

---

## COMMANDES

### GET /orders
Récupère toutes les commandes avec leurs articles.

**Réponse (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerName": "Jean Dupont",
      "customerEmail": "jean@example.com",
      "customerPhone": "0612345678",
      "shippingAddress": "123 Rue de Paris, 75000 Paris",
      "totalAmount": 50.00,
      "status": "PENDING",
      "notes": "Livraison en main propre",
      "createdAt": "2026-01-11T10:00:00Z",
      "updatedAt": "2026-01-11T10:00:00Z",
      "items": [
        {
          "id": "uuid",
          "quantity": 2,
          "unitPrice": 25.00,
          "product": { /* product data */ }
        }
      ]
    }
  ],
  "count": 1
}
```

### GET /orders/:id
Récupère une commande spécifique.

**Paramètres**:
- `id` (string) - ID de la commande

**Réponse (200)**:
```json
{
  "success": true,
  "data": { /* order object */ }
}
```

### POST /orders
Crée une nouvelle commande (accessible sans authentification).

**Corps de la requête**:
```json
{
  "customerName": "Jean Dupont",
  "customerEmail": "jean@example.com",
  "customerPhone": "0612345678",
  "shippingAddress": "123 Rue de Paris, 75000 Paris",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 25.00
    }
  ],
  "totalAmount": 50.00,
  "notes": "Livraison en main propre"
}
```

**Réponse (201)**:
```json
{
  "success": true,
  "message": "Order created",
  "data": { /* order object */ }
}
```

### PUT /orders/:id/status
Met à jour le statut d'une commande.

**Headers**: Authentification requise

**Paramètres**:
- `id` (string) - ID de la commande

**Corps de la requête**:
```json
{
  "status": "CONFIRMED"
}
```

**Statuts valides**:
- `PENDING` - En attente
- `CONFIRMED` - Confirmée
- `SHIPPED` - Expédiée
- `DELIVERED` - Livrée
- `CANCELLED` - Annulée

**Réponse (200)**:
```json
{
  "success": true,
  "message": "Order status updated",
  "data": { /* updated order */ }
}
```

### PUT /orders/:id
Met à jour les détails d'une commande.

**Headers**: Authentification requise

**Corps de la requête** (optionnel):
```json
{
  "customerName": "Jean Dupont Updated",
  "shippingAddress": "456 Avenue de la République",
  "status": "SHIPPED",
  "notes": "Prioritaire"
}
```

**Réponse (200)**:
```json
{
  "success": true,
  "message": "Order updated",
  "data": { /* updated order */ }
}
```

### DELETE /orders/:id
Supprime une commande et ses articles.

**Headers**: Authentification requise

**Réponse (200)**:
```json
{ "success": true, "message": "Order deleted" }
```

---

## STATISTIQUES

### GET /stats
Récupère les statistiques de la boutique.

**Réponse (200)**:
```json
{
  "success": true,
  "data": {
    "totalProducts": 15,
    "totalCategories": 3,
    "totalOrders": 42,
    "totalRevenue": 2150.50,
    "recentOrders": [
      { /* order objects */ }
    ]
  }
}
```

---

## Codes de réponse HTTP

| Code | Signification |
|------|---------------|
| 200  | Succès |
| 201  | Créé |
| 400  | Requête invalide |
| 401  | Non authentifié |
| 404  | Non trouvé |
| 500  | Erreur serveur |

---

## Exemples avec curl

### Créer un produit
```bash
curl -X POST http://localhost:4000/api/retromerch/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "T-shirt RetroRB",
    "price": 25,
    "stock": 50,
    "categoryId": "category-uuid",
    "image": "https://...",
    "active": true
  }'
```

### Créer une commande
```bash
curl -X POST http://localhost:4000/api/retromerch/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jean Dupont",
    "customerEmail": "jean@example.com",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 2,
        "unitPrice": 25
      }
    ],
    "totalAmount": 50
  }'
```

### Récupérer les statistiques
```bash
curl http://localhost:4000/api/retromerch/stats
```

---

## Notes d'intégration

1. **Authentification**: Utilisez les tokens JWT fournis par le système d'authentification RBE
2. **CORS**: L'API est configurée pour fonctionner avec le frontend React interne
3. **Pagination**: À implémenter si nécessaire selon le nombre de produits
4. **Validation**: Les dates et formats sont validés côté serveur
5. **Transactions**: Les suppléances de commandes suppriment automatiquement les items associés
