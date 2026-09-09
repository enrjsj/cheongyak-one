package com.cheongyakone.api.admin;

import java.util.List;

public record AdminMemberPageResponse(
        List<AdminMemberResponse> members,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
