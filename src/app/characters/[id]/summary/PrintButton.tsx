"use client";
// Tiny client island: the print-view page is a server component, so the
// window.print() trigger lives here (SPEC v2.2 §6 "Print view").
export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()} title="Print this summary">
      🖨 Print
    </button>
  );
}
