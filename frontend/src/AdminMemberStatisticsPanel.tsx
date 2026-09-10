import { useEffect, useState } from "react";
import {
  AdminMemberStatisticBucket,
  AdminMemberStatistics,
  fetchAdminMemberStatistics,
} from "./api";

interface DistributionProps {
  title: string;
  description: string;
  buckets: AdminMemberStatisticBucket[];
}

function Distribution({ title, description, buckets }: DistributionProps) {
  const maximum = Math.max(...buckets.map((bucket) => bucket.count), 1);
  return (
    <section className="admin-stat-distribution">
      <div><b>{title}</b><small>{description}</small></div>
      <ul>
        {buckets.map((bucket) => (
          <li key={bucket.key}>
            <span>{bucket.label}</span>
            <div aria-hidden="true"><i style={{ width: `${(bucket.count / maximum) * 100}%` }} /></div>
            <strong>{bucket.count.toLocaleString("ko-KR")}명</strong>
          </li>
        ))}
        {buckets.length === 0 && <li className="empty">아직 집계할 응답이 없습니다.</li>}
      </ul>
    </section>
  );
}

export default function AdminMemberStatisticsPanel() {
  const [statistics, setStatistics] = useState<AdminMemberStatistics>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAdminMemberStatistics()
      .then((result) => { if (!cancelled) setStatistics(result); })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "회원 통계를 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);

  if (loading && !statistics) return <p className="admin-sync-loading" role="status">회원 통계를 집계하는 중…</p>;
  if (error && !statistics) return <div className="admin-sync-error" role="alert"><p>{error}</p><button type="button" onClick={() => setVersion((value) => value + 1)}>다시 시도</button></div>;
  if (!statistics) return null;

  const consentRate = statistics.activeMemberCount === 0
    ? 0
    : Math.round((statistics.consentedProfileCount / statistics.activeMemberCount) * 100);

  return (
    <div className="admin-member-statistics">
      <div className="admin-stat-headline">
        <div><b>동의 회원 프로필 통계</b><small>활성 회원의 선택정보를 집계한 결과입니다.</small></div>
        <button type="button" disabled={loading} onClick={() => setVersion((value) => value + 1)}>{loading ? "갱신 중…" : "새로고침"}</button>
      </div>
      {error && <p className="admin-member-message error" role="alert">{error}</p>}
      <div className="admin-stat-summary">
        <div><span>활성 회원</span><strong>{statistics.activeMemberCount.toLocaleString("ko-KR")}명</strong></div>
        <div><span>프로필 동의</span><strong>{statistics.consentedProfileCount.toLocaleString("ko-KR")}명</strong></div>
        <div><span>동의율</span><strong>{consentRate}%</strong></div>
      </div>
      <p className="admin-stat-privacy">개인별 생년월일·성별 등 원본 정보는 표시하지 않으며, 동의한 회원의 응답만 구간별 숫자로 제공합니다.</p>
      <div className="admin-stat-grid">
        <Distribution title="성별" description="청약 자격 판정에는 사용하지 않음" buckets={statistics.genders} />
        <Distribution title="연령대" description="생년월일을 기준으로 집계" buckets={statistics.ageGroups} />
        <Distribution title="혼인 상태" description="선택 응답 기준" buckets={statistics.maritalStatuses} />
        <Distribution title="거주 지역" description="응답이 있는 지역만 표시" buckets={statistics.residenceRegions} />
        <Distribution title="가구원 수" description="본인 포함 가구 규모" buckets={statistics.householdSizes} />
        <Distribution title="자녀 수" description="선택 응답 기준" buckets={statistics.childCounts} />
      </div>
    </div>
  );
}
