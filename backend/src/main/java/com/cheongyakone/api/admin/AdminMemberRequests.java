package com.cheongyakone.api.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AdminMemberRequests {

    private AdminMemberRequests() {
    }

    public record Suspend(
            @NotBlank @Size(max = 200) String reason
    ) {
    }
}
