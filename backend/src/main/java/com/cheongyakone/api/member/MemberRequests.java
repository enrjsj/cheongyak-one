package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.EligibilityAnswer;
import com.cheongyakone.domain.member.MemberGender;
import com.cheongyakone.domain.member.MemberMaritalStatus;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.member.FavoriteProgress;
import com.cheongyakone.domain.notice.HousingCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public final class MemberRequests {

    private MemberRequests() {
    }

    public record Signup(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 2, max = 40) String nickname,
            @Past LocalDate birthDate,
            MemberGender gender,
            MemberMaritalStatus maritalStatus,
            @Min(1) @Max(20) Integer householdMemberCount,
            @Min(0) @Max(20) Integer childCount,
            @Size(max = 20) String residenceRegion,
            Boolean personalProfileConsent
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
            @NotBlank @Size(min = 2, max = 40) String nickname,
            @Past LocalDate birthDate,
            MemberGender gender,
            MemberMaritalStatus maritalStatus,
            @Min(1) @Max(20) Integer householdMemberCount,
            @Min(0) @Max(20) Integer childCount,
            @Size(max = 20) String residenceRegion,
            Boolean personalProfileConsent
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

    public record FavoriteTracker(
            @NotNull FavoriteProgress progress,
            @Size(max = 500) String memo
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
            @NotNull SearchPreferenceSort sort,
            @PositiveOrZero @Max(1000000) Integer minPriceManwon,
            @PositiveOrZero @Max(1000000) Integer maxPriceManwon
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
