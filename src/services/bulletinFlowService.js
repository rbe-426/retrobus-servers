/**
 * Service de gestion du parcours numérique de signature de bulletin
 * Gère les liens privés, tokens, et le workflow de signature
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let storageReady = false;

// Durée de validité : 7 jours
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const buildDefaultSteps = () => ({
  welcome: false,
  verification: false,
  additional_info: false,
  signature: false,
  confirmation: false
});

const ensureStorageSchema = async () => {
  if (storageReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BulletinFlowToken" (
      "token" VARCHAR(128) PRIMARY KEY,
      "memberData" JSONB NOT NULL,
      "steps" JSONB NOT NULL,
      "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
      "signatureData" TEXT NULL,
      "signedAt" TIMESTAMP(3) NULL,
      "ipAddress" VARCHAR(255) NULL,
      "userAgent" TEXT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BulletinFlowToken_status_idx" ON "BulletinFlowToken" ("status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BulletinFlowToken_expiresAt_idx" ON "BulletinFlowToken" ("expiresAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BulletinFlowToken_createdAt_idx" ON "BulletinFlowToken" ("createdAt");`);

  storageReady = true;
};

const normalizeTokenRecord = async (record) => {
  if (!record) return null;

  const now = new Date();
  if (record.expiresAt < now) {
    if (record.status !== 'expired') {
      await prisma.bulletinFlowToken.update({
        where: { token: record.token },
        data: { status: 'expired' }
      }).catch(() => {});
    }
    return null;
  }

  return {
    token: record.token,
    memberData: record.memberData || {},
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    status: record.status,
    signatureData: record.signatureData,
    signedAt: record.signedAt ? record.signedAt.toISOString() : null,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    steps: record.steps || buildDefaultSteps()
  };
};

/**
 * Génère un token unique pour le parcours de signature
 */
export const generateSignatureToken = async (memberData) => {
  await ensureStorageSchema();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MS);

  await prisma.bulletinFlowToken.create({
    data: {
      token,
      memberData,
      createdAt: now,
      expiresAt,
      status: 'pending',
      steps: buildDefaultSteps()
    }
  });

  console.log(`✅ Signature token generated: ${token.substring(0, 8)}... (expires in 7 days)`);
  return token;
};

/**
 * Récupère les données associées à un token
 */
export const getTokenData = async (token) => {
  await ensureStorageSchema();
  const record = await prisma.bulletinFlowToken.findUnique({
    where: { token }
  });

  if (!record) {
    console.log(`❌ Token not found: ${token.substring(0, 8)}...`);
    return null;
  }

  const normalized = await normalizeTokenRecord(record);
  if (!normalized) {
    console.log(`❌ Token expired: ${token.substring(0, 8)}...`);
  }

  return normalized;
};

/**
 * Met à jour le statut d'une étape du parcours
 */
export const updateStepStatus = async (token, step, completed = true) => {
  await ensureStorageSchema();
  const data = await getTokenData(token);

  if (!data || data.status === 'expired') {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(data.steps, step)) {
    return false;
  }

  const updatedSteps = {
    ...data.steps,
    [step]: completed
  };

  const isFinalStep = step === 'confirmation';
  const nextStatus = completed && !isFinalStep && data.status === 'pending'
    ? 'in_progress'
    : data.status;

  await prisma.bulletinFlowToken.update({
    where: { token },
    data: {
      steps: updatedSteps,
      status: nextStatus
    }
  });

  console.log(`✅ Step updated: ${step} = ${completed}`);
  return true;
};

/**
 * Met a jour les informations membre stockees dans le token
 */
