let unsavedChanges = false;
export function setUnsavedChanges(value: boolean) { unsavedChanges = value; }
export function hasUnsavedChanges() { return unsavedChanges; }
export function markFormSaved() {
  unsavedChanges = false;
  document.dispatchEvent(new Event("medsync:form-saved"));
}
