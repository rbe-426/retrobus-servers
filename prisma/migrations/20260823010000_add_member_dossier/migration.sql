-- CreateTable
CREATE TABLE "MemberDossierMembership" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberDossierMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberTraining" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAuthorization" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "obtainedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberActivity" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hours" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDossierEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "visibility" TEXT NOT NULL DEFAULT 'RESTRICTED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberDossierEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDossierEventAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDossierEventAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDossierAuditLog" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDossierAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberDossierMembership_memberId_startedAt_idx" ON "MemberDossierMembership"("memberId", "startedAt");

-- CreateIndex
CREATE INDEX "MemberDossierMembership_status_idx" ON "MemberDossierMembership"("status");

-- CreateIndex
CREATE INDEX "MemberTraining_memberId_completedAt_idx" ON "MemberTraining"("memberId", "completedAt");

-- CreateIndex
CREATE INDEX "MemberTraining_expiresAt_idx" ON "MemberTraining"("expiresAt");

-- CreateIndex
CREATE INDEX "MemberTraining_status_idx" ON "MemberTraining"("status");

-- CreateIndex
CREATE INDEX "MemberAuthorization_memberId_obtainedAt_idx" ON "MemberAuthorization"("memberId", "obtainedAt");

-- CreateIndex
CREATE INDEX "MemberAuthorization_expiresAt_idx" ON "MemberAuthorization"("expiresAt");

-- CreateIndex
CREATE INDEX "MemberAuthorization_status_idx" ON "MemberAuthorization"("status");

-- CreateIndex
CREATE INDEX "MemberActivity_memberId_occurredAt_idx" ON "MemberActivity"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemberActivity_type_idx" ON "MemberActivity"("type");

-- CreateIndex
CREATE INDEX "MemberDossierEvent_memberId_occurredAt_idx" ON "MemberDossierEvent"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemberDossierEvent_category_idx" ON "MemberDossierEvent"("category");

-- CreateIndex
CREATE INDEX "MemberDossierEvent_status_idx" ON "MemberDossierEvent"("status");

-- CreateIndex
CREATE INDEX "MemberDossierEventAttachment_eventId_idx" ON "MemberDossierEventAttachment"("eventId");

-- CreateIndex
CREATE INDEX "MemberDossierEventAttachment_documentId_idx" ON "MemberDossierEventAttachment"("documentId");

-- CreateIndex
CREATE INDEX "MemberDossierAuditLog_memberId_createdAt_idx" ON "MemberDossierAuditLog"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberDossierAuditLog_entityType_entityId_idx" ON "MemberDossierAuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "MemberDossierMembership" ADD CONSTRAINT "MemberDossierMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTraining" ADD CONSTRAINT "MemberTraining_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAuthorization" ADD CONSTRAINT "MemberAuthorization_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberActivity" ADD CONSTRAINT "MemberActivity_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDossierEvent" ADD CONSTRAINT "MemberDossierEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDossierEventAttachment" ADD CONSTRAINT "MemberDossierEventAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MemberDossierEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDossierAuditLog" ADD CONSTRAINT "MemberDossierAuditLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
