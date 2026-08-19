-- Email Templates for RétroBus Essonne
-- Insert default templates for common notifications

-- 1. Expense Report Submitted
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-expense-report-001',
  'expense_report_submitted',
  'Confirmation de votre note de frais - {{expense.id}}',
  '# Bonjour {{member.firstName}} !

Nous avons bien reçu votre note de frais.

## Détails de la demande

- **Montant** : {{expense.amount}}
- **Description** : {{expense.description}}
- **Date** : {{expense.date}}
- **Statut** : {{expense.status}}

Votre demande est en cours de traitement par notre équipe de trésorerie. Vous recevrez une notification dès que votre note de frais sera validée.

**Prochaines étapes**
- Vérification des justificatifs
- Validation par le trésorier
- Remboursement sous 15 jours ouvrés

---

Merci de votre patience et de votre engagement au sein de RétroBus Essonne !',
  'Email de confirmation envoyé automatiquement après la soumission d''une note de frais',
  'member.name, member.firstName, expense.id, expense.amount, expense.description, expense.date, expense.status, actionLink, actionText',
  'FINANCE',
  true,
  NOW(),
  NOW()
);

-- 2. Vehicle Reservation Confirmed
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-vehicle-reserv-001',
  'vehicle_reservation_confirmed',
  'Réservation confirmée - {{vehicle.name}}',
  '# Bonjour {{member.name}} !

Votre réservation de véhicule est confirmée ! 🚌

## Détails de la réservation

- **Véhicule** : {{vehicle.name}}
- **Immatriculation** : {{vehicle.plate}}
- **Date** : {{reservation.date}}
- **Horaires** : de {{reservation.startTime}} à {{reservation.endTime}}

**Rappel important**
- Vérifiez le niveau de carburant avant le départ
- Respectez les horaires de restitution
- Signalez tout incident immédiatement

---

Bonne route avec nos véhicules de collection !',
  'Email de confirmation de réservation de véhicule',
  'member.name, vehicle.name, vehicle.plate, reservation.date, reservation.startTime, reservation.endTime, actionLink, actionText',
  'VEHICLES',
  true,
  NOW(),
  NOW()
);

-- 3. Event Invitation
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-event-invite-001',
  'event_invitation',
  'Invitation - {{event.name}}',
  '# Bonjour {{member.name}} !

Vous êtes invité(e) à notre prochain événement ! 📅

## {{event.name}}

- **Date** : {{event.date}}
- **Lieu** : {{event.location}}

{{event.description}}

**Informations pratiques**
- Inscription obligatoire
- Places limitées
- N''oubliez pas votre carte adhérent

Nous avons hâte de vous retrouver pour ce moment de partage autour de notre passion commune !

---

L''équipe RétroBus Essonne',
  'Email d''invitation à un événement',
  'member.name, event.name, event.date, event.location, event.description, actionLink, actionText',
  'EVENTS',
  true,
  NOW(),
  NOW()
);

-- 4. Membership Renewal Reminder
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-membership-renew-001',
  'membership_renewal_reminder',
  'Renouvellement de votre adhésion',
  '# Bonjour {{member.name}} !

Il est temps de renouveler votre adhésion à RétroBus Essonne ! 🎫

## Votre adhésion

- **Numéro adhérent** : {{member.number}}
- **Type d''adhésion** : {{member.type}}
- **Date d''expiration** : {{membership.expiry}}

**Pourquoi renouveler ?**
- Continuez à participer à nos événements
- Soutenez la préservation du patrimoine routier
- Accédez aux avantages membres

Le renouvellement est simple et rapide en ligne !

---

Merci de votre fidélité et de votre soutien !',
  'Rappel de renouvellement d''adhésion',
  'member.name, member.number, member.type, membership.expiry, actionLink, actionText',
  'MEMBERSHIP',
  true,
  NOW(),
  NOW()
);

-- 5. Welcome New Member
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-welcome-member-001',
  'member_welcome',
  'Bienvenue à RétroBus Essonne ! 🎉',
  '# Bienvenue {{member.firstName}} !

Nous sommes ravis de vous accueillir au sein de RétroBus Essonne ! 🚌

Votre adhésion a été validée avec succès.

## Votre profil adhérent

- **Nom** : {{member.name}}
- **Numéro adhérent** : {{member.number}}

**Découvrez votre espace personnel**
- Consultez les événements à venir
- Réservez nos véhicules de collection
- Accédez aux actualités de l''association
- Gérez vos informations personnelles

**Prochaines étapes**
1. Connectez-vous à votre espace
2. Complétez votre profil
3. Rejoignez-nous aux prochains événements !

**Besoin d''aide ?**
Notre équipe est à votre disposition pour toute question.

---

