package com.medisage.api;

import com.medisage.db.DbController;
import com.medisage.utils.ParamCheck;
import com.medisage.utils.PasswordHash;
import com.medisage.utils.JwtUtils;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class Auth {
    private final DbController dbController;
    private final JwtUtils jwtUtils;

    public Auth(DbController dbController, JwtUtils jwtUtils) {
        this.dbController = dbController;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping(value = "/api/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> login(@RequestBody Map<String, Object> payload, HttpServletRequest request, HttpServletResponse response) {
        String email = payload.get("email").toString();
        String password = payload.get("password").toString();
        // 参数校验
        if(ParamCheck.isNullOrEmpty(email) || ParamCheck.isNullOrEmpty(password)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Email and password must not be empty.");
        }

        if(!ParamCheck.isAvailEmail(email)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Invalid email format.");
        }

        if(!ParamCheck.isAbailPassword(password)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Password must be at least 8 characters long.");
        }

        String storedHash = dbController.getPasswordHashByEmail(email).orElse(null);
        if (storedHash == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return Map.of("error", "User not found.");
        }
        
        if (!PasswordHash.matches(password, storedHash)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return Map.of("error", "Invalid credentials.");
        }

        // // 平滑迁移：如果历史存量是 sha256Hex(password)，登录成功后升级为 bcrypt
        // if (!PasswordHash.isBcryptHash(storedHash) && PasswordHash.isLegacySha256Hex(storedHash)) {
        //     String upgraded = PasswordHash.hashPassword(password);
        //     dbController.updatePasswordHashByEmail(email, upgraded);
        // }

        var user = dbController.getUserByEmail(email).orElse(null);
        if (user == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return Map.of("error", "User not found.");
        }

        // 登录成功，分发 JWT
        String token = jwtUtils.generateToken(String.valueOf(user.id()), user.username(), user.role());
        return Map.of(
            "loginStatus", "success",
            "token", token,
            "user", Map.of(
                "id", user.id(),
                "email", user.email(),
                "username", user.username(),
                "role", user.role()
            )
        );
    }
}
