-- CreateEnum
CREATE TYPE "MenuModifierSelectionType" AS ENUM ('SINGLE', 'MULTI');

-- CreateTable
CREATE TABLE "MenuModifierGroup" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectionType" "MenuModifierSelectionType" NOT NULL DEFAULT 'SINGLE',
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuModifierGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuModifierGroup_minSelect_nonneg_chk" CHECK ("minSelect" >= 0),
    CONSTRAINT "MenuModifierGroup_maxSelect_pos_chk" CHECK ("maxSelect" >= 1),
    CONSTRAINT "MenuModifierGroup_max_gte_min_chk" CHECK ("maxSelect" >= "minSelect"),
    CONSTRAINT "MenuModifierGroup_single_max1_chk" CHECK ("selectionType" <> 'SINGLE'::"MenuModifierSelectionType" OR "maxSelect" = 1)
);

-- CreateTable
CREATE TABLE "MenuModifierOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuModifierOption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuModifierOption_priceDelta_nonneg_chk" CHECK ("priceDelta" >= 0)
);

-- CreateTable
CREATE TABLE "MenuProductModifierGroup" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuProductModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "groupId" TEXT,
    "optionId" TEXT,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItemModifier_priceDelta_nonneg_chk" CHECK ("priceDelta" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuProduct_id_branchId_key" ON "MenuProduct"("id", "branchId");

-- CreateIndex
CREATE INDEX "MenuModifierGroup_branchId_idx" ON "MenuModifierGroup"("branchId");

-- CreateIndex
CREATE INDEX "MenuModifierGroup_isActive_idx" ON "MenuModifierGroup"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuModifierGroup_branchId_name_key" ON "MenuModifierGroup"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuModifierGroup_id_branchId_key" ON "MenuModifierGroup"("id", "branchId");

-- CreateIndex
CREATE INDEX "MenuModifierOption_groupId_idx" ON "MenuModifierOption"("groupId");

-- CreateIndex
CREATE INDEX "MenuModifierOption_isActive_idx" ON "MenuModifierOption"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuModifierOption_groupId_name_key" ON "MenuModifierOption"("groupId", "name");

-- CreateIndex
CREATE INDEX "MenuProductModifierGroup_branchId_idx" ON "MenuProductModifierGroup"("branchId");

-- CreateIndex
CREATE INDEX "MenuProductModifierGroup_productId_idx" ON "MenuProductModifierGroup"("productId");

-- CreateIndex
CREATE INDEX "MenuProductModifierGroup_groupId_idx" ON "MenuProductModifierGroup"("groupId");

-- CreateIndex
CREATE INDEX "MenuProductModifierGroup_isActive_idx" ON "MenuProductModifierGroup"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuProductModifierGroup_productId_groupId_key" ON "MenuProductModifierGroup"("productId", "groupId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_groupId_idx" ON "OrderItemModifier"("groupId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_optionId_idx" ON "OrderItemModifier"("optionId");

-- AddForeignKey
ALTER TABLE "MenuModifierGroup" ADD CONSTRAINT "MenuModifierGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifierOption" ADD CONSTRAINT "MenuModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant-safe join: product and group must share the same branchId.
ALTER TABLE "MenuProductModifierGroup" ADD CONSTRAINT "MenuProductModifierGroup_productId_branchId_fkey" FOREIGN KEY ("productId", "branchId") REFERENCES "MenuProduct"("id", "branchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuProductModifierGroup" ADD CONSTRAINT "MenuProductModifierGroup_groupId_branchId_fkey" FOREIGN KEY ("groupId", "branchId") REFERENCES "MenuModifierGroup"("id", "branchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuModifierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MenuModifierOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
