package com.medisage.api;

import com.medisage.db.DbController;
import com.medisage.utils.ParamCheck;
import com.medisage.utils.PasswordHash;
import com.medisage.app.EmailVerificationService;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class Register {
    private final DbController dbController;
    private final EmailVerificationService emailVerification;

    public Register(DbController dbController, EmailVerificationService emailVerification) {
        // 初始化DbController依赖
        this.dbController = dbController;
        // 初始化EmailVerification依赖
        this.emailVerification = emailVerification;
    }

    @PostMapping(value = "/api/register", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> register(@RequestBody Map<String, Object> payload, HttpServletRequest request, HttpServletResponse response) {
        String email = payload.get("email").toString();
        String username = payload.get("username").toString();
        String password = payload.get("password").toString();
        String code = payload.get("code").toString();
        // 参数校验
        if(ParamCheck.isNullOrEmpty(email) || ParamCheck.isNullOrEmpty(username) || ParamCheck.isNullOrEmpty(password)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Email, username and password must not be empty.");
        }

        if(!ParamCheck.isAvailEmail(email)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Invalid email format.");
        }

        if(!ParamCheck.isAbailPassword(password)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Password format is invalid.");
        }

        if(!ParamCheck.isAbailUsername(username)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Username must be 3-30 characters long and contain only letters, numbers, and underscores.");
        }

        if(!ParamCheck.isAbailCode(code)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Invalid verification code format.");
        }

        // 检查用户是否已存在
        if(dbController.getUserByEmail(email).isPresent()) {
            response.setStatus(HttpServletResponse.SC_CONFLICT);
            return Map.of("error", "User with this email already exists.");
        }
        // 等待验证码

        if(!emailVerification.verifyCode(email, code).isSuccess()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Email verification failed.");
        }

        // 创建用户
        String hash = PasswordHash.hashPassword(password);
        String role = "user";
        dbController.createUser(email, username, hash, role);

        return Map.of("RegisterStatus", "Success");
    }

    @GetMapping(value = "/api/register/get-email-verification-code", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getEmailVerificationCode(HttpServletRequest request, HttpServletResponse response) {
        String eamil = request.getParameter("email");
        if(ParamCheck.isNullOrEmpty(eamil) || !ParamCheck.isAvailEmail(eamil)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return Map.of("error", "Invalid email format.");
        }
        
        EmailVerificationService.SendResult result = emailVerification.sendCode(eamil, request.getRemoteAddr());
        response.setStatus(result.status());
        if (result.error() == null) {
            return Map.of("status", result.status());
        }
        return Map.of("status", result.status(), "error", result.error());
    }
}