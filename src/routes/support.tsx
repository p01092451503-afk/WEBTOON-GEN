import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TopNav } from "@/components/top-nav";
import { useAuth } from "@/hooks/useAuth";
import { useCreateTicket, useFaqs, useMyTickets, useNotices, type TicketType } from "@/hooks/useSupport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, HelpCircle, Home, Megaphone, MessageSquarePlus } from "lucide-react";

export const Route = createFileRoute("/support")({
  ssr: false,
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "고객센터 · pilottoon" },
      { name: "description", content: "pilottoon 이용 중 궁금한 점, 공지사항, 1:1 문의를 한 곳에서 해결하세요." },
      { property: "og:title", content: "고객센터 · pilottoon" },
      { property: "og:description", content: "자주 묻는 질문, 공지사항, 서비스 이용안내, 1:1 문의 등록." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Section = "home" | "faq" | "notice" | "guide" | "ticket";

function SupportPage() {
  const { t, i18n } = useTranslation();
  const ko = i18n.language?.startsWith("ko") ?? true;
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("home");

  const faqs = useFaqs();
  const notices = useNotices();
  const tickets = useMyTickets();
  const createTicket = useCreateTicket();

  const [type, setType] = useState<TicketType>("service");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const MENU: { key: Section; label: string; icon: typeof Home }[] = useMemo(
    () => [
      { key: "home", label: t("support.menu.home", "고객센터 홈"), icon: Home },
      { key: "faq", label: t("support.menu.faq", "자주 묻는 질문"), icon: HelpCircle },
      { key: "notice", label: t("support.menu.notice", "공지사항"), icon: Megaphone },
      { key: "guide", label: t("support.menu.guide", "서비스 이용안내"), icon: BookOpen },
      { key: "ticket", label: t("support.menu.ticket", "1:1 문의 등록"), icon: MessageSquarePlus },
    ],
    [t],
  );

  const typeLabel = (v: string) =>
    v === "billing"
      ? t("support.type.billing", "결제·크레딧")
      : v === "bug"
        ? t("support.type.bug", "오류 신고")
        : t("support.type.service", "서비스 이용");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error(t("support.form.required", "제목과 내용을 입력해 주세요."));
      return;
    }
    try {
      await createTicket.mutateAsync({ type, title, body });
      setTitle("");
      setBody("");
      toast.success(t("support.form.submitted", "문의가 접수되었습니다. 답변은 마이페이지에서 확인할 수 있어요."));
    } catch {
      toast.error(t("support.form.failed", "문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요."));
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">{t("nav.support", "고객센터")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("support.subtitle", "이용 중 궁금한 점을 빠르게 찾아보고, 해결되지 않으면 1:1 문의를 남겨주세요.")}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="h-fit rounded-2xl border border-border bg-card p-2 shadow-toss-sm">
            {MENU.map((m) => {
              const Icon = m.icon;
              const active = section === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSection(m.key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </nav>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-toss-sm">
            {section === "home" && (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {MENU.filter((m) => m.key !== "home").map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSection(m.key)}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-semibold">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <h2 className="mb-3 text-sm font-bold text-muted-foreground">
                    {t("support.recent_notices", "최근 공지")}
                  </h2>
                  <ul className="space-y-2">
                    {(notices.data ?? []).slice(0, 3).map((n) => (
                      <li key={n.id} className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                        <span className="font-semibold">{ko ? n.title_ko : (n.title_en ?? n.title_ko)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(n.published_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                    {!notices.isLoading && (notices.data ?? []).length === 0 && (
                      <li className="text-sm text-muted-foreground">{t("support.empty_notices", "공지가 없습니다.")}</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {section === "faq" && (
              <Accordion type="single" collapsible className="w-full">
                {(faqs.data ?? []).map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger className="text-left text-sm font-semibold">
                      {ko ? f.question_ko : (f.question_en ?? f.question_ko)}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {ko ? f.answer_ko : (f.answer_en ?? f.answer_ko)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
                {!faqs.isLoading && (faqs.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("support.empty_faqs", "등록된 질문이 없습니다.")}</p>
                )}
              </Accordion>
            )}

            {section === "notice" && (
              <ul className="space-y-3">
                {(notices.data ?? []).map((n) => (
                  <li key={n.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Badge variant="secondary">{t("support.pinned", "고정")}</Badge>}
                      <h3 className="text-sm font-bold">{ko ? n.title_ko : (n.title_en ?? n.title_ko)}</h3>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(n.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {ko ? n.body_ko : (n.body_en ?? n.body_ko)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {section === "guide" && (
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <div>
                  <h3 className="text-base font-bold text-foreground">{t("support.guide.step1_t", "1. 레퍼런스 준비")}</h3>
                  <p>
                    {t(
                      "support.guide.step1_b",
                      "[이미지 그룹]에서 자주 쓰는 인물·배경 이미지를 모아두고, [만들기]로 바로 불러올 수 있습니다. 한 번에 최대 10장까지 사용할 수 있어요.",
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{t("support.guide.step2_t", "2. 역할 태그 지정")}</h3>
                  <p>
                    {t(
                      "support.guide.step2_b",
                      "각 레퍼런스에 인물A/인물B/배경/포즈/스타일 태그를 지정하면 프롬프트 엔진이 순서대로 반영합니다.",
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{t("support.guide.step3_t", "3. 생성과 크레딧")}</h3>
                  <p>
                    {t(
                      "support.guide.step3_b",
                      "생성이 성공하면 만들어진 장수만큼 크레딧이 차감됩니다. 실패한 생성은 차감되지 않습니다.",
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{t("support.guide.step4_t", "4. 보관과 삭제")}</h3>
                  <p>
                    {t(
                      "support.guide.step4_b",
                      "이미지는 비공개 저장소에 보관되며 짧은 유효시간 링크로만 표시됩니다. 히스토리에서 언제든 영구 삭제할 수 있습니다.",
                    )}
                  </p>
                </div>
              </div>
            )}

            {section === "ticket" && (
              <div className="space-y-6">
                {!user ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("support.form.login_required", "1:1 문의를 남기려면 로그인이 필요합니다.")}
                    </p>
                    <Button asChild className="mt-4 rounded-full">
                      <Link to="/auth">{t("nav.sign_in", "로그인 / 회원가입")}</Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("support.form.type", "문의 유형")}</Label>
                      <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service">{typeLabel("service")}</SelectItem>
                          <SelectItem value="billing">{typeLabel("billing")}</SelectItem>
                          <SelectItem value="bug">{typeLabel("bug")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-title">{t("support.form.title", "제목")}</Label>
                      <Input
                        id="ticket-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={120}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-body">{t("support.form.body", "내용")}</Label>
                      <Textarea
                        id="ticket-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={8}
                        maxLength={4000}
                        className="rounded-xl"
                      />
                    </div>
                    <Button type="submit" disabled={createTicket.isPending} className="rounded-full">
                      {createTicket.isPending ? t("common.please_wait", "잠시만 기다려 주세요") : t("support.form.submit", "문의 등록")}
                    </Button>
                  </form>
                )}

                {user && (tickets.data ?? []).length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-bold text-muted-foreground">
                      {t("support.my_tickets", "내 문의 내역")}
                    </h2>
                    <ul className="space-y-2">
                      {(tickets.data ?? []).slice(0, 5).map((tk) => (
                        <li key={tk.id} className="rounded-xl border border-border bg-background px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">{typeLabel(tk.type)}</Badge>
                            <span className="font-semibold">{tk.title}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {new Date(tk.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
