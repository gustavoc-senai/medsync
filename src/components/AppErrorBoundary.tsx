import { Component, type ReactNode } from "react";
import AppRecovery from "./AppRecovery";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <AppRecovery />;
  }
}
