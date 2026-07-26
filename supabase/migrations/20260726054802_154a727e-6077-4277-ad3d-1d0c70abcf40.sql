
INSERT INTO public.presets (tenant_id, sheet, item_id, label_ko, label_en, prompt_text, level, sort_order, active) VALUES
-- PoseStrength: auto + exact copy
(NULL,'PoseStrength','POS_000','자동','auto','',0,0,true),
(NULL,'PoseStrength','POS_004','정확히 복제(실험)','exact','Precisely replicate the pose, gesture, and camera framing from Figure N exactly as shown',3,4,true),

-- BgStrength: auto
(NULL,'BgStrength','BGS_000','자동','auto','',0,0,true),

-- BodySource
(NULL,'BodySource','BOD_002','포즈 참조 기준','pose-ref','Use the pose reference image as the primary source for body proportions and silhouette.',1,2,true),
(NULL,'BodySource','BOD_003','슬림','slim','Render the character with a slim, slender body proportion.',1,3,true),
(NULL,'BodySource','BOD_004','평균 체형','average','Render the character with an average, natural body proportion.',1,4,true),
(NULL,'BodySource','BOD_005','건장한 체형','athletic','Render the character with an athletic, toned body build.',1,5,true),
(NULL,'BodySource','BOD_006','작은 키','petite','Render the character with a petite, slightly short frame.',1,6,true),
(NULL,'BodySource','BOD_007','큰 키','tall','Render the character with a tall, elongated frame.',1,7,true),

-- CameraAngle additions
(NULL,'CameraAngle','CAM_A_004','더치앵글','dutch','Shot with a tilted dutch-angle for dynamic tension.',2,4,true),
(NULL,'CameraAngle','CAM_A_005','버즈아이','birdseye','Extreme top-down bird''s eye view looking straight down.',3,5,true),
(NULL,'CameraAngle','CAM_A_006','웜즈아이','wormseye','Extreme upward worm''s eye view looking straight up.',3,6,true),
(NULL,'CameraAngle','CAM_A_007','약간 위에서','slight-high','Shot from a slightly high angle, gentle downward tilt.',1,7,true),
(NULL,'CameraAngle','CAM_A_008','약간 아래에서','slight-low','Shot from a slightly low angle, gentle upward tilt.',1,8,true),

-- CameraDistance additions
(NULL,'CameraDistance','CAM_D_004','익스트림 클로즈업','extreme-close','Extreme close-up focusing on eyes and facial detail.',3,4,true),
(NULL,'CameraDistance','CAM_D_005','바스트샷','bust','Bust shot framing from the chest up.',1,5,true),
(NULL,'CameraDistance','CAM_D_006','카우보이샷','cowboy','Cowboy shot framing from mid-thigh up.',2,6,true),
(NULL,'CameraDistance','CAM_D_007','와이드샷','wide','Wide shot showing the character within a spacious environment.',2,7,true),
(NULL,'CameraDistance','CAM_D_008','익스트림 와이드','extreme-wide','Extreme wide shot with the character small inside a vast landscape.',3,8,true),

-- CameraPosition additions
(NULL,'CameraPosition','CAM_P_004','3/4 정면','3q-front','Camera positioned at a three-quarter front angle.',1,4,true),
(NULL,'CameraPosition','CAM_P_005','3/4 후면','3q-back','Camera positioned at a three-quarter back angle.',2,5,true),
(NULL,'CameraPosition','CAM_P_006','오버숄더 A','ots-a','Over-the-shoulder framing from behind Character A looking at the scene.',2,6,true),
(NULL,'CameraPosition','CAM_P_007','오버숄더 B','ots-b','Over-the-shoulder framing from behind Character B looking at the scene.',2,7,true),
(NULL,'CameraPosition','CAM_P_008','포인트오브뷰','pov','First-person point-of-view perspective from the character''s eyes.',3,8,true),

-- FocusTarget additions
(NULL,'FocusTarget','FOC_003','전체 선명','deep-dof','Keep the entire scene in sharp focus with deep depth of field.',1,3,true),
(NULL,'FocusTarget','FOC_004','얕은 심도','shallow-dof','Use a shallow depth of field with soft creamy bokeh in the background.',2,4,true),
(NULL,'FocusTarget','FOC_005','인물 눈에 포커스','eyes','Lock sharp focus on the character''s eyes with everything else softly falling off.',2,5,true),
(NULL,'FocusTarget','FOC_006','손/소품 포커스','props','Focus sharply on the character''s hands and props while softening the rest.',2,6,true),

-- BgStyle additions
(NULL,'BgStyle','BGST_004','도시 거리','city-street','A vibrant modern city street with buildings, signs, and light traffic.',1,4,true),
(NULL,'BgStyle','BGST_005','야경 도시','city-night','A cinematic city night scene with neon signs and reflective wet pavement.',2,5,true),
(NULL,'BgStyle','BGST_006','카페 실내','cafe','A cozy cafe interior with warm lighting, wood tones, and soft ambience.',1,6,true),
(NULL,'BgStyle','BGST_007','학교 교실','classroom','A bright school classroom with desks, windows, and afternoon sunlight.',1,7,true),
(NULL,'BgStyle','BGST_008','침실','bedroom','A calm personal bedroom with soft natural lighting.',1,8,true),
(NULL,'BgStyle','BGST_009','숲/자연','forest','A serene forest with dappled sunlight filtering through the leaves.',1,9,true),
(NULL,'BgStyle','BGST_010','바닷가','beach','A sunny beach with soft waves and a bright horizon.',1,10,true),
(NULL,'BgStyle','BGST_011','옥상','rooftop','A modern rooftop with an expansive skyline view.',2,11,true),
(NULL,'BgStyle','BGST_012','판타지 성','fantasy-castle','A grand fantasy castle interior with tall arches and dramatic lighting.',2,12,true),
(NULL,'BgStyle','BGST_013','사이버펑크','cyberpunk','A cyberpunk alley with neon signage, holograms, and rain-slick streets.',3,13,true),
(NULL,'BgStyle','BGST_014','벚꽃 거리','cherry-blossom','A quiet street lined with blooming cherry blossoms and drifting petals.',1,14,true),
(NULL,'BgStyle','BGST_015','비 오는 거리','rainy','A rainy street with reflective puddles and soft atmospheric haze.',2,15,true),
(NULL,'BgStyle','BGST_016','눈 내리는 풍경','snowy','A gentle snowy landscape with soft falling snowflakes.',2,16,true),
(NULL,'BgStyle','BGST_017','스튜디오 조명','studio','A clean photo studio backdrop with soft directional lighting.',1,17,true),

