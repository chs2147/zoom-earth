# zoom-earth · Typhoon Lens

> **⚠️ 비상업용 프로젝트 · REA 기반**
> 이 저장소는 [REA](https://github.com/morluto/rea)(Reverse Engineer Anything)로 수행한 분석과, 그 결과를 바탕으로 공개 데이터만으로 새로 만든 **개인·비상업용** 날씨 지도입니다. Zoom Earth와 무관하며 공식 예보·경보 서비스가 아닙니다. 아래 [Disclaimer](#disclaimer)를 꼭 읽어 주세요.

**웹사이트:** https://chs2147.github.io/zoom-earth/

## 프로젝트 소개

태풍 진로와 예측 모델 지도를 한 화면에서 보는 서비스를 직접 만들어 본 프로젝트입니다. 두 부분으로 구성됩니다.

### 1. Zoom Earth 분석 (`analysis/`)

REA로 Zoom Earth 웹사이트를 분석했습니다.
- **분석 방법**: 공개된 페이지·스크립트·네트워크 응답을 REA로 캡처했습니다.
- **알아낸 것**
  - 태풍 진로와 예측 모델 지도가 어떤 데이터와 방식으로 제공되는지 정리했습니다.
  - 모델 지도는 값을 인코딩한 이미지 타일과 WebGL 렌더링으로 그려집니다.
  - GFS·ICON 진로를 JTWC 공식 예보와 비교했습니다.

| 문서 | 내용 |
|---|---|
| [`zoom-earth-typhoon-models.md`](analysis/zoom-earth-typhoon-models.md) | 태풍 데이터 API, 모델 타일 인코딩, 렌더링 방식 |
| [`champi-2026-model-tracks.md`](analysis/champi-2026-model-tracks.md) | 태풍 참피(Champi) GFS·ICON 진로와 JTWC 비교 |
| [`zoom-earth-features.md`](analysis/zoom-earth-features.md) | 주요 기능과 무료·Pro 차이 정리 |

### 2. Typhoon Lens 웹 앱 (`web/`)

분석에서 얻은 **구조와 아이디어만** 참고했습니다. 실제 구현은 **공개 기상 데이터**로 새로 만들었습니다.
- **데이터**: NOAA GFS, DWD ICON, JTWC·NHC 경보, NASA GIBS, RainViewer
- **사용하지 않은 것**: Zoom Earth의 코드·타일·API·유료 데이터·브랜드

| 기능 | 내용 |
|---|---|
| 예보 지도 | 바람(풍속·돌풍), 강수(비·눈·구름), 기온, 습도, 기압(등압선) |
| 예보 모델 | GFS 16일(384시간), ICON 7.5일(180시간) 전환 |
| 태풍 | JTWC·NHC 공식 예보 진로·강풍 반경·불확실성 범위, 모델 자동 추적 진로, 시각별 상세 표 |
| 관측 | 위성(NASA GIBS VIIRS), 강수 레이더(RainViewer), 산불 열점 |
| 사용성 | 타임라인 재생, 도시별 값·풍향, 바람 흐름 애니메이션, 공유 링크, 풍속 단위 설정, 모바일 화면, 모델 기준 시각·업데이트 시각 표시, 백그라운드 복귀·불러오기 실패 시 현재 시각으로 자동 새로고침 |
| 자동 갱신 | Upstash QStash가 30분마다 Vercel 운영 서버를 호출. 서버가 모델별 새 실행을 확인해 배포를 시작하고, 1시간 넘게 배포가 없으면 공식 경보를 갱신. 변환·배포는 GitHub Actions → GitHub Pages. 같은 서버를 Railway 등에서 상시 실행할 수도 있음 |
| 운영 관리 | 관리 화면에서 모델별 상태(배포된 실행·원본 최신 실행·다음 실행 예상), 최근 배포 작업, 지금 점검·재배포·재시도 |

자세한 구조와 실행 방법은 [`web/README.md`](web/README.md), 운영 서버는 [`web/control/README.md`](web/control/README.md)에 있습니다. 앞으로 할 일(한국 KIM·일본 GSM 모델 추가 등)은 [`ROADMAP.md`](ROADMAP.md)에 있습니다.

## 버전 정보

현재 버전은 **Typhoon Lens v0.2.1**(2026-10-23)입니다.
- 웹 앱: https://chs2147.github.io/zoom-earth/ (GitHub Pages)
- 운영 서버: v0.1.0, https://typhoon-lens-swart.vercel.app/ (Vercel)

### 사용 구성요소

| 구성요소 | 버전 |
|---|---|
| REA (`rea-agents`) | 6.7.0: 분석에 사용한 npm CLI (저장소 [chs2147/rea](https://github.com/chs2147/rea) 6.4.0 기준으로도 설치) |
| MapLibre GL JS | 4.7.1 |
| Vite / TypeScript | 5.4.21 / 5.6.3 |
| Node.js | 22 (웹 앱 빌드, 운영 서버) |
| Python / pygrib | 3.12 / 2.1 |
| 예보 데이터 | NOAA GFS 0.5° (6시간 주기), DWD ICON 전구 13 km (00·12Z) |
| 운영 | Vercel(운영 서버, Hobby), Upstash QStash(30분 주기 호출), GitHub Actions(변환·배포), GitHub Pages(웹 앱·데이터) |

### 변경 이력

| 버전·PR | 날짜 | 내용 |
|---|---|---|
| [#1](https://github.com/chs2147/zoom-earth/pull/1) | 2026-10-21 | REA 클라우드 세션 설정, Zoom Earth 태풍·모델 분석 |
| [#2](https://github.com/chs2147/zoom-earth/pull/2) | 2026-10-21 | GFS·ICON 진로 비교, 주요 기능 정리 |
| [#3](https://github.com/chs2147/zoom-earth/pull/3) | 2026-10-21 | **v0.1.0** Typhoon Lens 웹 앱: GFS 16일 예보 지도, 모델 태풍 추적, JTWC·NHC 공식 예보 |
| [#4](https://github.com/chs2147/zoom-earth/pull/4) | 2026-10-21 | GitHub Pages 자동 배포(매시간) |
| [#5](https://github.com/chs2147/zoom-earth/pull/5) | 2026-10-21 | 공식 태풍 표시가 타임라인을 따라 움직이도록 수정 |
| [#6](https://github.com/chs2147/zoom-earth/pull/6) | 2026-10-21 | ICON 모델, 태풍 상세 패널, 화면 구성 개편 |
| [#7](https://github.com/chs2147/zoom-earth/pull/7) | 2026-10-21 | 위성 레이어 자동 선택, 링크 미리보기, 홈 화면 아이콘 |
| [#8](https://github.com/chs2147/zoom-earth/pull/8) | 2026-10-21 | 산불 레이어 WMS 대체 경로 |
| [#9](https://github.com/chs2147/zoom-earth/pull/9) | 2026-10-21 | 모델 실행 완성 여부를 모든 파일 기준으로 판단 |
| [#10](https://github.com/chs2147/zoom-earth/pull/10) | 2026-10-21 | README 프로젝트 소개, 버전 정보, REA 기반 비상업용 Disclaimer |
| [#11](https://github.com/chs2147/zoom-earth/pull/11) | 2026-10-21 | **운영 서버 v0.1.0**: 모델별 새 실행 감지·배포 시작·재시도·관리 화면(Vercel), workflow가 모델 실행을 입력으로 받음, 로드맵 |
| [#12](https://github.com/chs2147/zoom-earth/pull/12) | 2026-10-21 | Vercel Hobby에서 배포되도록 Cron을 하루 1회 예비용으로 변경 |
| [#13](https://github.com/chs2147/zoom-earth/pull/13) | 2026-10-21 | 상시 실행 서버(`server.js`, Railway용) |
| [#14](https://github.com/chs2147/zoom-earth/pull/14) | 2026-10-21 | POST만 보내는 스케줄러(Upstash QStash)용 `/api/tick` POST 지원 |
| [#15](https://github.com/chs2147/zoom-earth/pull/15) | 2026-10-23 | 지도 윤곽선 가시성, 모델 기준 시각 표시, 백그라운드 복귀 시 새로고침, 휴대폰 모델 전환 버튼 가림 수정 |
| [#16](https://github.com/chs2147/zoom-earth/pull/16) | 2026-10-23 | **v0.2.0** 예보 데이터 불러오기 실패 시 자동 새로고침 |
| [#17](https://github.com/chs2147/zoom-earth/pull/17) | 2026-10-23 | README 버전 정보(v0.2.0), 운영 방식 문서 정정 |
| [#18](https://github.com/chs2147/zoom-earth/pull/18) | 2026-10-23 | **v0.2.1** 업데이트 시각을 모델 선택 위 별도 박스로 이동, 모델 선택과 타임라인 겹침 방지, 출처 표시 기본 접힘 |
| [#19](https://github.com/chs2147/zoom-earth/pull/19) | 2026-10-23 | README 버전 정보(v0.2.1) |
| [#20](https://github.com/chs2147/zoom-earth/pull/20) | 2026-10-23 | 개선·기능 추가 시 README 버전 정보를 자동으로 기록하는 작업 규칙(`CLAUDE.md`) |

## 저장소 구성

```
zoom-earth/
├── analysis/        # REA 분석 보고서와 그림
├── scenarios/       # REA 브라우저 캡처 시나리오
├── tools/           # 타일 디코더, 진로 추출·그림 스크립트
├── web/             # Typhoon Lens (pipeline: Python, app: TypeScript, control: Vercel 운영 서버)
├── ROADMAP.md       # 앞으로 할 일
├── CLAUDE.md        # 작업 규칙(README 버전 정보 자동 기록)
├── .claude/         # 클라우드 세션용 REA 설치 훅
└── .github/workflows/typhoon-lens.yml   # 데이터 생성·배포
```

## Disclaimer

**1. 비상업용 프로젝트**

이 프로젝트는 REA를 활용한 학습·연구 목적의 **개인·비상업용** 프로젝트입니다. 판매, 광고, 유료 구독 등 상업적 용도로 사용하지 않으며, 그런 용도로 쓰는 것을 허용하지 않습니다.

**2. REA 기반**
- 분석은 REA(MIT 라이선스, © 2026 morluto)로 수행했습니다.
- REA의 [책임 있는 사용 고지](https://github.com/morluto/rea/blob/main/DISCLAIMER.md)를 따릅니다. 기술적 보호 조치 우회, 접근 통제 우회, 독점 코드·자산 복제는 하지 않았습니다.
- REA 프로젝트와 그 저작자는 이 저장소와 관련이 없으며, 이 저장소를 보증하지 않습니다.

**3. Zoom Earth와 무관**
- 이 프로젝트는 Zoom Earth 및 Neave Interactive와 관련이 없고, 그 승인을 받지 않았습니다.
- 분석은 웹사이트가 공개적으로 제공하는 응답만 대상으로 했습니다. 유료(Pro) 데이터에는 접근하지 않았습니다.
- Typhoon Lens는 Zoom Earth의 코드, 타일, API, 데이터, 상표, 로고, 디자인 자산을 사용하지 않습니다.
- "Zoom Earth"는 해당 소유자의 상표입니다.

**4. 공식 예보가 아님**
- Typhoon Lens는 생명·재산 보호를 위한 판단에 쓰면 안 됩니다.
- 모델 진로와 강도는 자동 계산 결과라 실제와 다를 수 있습니다.
- 불확실성 범위는 근사치입니다.
- 공식 예보·경보는 기상청(KMA), JTWC, NHC 등 공식 기관의 발표를 확인하세요.

**5. 데이터 출처와 이용 조건**
- NOAA GFS·JTWC·NHC는 미국 정부 공개 데이터입니다.
- DWD ICON은 DWD 공개 데이터이며 출처 표기가 필요합니다.
- NASA GIBS·FIRMS는 NASA 공개 데이터이며 출처 표기가 필요합니다.
- RainViewer는 개인·비상업 용도로만 무료입니다.
- Natural Earth는 퍼블릭 도메인입니다.
- 각 데이터의 이용 조건은 해당 제공자의 정책을 따릅니다.

**6. 보증 없음**
이 프로젝트는 "있는 그대로" 제공되며, 정확성·가용성·특정 목적 적합성에 대한 어떠한 보증도 하지 않습니다.
