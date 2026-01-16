package com.medisage.utils;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
public class PasswordHash {
    private PasswordHash() {}

    private static final int BCRYPT_STRENGTH = 12;
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder(BCRYPT_STRENGTH);
    public static String hashPassword(String password) {
        return BCRYPT.encode(password);
    }

    public static String hashPasswordWithSalt(String password, String salt) {
        return BCRYPT.encode(password + salt);
    }

    public static boolean matches(String rawPassword, String storedHash) {
        if (rawPassword == null || storedHash == null) return false;

        if (isBcryptHash(storedHash)) {
            try {
                return BCRYPT.matches(rawPassword, storedHash);
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }

        if (isLegacySha256Hex(storedHash)) {
            String legacy = legacySha256Hex(rawPassword);
            return constantTimeEqualsAscii(legacy, storedHash);
        }

        return false;
    }

    public static boolean matchesWithSalt(String rawPassword, String salt, String storedHash) {
        if (rawPassword == null || salt == null || storedHash == null) return false;
        if (!isBcryptHash(storedHash)) return false;
        try {
            return BCRYPT.matches(rawPassword + salt, storedHash);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public static boolean isBcryptHash(String hash) {
        if (hash == null) return false;
        return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
    }

    /**
     * 兼容旧版：如果你历史数据里存的是 sha256Hex(password)，允许登录时验证并在成功后升级为 bcrypt。
     */
    public static boolean isLegacySha256Hex(String hash) {
        if (hash == null || hash.length() != 64) return false;
        for (int i = 0; i < hash.length(); i++) {
            char c = hash.charAt(i);
            boolean isHex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!isHex) return false;
        }
        return true;
    }

    private static String legacySha256Hex(String input) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return toHexLower(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static String toHexLower(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        final char[] HEX = "0123456789abcdef".toCharArray();
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            out[i * 2] = HEX[v >>> 4];
            out[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(out);
    }

    private static boolean constantTimeEqualsAscii(String a, String b) {
        if (a == null || b == null) return false;
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }
}
