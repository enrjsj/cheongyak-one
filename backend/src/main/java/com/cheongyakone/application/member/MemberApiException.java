package com.cheongyakone.application.member;

import org.springframework.http.HttpStatus;

public class MemberApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public MemberApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
