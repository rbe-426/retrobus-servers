/**
 * Routes RétroMerch - Gestion de la boutique en ligne
 * GET    /api/retromerch/products          - Liste des produits
 * POST   /api/retromerch/products          - Créer un produit
 * GET    /api/retromerch/products/:id      - Détail d'un produit
 * PUT    /api/retromerch/products/:id      - Mettre à jour un produit
 * DELETE /api/retromerch/products/:id      - Supprimer un produit
 * GET    /api/retromerch/categories        - Liste des catégories
 * POST   /api/retromerch/categories        - Créer une catégorie
 * GET    /api/retromerch/orders            - Liste des commandes
 * POST   /api/retromerch/orders            - Créer une commande
 * GET    /api/retromerch/orders/:id        - Détail d'une commande
 * PUT    /api/retromerch/orders/:id/status - Mettre à jour le statut
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware d'authentification basique
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============================================================================
// PRODUITS
// ============================================================================

/**
 * GET /api/retromerch/products - Récupérer tous les produits
 */
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.retromerch_products.findMany({
      include: {
        category: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('❌ GET products error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/retromerch/products/:id - Récupérer un produit spécifique
 */
router.get('/products/:id', async (req, res) => {
  try {
    const product = await prisma.retromerch_products.findUnique({
      where: { id: req.params.id },
      include: { category: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, data: product });
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
        active: active !== false,
        createdAt: new Date()
      },
      include: { category: true }
    });

    res.status(201).json({
      success: true,
      message: 'Product created',
      data: product
    });
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
        ...(active !== undefined && { active }),
        updatedAt: new Date()
      },
      include: { category: true }
    });

    res.json({
      success: true,
      message: 'Product updated',
      data: product
    });
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

    res.json({
      success: true,
      message: 'Product deleted'
    });
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
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.retromerch_categories.findMany({
      include: {
        products: {
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        ...cat,
        productCount: cat.products.length,
        products: undefined
      })),
      count: categories.length
    });
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
        description: description || '',
        createdAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Category created',
      data: category
    });
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
router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.retromerch_orders.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ GET orders error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/retromerch/orders/:id - Récupérer une commande spécifique
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.retromerch_orders.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, data: order });
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
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      totalAmount,
      notes
    } = req.body;

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
        createdAt: new Date(),
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: parseInt(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0
          }))
        }
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Order created',
      data: order
    });
  } catch (error) {
    console.error('❌ POST order error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/retromerch/orders/:id/status - Mettre à jour le statut d'une commande
 */
router.put('/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.retromerch_orders.update({
      where: { id: req.params.id },
      data: {
        status,
        updatedAt: new Date()
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    console.error('❌ PUT order status error:', error.message);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
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
        ...(status && { status }),
        updatedAt: new Date()
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order updated',
      data: order
    });
  } catch (error) {
    console.error('❌ PUT order error:', error.message);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/retromerch/orders/:id - Supprimer une commande
 */
router.delete('/orders/:id', requireAuth, async (req, res) => {
  try {
    // Supprimer d'abord les items
    await prisma.retromerch_order_items.deleteMany({
      where: { orderId: req.params.id }
    });

    // Puis la commande
    await prisma.retromerch_orders.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Order deleted'
    });
  } catch (error) {
    console.error('❌ DELETE order error:', error.message);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STATISTIQUES
// ============================================================================

/**
 * GET /api/retromerch/stats - Récupérer les statistiques
 */
router.get('/stats', async (req, res) => {
  try {
    const productCount = await prisma.retromerch_products.count();
    const categoryCount = await prisma.retromerch_categories.count();
    const orderCount = await prisma.retromerch_orders.count();
    
    const totalRevenue = await prisma.retromerch_orders.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' } }
    });

    const recentOrders = await prisma.retromerch_orders.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    res.json({
      success: true,
      data: {
        totalProducts: productCount,
        totalCategories: categoryCount,
        totalOrders: orderCount,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        recentOrders
      }
    });
  } catch (error) {
    console.error('❌ GET stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
