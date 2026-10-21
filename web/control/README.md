# Typhoon Lens 운영 서버 (Vercel)

모델별 예보 갱신을 관리하는 서버입니다. 무거운 변환은 GitHub Actions가 하고, 이 서버는 **언제 무엇을 배포할지** 정합니다.

```
 Vercel Cron (10분마다)
        │
        ▼
 /api/tick ──► 모델 원본 확인 (NOAA S3 · DWD)      최신 완성 실행
          ──► 사이트 data/index.json              배포된 실행
          ──► GitHub Actions 최근 실행 목록        진행 중·실패 이력
        │
        └─ 새 실행이 있거나 1시간 동안 배포가 없으면
           GitHub API로 배포 workflow를 실행 (모델별 실행 시각을 입력으로 전달)
                     │
                     ▼
           GitHub Actions: 프레임 변환(실행별 캐시) → 공식 경보 → GitHub Pages 배포
```

## 동작 방식

서버는 데이터베이스 없이 매번 세 곳을 확인해서 상태를 계산합니다.

| 확인 대상 | 알아내는 것 |
|---|---|
| 모델 원본 | 필요한 파일이 **모두** 올라온 최신 실행. GFS는 0~384시간 전체, ICON은 00·12Z 실행의 모든 변수·시간. Python 파이프라인(`gfs.py`, `icon.py`)의 판정과 같은 규칙입니다. |
| 사이트 `data/index.json` | 지금 사이트가 보여 주는 실행 |
| 배포 workflow 실행 목록 | 진행 중인 작업, 같은 실행을 몇 번 시도했는지. 실행 제목(`Typhoon Lens · update gfs · gfs 2026102106 · icon 2026102100`)에 모델별 실행 시각이 들어 있습니다. |

모델별 상태:

| 상태 | 뜻 | 서버 동작 |
|---|---|---|
| 최신 | 원본 최신 실행이 이미 배포됨 | 없음 |
| 갱신 대기 | 새 실행이 완성됨 | 배포 시작 |
| 변환 중 | 그 실행을 담은 배포가 진행 중 | 기다림 |
| 배포 반영 중 | 배포가 15분 안에 끝났고 사이트 반영을 기다림 | 기다림 |
| 실패 · 이전 실행 유지 | 24시간 동안 3번 시도했지만 사이트에 반영되지 않음 | 이전 실행으로 계속 배포. 관리 화면에서 다시 시도 가능 |
| 원본 확인 불가 | 원본 서버 응답 없음 | 이전 실행 유지 |

- 배포 작업이 진행 중이면 새 작업을 시작하지 않습니다.
- 바뀐 모델이 없어도 1시간마다 다시 배포해서 공식 태풍 경보와 위성·산불 레이어를 갱신합니다.
- ICON이 계속 실패하면 GFS만으로 배포합니다. GFS는 필수입니다.

## API

| 경로 | 인증 | 내용 |
|---|---|---|
| `GET /api/status` | 없음 | 모델·사이트·배포 상태(JSON). CDN에 60초 캐시 |
| `GET /api/tick` | `Authorization: Bearer $CRON_SECRET` | 점검 후 필요하면 배포 시작. Vercel Cron이 호출. `?dry=1`은 점검만 |
| `POST /api/dispatch` | `Authorization: Bearer $ADMIN_TOKEN` | `{"action":"check"}` 지금 점검, `{"action":"refresh"}` 지금 재배포, `{"action":"retry","model":"icon"}` 실패한 모델 다시 시도 |

`/`는 관리 화면입니다. 상태를 1분마다 새로 고치고, 관리 토큰을 넣으면 위 동작을 버튼으로 실행합니다.

## 환경 변수 (Vercel 프로젝트 설정)

| 이름 | 필수 | 내용 |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | Fine-grained personal access token. 저장소 `chs2147/zoom-earth`만, 권한 **Actions: Read and write** |
| `CRON_SECRET` | ✅ | Vercel Cron 인증용 임의 문자열. Vercel이 Cron 호출에 자동으로 붙입니다 |
| `ADMIN_TOKEN` | 관리 화면 버튼을 쓸 때 | 관리 동작 인증용 임의 문자열 |
| `SITE_URL` | | 기본값 `https://chs2147.github.io/zoom-earth/` |
| `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW`, `GITHUB_REF_NAME` | | 기본값 `chs2147`, `zoom-earth`, `typhoon-lens.yml`, `main` |

## Vercel 프로젝트 설정

- Root Directory: `web/control`
- Framework Preset: Other (빌드 없음). `public/`이 정적 파일, `api/`가 함수입니다.
- Cron은 `vercel.json`에 있습니다(10분마다). Vercel Hobby 요금제는 Cron을 하루 1번만 허용하므로, 10분 간격은 Pro 요금제에서만 됩니다. Hobby라면 외부 스케줄러가 같은 헤더로 `/api/tick`을 호출하면 됩니다.

## 개발

```bash
cd web/control
npm install
npm test           # 판단 로직·원본 확인 단위 테스트
npm run typecheck  # JSDoc 타입 검사
```

## 모델 추가

1. `web/pipeline/typhoon_lens/<모델>.py`: 원본을 읽어 0.5° 격자 필드를 돌려주는 소스 (`gfs.py`, `icon.py`와 같은 구조)
2. `.github/workflows/typhoon-lens.yml`: `<모델>_run` 입력, 캐시 복원·변환·저장 단계, 실행 제목
3. `web/control/lib/upstream.js`: 원본의 최신 완성 실행 확인
4. `web/control/lib/models.js`: 모델 항목(주기, 공개 지연, 필수 여부)
