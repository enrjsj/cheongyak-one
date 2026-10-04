import { Component } from "react";
import type { ReactNode } from "react";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-recovery" aria-labelledby="recovery-title">
      <h1 id="recovery-title" tabIndex={-1} ref={node => { node?.focus(); }}>화면을 표시하지 못했어요</h1>
      <p role="alert">일시적인 화면 오류가 발생했습니다. 다시 시도하거나 페이지를 새로고침해주세요.</p>
      <p>다시 시도하면 저장되지 않은 입력은 초기화될 수 있습니다. 저장된 관심 목록이나 계정을 삭제하지 않습니다.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>화면 다시 시도</button>
      <button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>
    </main>;
  }
}
