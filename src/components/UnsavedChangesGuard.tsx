import { useEffect, useRef, useState } from "react";
import { useBlocker, useLocation } from "react-router-dom";
import { setUnsavedChanges } from "../lib/formEvents";

export default function UnsavedChangesGuard() {
  const dirty = useRef(false);
  const [hasChanges, setHasChanges] = useState(false);
  const location = useLocation();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty.current &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    const clear = () => { dirty.current = false; setUnsavedChanges(false); setHasChanges(false); };
    const change = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("form.record-form, form[data-protect-changes]")) {
        dirty.current = true;
        setUnsavedChanges(true);
        setHasChanges(true);
      }
    };
    document.addEventListener("input", change);
    document.addEventListener("change", change);
    document.addEventListener("medsync:form-saved", clear);
    document.addEventListener("reset", clear);
    return () => {
      document.removeEventListener("input", change);
      document.removeEventListener("change", change);
      document.removeEventListener("medsync:form-saved", clear);
      document.removeEventListener("reset", clear);
    };
  }, []);
  useEffect(() => { dirty.current = false; setUnsavedChanges(false); }, [location.key]);
  useEffect(() => {
    if (!hasChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasChanges]);
  if (blocker.state !== "blocked") return null;
  return <div className="unsaved-overlay">
    <section className="surface unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); blocker.reset(); }
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll("button");
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
      }}>
      <h2 id="unsaved-title">Sair sem salvar?</h2>
      <p id="unsaved-description">As alterações deste formulário ainda não foram salvas.</p>
      <div className="form-actions">
        <button autoFocus className="button button-primary" onClick={() => blocker.reset()}>Continuar editando</button>
        <button className="button button-secondary" onClick={() => { dirty.current = false; setUnsavedChanges(false); setHasChanges(false); blocker.proceed(); }}>Descartar e sair</button>
      </div>
    </section>
  </div>;
}
