export type VideoTestTemplate = {
  id: "t2v-quality" | "i2v-quality";
  mode: "t2v" | "i2v";
  title: string;
  description: string;
  action: string;
  positive: string;
  negative: string;
  aspectRatio: "16:9";
  resolution: "720p";
  duration: 5;
  cameraFixed: boolean;
};

export const VIDEO_TEST_TEMPLATES: VideoTestTemplate[] = [
  {
    id: "t2v-quality",
    mode: "t2v",
    title: "T2V · Motion stability",
    description: "Tests human motion, facial stability, lighting, and camera tracking without a reference image.",
    action: "창가로 천천히 걸어가 한 손으로 유리를 가볍게 만지고, 차분한 표정으로 밖을 바라본다.",
    positive:
      "A cinematic medium shot shows a young woman in a cream-colored knit sweater standing in a quiet, sunlit room. She walks slowly toward a large window with natural, measured steps, gently places one hand against the glass, and looks outside with a calm expression. The camera tracks beside her at eye level with smooth, restrained movement while her face, body proportions, hairstyle, and clothing remain consistent throughout the shot. Soft morning sunlight passes through sheer curtains and creates warm highlights, realistic skin tones, and delicate shadows across the room. Her hair and sweater move subtly with each step, and the scene maintains stable motion, coherent anatomy, and a polished cinematic look.",
    negative:
      "face distortion, identity change, morphing, deformed hands, extra fingers, extra limbs, duplicated body parts, changing clothes, unstable anatomy, unnatural walking, sliding feet, jitter, flicker, frame warping, sudden camera movement, blurry face, low detail, text, subtitles, watermark",
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    cameraFixed: false,
  },
  {
    id: "i2v-quality",
    mode: "i2v",
    title: "I2V · Identity consistency",
    description: "Tests whether a supplied first frame stays visually consistent during subtle facial and body motion.",
    action: "인물은 첫 프레임의 외모와 의상을 그대로 유지하며 천천히 고개를 카메라 쪽으로 돌리고, 자연스럽게 눈을 한 번 깜빡인 뒤 은은하게 미소 짓는다.",
    positive:
      "Beginning exactly from the supplied first frame, the same person preserves identical facial features, hairstyle, clothing, body proportions, colors, and background details. The subject slowly turns their head toward the camera, blinks once naturally, and forms a subtle relaxed smile while the shoulders and posture remain steady. Motion is small, continuous, and physically plausible, with stable eyes, hands, skin texture, and garment details in every frame. The camera remains locked at the original framing with no zoom, crop, reframing, or viewpoint change. Existing light direction and color are preserved, producing a clean cinematic portrait with strong temporal consistency and no newly introduced objects.",
    negative:
      "identity change, different person, face morphing, facial asymmetry, changing hairstyle, changing clothes, altered background, new objects, deformed eyes, crossed eyes, unnatural blink, warped mouth, deformed hands, extra fingers, extra limbs, body distortion, camera movement, zoom, reframing, crop shift, flicker, jitter, frame interpolation artifacts, blur, text, watermark",
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    cameraFixed: true,
  },
];