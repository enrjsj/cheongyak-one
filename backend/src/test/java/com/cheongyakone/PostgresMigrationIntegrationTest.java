package com.cheongyakone;

import com.cheongyakone.application.member.KakaoSelfStore;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("postgres-test")
@EnabledIfEnvironmentVariable(named = "POSTGRES_TEST_URL", matches = ".+")
class PostgresMigrationIntegrationTest extends NoticeMatchingContract {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private KakaoSelfStore kakaoSelfStore;

    @Test
    void validatesMigrationsAgainstRealPostgres() {
        // PostgreSQL 고유 문법과 Hibernate 매핑이 함께 정상인지 CI 컨테이너에서 확인한다.
        Integer appliedMigrations = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = TRUE",
                Integer.class
        );
        String databaseProduct = jdbcTemplate.execute(
                (ConnectionCallback<String>) connection -> connection.getMetaData().getDatabaseProductName()
        );

        assertThat(databaseProduct).isEqualTo("PostgreSQL");
        assertThat(appliedMigrations).isGreaterThanOrEqualTo(39);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM KAKAO_SELF_CONNECTION WHERE ID=1 AND ACCESS_TOKEN IS NULL AND REFRESH_TOKEN IS NULL", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM KAKAO_SELF_RECEIPT", Integer.class)).isZero();
        // Validate the summary subquery/table/column contract on PostgreSQL too (no connected owner or external call).
        assertThat(kakaoSelfStore.candidates(kakaoSelfStore.read(), LocalDate.of(2026, 10, 23))).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM pg_indexes WHERE indexname = 'ix_member_notification_history'", Integer.class)).isEqualTo(1);
    }
}
