package com.medisage.utils;

public class ParamCheck {
    public static boolean isNullOrEmpty(String param){
        return param == null || param.trim().isEmpty();
    }

    public static boolean isAvailEmail(String email){
        String emailRegex = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$";
        return email != null && email.matches(emailRegex);
    }

    public static boolean isAbailPassword(String password){
        return password != null && password.length() >= 8;//长度大于8
    }

    public static boolean isAbailUsername(String username){
        String usernameRegex = "^\\w+$";
        if (username == null || !username.matches(usernameRegex)) {
            return false;
        }
        return username.length() >= 3 && username.length() <= 30 && username.matches(usernameRegex);//长度3-30
    }
}
