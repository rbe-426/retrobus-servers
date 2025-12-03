-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DRIVING_LICENSE', 'IDENTITY_CARD', 'INSURANCE_RECORD', 'MEMBERSHIP_FORM', 'MEDICAL_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'DRIVER', 'ADMIN', 'BUREAU');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('STANDARD', 'FAMILY', 'STUDENT', 'HONORARY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TICKET_CREATED', 'TICKET_UPDATED', 'EVENT_CREATED', 'EVENT_UPDATED', 'REPORT_CREATED', 'MAINTENANCE_ALERT', 'SYSTEM_MESSAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('DEVIS', 'FACTURE', 'BON_DE_COMMANDE', 'RAPPEL');

-- CreateEnum
CREATE TYPE "StockCategory" AS ENUM ('PIECES_DETACHEES', 'CONSOMMABLES', 'OUTILLAGE', 'EQUIPEMENT', 'DOCUMENTATION', 'MERCHANDISING', 'FOURNITURES', 'SECURITE', 'GENERAL');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED', 'RESERVED');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('PIECE', 'KG', 'LITRE', 'METRE', 'PAQUET', 'BOITE', 'ROULEAU', 'SET', 'AUTRE');

-- CreateTable
CREATE TABLE "Changelog" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Changelog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevisLine" (
    "id" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevisLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "expiryDate" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "description" TEXT,
    "helloAssoUrl" TEXT,
    "adultPrice" DOUBLE PRECISION,
    "childPrice" DOUBLE PRECISION,
    "vehicleId" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "layout" TEXT,
    "extras" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "participantEmail" TEXT NOT NULL,
    "adultTickets" INTEGER NOT NULL DEFAULT 1,
    "childTickets" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'helloasso',
    "helloAssoStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "helloAssoOrderId" TEXT,
    "qrCodeData" TEXT,
    "ticketSent" BOOLEAN NOT NULL DEFAULT false,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flash" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "showOnExternal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Flash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER,
    "successCount" INTEGER,
    "failureCount" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "htmlContent" TEXT NOT NULL,
    "logoSmall" TEXT,
    "logoBig" TEXT,
    "placeholders" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "parc" TEXT NOT NULL,
    "usageId" INTEGER,
    "description" TEXT,
    "filesMeta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroNews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "author" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showOnExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetroNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" SERIAL NOT NULL,
    "reference" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "StockCategory" NOT NULL DEFAULT 'GENERAL',
    "subcategory" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "unit" "StockUnit" NOT NULL DEFAULT 'PIECE',
    "location" TEXT,
    "supplier" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lastRestockDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "stockId" INTEGER NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" SERIAL NOT NULL,
    "parc" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "conducteur" TEXT,
    "participants" TEXT,
    "note" TEXT,
    "relatedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "parc" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "marque" TEXT,
    "subtitle" TEXT,
    "immat" TEXT,
    "etat" TEXT NOT NULL,
    "miseEnCirculation" TIMESTAMP(3),
    "energie" TEXT,
    "description" TEXT,
    "history" TEXT,
    "caracteristiques" TEXT,
    "gallery" TEXT,
    "backgroundImage" TEXT,
    "backgroundPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "fuel" DOUBLE PRECISION,
    "mileage" DOUBLE PRECISION,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "siteUserId" TEXT,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "performedBy" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_balance_history" (
    "id" TEXT NOT NULL,
    "oldBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_balances" (
    "id" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#999999',
    "type" TEXT NOT NULL DEFAULT 'BASIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_expense_reports" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "financeTransactionId" TEXT,
    "requestedByEmail" TEXT,
    "requestedByName" TEXT,
    "statusNotes" TEXT,

    CONSTRAINT "finance_expense_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_simulation_expense_items" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'AUTRE',
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_simulation_expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_simulation_income_items" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'AUTRE',
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_simulation_income_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_simulation_scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectionMonths" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_simulation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transaction_categories" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'QUOTE',
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountExcludingTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quoteStatus" TEXT,
    "invoiceStatus" TEXT,
    "eventId" TEXT,
    "memberId" TEXT,
    "replacedById" TEXT,
    "replaces" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "paymentMethod" TEXT,
    "paymentDate" TIMESTAMP(3),
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "htmlContent" TEXT,
    "retroRequestId" TEXT,
    "paymentHistory" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_logs" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_messages" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "birthDate" TIMESTAMP(3),
    "memberNumber" TEXT,
    "membershipType" TEXT NOT NULL DEFAULT 'STANDARD',
    "membershipStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "membershipStartDate" TIMESTAMP(3),
    "membershipEndDate" TIMESTAMP(3),
    "paymentAmount" DOUBLE PRECISION,
    "paymentMethod" TEXT,
    "hasLinkedAccess" BOOLEAN NOT NULL DEFAULT false,
    "newsletter" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "matricule" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNotifications" BOOLEAN NOT NULL DEFAULT true,
    "eventNotifications" BOOLEAN NOT NULL DEFAULT true,
    "reportNotifications" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceNotifications" BOOLEAN NOT NULL DEFAULT true,
    "systemNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_report_comments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_report_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "type" TEXT NOT NULL DEFAULT 'bug',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "assignedTo" TEXT,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_request" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "notes" TEXT,
    "devisNumber" TEXT,
    "factureNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "retro_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_request_file" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_request_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_request_status_log" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_request_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_operation_payments" (
    "id" TEXT NOT NULL,
    "scheduledOperationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "attachmentDataUrl" TEXT,

    CONSTRAINT "scheduled_operation_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_operations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "category" TEXT,
    "recurring" TEXT NOT NULL DEFAULT 'MONTHLY',
    "notes" TEXT,
    "isExecuted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "nextDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION,

    CONSTRAINT "scheduled_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "hasInternalAccess" BOOLEAN NOT NULL DEFAULT false,
    "hasExternalAccess" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "linkedMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "customPermissions" TEXT,

    CONSTRAINT "site_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actions" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "reason" TEXT,
    "resource" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mileage" INTEGER,
    "performedBy" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_service_schedule" (
    "id" TEXT NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'yearly',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_service_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleControlTechnique" (
    "id" TEXT NOT NULL,
    "parc" TEXT NOT NULL,
    "vehicleId" TEXT,
    "attestationPath" TEXT,
    "ctDate" TIMESTAMP(3) NOT NULL,
    "ctStatus" TEXT NOT NULL DEFAULT 'passed',
    "nextCtDate" TIMESTAMP(3),
    "mileage" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleControlTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCessionCertificate" (
    "id" TEXT NOT NULL,
    "parc" TEXT NOT NULL,
    "vehicleId" TEXT,
    "certificateUrl" TEXT,
    "certificatePath" TEXT,
    "issuedDate" TIMESTAMP(3),
    "issuedBy" TEXT,
    "notes" TEXT,
    "dateImport" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCessionCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGrayscale" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "currentGrayscaleNumber" TEXT,
    "currentGrayscaleUrl" TEXT,
    "previousGrayscaleNumber" TEXT,
    "previousGrayscaleUrl" TEXT,
    "registrationDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'valid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleGrayscale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInsurance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "attestationUrl" TEXT,
    "insuranceCompany" TEXT,
    "policyNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "validFromTime" TEXT,
    "validUntilTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInspection" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "inspectionType" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "result" TEXT,
    "nextInspectionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevisLine_devisId_idx" ON "DevisLine"("devisId");

-- CreateIndex
CREATE INDEX "DevisLine_order_idx" ON "DevisLine"("order");

-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "Document_memberId_idx" ON "Document"("memberId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_participantEmail_idx" ON "EventRegistration"("participantEmail");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "RetroNews_featured_idx" ON "RetroNews"("featured");

-- CreateIndex
CREATE INDEX "RetroNews_published_idx" ON "RetroNews"("published");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_reference_key" ON "Stock"("reference");

-- CreateIndex
CREATE INDEX "Stock_category_idx" ON "Stock"("category");

-- CreateIndex
CREATE INDEX "Stock_name_idx" ON "Stock"("name");

-- CreateIndex
CREATE INDEX "Stock_quantity_idx" ON "Stock"("quantity");

-- CreateIndex
CREATE INDEX "Stock_status_idx" ON "Stock"("status");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_stockId_idx" ON "StockMovement"("stockId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_parc_key" ON "Vehicle"("parc");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE INDEX "finance_balance_history_createdAt_idx" ON "finance_balance_history"("createdAt");

-- CreateIndex
CREATE INDEX "finance_balances_createdAt_idx" ON "finance_balances"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_categories_name_key" ON "finance_categories"("name");

-- CreateIndex
CREATE INDEX "finance_expense_reports_createdAt_idx" ON "finance_expense_reports"("createdAt");

-- CreateIndex
CREATE INDEX "finance_expense_reports_status_idx" ON "finance_expense_reports"("status");

-- CreateIndex
CREATE INDEX "finance_transaction_categories_categoryId_idx" ON "finance_transaction_categories"("categoryId");

-- CreateIndex
CREATE INDEX "finance_transaction_categories_transactionId_idx" ON "finance_transaction_categories"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_transaction_categories_transactionId_categoryId_key" ON "finance_transaction_categories"("transactionId", "categoryId");

-- CreateIndex
CREATE INDEX "finance_transactions_createdAt_idx" ON "finance_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "finance_transactions_date_idx" ON "finance_transactions"("date");

-- CreateIndex
CREATE INDEX "financial_documents_date_idx" ON "financial_documents"("date");

-- CreateIndex
CREATE INDEX "financial_documents_eventId_idx" ON "financial_documents"("eventId");

-- CreateIndex
CREATE INDEX "financial_documents_invoiceStatus_idx" ON "financial_documents"("invoiceStatus");

-- CreateIndex
CREATE INDEX "financial_documents_memberId_idx" ON "financial_documents"("memberId");

-- CreateIndex
CREATE INDEX "financial_documents_quoteStatus_idx" ON "financial_documents"("quoteStatus");

-- CreateIndex
CREATE INDEX "financial_documents_retroRequestId_idx" ON "financial_documents"("retroRequestId");

-- CreateIndex
CREATE INDEX "financial_documents_type_idx" ON "financial_documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "financial_documents_type_number_key" ON "financial_documents"("type", "number");

-- CreateIndex
CREATE INDEX "internal_messages_createdAt_idx" ON "internal_messages"("createdAt");

-- CreateIndex
CREATE INDEX "internal_messages_readAt_idx" ON "internal_messages"("readAt");

-- CreateIndex
CREATE INDEX "internal_messages_toUserId_idx" ON "internal_messages"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "members_memberNumber_key" ON "members"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "members_matricule_key" ON "members"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "retro_report_comments_createdAt_idx" ON "retro_report_comments"("createdAt");

-- CreateIndex
CREATE INDEX "retro_report_comments_reportId_idx" ON "retro_report_comments"("reportId");

-- CreateIndex
CREATE INDEX "retro_reports_createdAt_idx" ON "retro_reports"("createdAt");

-- CreateIndex
CREATE INDEX "retro_reports_priority_idx" ON "retro_reports"("priority");

-- CreateIndex
CREATE INDEX "retro_reports_status_idx" ON "retro_reports"("status");

-- CreateIndex
CREATE INDEX "retro_request_category_idx" ON "retro_request"("category");

-- CreateIndex
CREATE INDEX "retro_request_createdAt_idx" ON "retro_request"("createdAt");

-- CreateIndex
CREATE INDEX "retro_request_status_idx" ON "retro_request"("status");

-- CreateIndex
CREATE INDEX "retro_request_userId_idx" ON "retro_request"("userId");

-- CreateIndex
CREATE INDEX "retro_request_file_requestId_idx" ON "retro_request_file"("requestId");

-- CreateIndex
CREATE INDEX "retro_request_status_log_changedAt_idx" ON "retro_request_status_log"("changedAt");

-- CreateIndex
CREATE INDEX "retro_request_status_log_requestId_idx" ON "retro_request_status_log"("requestId");

-- CreateIndex
CREATE INDEX "scheduled_operation_payments_paidAt_idx" ON "scheduled_operation_payments"("paidAt");

-- CreateIndex
CREATE INDEX "scheduled_operation_payments_period_idx" ON "scheduled_operation_payments"("period");

-- CreateIndex
CREATE INDEX "scheduled_operation_payments_scheduledOperationId_idx" ON "scheduled_operation_payments"("scheduledOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "site_users_username_key" ON "site_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "site_users_email_key" ON "site_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "site_users_linkedMemberId_key" ON "site_users"("linkedMemberId");

-- CreateIndex
CREATE INDEX "user_permissions_expiresAt_idx" ON "user_permissions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_permissions_resource_idx" ON "user_permissions"("resource");

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_resource_key" ON "user_permissions"("userId", "resource");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_date_idx" ON "vehicle_maintenance"("date");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_vehicleId_idx" ON "vehicle_maintenance"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_service_schedule_plannedDate_idx" ON "vehicle_service_schedule"("plannedDate");

-- CreateIndex
CREATE INDEX "vehicle_service_schedule_status_idx" ON "vehicle_service_schedule"("status");

-- CreateIndex
CREATE INDEX "vehicle_service_schedule_vehicleId_idx" ON "vehicle_service_schedule"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleControlTechnique_parc_idx" ON "VehicleControlTechnique"("parc");

-- CreateIndex
CREATE INDEX "VehicleControlTechnique_vehicleId_idx" ON "VehicleControlTechnique"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleControlTechnique_ctDate_idx" ON "VehicleControlTechnique"("ctDate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCessionCertificate_parc_key" ON "VehicleCessionCertificate"("parc");

-- CreateIndex
CREATE INDEX "VehicleCessionCertificate_parc_idx" ON "VehicleCessionCertificate"("parc");

-- CreateIndex
CREATE INDEX "VehicleCessionCertificate_vehicleId_idx" ON "VehicleCessionCertificate"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGrayscale_vehicleId_key" ON "VehicleGrayscale"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleGrayscale_vehicleId_idx" ON "VehicleGrayscale"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleInsurance_vehicleId_key" ON "VehicleInsurance"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleInsurance_vehicleId_idx" ON "VehicleInsurance"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleInspection_vehicleId_idx" ON "VehicleInspection"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleInspection_inspectionDate_idx" ON "VehicleInspection"("inspectionDate");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("parc") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_parc_fkey" FOREIGN KEY ("parc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "Usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_parc_fkey" FOREIGN KEY ("parc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_siteUserId_fkey" FOREIGN KEY ("siteUserId") REFERENCES "site_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_simulation_expense_items" ADD CONSTRAINT "finance_simulation_expense_items_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "finance_simulation_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_simulation_income_items" ADD CONSTRAINT "finance_simulation_income_items_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "finance_simulation_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transaction_categories" ADD CONSTRAINT "finance_transaction_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transaction_categories" ADD CONSTRAINT "finance_transaction_categories_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_retroRequestId_fkey" FOREIGN KEY ("retroRequestId") REFERENCES "retro_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_report_comments" ADD CONSTRAINT "retro_report_comments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "retro_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_request_file" ADD CONSTRAINT "retro_request_file_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "retro_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_request_status_log" ADD CONSTRAINT "retro_request_status_log_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "retro_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_operation_payments" ADD CONSTRAINT "scheduled_operation_payments_scheduledOperationId_fkey" FOREIGN KEY ("scheduledOperationId") REFERENCES "scheduled_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_users" ADD CONSTRAINT "site_users_linkedMemberId_fkey" FOREIGN KEY ("linkedMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "site_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_service_schedule" ADD CONSTRAINT "vehicle_service_schedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
