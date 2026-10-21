# Zoom Earth 태풍·예측 모델 분석

- 분석일: 2026-10-21 (UTC 03시경)
- 대상: https://zoom.earth (번들 `app.43ddb4ba.js`, SHA-256 `59d213af6feadc7419797982caf411ef69cb39aac704a636741262cfcb45235b`)
- 도구: REA `rea-agents` 6.7.0 CLI. Chromium 141을 에이전트 프록시와 SwiftShader WebGL로 띄운 뒤 connect 모드로 연결함
- 관측 대상 태풍: `champi-2026` (Super Typhoon Champi / PAGASA 이름 Rosal)

표기 규칙:
- **[관측]** REA가 캡처한 네트워크·화면 증거, 또는 직접 받은 응답과 디코딩 결과
- **[정적]** 번들 코드를 읽어서 얻은 사실. 실행 여부는 따로 증명하지 않음
- **[추론]** 위 사실에서 도출한 해석
- **[미확인]** 확인하지 못한 부분

## 1. 한눈에 보기

Zoom Earth의 태풍 화면은 서로 다른 두 데이터 계층을 겹쳐서 보여 줍니다.

| 계층 | 출처 | 형식 | 렌더링 |
|---|---|---|---|
| 태풍 진로·예보 원(cone) | 공식 기관 예보(JTWC, NHC) | JSON (`/data/storms/`) | 벡터 선·점·다각형 |
| 예측 모델 필드 | 수치예보 모델 GFS(NCEP), ICON(DWD) | **값을 인코딩한 WebP 타일** | WebGL 셰이더로 색칠, 시간 보간, 등압선 |

진로 예보는 기관 예보를 그대로 보여 줍니다. ECMWF 같은 다른 모델의 앙상블이나 스파게티 진로는 이번 번들과 응답에서 발견되지 않았습니다 **[정적·관측]**.

## 2. API 엔드포인트

번들 안의 URL 문자열은 ROT13 뒤 Base64로 난독화돼 있습니다(`Vt.i("...")`). 이를 풀어서 기준 URL을 복원했고 **[정적]**, 실제 요청으로 확인했습니다 **[관측]**.

| 용도 | URL | 근거 |
|---|---|---|
| 활성 태풍 목록 | `https://zoom.earth/data/storms/?date=2026-10-20T18:00Z&to=12` | 관측: `{"storms":[...],"disturbances":[]}` |
| 태풍 상세 | `https://zoom.earth/data/storms/?id=champi-2026` | 관측: 17,229바이트 JSON |
| 모델 실행 시각 색인 | `https://tiles.zoom.earth/times/{gfs,icon}.json` | 관측 |
| 모델 타일 | `https://tiles.zoom.earth/{model}/{ver}/{layer}/webp/{level}/{YYYY-MM-DD}/{HHMM}/f{hhh}/{z}/{y}/{x}.webp` | 정적(`getURL`)과 관측 일치 |
| 데이터 없음 | `https://tiles.zoom.earth/{model}/{ver}/{layer}/blank.png` | 관측 |
| 서버 시각, 핑, 공지 | `/data/time/`, `/data/ping/`, `/data/notices/`, `/data/outages/` | 관측 |
| 지점 예보 | `https://api.zoom.earth/weather/` | 정적만 확인. 이번 시나리오에서는 호출되지 않음 |
| 유료(Pro) 시각 색인 | `https://tiles.zoom.earth/times/pro/{model}.json?token=...` | 정적 확인. 토큰 없이 요청하면 403(관측). Pro는 최대 15일 예보(사용자 제보). `zoom-earth-features.md` 참고 |

관측 예시:
- `gfs/v1/wind-speed/webp/10m/2026-10-20/1800/f009/3/3/6.webp`
- `icon/v1/pressure/webp/msl/2026-10-20/1800/f010/4/7/13.webp`

## 3. 태풍 데이터 (`/data/storms/?id=...`)

**[관측]** `champi-2026` 응답의 최상위 필드:
- `title`: "Typhoon Champi (Rosal)"
- `type`: Typhoon
- `description`: Super Typhoon
- `agencies`: "JTWC"
- `ja`: 30 (JMA 번호로 추정 **[추론]**)
- `ph`: "rosal"
- `max`, `forecast`, `active`, `place`
- `cone`: 경도·위도 쌍 125개로 된 다각형

