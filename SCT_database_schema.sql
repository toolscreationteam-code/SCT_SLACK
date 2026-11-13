-- ========================================================
-- SCT (Sadhana Creation Team) - Slack Web App Database Schema
-- Table Prefix: SCT_
-- MySQL Version: 5.7+ / 8.0+
-- Database: u339048620_stkreq
-- ========================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `SCT_notifications`;
DROP TABLE IF EXISTS `SCT_messages`;
DROP TABLE IF EXISTS `SCT_channel_members`;
DROP TABLE IF EXISTS `SCT_channels`;
DROP TABLE IF EXISTS `SCT_workspace_members`;
DROP TABLE IF EXISTS `SCT_workspaces`;
DROP TABLE IF EXISTS `SCT_users`;

-- 1. USERS TABLE (વપરાશકર્તાઓ)
CREATE TABLE `SCT_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'hod_admin', 'team_leader', 'member') NOT NULL DEFAULT 'member',
  `team_name` VARCHAR(50) NOT NULL DEFAULT 'Team 1',
  `avatar` VARCHAR(255) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. WORKSPACES TABLE (વર્કસ્પેસ)
CREATE TABLE `SCT_workspaces` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `icon` VARCHAR(50) DEFAULT 'SCT',
  `description` TEXT NULL,
  `head_user_id` INT NULL,
  `created_by` INT NULL,
  `leader_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (`slug`),
  INDEX idx_head_user (`head_user_id`),
  FOREIGN KEY (`head_user_id`) REFERENCES `SCT_users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `SCT_users`(`id`) ON DELETE SET NULL
  ,FOREIGN KEY (`leader_user_id`) REFERENCES `SCT_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. WORKSPACE MEMBERS TABLE (વર્કસ્પેસ સભ્યો)
CREATE TABLE `SCT_workspace_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workspace_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `workspace_role` ENUM('super_admin', 'workspace_head', 'team_leader', 'member') NOT NULL DEFAULT 'member',
  `team_name` VARCHAR(100) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ws_user (`workspace_id`, `user_id`),
  INDEX idx_ws_user (`user_id`, `workspace_id`),
  FOREIGN KEY (`workspace_id`) REFERENCES `SCT_workspaces`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `SCT_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CHANNELS TABLE (ચેનલ્સ)
CREATE TABLE `SCT_channels` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workspace_id` INT NOT NULL DEFAULT 1,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT '',
  `is_announcement` TINYINT(1) NOT NULL DEFAULT 0,
  `is_global_announcement` TINYINT(1) NOT NULL DEFAULT 0,
  `is_direct` TINYINT(1) NOT NULL DEFAULT 0,
  `post_permission` ENUM('all', 'admin_only', 'leaders_only') NOT NULL DEFAULT 'all',
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_id (`workspace_id`),
  UNIQUE KEY unique_workspace_channel (`workspace_id`, `name`),
  FOREIGN KEY (`workspace_id`) REFERENCES `SCT_workspaces`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `SCT_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CHANNEL MEMBERS TABLE (કઈ ચેનલમાં કયા સભ્યો છે)
CREATE TABLE `SCT_channel_members` (
  `channel_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_read_message_id` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`channel_id`, `user_id`),
  FOREIGN KEY (`channel_id`) REFERENCES `SCT_channels`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `SCT_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. MESSAGES TABLE (ચેટ મેસેજ અને ફાઇલ્સ)
CREATE TABLE `SCT_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `channel_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `content` TEXT NULL,
  `file_url` TEXT NULL,
  `file_name` VARCHAR(255) NULL,
  `file_type` VARCHAR(50) NULL,
  `is_edited` TINYINT(1) NOT NULL DEFAULT 0,
  `is_global_broadcast` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`channel_id`) REFERENCES `SCT_channels`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `SCT_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. NOTIFICATIONS TABLE (ઇન-એપ નોટિફિકેશન)
