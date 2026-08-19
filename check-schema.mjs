import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Try to create a test document to see what error we get
  const testDoc = await prisma.financial_documents.create({
    data: {
      id: 'test-' + Date.now(),
      type: 'QUOTE',
      number: 'TEST-001',
      title: 'Test Document',
      amount: 100,
      createdBy: 'test@example.com',
      updatedAt: new Date(),
      // Include all new fields
      destinataireName: 'Test Client',
      destinataireAdresse: '123 Test Street',
      destinataireSociete: 'Test Corp',
      destinataireContacts: 'test@example.com',
      paymentTerms: '30'
    }
  });
  
  console.log('✅ Test document created successfully!');
  console.log('Document ID:', testDoc.id);
  console.log('Type:', testDoc.type);
  console.log('Destinataire:', testDoc.destinataireName);
  
  // Clean up
  await prisma.financial_documents.delete({ where: { id: testDoc.id } });
  console.log('✅ Test document deleted');
  
} catch (e) {
  console.error('❌ Error:', e.message);
  console.error('Code:', e.code);
} finally {
  await prisma.$disconnect();
}
