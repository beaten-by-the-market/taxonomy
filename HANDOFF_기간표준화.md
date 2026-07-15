# HANDOFF — 기간(Period) 표준화 적용 (새 세션용)

> 이 문서 하나로 **문맥 없는 새 세션**이 기간 표준화를 이해하고, `공정공시내역`의
> **2024-01-01부터 전 데이터**에 동일 로직을 재적용할 수 있게 하는 인수인계서.
> 상세 알고리즘은 **[기간_표준화_로직.md](기간_표준화_로직.md)** 참조(트리·도식·정규식 해설·엣지케이스).

---

## 0. 결론 먼저 (TL;DR)

- **기간 표준화는 이미 구현·적용되어 있다.** 코드: `kind_project/src/periods.py`.
- **현재 데이터는 이미 2024-01 ~ 2026-06 전체**(3,891건)를 커버한다. "2025년부터"가 아니다.
- 새 세션이 할 일: (a) 이 로직을 이해하고, (b) `공정공시내역`에 새/더큰 export를 넣으면
  `python kind_project/src/build_all.py` **한 방으로 전량 재표준화**된다.
- 실행 한 줄:
  ```bash
  cd c:/Users/Peter/Desktop/taxonomy/kind_project && python src/build_all.py
  ```

---

## 1. 프로젝트 개요 (경로·구조)

한국거래소(KIND) **영업(잠정)실적 공정공시**를 XBRL/iXBRL로 태깅하고 가상 KIND 뷰어로 보는 프로젝트.

```
c:\Users\Peter\Desktop\taxonomy\
├─ 공정공시내역\                  ← 입력: KIND 다운로드 Excel(4개, 2024~2026)
│    20260715110451_연결…(공정공시).xlsx    (연결)
│    20260715110545_연결…(공정공시).xlsx    (연결)
│    20260715110623_영업(잠정)실적(공정공시).xlsx  (별도)
│    20260715110641_영업(잠정)실적(공정공시).xlsx  (별도)
├─ kind_project\                 ← 파이프라인·산출물·뷰어
│  ├─ src\  (아래 §8)
│  ├─ data\  disclosures.json · fiscal_months.json · kind_details.json
│  ├─ output\ instances\*.xml (3891) · ixbrl\*.html (3891)
│  └─ viewer\ index.html · app.js · data.js
├─ xbrl_downloader\output\        ← DART 정기보고서 XBRL(결산월 소스). 금융업종 제외.
├─ 차세대상장공시시스템용Taxonomy…\  ← 실제 KRX Taxonomy(schemaRef 대상)
├─ 기간_표준화_로직.md            ← 기간 표준화 상세 문서(정규식 해설·도식)
├─ 공정공시_잠정실적공시_Taxonomy_분석.md  ← taxonomy 구조 분석
└─ HANDOFF_기간표준화.md          ← (이 문서)
```

---

## 2. 현재 데이터 범위 (질문 답변)

- **공시일 범위: 2024-01 ~ 2026-06** (총 3,891건)
  - 2024년 1,526 · 2025년 1,569 · 2026년 796
- 서식: v2025(그룹형) 2,692 · v2026(지표형·명시적 날짜) 1,199
- 기준: 연결 2,821 · 별도 1,070 · 대상 358종목
- → **이미 2024-01-01부터 전부 들어가 있다.** 더 넓히려면 `공정공시내역`에 새 Excel을 넣고 재실행.

---

## 3. 기간 표준화 — 핵심 요약

**문제**: 회사마다 기수정보 표기가 제각각(`25년2분기`·`2Q24`·`4Q'23`·`제71기`·`(2025.8월)`·
명시적 날짜·무라벨 등) → 정규식 하나로 못 잡음.

**해법(4축 결합, `periods.py::assign_periods`)**:

