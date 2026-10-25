"use client";

import { useMutation } from "@tanstack/react-query";
import { reportsApi } from "../api";
import { saveBlobAsFile } from "../lib/save-blob";

/**
 * Downloads the PDF of a COMPLETED report: fetches the bytes through the authenticated same-origin route, then
 * starts a browser download from a temporary object URL that is revoked right after. Resolves with the saved
 * `filename`. Errors: `REPORT_PDF_NOT_AVAILABLE`, `REPORT_STORAGE_UNAVAILABLE`, 404.
 */
export function useDownloadReport() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { blob, filename } = await reportsApi.download(id);
      saveBlobAsFile(blob, filename);
      return { filename };
    },
  });
}
