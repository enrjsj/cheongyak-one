package com.cheongyakone.application.member;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class LoginClientParser {

    private static final String UNKNOWN_CLIENT = "알 수 없는 기기";

    public String parse(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return UNKNOWN_CLIENT;
        }

        String browser = browser(userAgent);
        String operatingSystem = operatingSystem(userAgent);
        if (browser == null && operatingSystem == null) {
            return UNKNOWN_CLIENT;
        }
        if (browser == null) {
            return operatingSystem;
        }
        if (operatingSystem == null) {
            return browser;
        }
        return browser + " · " + operatingSystem;
    }

    private String browser(String userAgent) {
        if (userAgent.contains("Edg/")) return "Edge";
        if (userAgent.contains("OPR/") || userAgent.contains("Opera/")) return "Opera";
        if (userAgent.contains("CriOS/") || userAgent.contains("Chrome/")) return "Chrome";
        if (userAgent.contains("FxiOS/") || userAgent.contains("Firefox/")) return "Firefox";
        if (userAgent.contains("Safari/")) return "Safari";
        return null;
    }

    private String operatingSystem(String userAgent) {
        if (userAgent.contains("iPhone")) return "iPhone";
        if (userAgent.contains("iPad")) return "iPad";
        if (userAgent.contains("Android")) return "Android";
        if (userAgent.contains("Windows")) return "Windows";
        if (userAgent.contains("Mac OS X") || userAgent.contains("Macintosh")) return "macOS";
        if (userAgent.contains("Linux")) return "Linux";
        return null;
    }
}