`track` 배열에는 49개 지점이 있고, 그중 8개가 예보(`forecast: true`)입니다. 각 지점의 필드는 `date`, `coordinates[lon,lat]`, `wind`, `pressure`, `basin`, `code`, `description`, `rank`, `spline`입니다.
- `spline`에는 이전 지점과 잇는 곡선 보간점이 **서버에서 미리 계산돼** 들어 있습니다.
- `pressure`는 예보 지점에서 `null`입니다.
- `wind`는 바람 값입니다. 21일 00Z 지점이 155에 Super Typhoon이어서 노트(kt) 단위로 보입니다 **[추론]**.

**[관측]** 같은 요청에서 받은 다른 활성 시스템:
- `93l-2026`, `94e-2026`: `agencies` "NHC/JTWC"
- `96a-2026`, `agueda-2027`: `agencies` "JTWC"
- Invest(발달 가능 저기압) 항목에는 `chance2day`, `chance7day` 또는 `chance` 같은 발달 확률 필드가 붙습니다.

## 4. 예측 모델 (GFS, ICON)

### 4.1 사용 가능한 모델과 변수
- **[정적]** 모델 목록: `Ut = {GFS:"gfs", ICON:"icon"}`
- **[관측]** 화면 출처 표기: GFS는 "NCEP/NWS/GFS 20/18Z", ICON은 "DWD/ICON 20/18Z"
- **[관측]** `times/gfs.json`의 변수와 고도:

| 변수 | 고도 |
|---|---|
| precipitation | surface |
| wind-speed | 10m |
| wind-gusts | surface |
| temperature, temperature-feel, humidity, dew-point, temperature-wet-bulb | 2m |
| pressure | msl |

### 4.2 실행 시각 색인
**[관측]** 형식은 `{변수: {고도: {실행시각(unix 초): [예보시간, ...]}}}`입니다.
- GFS는 2026-10-10 18Z부터 2026-10-20 18Z까지 실행 41개를 보관합니다(6시간 간격).
- 최신 실행에는 예보시간 59개가 있습니다.

**[정적]** 화면 시각에 맞는 타일을 고르는 함수는 `Wm.getClosest`입니다.
- 모든 실행에서 `실행시각 + 예보시간 × 3600`이 원하는 시각에 가장 가까운 조합을 찾습니다.
- 최신 실행부터 거꾸로 훑기 때문에 차이가 같으면 최신 실행이 우선합니다.
- **[추론]** 최신 실행이 아직 다루지 않는 먼 미래 시각이면, 예보 기간이 더 긴 이전 실행으로 대체될 수 있습니다.

### 4.3 타일은 '색'이 아니라 '값'
**[정적]** 변수마다 채널 값 범위가 정해져 있습니다(`Sr[...]`). 셰이더는 이 값을 물리량으로 바꾼 뒤 팔레트 텍스처에서 색을 찾습니다.

| 변수 | 셰이더 | 채널 인코딩 |
|---|---|---|
| pressure | PRESSURE | R/G/B 세 구간이 겹쳐 이어짐: 859.5–987, 985–1036, 1034–1085 hPa |
| wind-speed | UV | R=u, G=v (각각 −63.5~64). 바람 세기는 `length(u,v)` |
| temperature, dew-point | RGB | 세 구간 연결 방식 |
| precipitation | PRECIPITATION | R=구름, G=비, B=눈 (G·B는 8제곱 스케일) |
| 그 밖 | SCALAR | R 채널 하나 |

**[관측] 디코딩 검증**: 직접 받은 타일 두 장을 `tools/decode_tile.py`로 풀었습니다.

| 타일 | 결과 | 비교 대상 |
|---|---|---|
| ICON 해면기압, 20/18Z +9h, z3/6/3 | 최저 **921.0 hPa**, 18.31°N 129.55°E | JTWC 21일 00Z 위치 18.1°N 130.1°E, 902 hPa |
| GFS 10m 바람, 20/18Z +9h, z3/6/3 | 최대 **57.0**, 18.98°N 129.90°E | 같은 태풍 위치 |
| ICON 해면기압, z4/13/7 | 11.2°N 123.8°E에서 1010.0 hPa | 화면 라벨 "1009" (마닐라·다바오) |

- 세 결과 모두 태풍 중심 또는 화면 표시 값과 맞아서 디코딩 공식이 올바르다고 판단합니다.
- **[추론]** 바람 단위는 m/s로 봅니다. 57 m/s는 약 111 kt로, 전구 모델이 강한 태풍 강도를 낮게 잡는 일반적인 경향과도 맞습니다. 단위가 코드에 명시돼 있지는 않습니다.