CREATE TABLE `SCT_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `channel_id` INT NOT NULL,
  `message_id` INT NULL,
  `sender_id` INT NULL,
  `content` VARCHAR(255) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `SCT_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`channel_id`) REFERENCES `SCT_channels`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`message_id`) REFERENCES `SCT_messages`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `SCT_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================================
-- PRE-POPULATE USERS (9 Members - Username & Password pairs)
-- ========================================================
INSERT INTO `SCT_users` (`id`, `username`, `name`, `password`, `role`, `team_name`, `avatar`) VALUES
(1, 's112', 'Khush Maharaj', 's112', 'super_admin', 'Management', 'KM'),
(2, '111', 'P Haripryaswami', '111', 'team_leader', 'Team 1', 'PH'),
(3, '112', 'P Swayamprakashswami', '112', 'member', 'Team 1', 'PS'),
(4, 's120', 'Parthiv Maharaj', 's120', 'member', 'Team 1', 'PM'),
(5, 's108', 'Chintan Maharaj', 's108', 'member', 'Team 1', 'CM'),
(6, '114', 'P Hariprakashswami', '114', 'team_leader', 'Team 2', 'HP'),
(7, '115', 'P Haridarshanswami', '115', 'member', 'Team 2', 'HD'),
(8, 's116', 'Abhishek Maharaj', 's116', 'member', 'Team 2', 'AM'),
(9, 's119', 'Jaydeep Maharaj', 's119', 'member', 'Team 2', 'JM');
INSERT INTO `SCT_users` (`username`, `name`, `password`, `role`, `team_name`, `avatar`) VALUES
('64', 'P Gunnidhiswmai', '64', 'member', 'Team 1', 'PG'),
('108', 'P Sarvmangalswami', '108', 'member', 'Team 1', 'PS'),
('113', 'P Nimagnswami', '113', 'member', 'Team 1', 'PN'),
('s115', 'Sahaj M (2)', 's115', 'member', 'Team 1', 'SM2'),
('s117', 'Dixit M', 's117', 'member', 'Team 1', 'DM');

-- ========================================================
-- PRE-POPULATE DEFAULT WORKSPACE
-- ========================================================
INSERT INTO `SCT_workspaces` (`id`, `name`, `slug`, `icon`, `description`, `head_user_id`, `created_by`) VALUES
(1, 'AVK Workspace', 'avk', 'AVK', 'Main AVK Workspace', 1, 1);

-- ========================================================
-- PRE-POPULATE WORKSPACE MEMBERS
-- ========================================================
INSERT INTO `SCT_workspace_members` (`workspace_id`, `user_id`, `workspace_role`, `team_name`, `is_default`) VALUES
(1, 1, 'super_admin', 'Management', 1),
(1, 2, 'team_leader', 'Team 1', 1),
(1, 3, 'member', 'Team 1', 1),
(1, 4, 'member', 'Team 1', 1),
(1, 5, 'member', 'Team 1', 1),
(1, 6, 'team_leader', 'Team 2', 1),
(1, 7, 'member', 'Team 2', 1),
(1, 8, 'member', 'Team 2', 1),
(1, 9, 'member', 'Team 2', 1);

-- ========================================================
-- PRE-POPULATE DEFAULT CHANNELS
-- ========================================================
INSERT INTO `SCT_channels` (`id`, `workspace_id`, `name`, `description`, `is_announcement`, `is_global_announcement`, `is_direct`, `post_permission`, `created_by`) VALUES
(1, 1, 'super-admin-announcements', 'સૂપર એડમિનની સત્તાવાર ઘોષણાઓ (Super Admin announcements)', 1, 1, 0, 'admin_only', 1),
(2, 1, 'general', 'સામાન્ય ચર્ચા અને વિચારવિમર્શ (General Discussion)', 0, 0, 'all', 1),
(3, 1, 'team-1', 'ટીમ ૧ માટેનું કોઓર્ડિનેશન (Team 1 Workspace)', 0, 0, 'all', 2),
(4, 1, 'team-2', 'ટીમ ૨ માટેનું કોઓર્ડિનેશન (Team 2 Workspace)', 0, 0, 'all', 6);

-- ========================================================
-- ASSIGN MEMBERS TO CHANNELS
-- ========================================================
-- 1. #announcements (બધા જ ૯ સભ્યો)
INSERT INTO `SCT_channel_members` (`channel_id`, `user_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9);

-- 2. #general (બધા જ ૯ સભ્યો)
INSERT INTO `SCT_channel_members` (`channel_id`, `user_id`) VALUES
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9);

-- 3. #team-1 (Khush Maharaj (HOD) + Team 1 સભ્યો)
INSERT INTO `SCT_channel_members` (`channel_id`, `user_id`) VALUES
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5);

-- 4. #team-2 (Khush Maharaj (HOD) + Team 2 સભ્યો)
INSERT INTO `SCT_channel_members` (`channel_id`, `user_id`) VALUES
(4, 1), (4, 6), (4, 7), (4, 8), (4, 9);
