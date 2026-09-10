# 약 먹는 시간표 (medschedule-largeprint)

약봉투 사진 한 장으로 아침·점심·저녁·자기 전 복약 시간표를 만들어주는 웹 서비스입니다.

- 회원가입·앱 설치 없이 URL만 열면 누구나 쓸 수 있습니다.
- A4 인쇄본을 출력해 냉장고에 붙여둘 수 있습니다.
- 어르신이 보기 쉽게 큰 글씨로, 약봉투에 적힌 내용만 옮깁니다.

프로덕션 URL: https://medschedule-largeprint.vercel.app/
GitHub: github.com/lythean1004/medschedule-largeprint

## 누가 쓰나요?

- 처방약을 상시 복용하는 65세 이상 어르신 본인
- 스마트폰으로 사진 촬영은 하지만, 앱 설치·회원가입·타이핑은 부담스러운 분
- 어르신 약 정리를 돕는 자녀·요양보호사 (대신 조작하는 경우 포함)

## 언제 쓰나요?

약국에서 약을 받아 집에 들어온 직후, 봉투를 식탁에 펼쳐놓고 "언제 몇 알 먹으라는 거지?"를 확인하는 순간.
자녀가 부모님 집에 방문해 약봉투를 정리하는 순간.

서비스는 시크릿 창 URL 접속만으로 시작합니다. 회원가입·앱 설치·타이핑 없이요.

## 어떻게 쓰나요?

1. URL 열기: https://medschedule-largeprint.vercel.app/
2. 약봉투 사진 1장 올리기 (사진 고르기 버튼)
3. 잠시 기다리면 아침·점심·저녁·자기 전 네 칸으로 나뉜 큰 글씨 시간표가 화면에 나옵니다.
4. 필요하면 "인쇄/저장" 버튼을 눌러 A4 1장짜리 인쇄본을 출력합니다 (냉장고에 붙여두기 좋아요).

입력: 약봉투 사진 1장 (타이핑 없음)

출력:
- 화면: 큰 글씨 시간표 + "약사님께 확인할 것", "안내", "봉투에 적힌 내용(보호자 확인용)"
- 인쇄/저장: A4 1장 출력본 (@media print CSS 적용, 어르신용 20pt/제목 24pt, 화면 전용 요소 숨김)

## 기술 스택

클라이언트: index.html (정적 HTML/JS/CSS)
서버: Vercel 서버리스 함수 (api/schedule.js)
이미지 글자 읽기: Upstage Document OCR (POST /v1/document-digitization, model=ocr)
시간표 생성: Solar Pro 4 (POST /v1/chat/completions, solar-pro4)
배포: Vercel (프로덕션 도메인: medschedule-largeprint.vercel.app)
소스: GitHub (lythean1004/medschedule-largeprint)

흐름: 1) 클라이언트가 봉투 이미지를 업로드 → /api/schedule 로 base64 전달, 2) /api/schedule 가 Document OCR 로 이미지에서 텍스트 추출, 3) 추출한 텍스트를 Solar Pro 4(텍스트 전용) 에 medicine-schedule-largeprint 규칙 프롬프트와 함께 넣어 시간표로 재배치, 4) 결과를 클라이언트에 반환 → 화면에 큰 글씨로 렌더링

주의: /api 에서만 키를 사용하고, 클라이언트(index.html) 에는 키·프록시 주소가 0개. 키는 Vercel 환경변수(SOLAR_PRO_API_KEY) 로만 등록.

## medicine-schedule-largeprint 규칙 (핵심)

이 서비스는 약봉투에 적힌 내용을 그대로 읽고, 아침·점심·저녁·자기 전으로 나눠 시간표로 재배치합니다. 적혀 있지 않은 것은 판단하지 않습니다.

- 약 이름·횟수·용량은 봉투에 적힌 그대로 (원문에 없는 내용은 만들지 않음)
- 글씨가 안 보이면 "안 보임" / "(이름 확실하지 않음)"으로만 쓰고 추측하지 않음
- 환자 이름·생년월일·병원·약국·연락처·주소는 "(개인정보 생략)"으로만 처리
- 먹는 시간이 안 적혀 있으면 횟수만 보고 나눠 적고 안내 함께 씀
- 효능·부작용·병용 여부 설명 안 함, "약사님께 여쭤보세요" 안내로 마무리
- 끝나는 날짜 계산하지 않고, 며칠분만 옮김

더 자세한 규칙은 api/schedule.js 안의 PROMPT 상수 참고.

## 환경변수

SOLAR_PRO_API_KEY: /api/schedule 이 Document OCR + Solar Pro 4 호출에 사용 (Upstage 콘솔 발급, Vercel 환경변수에만 등록, 값 비공개)

중요: 이 값은 코드에 적거나 github 에 올리면 안 됩니다. Vercel 환경변수에만 등록하세요.

## 로컬에서 확인하기

```bash
git clone https://github.com/lythean1004/medschedule-largeprint.git
cd medschedule-largeprint
npm install
# .env 파일에 키 추가 (절대 github 에 올리면 안 됨)
# echo "SOLAR_PRO_API_KEY=<자신의 키>" > .env
vercel dev
```

## 보안 노트

- SOLAR_PRO_API_KEY 는 절대 코드에 하드코딩하거나 github 에 커밋하면 안 됩니다.
- .gitignore 에 verify_*.py, deploy_*.json, *.env 등 제외.
- /api/schedule 응답 JSON 에도 키 값 포함되지 않음.

## 시연 시나리오 (심사용)

시크릿 창(저장값·계정 없는 첫 방문)에서:
1. https://medschedule-largeprint.vercel.app/ 접속 → "약봉투 사진 한 장만 올려주세요" 안내가 스스로 보임
2. 약봉투 사진 1장 업로드 → 시간표 생성 → 인쇄/저장
3. 지표 (소명용): 주변 어르신 3명에게 실제 재서 제출 — ① 약봉투 확인에 걸리는 시간, ② "몇 시 먹는 약인지 헷갈린 횟수" (서비스 사용 전/후)

## 프로젝트 구조

├── .gitignore

├── index.html

├── api/

│   └── schedule.js

└── package.json

## 라이선스

이 프로젝트는 학습/시연 목적으로 만들어졌습니다.

## 참고자료

- Vercel 배포: https://vercel.com/
- Upstage Document OCR: https://console.upstage.ai/docs/capabilities/parse/document-ocr
- Solar Pro 4 API: https://console.upstage.ai/
