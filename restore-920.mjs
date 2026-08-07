import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const caracteristiques = JSON.stringify([
  {"label":"Numéros de flotte","value":"592 / 720 / X / 920"},
  {"label":"Constructeur","value":"Mercedes-Benz"},
  {"label":"Modèle","value":"Citaro ♿"},
  {"label":"Immatriculation","value":"FG-920-RE"},
  {"label":"Mise en circulation","value":"juillet 2001"},
  {"label":"Longueur","value":"11,95 m"},
  {"label":"Places assises","value":"32"},
  {"label":"Places debout","value":"64"},
  {"label":"UFR","value":"1"},
  {"label":"Statut","value":"Préservé"},
  {"label":"Préservé par","value":"Association RétroBus Essonne"},
  {"label":"Énergie","value":"Diesel"},
  {"label":"Norme Euro","value":"Euro II"},
  {"label":"Moteur","value":"Mercedes-Benz OM906hLA - 279 ch"},
  {"label":"Boîte de vitesses","value":"Automatique ZF5HP-502C"},
  {"label":"Nombre de portes","value":"2"},
  {"label":"Livrée","value":"Grise"},
  {"label":"Girouette","value":"Duhamel LED Oranges + Pastilles Vertes"},
  {"label":"Climatisation","value":"Complète"}
]);

(async () => {
  try {
    const updated = await prisma.vehicle.update({
      where: { parc: '920' },
      data: { caracteristiques }
    });
    console.log('✅ Caractéristiques restaurées pour', updated.parc);
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();
