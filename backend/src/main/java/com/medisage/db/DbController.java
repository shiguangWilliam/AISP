package com.medisage.db;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.validation.annotation.Validated;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Validated
public class DbController {
    @Value("${db.maxRetries:3}") private static int MAX_RETRIES;

    private final JdbcTemplate jdbcTemplate;
    public DbController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int pingDatabase() {
        Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return result == null ? 0 : result;
    }

        private static final RowMapper<UserRow> USER_ROW_MAPPER = (rs, rowNum) -> new UserRow(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("username"),
            rs.getString("role"),
            rs.getTimestamp("created_at").toInstant()
        );

        private static final RowMapper<ConversationRow> CONVERSATION_ROW_MAPPER = (rs, rowNum) -> new ConversationRow(
            rs.getLong("id"),
                rs.getString("agent_type"),
                rs.getString("server_session_id"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("last_modified_at").toInstant()
        );

        private static final RowMapper<ScoreRow> SCORE_ROW_MAPPER = (rs, rowNum) -> new ScoreRow(
            rs.getLong("id"),
            rs.getLong("conversation_id"),
            rs.getInt("score"),
            rs.getString("dimensions"),
            rs.getTimestamp("created_at").toInstant()
        );

        public List<UserRow> listUsers(@Min(1) @Max(200) int limit) {
        return jdbcTemplate.query(
            "SELECT id, email, username, role, created_at FROM users ORDER BY id DESC LIMIT ?",
            USER_ROW_MAPPER,
            limit
        );
        }

        public Optional<UserRow> getUserById(@Min(1) long id) {
        try {
            UserRow user = jdbcTemplate.queryForObject(
                "SELECT id, email, username, role, created_at FROM users WHERE id = ?",
                USER_ROW_MAPPER,
                id
            );
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        }

        public Optional<UserRow> getUserByEmail(@Email String email) {
        try {
            UserRow user = jdbcTemplate.queryForObject(
                "SELECT id, email, username, role, created_at FROM users WHERE email = ?",
                USER_ROW_MAPPER,
                email
            );
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        }

        public Optional<String> getPasswordHashByEmail(@Email String email) {
        try {
            String hash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM users WHERE email = ?",
                String.class,
                email
            );
            return Optional.ofNullable(hash);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        }

        public int updatePasswordHashByEmail(@Email String email, String passwordHash) throws DataAccessException {
        return jdbcTemplate.update(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            passwordHash,
            email
        );
        }

        public Optional<Instant> getLatestVerificationCreatedAt(@Email String email) {
        try {
            Timestamp ts = jdbcTemplate.queryForObject(
                "SELECT created_at FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
                Timestamp.class,
                email
            );
            return ts == null ? Optional.empty() : Optional.of(ts.toInstant());
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        }

        public void insertVerificationCode(@Email String email, String codeHash, Instant expiresAt, String requestIp) throws DataAccessException {
        jdbcTemplate.update(
            "INSERT INTO email_verification_codes (email, code_hash, expires_at, request_ip) VALUES (?, ?, ?, ?)",
            email,
            codeHash,
            Timestamp.from(expiresAt),
            requestIp
        );
        }

        public boolean consumeVerificationCode(@Email String email, String codeHash) throws DataAccessException {
        // 一次性使用：只消费未过期且未使用的最新记录
        int updated = jdbcTemplate.update(
            "UPDATE email_verification_codes " +
                "SET used_at = NOW() " +
                "WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > NOW()",
            email,
            codeHash
        );
        return updated > 0;
        }

        public int markEmailVerified(@Email String email) throws DataAccessException {
        return jdbcTemplate.update(
            "UPDATE users SET email_verified = 1 WHERE email = ?",
            email
        );
        }

        public List<ConversationRow> listConversations(@Min(1) @Max(200) int limit) {
        return jdbcTemplate.query(
                    "SELECT id, agent_type, server_session_id, created_at, last_modified_at FROM conversations ORDER BY id DESC LIMIT ?",
            CONVERSATION_ROW_MAPPER,
            limit
        );
        }

        public List<ConversationRow> listConversationsForUser(
            @Min(1) long userId,
            @Min(1) @Max(200) int limit
        ) {
        return jdbcTemplate.query(
            "SELECT c.id, c.agent_type, c.server_session_id, c.created_at, c.last_modified_at " +
                "FROM conversations c " +
                "JOIN user_conversations uc ON uc.conversation_id = c.id " +
                "WHERE uc.user_id = ? " +
                "ORDER BY c.id DESC LIMIT ?",
            CONVERSATION_ROW_MAPPER,
            userId,
            limit
        );
        }

        public List<ScoreRow> listScoresForConversation(
            @Min(1) long conversationId,
            @Min(1) @Max(200) int limit
        ) {
        return jdbcTemplate.query(
            "SELECT id, conversation_id, score, dimensions, created_at " +
                "FROM scores WHERE conversation_id = ? " +
                "ORDER BY id DESC LIMIT ?",
            SCORE_ROW_MAPPER,
            conversationId,
            limit
        );
        }

        public Optional<ScoreRow> getLatestScoreForConversation(@Min(1) long conversationId) {
        try {
            ScoreRow score = jdbcTemplate.queryForObject(
                    "SELECT id, conversation_id, score, dimensions, created_at " +
                    "FROM scores WHERE conversation_id = ? " +
                    "ORDER BY id DESC LIMIT 1",
                SCORE_ROW_MAPPER,
                conversationId
            );
            return Optional.ofNullable(score);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        }
        // 创建新用户，默认参数已处理
        public void createUser(@Email String email, String username,String passwordHash,String role) throws DataAccessException {
            jdbcTemplate.update(
                "INSERT INTO users (email, username, role, password_hash, created_at) VALUES (?, ?, ?, ?, NOW())",
                email,
                username,
                role,
                passwordHash
            );
        }

        // 目前只支持官方提供Agent,暂时不提供MCP与自定义agnet服务
        public void getAvailableAgentTypes() throws DataAccessException {
            jdbcTemplate.query(
                "SELECT DISTINCT agent_type FROM agents WHERE available = 1",
                (rs, rowNum) -> rs.getString("agent_type")
            );
        }

        public List<ConversationRow> listConversationsByUserId(String userId, int limit){
            return jdbcTemplate.query(
                "SELECT c.id, c.agent_type, c.server_session_id, c.created_at, c.last_modified_at " +
                    "FROM conversations c " +
                    "JOIN user_conversations uc ON uc.conversation_id = c.id " +
                    "WHERE uc.user_id = ? " +
                    "ORDER BY c.last_modified_at DESC LIMIT ?",
                CONVERSATION_ROW_MAPPER,
                userId,
                limit
            );


        }

        public String createConversation(long userId, String agentType, String agentId, Instant now){
            String conversationId = null;
            for(int attempt =0; attempt <MAX_RETRIES; attempt++){
                conversationId = UUID.randomUUID().toString();
                // 创建会话记录
                try{
                    jdbcTemplate.update(
                        "INSERT INTO conversations (id, agent_type, agent_id, server_session_id, created_at, last_modified_at) VALUES (?, ?, ?, ?, ?, ?)",
                        conversationId,
                        agentType,
                        agentId,
                        conversationId,
                        Timestamp.from(now),
                        Timestamp.from(now)
                    );
                }catch(DuplicateKeyException e){
                    // 理论上不会发生,但如果发生则重试
                    if(attempt == MAX_RETRIES -1) {
                        throw e;
                    }
                    continue;
                }
                break;
            }
            // 关联用户与会话
            jdbcTemplate.update(
                "INSERT INTO user_conversations (user_id, conversation_id, created_at) VALUES (?, ?, ?)",
                userId,
                conversationId,
                Timestamp.from(now)
            );
            return conversationId;
        }

        public record UserRow(long id, String email, String username, String role, Instant createdAt) {}

        public record ConversationRow(long id, String agentType, String serverSessionId, Instant createdAt, Instant lastModifiedAt) {
            public long getId(){return id;}
            public String getAgentType(){return agentType;}
            public String getServerSessionId(){return serverSessionId;}
            public Instant getCreatedAt(){return createdAt;}
            public Instant getLastModifiedAt(){return lastModifiedAt;}

        }

        public record ScoreRow(long id, long conversationId, int score, String dimensions, Instant createdAt) {}
}
