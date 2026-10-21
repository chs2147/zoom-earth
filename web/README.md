# Typhoon Lens (웹 버전)

GFS 16일 예보 지도와 열대저기압 진로를 보는 **개인·비상업용** 날씨 지도입니다.
분석 문서(`../analysis/`)에서 확인한 구조를 공개 데이터로 다시 구현했습니다.
- 수치를 인코딩한 이미지 → WebGL 디코딩·색칠 → 시간 보간 → 등압선
- Zoom Earth의 타일, API, 코드, 브랜드는 사용하지 않습니다.

## 기능

| 기능 | 상태 | 데이터 |
|---|---|---|
| 예보 지도: 바람, 돌풍, 기압(등압선), 기온, 습도, 강수(비·눈·구름) | ✅ 동작 확인 | NOAA GFS 0.5°, 3시간 간격 **384시간(16일)** |
| 타임라인 재생, 두 예보 시각 사이 보간 | ✅ | 같음 |
| 지점 값 표시(마우스 오버 또는 탭) | ✅ | 같음 |
| 공식 태풍 예보 | ✅ JTWC 동작 확인 · ⚠️ NHC 미검증 | JTWC 경보(JMV 3.0): 예보 진로, 강풍 반경(34·50·64kt), 지나온 경로, 발생 경보(TCFA). NHC는 현재 위치만 표시하며, 활성 태풍이 없어 실제 데이터로 확인하지 못함 |
| 열대저기압 진로(모델) | ✅ | GFS 해면기압·바람에서 자동 추적하고 공식 태풍과 이름을 연결. 공식 예보 아님 |
| 위성 영상(트루컬러) | ⚠️ 코드만 작성, 미검증 | NASA GIBS VIIRS. 사용자 브라우저가 직접 받음 |
| 강수 레이더 | ⚠️ 코드만 작성, 미검증 | RainViewer 공개 API |
| 산불 열점 | ⚠️ 코드만 작성, 미검증 | NASA GIBS VIIRS 열이상 |
| ICON 모델 | ⏳ 다음 단계 | DWD 공개 데이터 |

미검증 항목은 개발 환경에서 해당 서버에 접속할 수 없어 실제 응답을 확인하지 못한 것입니다. 일반 브라우저에서는 동작할 것으로 예상하지만 확인이 필요합니다.

## 구성

```
web/
├── pipeline/          # Python: GFS → 인코딩 프레임 + 진로
│   └── typhoon_lens/
│       ├── layers.py  # 레이어 정의(변수, 단위, 인코딩 범위)
│       ├── gfs.py     # AWS 공개 버킷에서 필요한 GRIB 메시지만 범위 요청
│       ├── encode.py  # 무손실 WebP 인코딩/디코딩
│       ├── tracker.py # 열대저기압 감지·추적
│       ├── retrack.py # 저장된 프레임으로 진로만 다시 계산
│       ├── official.py # JTWC·NHC 공식 경보 → official.json
│       └── build.py   # 실행 진입점, manifest/index 작성
└── app/               # TypeScript + MapLibre GL 웹 앱
    └── src/
        ├── fieldLayer.ts  # WebGL2 커스텀 레이어(디코딩, 보간, 팔레트, 등압선)
        ├── frames.ts      # 프레임 로딩·캐시, 지점 값 계산
        ├── palettes.ts    # 색상 척도
        ├── storms.ts      # 진로 GeoJSON, 강도 분류
        ├── basemap.ts     # Natural Earth 지도, 오버레이
        └── main.ts        # 화면·타임라인·메뉴
```

### 프레임 인코딩

픽셀값이 곧 수치이고, 무손실 WebP라서 값이 정확히 보존됩니다(720×361, 0.5° 격자).

| 인코딩 | 레이어 | 채널 |
|---|---|---|
| `scalar16` | 돌풍, 기압, 기온, 습도 | R=상위 바이트, G=하위 바이트 (16비트) |
| `uv12` | 바람 | u·v 각각 12비트: R=u 상위 8비트, G=v 상위 8비트, B=두 값의 하위 4비트 |
| `precip` | 강수 | R·G=강수율 16비트, B=구름량(0–127), 눈이면 +128 |

인코딩 범위는 `manifest.json`에 기록되고, 앱은 그 값을 읽어서 디코딩합니다.

## 실행 방법