```
 공시 1건 ─▶ resolve_one()  "당기(current)만 견고히 확정"
   ├─① v2026 명시적 시작/종료일 (날짜 유효성 통과 시)       [high]
   ├─② 라벨 파싱 parse_label (분기/월/반기/범위, 두 배열·기수배제) [high/med]
   └─③ 제출시점 휴리스틱 (12월결산: 제출월→분기)            [low]
        ▼ 전기·전년동기 = 당기에서 결정적 파생(라벨 오류 자동교정)
 assign_periods ─▶ ④ (종목×연결/별도) 시계열로 카덴스(월/분기) 판정 → 월간필러 무라벨건 보정
        ▼
   rec["periods"] = {current:[s,e], previous:[s,e], yoy:[s,e], source}
```

**두 대원칙**: ⑴ 당기만 확정하고 전기·전년동기는 계산으로 파생(오기 방어). ⑵ 명시적날짜>라벨>제출시점>시계열.

**현재 성과(3,891건)**:
- 기간 확정 **100%**, 전년동기·전기 **역전 0건**.
- 소스: `label_quarter` 2122 · `explicit_dates` 1082 · `label_range` 195 · `timing_month(series)` 179 ·
  `timing` 176 · `label_month` 135 · `label_half` 2.
- 신뢰도: high 3,525 · med 11 · low 355.

**결산월(§ 검증)**: DART 사업보고서 제목에서 결산월 실측 → 356개 12월 + SK오션플랜트(395400) 3월
(12→3 변경 이력). **둘 다 달력분기 경계월**이라 12월 가정 휴리스틱이 전건 유효(비경계 종목 0).
마스터: `data/fiscal_months.json`, 추출: `src/extract_fiscal_months.py`(제목만 사용).

> **정규식·도식·엣지케이스 전체는 반드시 [기간_표준화_로직.md] 읽을 것.**

---

## 4. 파이프라인 & 실행 순서

`src/build_all.py` 가 아래 순서로 실행(각 단계 개별 실행도 가능):

| 순 | 스크립트 | 역할 | 산출 |
|---|---|---|---|
| 1 | `extract_fiscal_months.py` | DART 제목→결산월 (비필수) | `data/fiscal_months.json` |
| 2 | `normalize.py` | Excel→JSON + **기간표준화(assign_periods)** + 가변행 + 결산월부착 | `data/disclosures.json` |
| 3 | `map_kind_urls.py` | KIND 접수번호→원문링크 (네트워크/캐시) | `disclosures.json`에 kind_url |
| 4 | `gen_xbrl.py` | JSON→XBRL 인스턴스 | `output/instances/*.xml` |
| 5 | `gen_ixbrl.py` | JSON→iXBRL | `output/ixbrl/*.html` |
| 6 | `build_viewer.py` | 뷰어 데이터 번들 | `viewer/data.js` |

**기간은 2단계(normalize)에서 확정**되고, 이후 gen_*/build_viewer는 `rec["periods"]`를 그대로 쓴다
(`common.derive_contexts`가 `rec["periods"]` 우선 사용).

```bash
cd c:/Users/Peter/Desktop/taxonomy/kind_project
python src/build_all.py                 # 전체
# 또는 개별:  python src/normalize.py    (기간표준화만 다시)
```

---

## 5. "2024-01-01부터 전 데이터" 적용 체크리스트

현재도 2024-01부터지만, **더 큰/새 export**로 전량 재적용할 때:

1. `공정공시내역`에 KIND에서 받은 Excel을 넣는다(파일명에 `연결`이 있으면 연결로 자동 인식).
   - **파일당 KIND 상한**: 서버가 페이지당 100건. 넓은 기간은 여러 파일로 나눠 받아 함께 두면 됨.
2. `python src/build_all.py` 실행 → normalize가 **모든 xlsx를 자동 병합·표준화**.
3. **KIND 링크 수집 범위 확인**: `src/map_kind_urls.py` 의 `CHUNKS`가 연도별
   `("2024-01-01","2024-12-31")…("2026-…")`로 되어 있다. 데이터가 2023년 이전이나 2027년으로
   넘어가면 **CHUNKS에 해당 연도 구간을 추가**할 것. (없으면 그 연도 링크 미부여)
4. **결산월**: `extract_fiscal_months.py`는 `xbrl_downloader/output/03_report_list.csv`를 읽는다.
   새 종목이 생기면 xbrl_downloader를 갱신하거나, 없으면 전부 12월로 기본 처리(경계월이면 안전).
5. 재실행 후 §6 검증.

