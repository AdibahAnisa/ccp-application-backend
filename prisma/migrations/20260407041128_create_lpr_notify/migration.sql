/*
  Warnings:

  - You are about to drop the column `person_in_charge_last_name` on the `reserve_bay` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `reserve_bay` DROP COLUMN `person_in_charge_last_name`,
    ADD COLUMN `person_in_charge_second_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `fcmToken` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `lpr_notify` (
    `id` VARCHAR(191) NOT NULL,
    `plateNumber` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `snapshotUrl` VARCHAR(191) NULL,
    `eventUuid` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lpr_notify_eventUuid_key`(`eventUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
