"use client";

import { generateTemplatePdfHtml, type TemplatePreview } from "@/lib/email-templates/preview";

export function DownloadAllButton({ templates }: { templates: TemplatePreview[] }) {
  return (
    <button
      onClick={() => {
        const html = generateTemplatePdfHtml(templates);
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 300);
        }
      }}
      className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download all as PDF
    </button>
  );
}