> 핵심: **기간 표준화는 입력 파일 개수·기간과 무관하게 전 레코드에 자동 적용**된다.
> 새로 해줄 코드는 없다. 단, 아래 §7의 "새 형식 감시"만 하면 된다.

---

## 6. 검증 방법

```bash
cd c:/Users/Peter/Desktop/taxonomy/kind_project
# (1) 기간 커버리지·역전·소스 분포
python - <<'PY'
import json
d=json.load(open("data/disclosures.json",encoding="utf-8"))
from collections import Counter
n=len(d); ok=sum(1 for r in d if r.get("periods",{}).get("current"))
rev=sum(1 for r in d if (p:=r.get("periods",{})) and p.get("yoy") and p.get("current") and p["yoy"][0]>=p["current"][0])
print(f"총 {n} · 기간확정 {ok}({100*ok//n}%) · 전년동기역전 {rev}(0이어야 정상)")
print("소스:", dict(Counter(r.get('periods',{}).get('source','?') for r in d)))
print("신뢰도:", dict(Counter(r.get('_period_conf','?') for r in d)))
# low(순수 timing) 건 표본 — 눈으로 확인
low=[r for r in d if r.get('_period_conf')=='low'][:10]
for r in low: print("  low:", r['company'], r['disclosure_datetime'][:10], r.get('period_labels',{}).get('current'), "→", r['periods']['current'])
PY

# (2) XBRL/iXBRL Arelle 검증 (표본)
pip install arelle-release   # 최초 1회
python -m arelle.CntlrCmdLine --validate --file output/instances/<uid>.xml  --logLevel error
python -m arelle.CntlrCmdLine --validate --file output/ixbrl/<uid>.html      --logLevel error
```

- **기대치**: 기간확정 100%, 역전 0, Arelle 오류 0.
- 특정 회사 시계열 점검: `stock_code`로 필터해 당기가 분기마다 전진하는지 눈으로 확인(§7 참고).

---

## 7. 알려진 이슈 · 엣지케이스 · 감시 포인트

새 데이터에서 **틀릴 수 있는 곳**(발견 즉시 `periods.py`/`parse_label` 보강):

| 감시 대상 | 증상 | 대응 |
|---|---|---|
| **새 라벨 형식** | 지금까지 없던 표기(예: `24-2Q`, `'24년2Q`, 로마숫자) | `parse_label`에 패턴 추가 후 재검증 |
| **비경계 결산월** | 결산월이 2·5·8·11월인 회사 유입 | `fiscal_month`로 회계분기 달력범위 직접산출 경로 추가(현재 미구현) |
| **결산월 변경** | 회사가 결산월 변경(SK오션플랜트 12→3처럼) | `fiscal_months.json`은 **최신 사업보고서** 기준. 과거 공시엔 history 참조 필요시 보강 |
| **월간+분기 이중 필러** | 같은 회사가 월·분기 혼재 | 카덴스 다수결이라 소수배열 흔들림 가능. 시계열 단조성 위반 로그 확인 |
| **명시적 날짜칸 오염** | v2026 날짜칸에 재무값(예 `16314344`) | `_valid_range`가 걸러 timing 폴백. 새 오염패턴이면 검사 강화 |
| **전년동기 오기** | yoy 라벨=당기와 동일(티엘비·심텍) | 이미 "역전 가드"로 당기−1년 강제교정. 신규 케이스도 자동방어 |
| **KIND CHUNKS 범위** | 새 데이터 연도가 CHUNKS 밖 | `map_kind_urls.CHUNKS`에 연도 추가 |

**시계열 단조성 자가진단**(원하면 실행):
```python
# (종목,기준)별로 당기 종료일이 시간순으로 비감소인지 — 위반건 출력
import json
d=json.load(open("kind_project/data/disclosures.json",encoding="utf-8"))
from collections import defaultdict
g=defaultdict(list)
for r in d: g[(r['stock_code'],r['basis'])].append(r)
for k,rs in g.items():
    rs.sort(key=lambda r:r['disclosure_datetime'])
    ends=[r['periods']['current'][1] for r in rs]
    bad=[i for i in range(1,len(ends)) if ends[i]<ends[i-1]]
    if bad: print(k, "위반 idx", bad, [ (rs[i]['disclosure_datetime'][:10], rs[i]['periods']['current']) for i in bad])
```
(월간+분기 이중 필러는 정상적으로 위반처럼 보일 수 있으니 내용 확인.)