export const updateMemberData = async (token, memberDataPatch = {}) => {
  await ensureStorageSchema();
  const data = await getTokenData(token);

  if (!data || data.status === 'expired') {
    return false;
  }

  if (!memberDataPatch || typeof memberDataPatch !== 'object') {
    return false;
  }

  const mergedMemberData = {
    ...data.memberData,
    ...memberDataPatch
  };

  const updatedSteps = {
    ...data.steps,
    additional_info: true
  };

  await prisma.bulletinFlowToken.update({
    where: { token },
    data: {
      memberData: mergedMemberData,
      steps: updatedSteps,
      status: data.status === 'pending' ? 'in_progress' : data.status
    }
  });

  return mergedMemberData;
};

/**
 * Enregistre la signature de l'adhérent
 */
export const saveSignature = async (token, signatureDataUrl, metadata = {}) => {
  await ensureStorageSchema();
  const data = await getTokenData(token);

  if (!data || data.status === 'expired') {
    return false;
  }

  const updatedSteps = {
    ...data.steps,
    signature: true,
    confirmation: true
  };

  await prisma.bulletinFlowToken.update({
    where: { token },
    data: {
      signatureData: signatureDataUrl,
      signedAt: new Date(),
      status: 'signed',
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      steps: updatedSteps
    }
  });

  console.log(`✅ Signature saved for token: ${token.substring(0, 8)}...`);
  return true;
};

export const generateSignatureLink = (token, baseUrl = 'https://association-rbe.fr') => {
  return `${baseUrl}/bulletin/sign/${token}`;
};

export const generateSMSMessage = (token, firstName, baseUrl = 'https://association-rbe.fr') => {
  const link = generateSignatureLink(token, baseUrl);
  return `Bonjour ${firstName},\n\nVotre bulletin d'adhésion RETROBUS ESSONNE est prêt.\nSignez-le en ligne ici (lien sécurisé valide 7 jours) :\n${link}\n\nMerci !`;
};

export const generateSignatureEmail = (token, memberData, baseUrl = 'https://association-rbe.fr') => {
  const link = generateSignatureLink(token, baseUrl);
  const firstName = memberData.firstName || 'Adhérent';

  return {
    subject: '✍️ Signature de votre bulletin d\'adhésion - RETROBUS ESSONNE',
    text: `Bonjour ${firstName},\n\nVotre bulletin d'adhésion est prêt à être signé !\n\nCliquez sur le lien ci-dessous :\n${link}\n\nLien valide 7 jours.`,
    html: `
      <p>Bonjour <strong>${firstName}</strong>,</p>
      <p>Votre bulletin d'adhésion est prêt à être signé.</p>
      <p><a href="${link}">Signer mon bulletin</a></p>
      <p>Lien direct: ${link}</p>
      <p>Ce lien est valide 7 jours.</p>
    `
  };
};

/**
 * Nettoie les tokens expirés
 */
export const cleanupExpiredTokens = async () => {
  await ensureStorageSchema();
  const now = new Date();

  const expired = await prisma.bulletinFlowToken.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { not: 'expired' }
    },
    data: { status: 'expired' }
  });

  const oldLimit = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const deleted = await prisma.bulletinFlowToken.deleteMany({
    where: {
      expiresAt: { lt: oldLimit }
    }
  });

  const cleaned = (expired.count || 0) + (deleted.count || 0);
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired signature tokens`);
  }

  return cleaned;
};

/**
 * Statistiques des parcours de signature
 */
export const getSignatureStats = async () => {
  await ensureStorageSchema();
  const now = new Date();
  const all = await prisma.bulletinFlowToken.findMany({
    select: {
      status: true,
      expiresAt: true
    }
  });

  const stats = {
    total: all.length,
    pending: 0,
    in_progress: 0,
    signed: 0,
    expired: 0
  };

  for (const row of all) {
    if (row.expiresAt < now || row.status === 'expired') {
      stats.expired++;
    } else if (row.status === 'pending') {
      stats.pending++;
    } else if (row.status === 'in_progress') {
      stats.in_progress++;
    } else if (row.status === 'signed') {
      stats.signed++;
    }
  }

  return stats;
};
