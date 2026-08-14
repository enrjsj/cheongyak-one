package com.cheongyakone.application;

public class NoticeNotFoundException extends RuntimeException {

    public NoticeNotFoundException(Long id) {
        super("Subscription notice not found: " + id);
    }
}
