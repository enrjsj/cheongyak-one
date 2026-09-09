package com.cheongyakone.api;

import com.cheongyakone.application.NoticeNotFoundException;
import com.cheongyakone.application.member.MemberApiException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NoticeNotFoundException.class)
    public ProblemDetail handleNotFound(NoticeNotFoundException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        detail.setTitle("Notice not found");
        return detail;
    }

    @ExceptionHandler(MemberApiException.class)
    public ProblemDetail handleMemberApi(MemberApiException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(exception.getStatus(), exception.getMessage());
        detail.setTitle("Member request failed");
        detail.setProperty("code", exception.getCode());
        return detail;
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    public ProblemDetail handleValidation(Exception exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "입력값을 다시 확인해주세요."
        );
        detail.setTitle("Invalid request");
        detail.setProperty("code", "VALIDATION_FAILED");
        return detail;
    }
}
