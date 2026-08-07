-- Template email "parcours bulletin"
-- À exécuter dans Prisma Studio ou via une migration

INSERT INTO "EmailTemplate" (
  id,
  name,
  subject,
  body,
  description,
  variables,
  category,
  active,
  "createdAt",
  "updatedAt"
) VALUES (
  'cuid_parcours_bulletin_001',
  'parcours bulletin',
  '✍️ Signature de votre bulletin d''adhésion - RETROBUS ESSONNE',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d30c4c 0%, #a00838 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #d30c4c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .steps { background: #f7fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .step { display: flex; align-items: center; margin: 10px 0; }
    .step-number { background: #d30c4c; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; }
    .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✍️ Signature de bulletin d''adhésion</h1>
      <p>RETROBUS ESSONNE</p>
    </div>
    <div class="content">
      <p>Bonjour <strong>{{firstName}}</strong>,</p>
      
      <p>Votre bulletin d''adhésion est prêt à être signé !</p>
      
      <p style="text-align: center;">
        <a href="{{lien bulletin}}" class="button">📝 Signer mon bulletin</a>
      </p>
      
      <p style="font-size: 12px; color: #718096;">
        Lien direct : <a href="{{lien bulletin}}">{{lien bulletin}}</a>
      </p>
      
      <div class="steps">
        <h3>📋 Le processus en 4 étapes :</h3>
        <div class="step">
          <div class="step-number">1</div>
          <div>Vérifiez vos informations pré-remplies</div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div>Complétez les informations manquantes (si besoin)</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div>Signez électroniquement avec votre doigt ou souris</div>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <div>Validez : votre bulletin est généré automatiquement !</div>
        </div>
      </div>
      
      <p style="background: #fff5f5; border-left: 4px solid #fc8181; padding: 15px; border-radius: 4px;">
        <strong>🔒 Sécurité :</strong> Ce lien est personnel et sécurisé. Il est valide pendant <strong>7 jours</strong>.
      </p>
      
      <p>À bientôt,<br>L''équipe RETROBUS ESSONNE</p>
    </div>
    <div class="footer">
      <p>RETROBUS ESSONNE - Association loi 1901</p>
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>',
  'Template pour le parcours de signature numérique du bulletin d''adhésion',
  'firstName, lien bulletin',
  'ADHERENT',
  true,
  NOW(),
  NOW()
);