---

## 8. 파일 지도 (`kind_project/src`)

| 파일 | 역할 | 기간 관련 |
|---|---|---|
| **`periods.py`** | **기간 표준화 엔진** `assign_periods/resolve_one/parse_label/timing_*` | ★ 핵심 |
| `common.py` | 지표메타·단위스케일·`derive_contexts`(rec["periods"] 우선)·`plan_contexts` | 기간 소비 |
| `normalize.py` | Excel→JSON, `assign_periods` 호출, 가변행·결산월 부착 | 기간 확정 호출부 |
| `extract_fiscal_months.py` | DART 제목→결산월 마스터 | 결산월 |
| `map_kind_urls.py` | KIND 접수번호/원문링크 (CHUNKS 연도범위 주의) | — |
| `gen_xbrl.py`·`gen_ixbrl.py` | XBRL/iXBRL 생성(6개 기간 컨텍스트) | 기간 소비 |
| `build_viewer.py` | 뷰어 data.js | 기간 소비 |
| `build_all.py` | 전체 파이프라인 | — |

---

## 9. 환경 / 의존성

- Python 3.13 (Windows). 콘솔은 cp949 — 스크립트 출력의 한글은 깨져 보여도 파일은 UTF-8 정상.
- 패키지: `openpyxl beautifulsoup4 pandas requests` · 검증용 `arelle-release` ·
  KIND수집용 `krx_kind_data_api`(editable 설치, `disclosure_details` 포함) · 스크린샷용 MS Edge.
- 네트워크: `map_kind_urls`는 KIND 조회에 인터넷 필요(최초 1회 ~100초). 이후 `data/kind_details.json`
  캐시로 오프라인. 강제 재수집: `python src/map_kind_urls.py --refresh`.
- 오프라인/네트워크 불가 시: normalize·gen_*·build_viewer는 그대로 동작(기간표준화 포함),
  KIND 링크만 비게 됨.

---

## 10. 새 세션에 줄 프롬프트 (복붙용)

> 지금은 **숙지만** 시키는 단계. 실제 작업 지시는 이후에 따로 준다.

```
c:\Users\Peter\Desktop\taxonomy 프로젝트를 이어받는다. 아직 아무 작업도 하지 말고,
먼저 아래 문서를 정독해서 내용을 숙지한 상태로 대기해라.

정독 대상:
- c:\Users\Peter\Desktop\taxonomy\HANDOFF_기간표준화.md  (인수인계 전반)
- c:\Users\Peter\Desktop\taxonomy\기간_표준화_로직.md    (기간 표준화 상세: 정규식·도식·엣지케이스)

숙지할 핵심:
- 이 프로젝트는 KIND 영업(잠정)실적 공정공시를 XBRL/iXBRL로 태깅하고 뷰어로 보는 것.
- "기간(당기/전기/전년동기) 표준화"의 로직 본체는 kind_project/src/periods.py 이며,
  라벨 파싱 + 제출시점 휴리스틱 + 시계열 정합성 + 당기기준 파생 + 역전가드로 동작한다.
- 현재 데이터는 이미 2024-01 ~ 2026-06 전체(3,891건)를 커버하고 있고, 파이프라인은
  python kind_project/src/build_all.py 한 방으로 재현된다.
- 값을 임의로 손대지 않고 규칙으로 처리한다는 원칙, 그리고 §7 "감시 포인트"(새 라벨 형식·
  비경계 결산월·시계열 단조성 위반 등)를 기억해 둔다.

지금은 코드 실행·수정·재생성을 하지 말 것. 문서를 읽고 "숙지 완료"와 함께
핵심 요약(무엇을 어떻게 하는지, 어디를 건드리면 되는지)만 3~5줄로 보고한 뒤 다음 지시를 기다려라.
콘솔 한글 깨짐은 정상(cp949), 파일은 UTF-8.
```
