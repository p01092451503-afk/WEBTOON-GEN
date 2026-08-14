CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'service',
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant support tickets read"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "own support tickets insert"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

CREATE POLICY "own support tickets update"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  question_ko text NOT NULL,
  answer_ko text NOT NULL,
  question_en text,
  answer_en text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT ALL ON public.faqs TO service_role;

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active faqs"
  ON public.faqs FOR SELECT TO anon, authenticated
  USING (active);

CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko text NOT NULL,
  body_ko text NOT NULL,
  title_en text,
  body_en text,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notices TO anon, authenticated;
GRANT ALL ON public.notices TO service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active notices"
  ON public.notices FOR SELECT TO anon, authenticated
  USING (active);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.faqs (category, question_ko, answer_ko, question_en, answer_en, sort_order) VALUES
('service', '이미지는 어떻게 만드나요?', '상단 메뉴의 [만들기]에서 레퍼런스 이미지를 올리고 역할 태그를 지정한 뒤, 프롬프트를 입력하고 만들기 버튼을 누르면 됩니다.', 'How do I create an image?', 'Go to Create, upload reference images, tag their roles, write a prompt, and press Create.', 10),
('service', '레퍼런스 이미지는 몇 장까지 넣을 수 있나요?', '한 번에 최대 10장까지 등록할 수 있으며, 역할 태그(인물A/인물B/배경/포즈/스타일)를 지정하면 프롬프트 엔진이 자동으로 반영합니다.', 'How many reference images can I use?', 'Up to 10 per generation. Role tags (Character A/B, background, pose, style) are applied automatically.', 20),
('credit', '크레딧은 언제 차감되나요?', '이미지 생성이 성공한 시점에 생성된 장수 기준으로 차감됩니다. 실패한 생성은 차감되지 않습니다.', 'When are credits charged?', 'Credits are charged when generation succeeds, based on the number of images produced. Failed jobs are not charged.', 30),
('credit', '크레딧이 부족하면 어떻게 되나요?', '잔액이 예상 소진량보다 적으면 생성이 시작되지 않고 안내 메시지가 표시됩니다.', 'What happens when I run out of credits?', 'Generation is blocked before it starts and a notice is shown.', 40),
('error', '생성이 실패했어요.', '민감 콘텐츠 감지, 일시적인 요청 한도 초과 등으로 실패할 수 있습니다. 잠시 후 다시 시도하고, 반복되면 1:1 문의로 알려주세요.', 'My generation failed.', 'Failures can come from sensitive-content detection or temporary rate limits. Retry shortly, and contact us if it repeats.', 50),
('error', '이미지가 보이지 않아요.', '이미지는 비공개 저장소에 보관되며 짧은 유효시간의 링크로 표시됩니다. 새로고침하면 대부분 해결됩니다.', 'Images are not loading.', 'Images live in private storage and are shown via short-lived links. A refresh usually fixes it.', 60);

INSERT INTO public.notices (title_ko, body_ko, title_en, body_en, pinned) VALUES
('서비스 이용안내', '본 서비스는 생성형 AI로 이미지를 제작합니다. 타인의 초상권·저작권을 침해하는 레퍼런스 업로드는 금지되며, 생성 결과물의 사용 책임은 이용자에게 있습니다.', 'Service guide', 'This service creates images with generative AI. Do not upload references that infringe portrait or copyright rights; you are responsible for how results are used.', true),
('이미지 보관 정책 안내', '생성된 이미지는 비공개 저장소에 보관되며, 필요 시 히스토리에서 직접 영구 삭제할 수 있습니다.', 'Image retention', 'Generated images are stored privately and can be permanently deleted from History at any time.', false);