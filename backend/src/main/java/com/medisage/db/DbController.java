package com.medisage.db;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.validation.annotation.Validated;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@Validated
public class DbController {
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
            "SELECT id, email, username, created_at FROM users ORDER BY id DESC LIMIT ?",
            USER_ROW_MAPPER,
            limit
        );
        }

        public Optional<UserRow> getUserById(@Min(1) long id) {
        try {
            UserRow user = jdbcTemplate.queryForObject(
                "SELECT id, email, username, created_at FROM users WHERE id = ?",
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
                "SELECT id, email, username, created_at FROM users WHERE email = ?",
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

        public record UserRow(long id, String email, String username, Instant createdAt) {}

        public record ConversationRow(long id, String agentType, String serverSessionId, Instant createdAt, Instant lastModifiedAt) {}

        public record ScoreRow(long id, long conversationId, int score, String dimensions, Instant createdAt) {}
}
