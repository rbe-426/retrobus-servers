-- CreateTable
CREATE TABLE "AssociationProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociationProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssociationProjectVote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssociationProjectVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssociationProject_createdAt_idx" ON "AssociationProject"("createdAt");

-- CreateIndex
CREATE INDEX "AssociationProjectVote_userId_idx" ON "AssociationProjectVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssociationProjectVote_projectId_userId_key" ON "AssociationProjectVote"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "AssociationProjectVote" ADD CONSTRAINT "AssociationProjectVote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AssociationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