### 4.4 렌더링 방식
- **[관측] 시간 보간**: 현재 시각(03:2x UTC)에 대해 GFS와 ICON 모두 `f009`와 `f010` 두 시각의 타일을 함께 받았습니다.
- **[정적]** 셰이더는 두 시각의 타일을 `mix(texture2, texture, ratio)`로 섞어서 1시간 사이를 부드럽게 이어 줍니다. 이 1시간 간격은 `timeStep = 3600`입니다.
- **[정적] 등압선**: 기압 셰이더가 `GL_OES_standard_derivatives`의 `dFdx`, `dFdy`로 GPU에서 등압선을 직접 그립니다.
  - 가우시안 가중 평활과 `1.315 × smoothstep` 보정을 거칩니다.
  - 고·저기압 중심과 라벨 위치는 CPU에서 별도로 찾습니다(`np`, `rp`의 prominence 탐색).
- **[관측]** WebGL이 꺼진 Chromium(`--disable-gpu`)에서는 모델 색상 레이어가 그려지지 않았습니다.
- **[관측] 확대 한도**: 같은 화면(zoom 5)에서 GFS 타일은 z3, ICON 타일은 z4가 요청됐습니다. 모델마다 해상도별 최대 줌(`Pe.models[model]`)이 다르다는 정적 코드와 일치합니다.

## 5. 재현 방법

1. Chromium을 프록시와 소프트웨어 WebGL로 실행합니다. 클라우드 환경 기준입니다.
   ```bash
   /opt/pw-browsers/chromium --headless=new --no-sandbox \
     --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
     --proxy-server=http://127.0.0.1:38523 \
     --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 \
     --user-data-dir=/tmp/ze-profile about:blank
   ```
2. `curl -s http://127.0.0.1:9222/json/list`로 페이지 ID를 확인하고 `scenarios/*.json`의 `REPLACE_WITH_TARGET_ID`를 바꿉니다.
3. `rea capture-browser-scenario scenarios/model-layers.json --json > capture.json`
4. 타일을 디코딩합니다.
   ```bash
   python3 tools/decode_tile.py pressure 3 6 3 tile.webp
   ```

## 6. 증거 목록

| 내용 | REA Evidence ID |
|---|---|
| 태풍 목록과 상세 응답 본문 | `ev_26a9a302fcfed6819377562258612dca4d2c583f08bd3d4c8ca5ba7fbeec7b52` |
| GFS·ICON 모델 타일 요청과 스크린샷(WebGL 켬) | `ev_fc6c715db4ea72a8244028bb595a28ac6845fd00355bdc8f8ac478490bed7311` |
| 페이지 스크립트 수동 수집 | `ev_7cc2006ea323e9831148fbe0f463c4a955014bd9f308cda6a6eeedf4124a29c8` |
| 스크립트 내보내기 | `ev_e730cc3167b1979587686af5f75062722a69e54e556f425691b6ab40b477b3ca` |
| 정적 JS 분석 | `ev_0935dcf2f8aee8d43e4374a2de369c1859b0be4f623ac3b48bdd20c797230e14` |

증거 원본(캡처 JSON, 응답 본문, 타일, 번들)은 제3자 콘텐츠라서 저장소에 올리지 않았습니다. 세션 임시 디렉터리에만 있었고, 세션이 끝나면 사라집니다.

## 7. 한계와 미확인 사항
- **connect 모드의 사전 공백**: 기존 브라우저에 붙는 방식이라 연결 전 이벤트가 빠질 수 있습니다. 그래서 캡처 완결성은 `incomplete`로 표시됐습니다.
- **본문 캡처 한도**: 타일 본문까지 저장한 첫 캡처는 이벤트 용량 한도(16MB)를 넘었습니다. 모델 단계는 메타데이터만 다시 캡처했습니다. 타일 본문은 같은 URL을 `curl`로 다시 받아서 디코딩했습니다.
- **정적 분석의 한계**: 난독화된 문자열 때문에 REA 정적 분석이 엔드포인트를 거의 식별하지 못했습니다. URL 복원은 직접 디코딩한 결과입니다.
- **[미확인]** Pro 전용 기능의 차이, 지점 예보 API(`api.zoom.earth/weather/`)의 응답 형식, 요청 서명(`Request-Signature`)이 쓰이는 범위.
- **[미확인]** 모델 타일이 어떤 원자료(GRIB)에서 어떤 방식으로 만들어지는지. 서버 쪽이라 관측할 수 없습니다.
- 바람 단위(m/s)와 태풍 `wind` 단위(kt)는 추론입니다.
