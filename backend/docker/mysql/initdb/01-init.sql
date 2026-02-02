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
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  avatar_path VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_username (username)
  /* 唯一用户名：可以，但需要在业务层处理重复注册/提示 */
) ENGINE=InnoDB;

-- Conversations: one dialogue session between a user and an agent
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  agent_type VARCHAR(64) NOT NULL,
  server_session_id VARCHAR(128) NULL UNIQUE, 
  /* server_session_id: ID used by backend agent server to identify session */
  PRIMARY KEY (id),
  KEY idx_conversations_created_at (created_at),
  KEY idx_conversations_last_modified_at (last_modified_at),
  KEY idx_conversations_server_session_id (server_session_id)
) ENGINE=InnoDB;

-- Agents: available agent definitions
-- Note: keep `agent_type` as a generated alias for compatibility with existing backend queries.
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(64) NOT NULL,
  agentname VARCHAR(64) NOT NULL,
  agent_type VARCHAR(64) GENERATED ALWAYS AS (agentname) STORED,
  available TINYINT(1) NOT NULL DEFAULT 1,
  discribe VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_agents_agentname (agentname),
  KEY idx_agents_agent_type (agent_type),
  KEY idx_agents_available (available)
) ENGINE=InnoDB;

INSERT INTO agents (id, agentname, available, discribe)
VALUES
  ('6961126200b4dbf51af4399d', '吴敏', 1, '预置问诊 Agent'),
  ('69610fcc67b6b2119201c019', '郑强', 1, '预置问诊 Agent'),
  ('69610c78b7f075cf136503d6', '周明', 1, '预置问诊 Agent'),
  ('69610bad1e9cd5ad02c7c12f', '陈雪', 1, '预置问诊 Agent'),
  ('68eb8f41210988a35f8c5101', '赵阳', 1, '预置问诊 Agent'),
  ('68e9329b7f28474b5c315d1e', '刘芳', 1, '预置问诊 Agent'),
  ('68d0179b9e009e14b4966dc4', '王建国', 1, '预置问诊 Agent'),
  ('68d015f3f40559f09fca9a67', '周雨', 1, '预置问诊 Agent'),
  ('68cfd87d33cb4b9b1b5b604a', '林小燕', 1, '预置问诊 Agent'),
  ('68a03da7e6bf16a9f207ab64', '李伟', 1, '预置问诊 Agent')
ON DUPLICATE KEY UPDATE
  agentname = VALUES(agentname),
  available = VALUES(available),
  discribe = VALUES(discribe);

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

-- Email verification codes (store hash only, not plaintext)
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_ip VARCHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_evc_email_created_at (email, created_at),
  KEY idx_evc_email_expires_at (email, expires_at)
) ENGINE=InnoDB;

-- Seed a demo user (password hash is placeholder)
INSERT INTO users (email, username, role, password_hash, email_verified)
VALUES ('demo@example.com', 'demo', 'user', '$2b$10$replace_with_real_bcrypt_hash', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);

SET @demo_user_id := (SELECT id FROM users WHERE username = 'demo' LIMIT 1);

INSERT INTO conversations (agent_type, server_session_id)
VALUES ('placeholder_agent', 'placeholder_server_session');

SET @demo_conversation_id := LAST_INSERT_ID();

INSERT INTO user_conversations (user_id, conversation_id)
VALUES (@demo_user_id, @demo_conversation_id);

INSERT INTO scores (conversation_id, score)
VALUES (@demo_conversation_id, 80);
