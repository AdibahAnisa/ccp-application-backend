/*
  Warnings:

  - Added the required column `user_id` to the `lpr_notify` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `lpr_notify` ADD COLUMN `user_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `parking` ADD COLUMN `last_notified_status` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `autoDeduct` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tokenBalance` DOUBLE NOT NULL DEFAULT 0;
