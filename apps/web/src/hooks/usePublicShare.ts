import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Bare axios instance with no Clerk/auth interceptors. The public share view
// must remain anonymous — never send Authorization headers.
const publicAxios = axios.create({ withCredentials: false });

export interface PublicShareImage {
  id: string;
  url: string;
  caption: string | null;
  type: string;
  sortOrder: number;
}

export interface PublicShareDocument {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  uploadedAt: string;
  downloadPath: string;
}

export interface PublicShareStatusEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  changedAt: string;
}

export interface PublicShareUpdateMedia {
  id: string;
  type: "PHOTO" | "VIDEO";
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface PublicShareUpdate {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  media: PublicShareUpdateMedia[];
}

export interface PublicShareView {
  unit: {
    unitNumber: string;
    floor: number;
    type: string;
    area: number;
    view: string;
    bathrooms: number | null;
    parkingSpaces: number | null;
    internalArea: number | null;
    externalArea: number | null;
    price: number | null;
    images: PublicShareImage[];
  };
  project: {
    id: string;
    name: string;
    location: string;
    projectStatus: string;
    completionStatus: string;
    handoverDate: string;
  };
  documents: PublicShareDocument[];
  statusHistory: PublicShareStatusEntry[];
  updates: PublicShareUpdate[];
  shareMeta: {
    showPrice: boolean;
    expiresAt: string | null;
  };
}

export type PublicShareError = "NOT_FOUND" | "REVOKED" | "EXPIRED" | "RATE_LIMITED" | "UNKNOWN";

export function usePublicShare(token: string) {
  return useQuery({
    queryKey: ["public-share", token],
    queryFn: async () => {
      try {
        const res = await publicAxios.get(`/public/share/u/${token}`);
        return { ok: true as const, data: res.data as PublicShareView };
      } catch (err: any) {
        const status = err?.response?.status;
        const code: string | undefined = err?.response?.data?.code;
        let kind: PublicShareError = "UNKNOWN";
        if (status === 404) kind = "NOT_FOUND";
        else if (status === 410 && code === "SHARE_REVOKED") kind = "REVOKED";
        else if (status === 410 && code === "SHARE_EXPIRED") kind = "EXPIRED";
        else if (status === 410) kind = "EXPIRED";
        else if (status === 429) kind = "RATE_LIMITED";
        return { ok: false as const, error: kind };
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });
}

export async function fetchPublicDocumentDownloadUrl(token: string, docId: string): Promise<string> {
  const res = await publicAxios.get(`/public/share/u/${token}/documents/${docId}/download`);
  return res.data.url as string;
}
