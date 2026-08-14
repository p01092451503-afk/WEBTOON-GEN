import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export type TicketType = "service" | "billing" | "bug";

export type SupportTicket = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

/** 공개 콘텐츠: 자주 묻는 질문 */
export function useFaqs() {
  return useQuery({
    queryKey: ["faqs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faqs")
        .select("id, category, question_ko, answer_ko, question_en, answer_en, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** 공개 콘텐츠: 공지사항 */
export function useNotices() {
  return useQuery({
    queryKey: ["notices"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("id, title_ko, body_ko, title_en, body_en, pinned, published_at")
        .eq("active", true)
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** 내 1:1 문의 내역 (RLS: 같은 테넌트 범위) */
export function useMyTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["support_tickets", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, type, title, body, status, admin_reply, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportTicket[];
    },
  });
}

/** 1:1 문의 등록 */
export function useCreateTicket() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { type: TicketType; title: string; body: string }) => {
      if (!user?.id || !tenantId) throw new Error("NOT_AUTHENTICATED");
      const { error } = await supabase.from("support_tickets").insert({
        tenant_id: tenantId,
        user_id: user.id,
        type: input.type,
        title: input.title.trim(),
        body: input.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support_tickets"] }),
  });
}
