-- Template email "mailback password"
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
  'cuid_mailback_password_001',
  'mailback password',
  '🔑 Vos identifiants de connexion - RETROBUS ESSONNE',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d30c4c 0%, #a00838 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e2e8f0; }
    .credentials { background: #f7fafc; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #d30c4c; }
    .credential-item { margin: 15px 0; }
    .label { color: #718096; font-size: 14px; margin-bottom: 5px; }
    .value { font-family: monospace; font-size: 16px; font-weight: bold; color: #2d3748; background: white; padding: 10px; border-radius: 4px; }
    .warning { background: #fff5f5; border: 1px solid #fc8181; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .warning-icon { color: #e53e3e; font-size: 20px; }
    .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #d30c4c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Identifiants de connexion</h1>
      <p>RETROBUS ESSONNE</p>
    </div>
    <div class="content">
      <p>Bonjour <strong>{{firstName}} {{lastName}}</strong>,</p>
      
      <p>Voici vos identifiants de connexion à la plateforme RETROBUS ESSONNE :</p>
      
      <div class="credentials">
        <div class="credential-item">
          <div class="label">Votre identifiant :</div>
          <div class="value">{{urbex_id}}</div>
        </div>
        <div class="credential-item">
          <div class="label">Votre mot de passe :</div>
          <div class="value">{{temporar_mdp}}</div>
        </div>
      </div>
      
      <div class="warning">
        <p style="margin: 0;"><span class="warning-icon">⚠️</span> <strong>Important : Mot de passe temporaire</strong></p>
        <p style="margin: 10px 0 0 0;">Vous devrez <strong>obligatoirement changer ce mot de passe</strong> lors de votre première connexion pour des raisons de sécurité.</p>
      </div>
      
      <p style="text-align: center;">
        <a href="https://interne.association-rbe.fr" class="button">🔐 Se connecter</a>
      </p>
      
      <p style="color: #718096; font-size: 14px; margin-top: 30px;">
        Si vous n''avez pas demandé ce mot de passe, veuillez contacter immédiatement un administrateur.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>RETROBUS ESSONNE</strong></p>
      <p>Association de préservation du patrimoine routier</p>
      <p style="margin-top: 10px;">
        📧 <a href="mailto:contact@association-rbe.fr" style="color: #d30c4c;">contact@association-rbe.fr</a>
      </p>
    </div>
  </div>
</body>
</html>',
  'Template pour l''envoi des identifiants de connexion avec mot de passe temporaire',
  '{{firstName}}, {{lastName}}, {{urbex_id}}, {{temporar_mdp}}',
  'SYSTEM',
  true,
  NOW(),
  NOW()
);