```bash
# 1) 데이터 생성 (최신 GFS 실행, 약 5분, 약 200 MB)
cd web/pipeline
pip install -r requirements.txt
python3 -m typhoon_lens.build ../app/public/data

# 빠르게 시험할 때: 48시간만
python3 -m typhoon_lens.build ../app/public/data --max-hour 48

# 공식 태풍 경보 (수 초, 1시간마다 실행 권장)
python3 -m typhoon_lens.official ../app/public/data

# 2) 웹 앱 실행
cd ../app
npm ci
npm run dev        # http://localhost:5173
npm run build      # dist/ 정적 사이트 (data/는 따로 배포)
```

GFS는 6시간마다(00/06/12/18Z) 새 실행이 나오고, 384시간까지 모두 공개되기까지 약 5시간 걸립니다. 정기적으로 `build`를 실행하면 최신 실행 2개만 보관합니다(`--keep`).

## 배포 (GitHub Pages)

`.github/workflows/typhoon-lens.yml`이 매시간(매시 17분) 다음을 실행합니다.
1. 384시간까지 모두 공개된 최신 GFS 실행을 찾습니다.
2. 그 실행의 프레임이 Actions 캐시에 있으면 재사용하고, 없으면 새로 만듭니다. 새로 만드는 일은 6시간마다 한 번, 약 10분 걸립니다.
3. JTWC·NHC 공식 경보를 갱신합니다. 실패해도 배포는 계속됩니다.
4. 웹 앱을 빌드하고 GitHub Pages에 배포합니다.

처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 합니다. 배포 주소는 `https://<사용자>.github.io/zoom-earth/`입니다.

수동 실행: **Actions → Deploy Typhoon Lens → Run workflow**.

## 열대저기압 추적 방식

`tracker.py`가 다음 순서로 진로를 만듭니다.
1. 단계마다 해면기압 국지 최저점 가운데, 주변보다 2 hPa 이상 낮은 닫힌 저기압을 후보로 찾습니다.
2. 위도 25° 이내이고 반경 2.5° 안 최대풍이 17 m/s 이상인 후보에서 새 진로를 시작합니다.
3. 이전 이동 방향으로 예상한 위치 근처의 후보를 이어 붙입니다.
4. 24시간 이상 지속된 진로만 남깁니다.

모델 풍속은 실제 태풍보다 약하게 나오는 경향이 있습니다. 강도 등급은 모델 10m 최대풍 기준이고 공식 등급이 아닙니다.

## 공식 태풍 예보

`official.py`는 공식 경보를 다음 순서로 가져옵니다.
1. JTWC RSS(`jtwc.rss`)에서 활성 시스템별 JMV 3.0 데이터(`.tcw`) 링크를 찾습니다.
2. 경보(WARNING)에서는 발표 시각, 번호·이름·등급, 예보 지점(T000~T120), 강풍 반경, 비고, 지나온 경로를 읽습니다.
3. 발생 경보(TCFA, ALERT)에서는 지나온 경로만 읽습니다.
4. NHC `CurrentStorms.json`에서 JTWC가 다루지 않는 대서양 시스템의 현재 위치를 더합니다.

- **불확실성 범위(콘)**: JTWC는 콘을 발표하지 않습니다. 그래서 예보 시간별 대략적인 평균 진로 오차(12시간 25해리 ~ 120시간 185해리)로 그린 **근사치**입니다. 공식 산출물이 아닙니다.
- **모델 진로와 이름 연결**: 공식 발표 시각의 모델 위치가 공식 위치에서 3° 이내이면 같은 태풍으로 봅니다(예: "GFS Champi").

## 데이터 출처와 이용 조건

- **NOAA GFS**: 미국 정부 공개 데이터. NOAA Open Data Dissemination(AWS) 버킷을 사용합니다.
- **JTWC·NHC**: 미국 정부 공개 경보입니다. 출처를 표기합니다.
- **Natural Earth**: 퍼블릭 도메인. `world-atlas` 패키지로 사용합니다.
- **NASA GIBS/FIRMS**: 공개 데이터. 출처 표기가 필요합니다.
- **RainViewer**: 개인·비상업 용도에 한해 무료이며 출처 표기가 필요합니다.

상업적으로 쓰려면 각 데이터의 이용 조건을 다시 확인해야 합니다.
