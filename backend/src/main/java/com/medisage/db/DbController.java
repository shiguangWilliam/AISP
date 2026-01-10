package com.medisage.db;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/db")
@Validated
public class DbController {
    private final JdbcTemplate jdbcTemplate;
    public DbController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/ping")
    public ResponseEntity<String> pingDatabase() {
        Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return ResponseEntity.ok("ok:" + result);
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

        @GetMapping("/users")
        public List<UserRow> listUsers(
                @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit
        ) {
        return jdbcTemplate.query(
            "SELECT id, email, username, created_at FROM users ORDER BY id DESC LIMIT ?",
            USER_ROW_MAPPER,
            limit
        );
        }

        @GetMapping("/users/{id}")
        public ResponseEntity<UserRow> getUserById(@PathVariable("id") @Min(1) long id) {
        try {
            UserRow user = jdbcTemplate.queryForObject(
                "SELECT id, email, username, created_at FROM users WHERE id = ?",
                USER_ROW_MAPPER,
                id
            );
            return ResponseEntity.ok(user);
        } catch (EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
        }

        @GetMapping("/users/by-email")
        public ResponseEntity<UserRow> getUserByEmail(@RequestParam("email") @Email String email) {
        try {
            UserRow user = jdbcTemplate.queryForObject(
                "SELECT id, email, username, created_at FROM users WHERE email = ?",
                USER_ROW_MAPPER,
                email
            );
            return ResponseEntity.ok(user);
        } catch (EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
        }

        @GetMapping("/conversations")
        public List<ConversationRow> listConversations(
            @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit
        ) {
        return jdbcTemplate.query(
                    "SELECT id, agent_type, server_session_id, created_at, last_modified_at FROM conversations ORDER BY id DESC LIMIT ?",
            CONVERSATION_ROW_MAPPER,
            limit
        );
        }

        @GetMapping("/users/{userId}/conversations")
        public List<ConversationRow> listConversationsForUser(
            @PathVariable("userId") @Min(1) long userId,
            @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit
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

        @GetMapping("/conversations/{conversationId}/scores")
        public List<ScoreRow> listScoresForConversation(
            @PathVariable("conversationId") @Min(1) long conversationId,
            @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit
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

        @GetMapping("/conversations/{conversationId}/scores/latest")
        public ResponseEntity<ScoreRow> getLatestScoreForConversation(@PathVariable("conversationId") @Min(1) long conversationId) {
        try {
            ScoreRow score = jdbcTemplate.queryForObject(
                    "SELECT id, conversation_id, score, dimensions, created_at " +
                    "FROM scores WHERE conversation_id = ? " +
                    "ORDER BY id DESC LIMIT 1",
                SCORE_ROW_MAPPER,
                conversationId
            );
            return ResponseEntity.ok(score);
        } catch (EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
        }

        @ExceptionHandler(DataAccessException.class)
        public ResponseEntity<String> handleDatabaseError(DataAccessException ex) {
            return ResponseEntity.internalServerError().body("database error");
        }

        public record UserRow(long id, String email, String username, Instant createdAt) {}

        public record ConversationRow(long id, String agentType, String serverSessionId, Instant createdAt, Instant lastModifiedAt) {}

        public record ScoreRow(long id, long conversationId, int score, String dimensions, Instant createdAt) {}
}
