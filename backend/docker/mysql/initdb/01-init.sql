-- MediSage basic schema init (MySQL 8.0)
-- This file is executed automatically by the official mysql image on first container start.

-- Ensure UTF8MB4
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Create database (you can also rely on MYSQL_DATABASE env var)
CREATE DATABASE IF NOT EXISTS medisage
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE medisage;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  avatar_path VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB;

-- Conversations: one dialogue session between a user and an agent
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  agent_type VARCHAR(64) NOT NULL,
  server_session_id VARCHAR(128) NULL,
  PRIMARY KEY (id),
  KEY idx_conversations_created_at (created_at),
  KEY idx_conversations_last_modified_at (last_modified_at),
  KEY idx_conversations_server_session_id (server_session_id)
) ENGINE=InnoDB;

-- User-Conversations join table
CREATE TABLE IF NOT EXISTS user_conversations (
  user_id BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, conversation_id),
  KEY idx_user_conversations_conversation_id (conversation_id),
  CONSTRAINT fk_user_conversations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_conversations_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Scores: feedback/score belongs to a conversation
CREATE TABLE IF NOT EXISTS scores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  score INT NOT NULL,
  dimensions JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scores_conversation_id (conversation_id),
  CONSTRAINT fk_scores_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed a demo user (password hash is placeholder)
INSERT INTO users (email, username, password_hash, email_verified)
VALUES ('demo@example.com', 'demo', '$2b$10$replace_with_real_bcrypt_hash', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);

SET @demo_user_id := (SELECT id FROM users WHERE username = 'demo' LIMIT 1);

INSERT INTO conversations (agent_type, server_session_id)
VALUES ('placeholder_agent', 'placeholder_server_session');

SET @demo_conversation_id := LAST_INSERT_ID();

INSERT INTO user_conversations (user_id, conversation_id)
VALUES (@demo_user_id, @demo_conversation_id);

INSERT INTO scores (conversation_id, score)
VALUES (@demo_conversation_id, 80);
