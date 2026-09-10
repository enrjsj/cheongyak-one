import { FormEvent, useEffect, useState } from "react";
import {
  MemberGender,
  MemberMaritalStatus,
  MemberProfile,
  MemberProfileInput,
  MemberSession,
} from "./api";
import { useDialogAccessibility } from "./useDialogAccessibility";

export type MemberDialogMode = "login" | "signup" | "verify-email" | "forgot-password" | "reset-password" | "account" | null;

interface MemberDialogsProps {
  mode: MemberDialogMode;
  member?: MemberProfile;
  onModeChange: (mode: MemberDialogMode) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, profile: MemberProfileInput) => Promise<void>;
  onRequestEmailVerification: (email: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onResetPassword: (newPassword: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onUpdateProfile: (profile: MemberProfileInput) => Promise<void>;
  onDeletePersonalProfile: () => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onWithdraw: (password: string) => Promise<void>;
  onLoadSessions: () => Promise<MemberSession[]>;
  onRevokeSession: (sessionId: number) => Promise<void>;
  onRevokeOtherSessions: () => Promise<MemberSession[]>;
}

const RESIDENCE_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

function optionalNumber(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatConsentDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export default function MemberDialogs({
  mode,
  member,
  onModeChange,
  onLogin,
  onSignup,
  onRequestEmailVerification,
  onRequestPasswordReset,
  onResetPassword,
  onLogout,
  onUpdateProfile,
  onDeletePersonalProfile,
  onChangePassword,
  onWithdraw,
  onLoadSessions,
  onRevokeSession,
  onRevokeOtherSessions,
}: MemberDialogsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [nickname, setNickname] = useState("");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<MemberGender | "">("");
  const [maritalStatus, setMaritalStatus] = useState<MemberMaritalStatus | "">("");
  const [householdMemberCount, setHouseholdMemberCount] = useState("");
  const [childCount, setChildCount] = useState("");
  const [residenceRegion, setResidenceRegion] = useState("");
  const [personalProfileConsent, setPersonalProfileConsent] = useState(false);
  const [confirmPersonalProfileDeletion, setConfirmPersonalProfileDeletion] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessions, setSessions] = useState<MemberSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState<number | "others">();
  const [sessionError, setSessionError] = useState("");
  const dialogRef = useDialogAccessibility<HTMLElement>(Boolean(mode), () => onModeChange(null));

  useEffect(() => {
    setError("");
    setNotice("");
    setPassword("");
    setPasswordConfirmation("");
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setWithdrawPassword("");
    setConfirmWithdrawal(false);
    setConfirmPersonalProfileDeletion(false);
    setSignupStep(1);
    if (mode === "account" && member) {
      setNickname(member.nickname);
      setBirthDate(member.birthDate ?? "");
      setGender(member.gender ?? "");
      setMaritalStatus(member.maritalStatus ?? "");
      setHouseholdMemberCount(member.householdMemberCount?.toString() ?? "");
      setChildCount(member.childCount?.toString() ?? "");
      setResidenceRegion(member.residenceRegion ?? "");
      setPersonalProfileConsent(Boolean(member.personalProfileConsentedAt));
    } else if (mode === "signup") {
      setBirthDate("");
      setGender("");
      setMaritalStatus("");
      setHouseholdMemberCount("");
      setChildCount("");
      setResidenceRegion("");
      setPersonalProfileConsent(false);
    }
  }, [member, mode]);

  useEffect(() => {
    if (mode !== "account" || !member) {
      setSessions([]);
      setSessionError("");
      return;
    }

    let cancelled = false;
    setSessionsLoading(true);
    setSessionError("");
    onLoadSessions()
      .then((items) => {
        if (!cancelled) setSessions(items);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setSessionError(requestError instanceof Error ? requestError.message : "로그인 기기를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [member, mode, onLoadSessions]);

  if (!mode) return null;

  const execute = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const submitAuthentication = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup") {
      if (signupStep === 1) {
        if (password !== passwordConfirmation) {
          setError("비밀번호 확인이 일치하지 않습니다.");
          return;
        }
        setError("");
        setSignupStep(2);
        return;
      }
      if (password !== passwordConfirmation) {
        setError("비밀번호 확인이 일치하지 않습니다.");
        return;
      }
      if (hasPersonalProfileInput && !personalProfileConsent) {
        setError("맞춤 정보를 저장하려면 선택 개인정보 수집·이용에 동의해주세요.");
        return;
      }
      void execute(() => onSignup(email, password, profileInput()));
    } else {
      void execute(() => onLogin(email, password));
    }
  };

  const profileInput = (): MemberProfileInput => ({
    nickname,
    birthDate: birthDate || undefined,
    gender: gender || undefined,
    maritalStatus: maritalStatus || undefined,
    householdMemberCount: optionalNumber(householdMemberCount),
    childCount: optionalNumber(childCount),
    residenceRegion: residenceRegion || undefined,
    personalProfileConsent: personalProfileConsent || undefined,
  });

  const hasPersonalProfileInput = Boolean(
    birthDate || gender || maritalStatus || householdMemberCount || childCount || residenceRegion,
  );

  const title = mode === "account" ? "회원 관리"
    : mode === "signup" ? "회원가입"
      : mode === "verify-email" ? "이메일 인증"
        : mode === "forgot-password" ? "비밀번호 찾기"
          : mode === "reset-password" ? "새 비밀번호 설정"
            : "로그인";

  return (
    <div className="modal-backdrop member-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onModeChange(null);
    }}>
      <section ref={dialogRef} tabIndex={-1} className={`modal member-modal${mode === "signup" || mode === "account" ? " member-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="member-dialog-title">
        <div className="modal-head">
          <div>
            <span>{mode === "account" ? "MY ACCOUNT" : "MEMBER"}</span>
            <h2 id="member-dialog-title">
              {title}
            </h2>
          </div>
          <button type="button" onClick={() => onModeChange(null)} disabled={busy} aria-label="닫기">×</button>
        </div>

        {mode === "verify-email" ? (
          <form className="member-form" onSubmit={(event) => {
            event.preventDefault();
            void execute(
              () => onRequestEmailVerification(email),
              "가입 여부와 관계없이 인증 가능한 계정에는 메일을 보냈습니다.",
            );
          }}>
            <p className="member-flow-description">가입한 이메일로 전송된 인증 링크를 열어주세요. 받지 못했다면 아래에서 다시 요청할 수 있습니다.</p>
            <label>이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={320} autoComplete="email" required /></label>
            {notice && <p className="member-message success" role="status">{notice}</p>}
            {error && <p className="member-message error" role="alert">{error}</p>}
            <button className="primary-button member-submit" type="submit" disabled={busy}>{busy ? "요청 중…" : "인증 메일 다시 받기"}</button>
            <button className="member-flow-link" type="button" onClick={() => onModeChange("login")}>인증을 완료했어요 · 로그인</button>
          </form>
        ) : mode === "forgot-password" ? (
          <form className="member-form" onSubmit={(event) => {
            event.preventDefault();
            void execute(
              () => onRequestPasswordReset(email),
              "가입 여부와 관계없이 재설정 가능한 계정에는 메일을 보냈습니다.",
            );
          }}>
            <p className="member-flow-description">가입한 이메일을 입력하면 30분 동안 사용할 수 있는 비밀번호 재설정 링크를 보내드립니다.</p>
            <label>이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={320} autoComplete="email" required /></label>
            {notice && <p className="member-message success" role="status">{notice}</p>}
            {error && <p className="member-message error" role="alert">{error}</p>}
            <button className="primary-button member-submit" type="submit" disabled={busy}>{busy ? "요청 중…" : "재설정 메일 받기"}</button>
            <button className="member-flow-link" type="button" onClick={() => onModeChange("login")}>로그인으로 돌아가기</button>
          </form>
        ) : mode === "reset-password" ? (
          <form className="member-form" onSubmit={(event) => {
            event.preventDefault();
            if (newPassword !== newPasswordConfirmation) {
              setError("새 비밀번호 확인이 일치하지 않습니다.");
              return;
            }
            void execute(() => onResetPassword(newPassword));
          }}>
            <p className="member-flow-description">다른 서비스에서 사용하지 않는 새 비밀번호를 입력해주세요. 변경하면 기존 로그인은 모두 종료됩니다.</p>
            <label>새 비밀번호<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
            <label>새 비밀번호 확인<input value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
            {error && <p className="member-message error" role="alert">{error}</p>}
            <button className="primary-button member-submit" type="submit" disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</button>
          </form>
        ) : mode !== "account" ? (
          <>
            <div className="member-tabs" role="tablist" aria-label="회원 메뉴">
              <button className={mode === "login" ? "active" : ""} type="button" role="tab" aria-selected={mode === "login"} onClick={() => onModeChange("login")}>로그인</button>
              <button className={mode === "signup" ? "active" : ""} type="button" role="tab" aria-selected={mode === "signup"} onClick={() => onModeChange("signup")}>회원가입</button>
            </div>
            <form className="member-form" onSubmit={submitAuthentication}>
              {mode === "signup" && (
                <ol className="signup-progress" aria-label="회원가입 진행 단계">
                  <li className={signupStep === 1 ? "active" : "complete"}><span>1</span><b>계정 정보</b></li>
                  <li className={signupStep === 2 ? "active" : ""}><span>2</span><b>맞춤 정보</b></li>
                </ol>
              )}
              {mode === "signup" && signupStep === 1 ? (
                <>
                  <div className="member-form-intro"><b>반가워요!</b><p>먼저 로그인에 필요한 기본 정보만 입력해주세요.</p></div>
                  <label>닉네임<input value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required /></label>
                  <label>이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={320} autoComplete="email" required /></label>
                  <div className="member-form-grid">
                    <label>비밀번호<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
                    <label>비밀번호 확인<input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
                  </div>
                  <p className="field-help">8자 이상 입력해주세요. 가입 후 이메일 인증이 필요합니다.</p>
                </>
              ) : mode === "signup" ? (
                <>
                  <div className="profile-benefit-card">
                    <span aria-hidden="true">⌂</span>
                    <div><b>내게 맞는 청약을 더 빨리 찾아드릴게요</b><p>아래 항목은 모두 선택사항이며 추천 보조에만 사용됩니다. 직접 비우거나 회원 탈퇴 시 제거됩니다.</p></div>
                  </div>
                  <div className="member-form-grid profile-fields">
                    <label>생년월일 <small>선택</small><input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} type="date" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" /></label>
                    <label>거주 지역 <small>선택</small><select value={residenceRegion} onChange={(event) => setResidenceRegion(event.target.value)}><option value="">선택하지 않음</option>{RESIDENCE_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label>
                    <label>성별 <small>선택</small><select value={gender} onChange={(event) => setGender(event.target.value as MemberGender | "")}><option value="">응답하지 않음</option><option value="FEMALE">여성</option><option value="MALE">남성</option><option value="OTHER">기타</option></select></label>
                    <label>혼인 상태 <small>선택</small><select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value as MemberMaritalStatus | "")}><option value="">선택하지 않음</option><option value="SINGLE">미혼</option><option value="MARRIED">기혼</option></select></label>
                    <label>가구원 수 <small>선택</small><input value={householdMemberCount} onChange={(event) => setHouseholdMemberCount(event.target.value)} type="number" min={1} max={20} inputMode="numeric" placeholder="본인 포함" /></label>
                    <label>자녀 수 <small>선택</small><input value={childCount} onChange={(event) => setChildCount(event.target.value)} type="number" min={0} max={20} inputMode="numeric" placeholder="0" /></label>
                  </div>
                  <p className="privacy-note">성별은 프로필에만 저장되며 현재 추천 점수나 청약 자격 판정에는 사용하지 않습니다.</p>
                  <label className="profile-consent">
                    <input type="checkbox" checked={personalProfileConsent} onChange={(event) => setPersonalProfileConsent(event.target.checked)} />
                    <span><b>[선택] 맞춤 추천을 위한 개인정보 수집·이용에 동의합니다.</b><small>목적: 공고 추천 및 자격 사전점검 보조 · 항목: 생년월일, 성별, 혼인 상태, 가구원·자녀 수, 거주 지역 · 보유: 맞춤정보 삭제 또는 회원 탈퇴까지</small><em>동의하지 않아도 선택정보 없이 가입할 수 있습니다.</em></span>
                  </label>
                  {hasPersonalProfileInput && !personalProfileConsent && <p className="consent-required" role="status">입력한 맞춤 정보를 저장하려면 위 동의가 필요합니다.</p>}
                </>
              ) : (
                <>
                  <label>이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={320} autoComplete="email" required /></label>
                  <label>비밀번호<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" maxLength={72} autoComplete="current-password" required /></label>
                </>
              )}
              {error && <p className="member-message error" role="alert">{error}</p>}
              {mode === "signup" && signupStep === 2 && <button className="member-back-button" type="button" onClick={() => setSignupStep(1)} disabled={busy}>이전 단계</button>}
              <button className="primary-button member-submit" type="submit" disabled={busy || (mode === "signup" && signupStep === 2 && hasPersonalProfileInput && !personalProfileConsent)}>{busy ? "처리 중…" : mode === "signup" ? signupStep === 1 ? "맞춤 정보 입력하기" : "가입 완료하기" : "로그인"}</button>
              {mode === "signup" && signupStep === 2 && <button className="member-skip-button" type="button" disabled={busy} onClick={() => void execute(() => onSignup(email, password, { nickname }))}>선택정보 없이 가입</button>}
              {mode === "login" && (
                <div className="member-flow-actions">
                  <button type="button" onClick={() => onModeChange("forgot-password")}>비밀번호를 잊으셨나요?</button>
                  <button type="button" onClick={() => onModeChange("verify-email")}>인증 메일 다시 받기</button>
                </div>
              )}
            </form>
          </>
        ) : member ? (
          <div className="account-sections">
            <div className="account-summary"><span>{member.nickname.slice(0, 1)}</span><div><b>{member.nickname}</b><small>{member.email}</small></div></div>

            <form className="account-section" onSubmit={(event) => {
              event.preventDefault();
              if (hasPersonalProfileInput && !personalProfileConsent) {
                setError("맞춤 정보를 저장하려면 선택 개인정보 수집·이용에 동의해주세요.");
                return;
              }
              void execute(() => onUpdateProfile(profileInput()), "맞춤 프로필을 저장했습니다.");
            }}>
              <div className="account-section-heading"><div><h3>맞춤 프로필</h3><p>저장한 정보는 공고 추천과 향후 자격 사전점검을 돕는 데 사용됩니다.</p></div><span>{member.personalProfileConsentedAt ? `동의 ${formatConsentDate(member.personalProfileConsentedAt)}` : "선택 입력"}</span></div>
              <label>닉네임<input value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={40} required /></label>
              <div className="member-form-grid profile-fields">
                <label>생년월일<input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} type="date" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" /></label>
                <label>거주 지역<select value={residenceRegion} onChange={(event) => setResidenceRegion(event.target.value)}><option value="">선택하지 않음</option>{RESIDENCE_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label>
                <label>성별<select value={gender} onChange={(event) => setGender(event.target.value as MemberGender | "")}><option value="">응답하지 않음</option><option value="FEMALE">여성</option><option value="MALE">남성</option><option value="OTHER">기타</option></select></label>
                <label>혼인 상태<select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value as MemberMaritalStatus | "")}><option value="">선택하지 않음</option><option value="SINGLE">미혼</option><option value="MARRIED">기혼</option></select></label>
                <label>가구원 수<input value={householdMemberCount} onChange={(event) => setHouseholdMemberCount(event.target.value)} type="number" min={1} max={20} placeholder="본인 포함" /></label>
                <label>자녀 수<input value={childCount} onChange={(event) => setChildCount(event.target.value)} type="number" min={0} max={20} placeholder="0" /></label>
              </div>
              <p className="privacy-note">모든 항목은 언제든 비우거나 수정할 수 있습니다. 성별은 추천 점수와 자격 판정에 사용하지 않습니다.</p>
              <label className="profile-consent">
                <input type="checkbox" checked={personalProfileConsent} onChange={(event) => setPersonalProfileConsent(event.target.checked)} />
                <span><b>[선택] 맞춤 추천을 위한 개인정보 수집·이용에 동의합니다.</b><small>목적: 공고 추천 및 자격 사전점검 보조 · 항목: 생년월일, 성별, 혼인 상태, 가구원·자녀 수, 거주 지역 · 보유: 맞춤정보 삭제 또는 회원 탈퇴까지</small></span>
              </label>
              {hasPersonalProfileInput && !personalProfileConsent && <p className="consent-required" role="status">입력한 맞춤 정보를 저장하려면 위 동의가 필요합니다.</p>}
              <div className="profile-form-actions">
                {(member.personalProfileConsentedAt || member.birthDate || member.gender || member.maritalStatus || member.householdMemberCount != null || member.childCount != null || member.residenceRegion) && (
                  <button className="danger-text-button" type="button" onClick={() => setConfirmPersonalProfileDeletion((value) => !value)} disabled={busy}>맞춤 정보 전체 삭제</button>
                )}
                <button className="secondary-button" type="submit" disabled={busy || (hasPersonalProfileInput && !personalProfileConsent)}>프로필 저장</button>
              </div>
              {confirmPersonalProfileDeletion && (
                <div className="profile-delete-box" role="alert">
                  <div><b>맞춤 정보를 모두 삭제할까요?</b><p>닉네임과 계정은 유지되며 선택정보와 동의 이력만 즉시 삭제됩니다.</p></div>
                  <div><button type="button" onClick={() => setConfirmPersonalProfileDeletion(false)} disabled={busy}>취소</button><button className="danger-button" type="button" disabled={busy} onClick={() => void execute(onDeletePersonalProfile, "맞춤 정보를 모두 삭제했습니다.")}>{busy ? "삭제 중…" : "삭제"}</button></div>
                </div>
              )}
            </form>

            <form className="account-section" onSubmit={(event) => {
              event.preventDefault();
              if (newPassword !== newPasswordConfirmation) {
                setError("새 비밀번호 확인이 일치하지 않습니다.");
                return;
              }
              void execute(() => onChangePassword(currentPassword, newPassword));
            }}>
              <h3>비밀번호 변경</h3>
              <label>현재 비밀번호<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
              <label>새 비밀번호<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
              <label>새 비밀번호 확인<input value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
              <p className="field-help">변경하면 모든 기기에서 로그아웃됩니다.</p>
              <button className="secondary-button" type="submit" disabled={busy}>비밀번호 변경</button>
            </form>

            <section className="account-section session-section" aria-busy={sessionsLoading}>
              <div className="session-heading">
                <div><h3>로그인 기기</h3><p>현재 계정에 로그인된 기기를 확인하고 종료할 수 있습니다.</p></div>
                {sessions.filter((session) => !session.current).length > 0 && (
                  <button type="button" disabled={sessionBusy !== undefined} onClick={() => {
                    setSessionBusy("others");
                    setSessionError("");
                    void onRevokeOtherSessions()
                      .then(setSessions)
                      .catch((requestError: unknown) => setSessionError(requestError instanceof Error ? requestError.message : "다른 기기를 종료하지 못했습니다."))
                      .finally(() => setSessionBusy(undefined));
                  }}>{sessionBusy === "others" ? "종료 중…" : "다른 기기 모두 종료"}</button>
                )}
              </div>
              {sessionsLoading ? <p className="session-state">로그인 기기를 확인하고 있습니다…</p> : sessions.map((session) => (
                <article className={`session-item${session.current ? " current" : ""}`} key={session.id}>
                  <span className="session-device" aria-hidden="true">{session.current ? "●" : "○"}</span>
                  <div>
                    <b>{session.clientName}{session.current && <em>현재 기기</em>}</b>
                    <small>{formatSessionDate(session.createdAt)} 로그인</small>
                    <small>{formatSessionDate(session.expiresAt)} 자동 만료</small>
                  </div>
                  {!session.current && <button type="button" disabled={sessionBusy !== undefined} onClick={() => {
                    setSessionBusy(session.id);
                    setSessionError("");
                    void onRevokeSession(session.id)
                      .then(() => setSessions((items) => items.filter((item) => item.id !== session.id)))
                      .catch((requestError: unknown) => setSessionError(requestError instanceof Error ? requestError.message : "로그인 기기를 종료하지 못했습니다."))
                      .finally(() => setSessionBusy(undefined));
                  }}>{sessionBusy === session.id ? "종료 중…" : "종료"}</button>}
                </article>
              ))}
              {!sessionsLoading && sessions.length === 0 && !sessionError && <p className="session-state">표시할 로그인 기기가 없습니다.</p>}
              {sessionError && <p className="member-message error" role="alert">{sessionError}</p>}
            </section>

            {notice && <p className="member-message success" role="status">{notice}</p>}
            {error && <p className="member-message error" role="alert">{error}</p>}

            <div className="account-actions">
              <button type="button" onClick={() => void execute(onLogout)} disabled={busy}>로그아웃</button>
              <button className="danger-link" type="button" onClick={() => setConfirmWithdrawal((value) => !value)} disabled={busy}>회원 탈퇴</button>
            </div>

            {confirmWithdrawal && (
              <form className="withdraw-box" onSubmit={(event) => {
                event.preventDefault();
                void execute(() => onWithdraw(withdrawPassword));
              }}>
                <b>정말 탈퇴하시겠어요?</b>
                <p>개인정보는 익명화되고 관심청약과 모든 로그인 세션이 삭제됩니다.</p>
                <label>확인을 위해 비밀번호 입력<input value={withdrawPassword} onChange={(event) => setWithdrawPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
                <button type="submit" disabled={busy}>회원 탈퇴 확정</button>
              </form>
            )}
          </div>
        ) : (
          <p className="member-empty">로그인 정보가 없습니다.</p>
        )}
      </section>
    </div>
  );
}
