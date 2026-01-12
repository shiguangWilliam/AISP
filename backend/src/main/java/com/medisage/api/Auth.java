package com.medisage.api;

import com.medisage.db.DbController;
import com.medisage.utils.ParamCheck;
import com.medisage.utils.PasswordHash;
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

    public Auth(DbController dbController) {
        this.dbController = dbController;
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

        String hash = PasswordHash.hashPassword(password);

        String storedHash = dbController.getPasswordHashByEmail(email).orElse(null);
        if (storedHash == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return Map.of("error", "User not found.");
        }

        if (!storedHash.equals(hash)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return Map.of("error", "Invalid credentials.");
        }

        return Map.of("LoginStatus", "Success");
    }
}
