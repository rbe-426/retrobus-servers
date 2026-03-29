import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Generate a temporary password and hash it
function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  for (let i = 0; i < 4; i++) password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  return password;
}

function hashPasswordForStorage(password) {
  const iterations = 100000;
  const salt = crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  return `${hash.toString('hex')}:${salt.toString('hex')}:${iterations}`;
}

async function createAndLinkBelaidiAccess() {
  try {
    console.log('🔗 Creating and linking w.belaidi access...\n');
    
    // Find waiyl belaidi member
    const member = await prisma.members.findFirst({
      where: {
        matricule: 'w.belaidi'
      }
    });
    
    if (!member) {
      console.error('❌ Member with matricule w.belaidi not found');
      return;
    }
    
    console.log(`✅ Found member: ${member.firstName} ${member.lastName}`);
    console.log(`   ID: ${member.id}`);
    console.log(`   Email: ${member.email}`);
    console.log(`   Role: ${member.role}`);
    
    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = hashPasswordForStorage(tempPassword);
    
    // Create the site_users access
    const newAccess = await prisma.site_users.create({
      data: {
        id: randomUUID(),
        username: 'w.belaidi',
        email: member.email,
        firstName: member.firstName || 'Waiyl',
        lastName: member.lastName || 'BELAIDI',
        password: hashedPassword,
        hasInternalAccess: true,
        hasExternalAccess: false,
        role: member.role || 'ADMIN',
        linkedMemberId: member.id,  // Link to the member
        mustChangePassword: true,  // Flag to change password at first login
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`\n✅ Created access: ${newAccess.username}`);
    console.log(`   ID: ${newAccess.id}`);
    console.log(`   Linked to member: ${newAccess.linkedMemberId}`);
    console.log(`   Temporary password: ${tempPassword}`);
    
    // Update member flag
    await prisma.members.update({
      where: { id: member.id },
      data: { hasLinkedAccess: true }
    });
    
    console.log(`\n✅ Updated member hasLinkedAccess = true`);
    console.log('\n✅✅ DONE! w.belaidi access created and linked to Waiyl BELAIDI member');
    console.log(`\n📝 Share this temporary password with the user: ${tempPassword}`);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ Error: w.belaidi access already exists');
      console.log('\nTrying to link existing access instead...');
      
      // Try to find and link existing access
      const existingAccess = await prisma.site_users.findUnique({
        where: { username: 'w.belaidi' }
      });
      
      if (existingAccess) {
        const member = await prisma.members.findFirst({
          where: { matricule: 'w.belaidi' }
        });
        
        if (member) {
          await prisma.site_users.update({
            where: { id: existingAccess.id },
            data: { linkedMemberId: member.id }
          });
          
          await prisma.members.update({
            where: { id: member.id },
            data: { hasLinkedAccess: true }
          });
          
          console.log('✅ Linked existing w.belaidi access to member');
        }
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAndLinkBelaidiAccess();
