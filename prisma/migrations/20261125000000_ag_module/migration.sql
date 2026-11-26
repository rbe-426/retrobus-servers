-- CreateTable
CREATE TABLE "AgSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "modeActive" BOOLEAN NOT NULL DEFAULT false,
    "joinCode" TEXT NOT NULL,
    "excludedUserIds" JSONB NOT NULL DEFAULT '[]',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgAttendee" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgDocument" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgArticle" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "AgArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgAmendment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposedText" TEXT NOT NULL,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "rejectionKind" TEXT,
    "rejectionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgPoll" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "amendmentId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voterName" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgSession_joinCode_key" ON "AgSession"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "AgAttendee_sessionId_userId_key" ON "AgAttendee"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "AgDocument_sessionId_idx" ON "AgDocument"("sessionId");

-- CreateIndex
CREATE INDEX "AgArticle_documentId_position_idx" ON "AgArticle"("documentId", "position");

-- CreateIndex
CREATE INDEX "AgAmendment_documentId_idx" ON "AgAmendment"("documentId");

-- CreateIndex
CREATE INDEX "AgAmendment_authorId_idx" ON "AgAmendment"("authorId");

-- CreateIndex
CREATE INDEX "AgAmendment_status_idx" ON "AgAmendment"("status");

-- CreateIndex
CREATE INDEX "AgPoll_sessionId_status_idx" ON "AgPoll"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgVote_pollId_userId_key" ON "AgVote"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "AgAttendee" ADD CONSTRAINT "AgAttendee_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgDocument" ADD CONSTRAINT "AgDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgArticle" ADD CONSTRAINT "AgArticle_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AgDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgAmendment" ADD CONSTRAINT "AgAmendment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AgDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgAmendment" ADD CONSTRAINT "AgAmendment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "AgArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgPoll" ADD CONSTRAINT "AgPoll_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgPoll" ADD CONSTRAINT "AgPoll_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "AgAmendment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgVote" ADD CONSTRAINT "AgVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "AgPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
