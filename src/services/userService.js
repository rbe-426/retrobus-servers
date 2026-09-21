/**
 * User Service - Logique métier pour les utilisateurs/membres
 * Centralise toutes les requêtes Prisma et la logique concernant les utilisateurs
 */

import { PrismaClient } from '@prisma/client';
import { verifyPassword, hashPasswordForStorage } from '../lib/passwordUtils.js';
import { auditLog } from '../security.js';

const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Trouve un utilisateur par email ou matricule
 */
export const findUserByIdentifier = async (identifier) => {
  try {
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { matricule: identifier },
          { email: identifier },
          { email: { startsWith: identifier } }
        ]
      }
    });
    return member;
  } catch (error) {
    console.error('❌ Error finding user:', error.message);
    throw error;
  }
};

/**
 * Authentifie un utilisateur avec email et mot de passe
 */
export const authenticateUser = async (email, password) => {
  try {
    const siteUser = await prisma.site_users.findFirst({
      where: {
        OR: [
          { email: { equals: String(email).trim(), mode: 'insensitive' } },
          { username: { equals: String(email).trim(), mode: 'insensitive' } }
        ]
      },
      include: { members: true }
    });

    if (siteUser) {
      if (!siteUser.isActive) {
        auditLog('MEMBER_LOGIN_DISABLED_SITE_ACCESS', email, { siteUserId: siteUser.id }, 'failed');
        return null;
      }

      const passwordValid = siteUser.password?.includes(':')
        ? verifyPassword(password, siteUser.password)
        : password === siteUser.password;
      if (!passwordValid) {
        auditLog('MEMBER_LOGIN_INVALID_PASSWORD', email, { siteUserId: siteUser.id }, 'failed');
        return null;
      }

      const linkedMember = siteUser.members;
      if (linkedMember && linkedMember.status && linkedMember.status !== 'active') {
        auditLog('MEMBER_LOGIN_DISABLED_ACCOUNT', email, { status: linkedMember.status }, 'failed');
        return null;
      }

      // Independent access accounts are valid even when they are not attached to a member.
      return linkedMember || {
        id: siteUser.id,
        email: siteUser.email,
        firstName: siteUser.firstName,
        lastName: siteUser.lastName,
        matricule: siteUser.username,
        role: siteUser.role,
        permissions: [],
        mustChangePassword: siteUser.mustChangePassword,
        isPasswordTemporary: siteUser.mustChangePassword,
        status: 'active'
      };
    }

    const member = await findUserByIdentifier(email);
    if (!member) {
      auditLog('MEMBER_LOGIN_NOT_FOUND', email, { path: 'userService' }, 'failed');
      return null;
    }

    const storedPassword = member.password;
    let passwordValid = false;
    if (storedPassword?.includes(':')) {
      // Format haché: hash:salt:iterations
      passwordValid = verifyPassword(password, storedPassword);
    } else {
      // Format plaintext (legacy)
      passwordValid = (password === storedPassword);
    }

    if (!passwordValid) {
      auditLog('MEMBER_LOGIN_INVALID_PASSWORD', email, { memberId: member.id }, 'failed');
      return null;
    }

    // Vérifier que le compte est actif
    if (member.status && member.status !== 'active') {
      auditLog('MEMBER_LOGIN_DISABLED_ACCOUNT', email, { status: member.status }, 'failed');
      return null;
    }

    return member;
  } catch (error) {
    console.error('❌ Error authenticating user:', error.message);
    throw error;
  }
};

/**
 * Met à jour le dernier login et le statut
 */
export const updateLastLogin = async (userId) => {
  try {
    await prisma.members.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        status: 'active'
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not update lastLoginAt:', error.message);
    // Non-blocking
  }
};

/**
 * Obtient le rôle de l'utilisateur
 */
export const getUserRole = async (memberId) => {
  try {
    // D'abord essayer Prisma
    const member = await prisma.members.findUnique({
      where: { id: memberId }
    });
    
    if (member?.role) return member.role;
    
    // Fallback: chercher dans site_users
    // (nécessite accès à state, sera passé en paramètre par l'appelant)
    return 'MEMBER';
  } catch (error) {
    console.error('❌ Error getting user role:', error.message);
    return 'MEMBER';
  }
};

/**
 * Change le mot de passe d'un utilisateur
 */
export const changePassword = async (userId, newPassword) => {
  try {
    const hashedPassword = hashPasswordForStorage(newPassword);
    
    await prisma.members.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        isPasswordTemporary: false
      }
    });

    await prisma.site_users.updateMany({
      where: { linkedMemberId: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date()
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error changing password:', error.message);
    throw error;
  }
};

export default {
  findUserByIdentifier,
  authenticateUser,
  updateLastLogin,
  getUserRole,
  changePassword
};
