/**
 * C-2-3: /api/schedule  서버리스 함수
 * 클라이언트에서 올린 봉투 이미지를 Document OCR로 텍스트 추출 후,
 * Solar Pro 4(텍스트 전용)에 medicine-schedule-largeprint 규칙 프롬프트와 함께 넣어 시간표로 재배치해 반환한다.
 * 키·프록시 주소는 서버에만. 클라이언트는 같은 도메인 /api만 fetch.
 */

const FormData = require("form-data");

const OCR_URL = "https://api.upstage.ai/v1/document-digitization";
const SOLAR_URL = "https://api.upstage.ai/v1/chat/completions";
const MODEL = "solar-pro4";

const PROMPT = `
너는 약봉투 판독 후 복약 시간표 작성 규칙만 따른다. 아래 규칙을 절대 어기지 않는다.

## 기본 규칙
1. 아래 OCR 텍스트(봉투+영수증 등 섞인 문서)에서 약 이름, 1회 먹는 양, 먹는 시간/횟수, 며칠분만 골라낸다.
2. 영수증·결제·금액·현금영수증·공제 등 약과 무관한 내용은 모두 무시한다.
3. 환자 이름, 생년월일, 병원·약국 이름, 약사 이름, 주소, 연락처는 "(개인정보 생략)"으로만 쓴다. 실제 이름을 덧붙이지 않는다.
4. 약 이름을 봉투에 적힌 그대로 옮긴다. 긴 이름도 줄이지 않는다.
5. 1회 먹는 양은 봉투에 적힌 숫자를 그대로 쓴다. "1.00"은 "1.00"으로, 단위(정, 캡슐, 포, mL)는 봉투에 그 단위가 적혀 있을 때만 쓴다.
6. 먹는 시간이 봉투에 적혀 있으면 그대로 쓴다. 횟수와 시간대가 함께 보이면 그에 맞춰 배치한다.
7. 먹는 시간이 안 적혀 있으면 횟수만 보고 아래처럼 나누고, 반드시 안내 문구를 함께 쓴다:
   - 1일 1회 → 아침
   - 1일 2회 → 아침, 저녁
   - 1일 3회 → 아침, 점심, 저녁
   안내 문구: "먹는 시간이 봉투에 안 적혀 있어서 횟수만 보고 나눠 적었어요"
8. "필요할 때만", "통증 시" 등으로 적힌 약은 시간대 칸에 넣지 않고 "■ 필요할 때만 먹는 약"에 따로 적는다.
9. "주 1회", "격일" 등 매일 먹지 않는 약은 "■ 매일 먹지 않는 약"에 따로 적는다.

## 출력 형식 (아래 제목을 하나도 빼지 않고 순서 그대로)
# 약 먹는 시간표

■ 하루 몇 번 먹는 약인지
(각 약마다 한 줄: "약 이름 / 하루 ○번". 횟수를 읽지 못했으면 "하루 몇 번인지 안 보임")

## 아침
(각 줄: 약 이름 / 몇 알 / 언제 — 식전·식후 등 봉투에 적힌 대로, 안 적혀 있으면 "언제 먹는지 안 적혀 있음")

## 점심
(없음이면 "없음")

## 저녁
(없음이면 "없음")

## 자기 전
(없음이면 "없음")

■ 매일 먹지 않는 약
(없음이면 "없음")

■ 필요할 때만 먹는 약
(없음이면 "없음")

■ 며칠분
(각 약마다 한 줄: 약 이름 / 며칠분. 적혀 있지 않으면 "며칠분 안 적혀 있음")

■ 약사님께 확인할 것
(글씨 안 보임, 봉투에 안 적힌 것, 위 규칙 해당 사항만. 없으면 "없음")

■ 안내
(두 줄 그대로)
이 표는 약봉투에 적힌 내용을 옮긴 것입니다.
먹는 방법을 바꾸거나 궁금한 점이 있으면 약사님께 여쭤보세요.

■ 봉투에 적힌 내용 (보호자 확인용)
(약국명, 조제약사명 등은 "(개인정보 생략)"으로 처리. 맨 위에 "약 이름과 1회 먹는 양이 봉투와 같은지 보호자가 확인해 주세요." 한 줄을 쓴다)

## 주의
- 이 설명글 자체, 규칙 설명, 괄호 안 규칙 설명은 결과물에 옮기지 않는다.
- 영수증·결제·금액 내용은 절대 결과물에 옮기지 않는다.

OCR 텍스트:
{{OCR_TEXT}}
`;

function escapeJson(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

async function ocrText(buffer) {
  const form = new FormData();
  form.append("document", buffer, "photo.jpeg");
  form.append("model", "ocr");
  const formHeaders = form.getHeaders();
  const res = await fetch(OCR_URL, {
    method: "POST",
    headers: {
      ...formHeaders,
      Authorization: `Bearer ${process.env.SOLAR_PRO_API_KEY}`,
    },
    body: form.getBuffer(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OCR 오류 ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.pages?.[0]?.text;
  if (!text) throw new Error("OCR 결과 텍스트가 없습니다");
  return text;
}

async function solarSchedule(text) {
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: PROMPT.replace("{{OCR_TEXT}}", text),
      },
    ],
    max_tokens: 4000,
    temperature: 0,
  });
  const res = await fetch(SOLAR_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SOLAR_PRO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Solar 오류 ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Solar 응답에 시간표가 없습니다");
  return content;
}

exports.default = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 사용합니다" });
  }
  if (!process.env.SOLAR_PRO_API_KEY) {
    return res.status(500).json({ error: "서버 설정 오류" });
  }
  const body = req.body;
  if (!body || !body.image_b64) {
    return res.status(400).json({ error: "이미지(base64)를 올려주세요" });
  }
  let dataUrl = body.image_b64;
  if (typeof dataUrl !== "string") {
    return res.status(400).json({ error: "이미지(base64)를 올려주세요" });
  }
  const commaIdx = dataUrl.indexOf(",");
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) throw new Error("빈 이미지");
  } catch (e) {
    return res.status(400).json({ error: "이미지 형식이 맞지 않습니다" });
  }

  try {
    const ocrResult = await ocrText(buffer);
    const schedule = await solarSchedule(ocrResult);
    return res.status(200).json({ schedule });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message.slice(0, 300) });
  }
};
