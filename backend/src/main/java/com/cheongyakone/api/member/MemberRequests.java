package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.member.EligibilityAnswer;
import com.cheongyakone.domain.notice.HousingCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;

public final class MemberRequests {

    private MemberRequests() {
    }

    public record Signup(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 2, max = 40) String nickname
    ) {
    }

    public record Login(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(max = 72) String password
    ) {
    }

    public record EmailRequest(
            @NotBlank @Email @Size(max = 320) String email
    ) {
    }

    public record TokenRequest(
            @NotBlank @Size(max = 200) String token
    ) {
    }

    public record ResetPassword(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Size(min = 8, max = 72) String newPassword
    ) {
    }

    public record UpdateProfile(
            @NotBlank @Size(min = 2, max = 40) String nickname
    ) {
    }

    public record ChangePassword(
            @NotBlank @Size(max = 72) String currentPassword,
            @NotBlank @Size(min = 8, max = 72) String newPassword
    ) {
    }

    public record Withdraw(
            @NotBlank @Size(max = 72) String password
    ) {
    }

    public record MergeFavorites(
            @NotEmpty @Size(max = 200) Set<@Valid @Positive Long> noticeIds
    ) {
    }

    public record MergeComparisons(
            @NotEmpty @Size(max = 3) List<@Valid @Positive Long> noticeIds
    ) {
    }

    public record SearchPreference(
            @Size(max = 40) String region,
            HousingCategory housingCategory,
            @NotNull SearchPreferenceStatus status,
            @NotNull SearchPreferenceSort sort
    ) {
    }

    public record EligibilityProfile(
            @NotNull EligibilityAnswer homeless,
            @NotNull EligibilityAnswer subscriptionAccount,
            @NotNull EligibilityAnswer newlywed,
            @NotNull EligibilityAnswer firstHome
    ) {
    }

    public record NotificationPreference(
            @NotNull Boolean applyStartEnabled,
            @NotNull Boolean deadline7dEnabled,
            @NotNull Boolean deadline3dEnabled,
            @NotNull Boolean deadline1dEnabled,
            @NotNull Boolean winnerEnabled,
            @NotNull Boolean newMatchingNoticeEnabled,
            Boolean noticeUpdatedEnabled,
            @NotNull Boolean emailEnabled
    ) {
    }
}
