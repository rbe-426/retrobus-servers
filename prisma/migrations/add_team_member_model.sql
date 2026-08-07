-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleColor" TEXT NOT NULL DEFAULT 'blue',
    "hierarchy" INTEGER NOT NULL DEFAULT 4,
    "joinDate" TEXT NOT NULL,
    "memberType" TEXT NOT NULL DEFAULT 'Membre',
    "catchphrase" TEXT,
    "image" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "expertise" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_hierarchy_idx" ON "TeamMember"("hierarchy");
CREATE INDEX "TeamMember_order_idx" ON "TeamMember"("order");
CREATE INDEX "TeamMember_isActive_idx" ON "TeamMember"("isActive");
