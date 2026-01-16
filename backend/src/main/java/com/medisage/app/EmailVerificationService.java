package com.medisage.app;

import com.medisage.db.DbController;
import com.medisage.utils.ParamCheck;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationService {
    private static final SecureRandom RNG = new SecureRandom();

    private final JavaMailSender mailSender;
    private final DbController dbController;

    private final String from;
    private final String fromName;
    private final int ttlSeconds;
    private final int minResendSeconds;
    private final String hmacSecret;

    public EmailVerificationService(
        // 基础信息配置
        JavaMailSender mailSender,
        DbController dbController,
        @Value("${app.mail.from}") String from,
        @Value("${app.mail.fromName:MediSage}") String fromName,
        @Value("${app.verify.code.ttlSeconds:900}") int ttlSeconds,
        @Value("${app.verify.code.minResendSeconds:60}") int minResendSeconds,
        @Value("${app.verify.hmacSecret:}") String hmacSecret
    ) {
        this.mailSender = mailSender;
        this.dbController = dbController;
        this.from = from;
        this.fromName = fromName;
        this.ttlSeconds = ttlSeconds;
        this.minResendSeconds = minResendSeconds;
        this.hmacSecret = hmacSecret;
    }
    // 发送验证码
    public SendResult sendCode(String email, String requestIp) {
        if (ParamCheck.isNullOrEmpty(email) || !ParamCheck.isAvailEmail(email)) {
            return SendResult.invalid("Invalid email format.");
        }
        // 频率限制，获取前序请求，进行时间限制
        Instant now = Instant.now();
        Instant lastSent = dbController.getLatestVerificationCreatedAt(email).orElse(null);
        if (lastSent != null) {
            long seconds = now.getEpochSecond() - lastSent.getEpochSecond();
            if (seconds < minResendSeconds) {
                return SendResult.tooManyRequests("Too many requests. Please try later.");
            }
        }
        // 生成6位验证码，计算Email+code 的hash，存储expired时间
        String code = generate6DigitCode();
        Instant expiresAt = now.plusSeconds(ttlSeconds);
        String codeHash = hashCode(email, code);

        dbController.insertVerificationCode(email, codeHash, expiresAt, requestIp);
        // 使用mime发送验证码
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(email);
            helper.setFrom(new InternetAddress(from, fromName, StandardCharsets.UTF_8.name()));
            helper.setSubject("AISP 邮箱验证码");
            helper.setText(buildVerificationEmailHtml(code), true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to send verification email", e);
        }

        return SendResult.ok();
    }
    // 验证码校验，两个元素，email + code
    public VerifyResult verifyCode(String email, String code) {
        if (ParamCheck.isNullOrEmpty(email) || !ParamCheck.isAvailEmail(email)) {
            return VerifyResult.invalid("Invalid email format.");
        }
        if (ParamCheck.isNullOrEmpty(code) || code.length() != 6) {
            return VerifyResult.invalid("Invalid code.");
        }

        String codeHash = hashCode(email, code);
        boolean ok = dbController.consumeVerificationCode(email, codeHash);
        if (!ok) {
            return VerifyResult.unauthorized("Invalid or expired code.");
        }

        dbController.markEmailVerified(email);
        return VerifyResult.ok();
    }

    private String generate6DigitCode() {
        int n = RNG.nextInt(1_000_000);
        return String.format("%06d", n);
    }

    private String hashCode(String email, String code) {
        // 绑定 email，避免同一 code 在不同邮箱间重放
        String input = email + ":" + code;

        if (hmacSecret != null && !hmacSecret.isBlank()) {
            return hmacSha256Hex(hmacSecret, input);
        }

        // 允许在没有配置 secret 的情况下跑起来，但建议生产一定要配 app.verify.hmacSecret
        return sha256Hex(input);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hmacSha256Hex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String formatFrom(String email, String name) {
        // SimpleMailMessage 的 from 是原样字符串；用 "Name <email>" 形式即可。
        if (name == null || name.isBlank()) return email;
        return name + " <" + email + ">";
    }

        private String buildVerificationEmailHtml(String code) {
                int ttlMinutes = Math.max(1, ttlSeconds / 60);
                // 纯内联样式，尽量兼容常见邮件客户端
                return """
                        <!doctype html>
                        <html lang="zh-CN">
                            <head>
                                <meta charset="utf-8" />
                                <meta name="viewport" content="width=device-width, initial-scale=1" />
                                <title>AISP 邮箱验证码</title>
                            </head>
                            <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
                                <div style="max-width:560px;margin:0 auto;padding:24px;">
                                    <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e9ecf5;">
                                        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px;">AISP 邮箱验证码</div>
                                        <div style="font-size:14px;color:#374151;line-height:1.6;">
                                            你好，你的验证码如下（用于登录/注册验证）：
                                        </div>
                                        <div style="margin:18px 0;padding:14px 16px;background:#f3f4f6;border-radius:10px;">
                                            <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">验证码</div>
                                            <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#111827;">%s</div>
                                        </div>
                                        <div style="font-size:14px;color:#374151;line-height:1.6;">
                                            有效期：<b>%d 分钟</b>
                                        </div>
                                        <div style="margin-top:18px;font-size:12px;color:#6b7280;line-height:1.6;">
                                            如果不是你本人操作，请忽略此邮件。
                                        </div>
                                    </div>
                                    <div style="text-align:center;margin-top:12px;font-size:12px;color:#9ca3af;">
                                        © AISP
                                    </div>
                                </div>
                            </body>
                        </html>
                        """.formatted(code, ttlMinutes);
        }

    public record SendResult(int status, String error) {
        public static SendResult ok() { return new SendResult(200, null); }
        public static SendResult invalid(String msg) { return new SendResult(400, msg); }
        public static SendResult tooManyRequests(String msg) { return new SendResult(429, msg); }
    }

    public record VerifyResult(int status, String error) {
        public static VerifyResult ok() { return new VerifyResult(200, null); }
        public static VerifyResult invalid(String msg) { return new VerifyResult(400, msg); }
        public static VerifyResult unauthorized(String msg) { return new VerifyResult(401, msg); }
        public boolean isSuccess() {
            return this.status == 200 && this.error == null;
        }
    }
}
