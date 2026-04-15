/*
  Warnings:

  - You are about to drop the column `plateNumber` on the `lpr_notify` table. All the data in the column will be lost.
  - You are about to drop the column `plateNumber` on the `vehicle` table. All the data in the column will be lost.
  - Added the required column `plate_number` to the `lpr_notify` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plate_number` to the `vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `vehicle_plateNumber_key` ON `vehicle`;

-- AlterTable
ALTER TABLE `lpr_notify` DROP COLUMN `plateNumber`,
    ADD COLUMN `plate_number` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `vehicle` DROP COLUMN `plateNumber`,
    ADD COLUMN `plate_number` VARCHAR(191) NOT NULL;
