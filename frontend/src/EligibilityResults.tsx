import { buildEligibilityCheckResult, eligibilityQuestions } from "./eligibilityTools";
import type { EligibilityAnswer } from "./eligibilityTools";
import "./eligibilityResults.css";

type Props = {
  answers: EligibilityAnswer[];
  onEdit: (index: number) => void;
  disabled?: boolean;
};

const answerTitles = ["무주택 세대", "청약통장", "신혼부부 공급 관심", "생애최초 공급 관심"];

export default function EligibilityResults({ answers, onEdit, disabled = false }: Props) {
  const result = buildEligibilityCheckResult(answers);
  const groups = [
    { priority: "FIRST", title: "먼저 확인할 항목", description: "기본 정보를 확인하거나 적용되는 공급 기준을 먼저 살펴보세요." },
    { priority: "NOTICE", title: "공고와 대조할 항목", description: "답변만으로 확인되지 않는 세부 조건이에요. 신청할 공고를 정한 뒤 대조하세요." },
  ] as const;
  return <div className="eligibility-results">
    <div className="eligibility-results-heading">
      <small>나의 확인 체크리스트</small>
      <h3 tabIndex={-1}>{result.headline}</h3>
      <p>답변 {result.answeredCount}/4개 · 미확인 답변 {result.unknownCount}개</p>
      <p>준비 순서를 정리한 결과예요. 항목 수는 자격 점수나 통과율이 아닙니다.</p>
    </div>
    <section className="eligibility-answer-summary" aria-labelledby="eligibility-answers-title">
      <h4 id="eligibility-answers-title">내 답변</h4>
      <ul>{eligibilityQuestions.map((question, index) => <li key={question.id}>
        <div><span>{answerTitles[index]}</span><strong>{index >= 2 && answers[index] === "NO" ? "이번에는 확인하지 않음" : question.options.find(option => option.value === answers[index])?.label ?? "미응답"}</strong></div>
        <button type="button" disabled={disabled} onClick={() => onEdit(index)} aria-label={`${answerTitles[index]} 답변 수정`}>수정</button>
      </li>)}</ul>
      <p>특별공급 답변은 관심 유형을 뜻하며, 해당 유형의 자격 여부가 아닙니다.</p>
    </section>
    {groups.map(group => {
      const items = result.items.filter(item => item.priority === group.priority);
      if (!items.length) return null;
      return <section className="eligibility-check-group" key={group.priority} aria-labelledby={`eligibility-group-${group.priority}`}>
        <h4 id={`eligibility-group-${group.priority}`}>{group.title} <span>{items.length}개</span></h4>
        <p>{group.description}</p>
        <ol>{items.map(item => <li key={item.id}>
          <h5>{item.title}</h5>
          <p>{item.reason}</p>
          <details open={item.priority === "FIRST"}>
            <summary>준비자료와 확인 방법</summary>
            <dl><dt>참고할 자료</dt><dd>{item.evidence}</dd><dt>다음 행동</dt><dd>{item.action}</dd></dl>
          </details>
        </li>)}</ol>
      </section>;
    })}
    <div className="eligibility-official-guide">
      <p className="eligibility-disclaimer"><strong>자격 판정 결과가 아닙니다.</strong> 실제 신청 가능 여부는 모집공고일의 관계 법령과 공식 공고문, 사업주체 심사 결과에 따라 달라질 수 있습니다.</p>
      <strong>신청 전에는 공식 공고문으로 확인하세요</strong>
      <p>관심 공고 상세에서 원문을 열어 모집공고일·공급 유형·신청자격·제출서류를 확인하세요. 필요한 서류와 발급 시점은 공고마다 다릅니다.</p>
      <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer">청약홈에서 청약자격 확인하기 (새 창)</a>
      <p>청약홈 조회 대상이 아닌 공고는 해당 공급기관의 안내를 확인하세요.</p>
    </div>
  </div>;
}