-- CostumeMode additions
(NULL,'CostumeMode','CST_003','교복','uniform','Dress the character in a neat Korean-style school uniform.',1,3,true),
(NULL,'CostumeMode','CST_004','스트리트웨어','streetwear','Dress the character in trendy modern streetwear.',1,4,true),
(NULL,'CostumeMode','CST_005','운동복','sportswear','Dress the character in athletic sportswear suited for movement.',1,5,true),
(NULL,'CostumeMode','CST_006','한복','hanbok','Dress the character in a traditional Korean hanbok.',2,6,true),
(NULL,'CostumeMode','CST_007','판타지 갑옷','fantasy-armor','Dress the character in ornate fantasy armor with intricate detailing.',2,7,true),
(NULL,'CostumeMode','CST_008','파티/드레스업','party','Dress the character in an elegant party outfit or evening dress.',2,8,true),
(NULL,'CostumeMode','CST_009','수트','suit','Dress the character in a sharply tailored modern suit.',1,9,true),
(NULL,'CostumeMode','CST_010','메이드/집사','maid-butler','Dress the character in a classic maid or butler outfit.',2,10,true),
(NULL,'CostumeMode','CST_011','오피스 룩','office','Dress the character in a clean professional office outfit.',1,11,true),
(NULL,'CostumeMode','CST_012','겨울 코트','winter','Dress the character in a warm winter coat and scarf.',1,12,true),
(NULL,'CostumeMode','CST_013','수영복','swimwear','Dress the character in tasteful swimwear appropriate for a beach or pool setting.',1,13,true),

-- Emotion additions
(NULL,'Emotion','EMO_005','활짝 웃음','laughing','with a bright, wide laugh and joyful eyes',1,5,true),
(NULL,'Emotion','EMO_006','수줍음','shy','with a shy, softly blushing expression',1,6,true),
(NULL,'Emotion','EMO_007','화남','angry','with an angry, tense expression and furrowed brow',2,7,true),
(NULL,'Emotion','EMO_008','당황','embarrassed','with a flustered, embarrassed expression',1,8,true),
(NULL,'Emotion','EMO_009','생각중','thinking','with a thoughtful, contemplative expression',1,9,true),
(NULL,'Emotion','EMO_010','졸림/피곤','tired','with a sleepy, tired expression and half-lidded eyes',1,10,true),
(NULL,'Emotion','EMO_011','자신감','confident','with a confident, self-assured smirk',1,11,true),
(NULL,'Emotion','EMO_012','눈물','teary','with glistening, teary eyes on the verge of crying',2,12,true),
(NULL,'Emotion','EMO_013','평온','calm','with a calm, serene expression',1,13,true),
(NULL,'Emotion','EMO_014','설렘','excited','with an excited, sparkling expression full of anticipation',1,14,true),
(NULL,'Emotion','EMO_015','냉담','cold','with a cold, distant, emotionless expression',2,15,true),

-- StyleFinish additions
(NULL,'StyleFinish','STY_000','자동','auto','',0,0,true),
(NULL,'StyleFinish','STY_002','컬러 웹툰(진한 채색)','webtoon-rich','Korean webtoon style with rich saturated colors, clean line art, and dramatic cel shading.',1,2,true),
(NULL,'StyleFinish','STY_003','모노크롬 만화','monochrome','Black and white manga style with screen-tone shading and expressive line work.',1,3,true),
(NULL,'StyleFinish','STY_004','수채화','watercolor','Soft watercolor painting style with gentle color bleeding and paper texture.',2,4,true),
(NULL,'StyleFinish','STY_005','일본 애니메이션','anime','Modern Japanese anime style with clean line art, vibrant cel shading, and expressive eyes.',1,5,true),
(NULL,'StyleFinish','STY_006','세미 리얼리즘','semi-real','Semi-realistic illustration style balancing anatomy accuracy with stylized rendering.',2,6,true),
(NULL,'StyleFinish','STY_007','유화 페인팅','oil-paint','Oil painting style with visible brush strokes and rich painterly texture.',2,7,true),
(NULL,'StyleFinish','STY_008','스케치/펜','sketch','Rough pencil and pen sketch style with expressive line work and minimal shading.',1,8,true),
(NULL,'StyleFinish','STY_009','픽셀 아트','pixel','Retro pixel-art style with limited palette and crisp pixel edges.',3,9,true),
(NULL,'StyleFinish','STY_010','시네마틱 CG','cinematic','Cinematic 3D CG rendering with realistic lighting, depth, and film-grade color grading.',2,10,true),
(NULL,'StyleFinish','STY_011','플랫 일러스트','flat','Flat vector illustration style with bold shapes and minimal shading.',1,11,true),
(NULL,'StyleFinish','STY_012','빈티지 판화','vintage-print','Vintage print illustration style with textured shading and muted retro palette.',2,12,true)
ON CONFLICT (tenant_id, sheet, item_id) DO NOTHING;