Encore bienvenue dans la famille RétroBus !',
  'Email de bienvenue pour les nouveaux adhérents',
  'member.name, member.firstName, member.number, actionLink, actionText',
  'WELCOME',
  true,
  NOW(),
  NOW()
);

-- 6. Ticket Created Notification
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-ticket-created-001',
  'ticket_created',
  'Votre demande a été enregistrée - #{{ticket.id}}',
  '# Bonjour {{creator.name}} !

Votre demande d''assistance a bien été enregistrée.

## Ticket #{{ticket.id}}

- **Titre** : {{ticket.title}}
- **Statut** : {{ticket.status}}
- **Priorité** : {{ticket.priority}}

Notre équipe technique va traiter votre demande dans les plus brefs délais.

**Temps de réponse estimé**
- Priorité haute : 24h
- Priorité normale : 48-72h
- Priorité basse : 1 semaine

Vous recevrez une notification dès qu''une réponse sera apportée à votre demande.

---

Merci de votre confiance !',
  'Email de confirmation de création de ticket',
  'creator.name, ticket.id, ticket.title, ticket.status, ticket.priority, actionLink, actionText',
  'TICKETS',
  true,
  NOW(),
  NOW()
);

-- 7. Invoice Created
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-invoice-created-001',
  'invoice_created',
  'Votre facture {{invoice.number}} est disponible',
  '# Bonjour {{client.name}} !

Votre facture est maintenant disponible.

## Facture {{invoice.number}}

- **Montant** : {{invoice.amount}}
- **Date d''émission** : {{invoice.date}}
- **Date d''échéance** : {{invoice.dueDate}}

**Modalités de paiement**
- Virement bancaire
- Chèque à l''ordre de RétroBus Essonne
- Espèces (au local)

Merci de procéder au règlement avant la date d''échéance.

---

Pour toute question, n''hésitez pas à nous contacter.',
  'Email de notification de facture créée',
  'client.name, invoice.number, invoice.amount, invoice.date, invoice.dueDate, actionLink, actionText',
  'FINANCE',
  true,
  NOW(),
  NOW()
);

-- 8. System Alert
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-system-alert-001',
  'system_alert',
  'Alerte système - {{admin.message}}',
  '# Alerte système

{{admin.message}}

## Statut du système

{{system.status}}

**Action requise**

{{action.required}}

---

Cet email est envoyé automatiquement par le système.',
  'Email d''alerte système pour les administrateurs',
  'admin.message, system.status, action.required, link',
  'ADMIN',
  true,
  NOW(),
  NOW()
);

-- 9. Contact Form Notification (to association)
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-contact-notif-001',
  'contact_form_notification',
  '[Formulaire Contact] {{subject}}',
  '# Nouveau message de contact

Vous avez reçu un nouveau message via le formulaire de contact du site web.

## Informations de l''expéditeur

- **Nom** : {{sender.name}}
- **Email** : {{sender.email}}
- **Date** : {{message.date}}

## Sujet

{{subject}}

## Message

{{message.content}}

---

**Informations techniques**
- IP : {{sender.ip}}
- User Agent : {{sender.userAgent}}

**Pour répondre** : Cliquez sur "Répondre" et votre réponse sera envoyée à {{sender.email}}',
  'Notification interne envoyée à l''association lors de la réception d''un message de contact',
  'sender.name, sender.email, subject, message.content, message.date, sender.ip, sender.userAgent',
  'CUSTOM',
  true,
  NOW(),
  NOW()
);

-- 10. Contact Form Confirmation (to sender - mailback)
INSERT INTO "EmailTemplate" (id, name, subject, body, description, variables, category, active, "createdAt", "updatedAt")
VALUES (
  'clxxx-contact-confirm-001',
  'mailback_formulaire',
  'Confirmation de votre message - RétroBus Essonne',
  '# Merci pour votre message !

Bonjour {{sender.name}},

Nous avons bien reçu votre message du **{{message.date}}**.

L''association RétroBus Essonne vous répondra dans les plus brefs délais (généralement sous 48h).

## Récapitulatif de votre message

**Sujet** : {{subject}}

{{message.content}}

---

## Nos coordonnées

📧 Email : association.rbe@gmail.com
🌐 Site web : https://association-rbe.fr
📍 Adresse : [Adresse de l''association]

**Suivez-nous !**
- Facebook : [Lien Facebook]
- Instagram : [Lien Instagram]

---

Cordialement,
**L''équipe RétroBus Essonne**
_Passionnés de véhicules de collection depuis [année]_',
  'Email de confirmation automatique envoyé à l''expéditeur du formulaire de contact',
  'sender.name, subject, message.content, message.date',
  'CUSTOM',
  true,
  NOW(),
  NOW()
);
