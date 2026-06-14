/**
 * Script pour nettoyer les URLs d'images invalides dans la table TeamMember
 * Remplace les chemins locaux inexistants par des placeholders valides
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixTeamImages() {
  console.log('🔍 Vérification des images des membres...\n');

  try {
    const members = await prisma.teamMember.findMany();
    let fixedCount = 0;

    for (const member of members) {
      let needsUpdate = false;
      let newImageUrl = member.image;

      if (!member.image) {
        console.log(`⚠️  ${member.name}: Pas d'image définie`);
        continue;
      }

      // Vérifier si c'est un chemin local
      if (member.image.startsWith('/assets/') || member.image.startsWith('./')) {
        const localPath = path.join(__dirname, '../..', member.image);
        
        if (!fs.existsSync(localPath)) {
          console.log(`❌ ${member.name}: Image locale introuvable ${member.image}`);
          // Générer un placeholder avec initiales
          const initials = member.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();
          newImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=300&background=random`;
          needsUpdate = true;
        }
      }
      // Vérifier si c'est un chemin relatif uploads sans URL complète
      else if (member.image.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '..', member.image);
        
        if (!fs.existsSync(localPath)) {
          console.log(`❌ ${member.name}: Fichier uploadé introuvable ${member.image}`);
          const initials = member.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();
          newImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=300&background=random`;
          needsUpdate = true;
        } else {
          console.log(`✅ ${member.name}: Fichier uploadé existe ${member.image}`);
        }
      }
      // Vérifier les URLs externes (via.placeholder.com est OK)
      else if (member.image.startsWith('http')) {
        console.log(`🌐 ${member.name}: URL externe ${member.image}`);
      }

      // Mettre à jour si nécessaire
      if (needsUpdate) {
        await prisma.teamMember.update({
          where: { id: member.id },
          data: { image: newImageUrl }
        });
        console.log(`   ↳ 🔧 Remplacé par: ${newImageUrl}\n`);
        fixedCount++;
      }
    }

    console.log(`\n✅ Traitement terminé: ${fixedCount} image(s) corrigée(s)`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTeamImages();
