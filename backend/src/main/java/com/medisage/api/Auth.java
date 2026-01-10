package com.medisage.api;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class Auth {
    @PostMapping(value = "/api/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> login(@RequestBody Map<String, Object> payload, HttpServletRequest request, HttpServletResponse response) {
        String email = payload.get("email").toString();
        String password = payload.get("password").toString();
        return Map.of(
            "status", "success",
            "message", "Login successful",
            "data", Map.of(
                "userId", 1,
                "username", payload.get("username"),
                "token", "dummy-jwt-token"
            )
        );
    }
}
