import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmail() {
  const m = await prisma.members.findFirst({
    where: {
      OR: [
        { email: { contains: 'bayoudh' } },
        { matricule: { contains: 'bayoudh' } }
      ]
    }
  });
  
  console.log('='.repeat(60));
  console.log('Informations compte mail:');
  console.log('Email dans la DB:', m?.email);
  console.log('Matricule:', m?.matricule);
  console.log('='.repeat(60));
  console.log('\nPour te connecter à Retromail:');
  console.log('Email à utiliser: bayoudhnour06@association-rbe.fr');
  console.log('OU: n.bayoudh@association-rbe.fr');
  console.log('Mot de passe: mi2.Konate20012007');
  console.log('\nCes identifiants doivent être configurés dans Infomaniak.');
  
  await prisma.$disconnect();
}

checkEmail();
