import { useQuery } from "@tanstack/react-query";
import axios from "axios";
// Bare axios instance with no Clerk/auth interceptors. The public share view
// must remain anonymous — never send Authorization headers.
const publicAxios = axios.create({ withCredentials: false });
export function usePublicShare(token) {
    return useQuery({
        queryKey: ["public-share", token],
        queryFn: async () => {
            try {
                const res = await publicAxios.get(`/public/share/u/${token}`);
                return { ok: true, data: res.data };
            }
            catch (err) {
                const status = err?.response?.status;
                const code = err?.response?.data?.code;
                let kind = "UNKNOWN";
                if (status === 404)
                    kind = "NOT_FOUND";
                else if (status === 410 && code === "SHARE_REVOKED")
                    kind = "REVOKED";
                else if (status === 410 && code === "SHARE_EXPIRED")
                    kind = "EXPIRED";
                else if (status === 410)
                    kind = "EXPIRED";
                else if (status === 429)
                    kind = "RATE_LIMITED";
                return { ok: false, error: kind };
            }
        },
        enabled: !!token,
        retry: false,
        staleTime: 30000,
    });
}
export async function fetchPublicDocumentDownloadUrl(token, docId) {
    const res = await publicAxios.get(`/public/share/u/${token}/documents/${docId}/download`);
    return res.data.url;
}
