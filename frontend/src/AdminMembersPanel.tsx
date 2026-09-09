import { FormEvent, useEffect, useState } from "react";
import {
  AdminMemberPage,
  AdminMemberStatus,
  fetchAdminMembers,
  reactivateAdminMember,
  revokeAdminMemberSessions,
  suspendAdminMember,
  unlockAdminMember,
} from "./api";

interface AdminMembersPanelProps {
  currentMemberId: number;
}

const EMPTY_PAGE: AdminMemberPage = {
  members: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

function formatDate(value?: string | null): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default function AdminMembersPanel({ currentMemberId }: AdminMembersPanelProps) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminMemberStatus | "">("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<AdminMemberPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAdminMembers(query, status, page)
      .then((response) => { if (!cancelled) setResult(response); })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "회원 목록을 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, status, page, version]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setQuery(draftQuery.trim());
    setVersion((value) => value + 1);
  };

  const unlock = async (memberId: number) => {
    setBusyId(memberId);
    setError("");
    setNotice("");
    try {
      await unlockAdminMember(memberId);
      setNotice("로그인 잠금을 해제했습니다.");
      setVersion((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "잠금을 해제하지 못했습니다.");
    } finally {
      setBusyId(undefined);
    }
  };

  const revokeSessions = async (memberId: number) => {
    if (!window.confirm("이 회원의 모든 로그인 세션을 종료할까요?")) return;
    setBusyId(memberId);
    setError("");
    setNotice("");
    try {
      await revokeAdminMemberSessions(memberId);
      setNotice("회원의 모든 로그인 세션을 종료했습니다.");
      setVersion((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "로그인 세션을 종료하지 못했습니다.");
    } finally {
      setBusyId(undefined);
    }
  };

  const suspend = async (memberId: number) => {
    const reason = window.prompt("회원 이용정지 사유를 입력해주세요. (최대 200자)")?.trim();
    if (reason === undefined) return;
    if (!reason) {
      setError("이용정지 사유를 입력해주세요.");
      return;
    }
    if (reason.length > 200) {
      setError("이용정지 사유는 200자 이하로 입력해주세요.");
      return;
    }
    setBusyId(memberId);
    setError("");
    setNotice("");
    try {
      await suspendAdminMember(memberId, reason);
      setNotice("회원 이용을 정지하고 모든 세션을 종료했습니다.");
      setVersion((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "회원 이용을 정지하지 못했습니다.");
    } finally {
      setBusyId(undefined);
    }
  };

  const reactivate = async (memberId: number) => {
    if (!window.confirm("이 회원의 이용정지를 해제할까요?")) return;
    setBusyId(memberId);
    setError("");
    setNotice("");
    try {
      await reactivateAdminMember(memberId);
      setNotice("회원 이용정지를 해제했습니다.");
      setVersion((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "회원 이용정지를 해제하지 못했습니다.");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="admin-members-panel">
      <form className="admin-member-search" onSubmit={search}>
        <input value={draftQuery} maxLength={100} onChange={(event) => setDraftQuery(event.target.value)} placeholder="이메일 또는 닉네임 검색" aria-label="회원 검색어" />
        <select value={status} onChange={(event) => { setStatus(event.target.value as AdminMemberStatus | ""); setPage(0); }} aria-label="회원 상태">
          <option value="">전체 상태</option>
          <option value="ACTIVE">이용 중</option>
          <option value="SUSPENDED">이용정지</option>
          <option value="WITHDRAWN">탈퇴</option>
        </select>
        <button type="submit">검색</button>
      </form>

      <div className="admin-member-headline"><b>총 {result.totalElements.toLocaleString("ko-KR")}명</b><button type="button" disabled={loading} onClick={() => setVersion((value) => value + 1)}>{loading ? "조회 중…" : "새로고침"}</button></div>
      {error && <p className="admin-member-message error" role="alert">{error}</p>}
      {notice && <p className="admin-member-message success" role="status">{notice}</p>}
      {loading && result.members.length === 0 ? <p className="admin-sync-loading">회원 목록을 불러오는 중…</p> : (
        <div className="admin-member-list">
          {result.members.map((member) => {
            const locked = Boolean(member.lockedUntil && new Date(member.lockedUntil) > new Date());
            return (
              <article key={member.id} className={member.status.toLowerCase()}>
                <div className="admin-member-identity">
                  <div><b>{member.nickname}</b>{member.role === "ADMIN" && <em>관리자</em>}{member.status === "SUSPENDED" && <em className="suspended">이용정지</em>}{locked && <em className="locked">잠김</em>}</div>
                  <span>{member.email}</span>
                </div>
                <dl>
                  <div><dt>상태</dt><dd>{member.status === "ACTIVE" ? "이용 중" : member.status === "SUSPENDED" ? "이용정지" : "탈퇴"}</dd></div>
                  <div><dt>이메일</dt><dd>{member.emailVerified ? "인증" : "미인증"}</dd></div>
                  <div><dt>세션</dt><dd>{member.activeSessionCount}개</dd></div>
                  <div><dt>가입일</dt><dd>{formatDate(member.createdAt)}</dd></div>
                </dl>
                <div className="admin-member-actions">
                  <button type="button" disabled={busyId !== undefined || (!locked && member.failedLoginAttempts === 0) || member.status !== "ACTIVE"} onClick={() => void unlock(member.id)}>잠금 초기화</button>
                  <button type="button" className="danger" disabled={busyId !== undefined || member.activeSessionCount === 0 || member.id === currentMemberId} onClick={() => void revokeSessions(member.id)}>전체 로그아웃</button>
                  {member.status === "ACTIVE" && member.role !== "ADMIN" && member.id !== currentMemberId && <button type="button" className="danger" disabled={busyId !== undefined} onClick={() => void suspend(member.id)}>이용정지</button>}
                  {member.status === "SUSPENDED" && <button type="button" disabled={busyId !== undefined} onClick={() => void reactivate(member.id)}>정지 해제</button>}
                </div>
              </article>
            );
          })}
          {!loading && result.members.length === 0 && <p className="admin-sync-empty">조건에 맞는 회원이 없습니다.</p>}
        </div>
      )}

      {result.totalPages > 1 && <div className="admin-member-pages"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>이전</button><span>{page + 1} / {result.totalPages}</span><button type="button" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>다음</button></div>}
    </div>
  );
}
