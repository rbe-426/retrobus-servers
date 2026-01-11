/**
 * Routes RétroMerch - Gestion de la boutique en ligne
 * Factory function qui crée et retourne un Express router configuré
 */

import express from 'express';

export default function createRetroMerchRouter(prismaInstance) {
  const router = express.Router();
  const prisma = prismaInstance;

  // Middleware d'authentification OPTIONNELLE (ne bloque pas si pas présente)
  const optionalAuth = (req, res, next) => {
    // Extrait le token s'il existe, mais ne bloque pas s'il n'y a rien
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        if (token.startsWith('stub.')) {
          const emailB64 = token.slice(5);
          const email = Buffer.from(emailB64, 'base64').toString('utf-8');
          req.user = { email: email, id: email };
        }
      } catch (e) {
        // Silently fail
      }
    }
    next();
  };

  // Middleware d'authentification requise
  const requireAuth = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Endpoint public GET products - sans authentification requise
  router.get('/products', optionalAuth, async (req, res) => {
    try {
      const products = await prisma.retromerch_products.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(products);
    } catch (error) {
      console.error('❌ GET products error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/retromerch/products/:id - Récupérer un produit spécifique
   */
  router.get('/products/:id', optionalAuth, async (req, res) => {
    try {
      const product = await prisma.retromerch_products.findUnique({
        where: { id: req.params.id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      console.error('❌ GET product error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/retromerch/products - Créer un nouveau produit
   */
  router.post('/products', requireAuth, async (req, res) => {
    try {
      const { name, description, price, stock, categoryId, image, active } = req.body;

      if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      const product = await prisma.retromerch_products.create({
        data: {
          name,
          description: description || '',
          price: parseFloat(price),
          stock: parseInt(stock) || 0,
          categoryId: categoryId || null,
          image: image || '',
          active: active !== false
        }
      });

      res.status(201).json(product);
    } catch (error) {
      console.error('❌ POST product error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/retromerch/products/:id - Mettre à jour un produit
   */
  router.put('/products/:id', requireAuth, async (req, res) => {
    try {
      const { name, description, price, stock, categoryId, image, active } = req.body;

      const product = await prisma.retromerch_products.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(stock !== undefined && { stock: parseInt(stock) }),
          ...(categoryId !== undefined && { categoryId }),
          ...(image !== undefined && { image }),
          ...(active !== undefined && { active })
        }
      });

      res.json(product);
    } catch (error) {
      console.error('❌ PUT product error:', error.message);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/retromerch/products/:id - Supprimer un produit
   */
  router.delete('/products/:id', requireAuth, async (req, res) => {
    try {
      await prisma.retromerch_products.delete({
        where: { id: req.params.id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('❌ DELETE product error:', error.message);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // CATÉGORIES
  // ============================================================================

  /**
   * GET /api/retromerch/categories - Récupérer toutes les catégories
   */
  router.get('/categories', optionalAuth, async (req, res) => {
    try {
      const categories = await prisma.retromerch_categories.findMany({
        orderBy: { name: 'asc' }
      });

      res.json(categories);
    } catch (error) {
      console.error('❌ GET categories error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/retromerch/categories - Créer une nouvelle catégorie
   */
  router.post('/categories', requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const category = await prisma.retromerch_categories.create({
        data: {
          name,
          description: description || ''
        }
      });

      res.status(201).json(category);
    } catch (error) {
      console.error('❌ POST category error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // COMMANDES
  // ============================================================================

  /**
   * GET /api/retromerch/orders - Récupérer toutes les commandes
   */
  router.get('/orders', optionalAuth, async (req, res) => {
    try {
      const orders = await prisma.retromerch_orders.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json(orders);
    } catch (error) {
      console.error('❌ GET orders error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/retromerch/orders/:id - Récupérer une commande spécifique
   */
  router.get('/orders/:id', optionalAuth, async (req, res) => {
    try {
      const order = await prisma.retromerch_orders.findUnique({
        where: { id: req.params.id }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      console.error('❌ GET order error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/retromerch/orders - Créer une nouvelle commande
   */
  router.post('/orders', async (req, res) => {
    try {
      const { customerName, customerEmail, customerPhone, shippingAddress, items, totalAmount, notes } = req.body;

      if (!customerName || !items || items.length === 0) {
        return res.status(400).json({ error: 'Customer name and items are required' });
      }

      const order = await prisma.retromerch_orders.create({
        data: {
          customerName,
          customerEmail: customerEmail || '',
          customerPhone: customerPhone || '',
          shippingAddress: shippingAddress || '',
          totalAmount: parseFloat(totalAmount) || 0,
          status: 'PENDING',
          notes: notes || '',
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseInt(item.quantity) || 1,
              unitPrice: parseFloat(item.unitPrice) || 0
            }))
          }
        }
      });

      res.status(201).json(order);
    } catch (error) {
      console.error('❌ POST order error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/retromerch/orders/:id/status - Mettre à jour le statut
   */
  router.put('/orders/:id/status', requireAuth, async (req, res) => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const order = await prisma.retromerch_orders.update({
        where: { id: req.params.id },
        data: { status }
      });

      res.json(order);
    } catch (error) {
      console.error('❌ PUT order status error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/retromerch/orders/:id - Mettre à jour une commande
   */
  router.put('/orders/:id', requireAuth, async (req, res) => {
    try {
      const { customerName, customerEmail, customerPhone, shippingAddress, notes, status } = req.body;

      const order = await prisma.retromerch_orders.update({
        where: { id: req.params.id },
        data: {
          ...(customerName && { customerName }),
          ...(customerEmail !== undefined && { customerEmail }),
          ...(customerPhone !== undefined && { customerPhone }),
          ...(shippingAddress !== undefined && { shippingAddress }),
          ...(notes !== undefined && { notes }),
          ...(status && { status })
        }
      });

      res.json(order);
    } catch (error) {
      console.error('❌ PUT order error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/retromerch/orders/:id - Supprimer une commande
   */
  router.delete('/orders/:id', requireAuth, async (req, res) => {
    try {
      await prisma.retromerch_order_items.deleteMany({
        where: { orderId: req.params.id }
      });

      await prisma.retromerch_orders.delete({
        where: { id: req.params.id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('❌ DELETE order error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // STATISTIQUES
  // ============================================================================

  /**
   * GET /api/retromerch/stats - Récupérer les statistiques
   */
  router.get('/stats', optionalAuth, async (req, res) => {
    try {
      const productCount = await prisma.retromerch_products.count();
      const categoryCount = await prisma.retromerch_categories.count();
      const orderCount = await prisma.retromerch_orders.count();
      
      const totalRevenue = await prisma.retromerch_orders.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: 'CANCELLED' } }
      });

      res.json({
        totalProducts: productCount,
        totalCategories: categoryCount,
        totalOrders: orderCount,
        totalRevenue: totalRevenue._sum.totalAmount || 0
      });
    } catch (error) {
      console.error('❌ GET stats error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
