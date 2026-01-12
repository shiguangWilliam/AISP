package com.medisage.utils;

import org.apache.commons.codec.digest.DigestUtils;


public class PasswordHash {
    public static String hashPassword(String password){
        String sha256Hex =DigestUtils.sha256Hex(password);
        return sha256Hex;
    }
}
