package com.cheongyakone;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("migration-test")
class MigrationValidationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesFlywayMigrationsBeforeJpaValidation() {
        // 애플리케이션이 실제로 사용하는 핵심 테이블이 마이그레이션으로 생성됐는지 확인한다.
        Integer noticeTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'subscription_notice'",
                Integer.class
        );
        Integer syncTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'sync_execution'",
                Integer.class
        );
        Integer memberTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'app_member'",
                Integer.class
        );
        Integer preferenceTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'member_search_preference'",
                Integer.class
        );
        Integer sessionClientColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'member_login_session' AND column_name = 'client_name'",
                Integer.class
        );
        Integer notificationTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'member_notification'",
                Integer.class
        );
        Integer notificationPreferenceTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_name = 'member_notification_preference'",
                Integer.class
        );
        Integer recommendationDismissalTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_name = 'member_recommendation_dismissal'",
                Integer.class
        );
        Integer memberRoleColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'app_member' AND column_name = 'member_role'",
                Integer.class
        );
        Integer comparisonTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_name = 'member_comparison'",
                Integer.class
        );
        Integer actionTokenTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_name = 'member_action_token'",
                Integer.class
        );
        Integer emailVerifiedColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'app_member' AND column_name = 'email_verified_at'",
                Integer.class
        );
        Integer notificationEmailColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'member_notification' AND column_name = 'email_next_attempt_at'",
                Integer.class
        );
        Integer preferenceEmailColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'member_notification_preference' AND column_name = 'email_enabled'",
                Integer.class
        );
        Integer adminAuditTableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'admin_audit_log'",
                Integer.class
        );
        Integer suspendedAtColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'app_member' AND column_name = 'suspended_at'",
                Integer.class
        );
        Integer auditDetailsColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'admin_audit_log' AND column_name = 'details'",
                Integer.class
        );
        Integer firstSeenAtColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'subscription_notice' AND column_name = 'first_seen_at'",
                Integer.class
        );
        Integer matchingNoticePreferenceColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'member_notification_preference' "
                        + "AND column_name = 'new_matching_notice_enabled'",
                Integer.class
        );
        Integer noticeDetailColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'subscription_notice' AND column_name IN ("
                        + "'postal_code', 'housing_detail_type', 'rent_type', 'business_entity_name', "
                        + "'construction_company_name', 'contact_phone', 'homepage_url', "
                        + "'move_in_planned_month', 'special_supply_start_date', "
                        + "'special_supply_end_date', 'contract_start_date', 'contract_end_date')",
                Integer.class
        );
        Integer noticeChangedAtColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'subscription_notice' AND column_name = 'content_changed_at'",
                Integer.class
        );
        Integer noticeUpdatedPreferenceColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'member_notification_preference' "
                        + "AND column_name = 'notice_updated_enabled'",
                Integer.class
        );
        Integer noticeChangeSummaryColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_name = 'subscription_notice' AND column_name = 'last_change_summary'",
                Integer.class
        );

        assertThat(noticeTableCount).isEqualTo(1);
        assertThat(syncTableCount).isEqualTo(1);
        assertThat(memberTableCount).isEqualTo(1);
        assertThat(preferenceTableCount).isEqualTo(1);
        assertThat(sessionClientColumnCount).isEqualTo(1);
        assertThat(notificationTableCount).isEqualTo(1);
        assertThat(notificationPreferenceTableCount).isEqualTo(1);
        assertThat(recommendationDismissalTableCount).isEqualTo(1);
        assertThat(memberRoleColumnCount).isEqualTo(1);
        assertThat(comparisonTableCount).isEqualTo(1);
        assertThat(actionTokenTableCount).isEqualTo(1);
        assertThat(emailVerifiedColumnCount).isEqualTo(1);
        assertThat(notificationEmailColumnCount).isEqualTo(1);
        assertThat(preferenceEmailColumnCount).isEqualTo(1);
        assertThat(adminAuditTableCount).isEqualTo(1);
        assertThat(suspendedAtColumnCount).isEqualTo(1);
        assertThat(auditDetailsColumnCount).isEqualTo(1);
        assertThat(firstSeenAtColumnCount).isEqualTo(1);
        assertThat(matchingNoticePreferenceColumnCount).isEqualTo(1);
        assertThat(noticeDetailColumnCount).isEqualTo(12);
        assertThat(noticeChangedAtColumnCount).isEqualTo(1);
        assertThat(noticeUpdatedPreferenceColumnCount).isEqualTo(1);
        assertThat(noticeChangeSummaryColumnCount).isEqualTo(1);
    }
}
