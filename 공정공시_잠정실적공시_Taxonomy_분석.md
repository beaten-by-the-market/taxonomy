# 공정공시 「영업(잠정)실적」 공시 Taxonomy 분석 — 개별/별도 · 연결

> 대상: `KRX_Taxonomy_instance포함_251118` (차세대 상장공시시스템용 Taxonomy 사후관리 산출물)
> 초점: 공정공시 중 **영업(잠정)실적** 공시의 개별/별도 기준과 연결 기준 서식
> 근거: Entry Point `A700000401` 스키마·정의(def)·표시(pre) 링크베이스, `krx-md-ot` 라벨, DP/Presentation 매핑(Excel 3종), 실제 인스턴스 XML

---

## 1. 한 줄 요약

공정공시의 잠정실적 공시는 **유가·코스닥 × 개별별도·연결 = 4개 서식**이 존재하지만, 이번 차세대 Taxonomy에서는 이들을 **단일 Entry Point `A700000401` 하나의 공통 데이터 모델로 "서식통합"**했다. 개별/별도와 연결의 차이는 이제 **서식 번호와 일부 데이터포인트(특히 '지배기업 소유주 귀속 당기순이익')** 수준에서만 갈리고, 실적 표·증감율·흑자적자전환 등 골격은 완전히 공유된다.

---

## 2. 서식 체계 — Entry Point `A700000401`

**`A700000401` = "[A700000401] 영업잠정실적 및 결산실적공시 예정"**
이 진입점 안에 두 개의 공시 역할(Role)이 묶여 있다.

| Role URI | 정의 |
|---|---|
| `[A700000401a]` | 영업잠정실적에 대한 공시 |
| `[A700000401]` | 영업잠정실적 및 결산실적공시 예정 (결산실적공시 예고 포함) |

그리고 이 진입점 하나가 **6개 서식(FormXXXXExplanatory)** 을 통합 수용한다 — Presentation 최상위에 6개 문장영역(Text Block)으로 나란히 배치된다.

| 서식번호 | 시장 | 재무제표 기준 | 서식명 | 버전 |
|---|---|---|---|---|
| **99620** | 유가증권 | **개별/별도** | 영업(잠정)실적(공정공시) | 5.08 |
| **99626** | 유가증권 | **연결** | 연결재무제표기준 영업(잠정)실적(공정공시) | 5.10 |
| **70953** | 코스닥 | **개별/별도** | 영업(잠정)실적(공정공시) | 5.04 |
| **70956** | 코스닥 | **연결** | 연결재무제표 기준 영업(잠정)실적(공정공시) | 5.03 |
| 99833 | (기타공시) | — | 결산실적공시 예고 계열 문장영역 | — |
| 70940 | (기타공시) | — | 결산실적공시 예고 계열 문장영역 | — |

> 사용자가 관심 갖는 **잠정실적(개별별도·연결)은 위 4개(99620·99626·70953·70956)** 다. 99833·70940은 같은 진입점에 "기타공시" 문장영역으로 함께 실린 결산실적공시 예고 계열이다.

Excel 작업상세의 변경 사유에 명시된 표현이 이 통합을 뒷받침한다:
`ⓐ 700000101~700000401_공정공시_서식통합`, `ⓐ 데이터포인트추가`.

---

## 3. 개별/별도 vs 연결 — 무엇이 다른가 (핵심)

네 서식은 **같은 데이터 모델**(`DisclosureOfPreliminaryOperatingResults`)을 공유한다. 구조적 차이는 다음 세 가지로 압축된다.

### (1) 서식 번호 자체가 구분자
개별/별도인지 연결인지는 **별도의 XBRL 축(Separate/Consolidated Axis)이 아니라 서식 번호로 구분**된다. 즉 회사는 자신의 기준에 맞는 서식(예: 유가·연결 → 99626)을 선택해 제출한다.

### (2) '지배기업 소유주 귀속 당기순이익'의 유무 ★
DP 매핑을 대조하면 결정적 차이가 드러난다.

- **연결 서식(70956·99626)** 에만
  `ifrs-full:ProfitLossAttributableToOwnersOfParent`
  = **지배기업 소유주에게 귀속되는 당기순이익(손실)** 데이터포인트가 존재한다.
  (예: `70956-10`, `70956-11`, `70956-20`, `70956-35` … 각각 당기/누계 × 감사전잠정/감사받은 조합)
- **개별/별도 서식(70953·99620)** 에는 이 항목이 없다 — 별도재무제표에는 지배·비지배 구분이 성립하지 않기 때문.

### (3) 자회사(종속회사) 축 적용
연결 실적 데이터포인트는 **자회사 축**(`krx-common:SubsidiariesAxis` → `MaterialSubsidiariesMember`, 주요 자회사)과 함께 태깅되어, 주요 종속회사 단위의 실적 표현이 가능하다.

---

## 4. 데이터 모델 구조 (정의 링크베이스)

```
영업잠정실적에 대한 공시 [표]  (DisclosureOfPreliminaryOperatingResultsTable)
├─ [축] 자회사                 SubsidiariesAxis
│        └ 자회사 분류 → 주요 자회사 (MaterialSubsidiariesMember)
├─ [축] 감사받은재무제표여부      AuditedFinancialStatementsStatusAxis
│        ├ 감사받은재무제표 (기본값, AuditedFinancialStatementsMember)
│        └ 감사전잠정실적재무제표 (PreauditPreliminaryFinancialStatementsMember)  ← '잠정'의 정체
├─ [축] 기타실적구분            TypesOfOtherPerformanceIndicatorsAxis (typed dimension)
└─ [항목] 영업잠정실적에 대한 공시 [항목] (LineItems)
```

세 개의 축(Axis)이 핵심이다.

| 축 | 구성요소 | 의미 |
|---|---|---|
| **감사받은재무제표여부** | 감사받은재무제표 / **감사전잠정실적재무제표** | 잠정치임을 표시. 잠정 공시는 `PreauditPreliminaryFinancialStatements` member 사용 |
| **자회사** | 주요 자회사 | 연결 실적을 주요 종속회사 단위로 구분 |
| **기타실적구분** | (typed) | 표준 지표 외 회사가 임의 정의하는 '기타실적' 지표 |

---

## 5. 실적 표(表) 구조 — 기간 × 지표

각 서식의 실적 표는 **6개 기간 블록**으로 구성되고, 여기에 **증감율**과 **흑자·적자 전환 여부**가 얹힌다.

**기간 블록 (`DetailsOfPreliminaryOperatingResults`)**
1. 당분기실적 (CurrentQuarterPerformance)
2. 당분기누적실적 (CumulativePerformanceForCurrentQuarter)
3. 직전분기실적 (PerformanceForPreviousQuarter)
4. 직전분기누적실적 (CumulativePerformanceForPreviousQuarter)
5. 전년동기실적 (PerformanceForSamePeriodOfLastYear)
6. 전년동기누적실적 (CumulativePerformanceForSamePeriodOfLastYear)

**파생 비교 블록**
- 직전분기 대비 증감율 / 전년동기 대비 증감율 / 전년동기 대비 누적 증감율 (단위 %)
- 직전분기 대비 · 전년동기 대비 · 전년동기누적 대비 **적자전환·흑자전환 여부** (문자)

**실적 기간 정의**: 당분기·전분기·전년동기·당분기누적·전년동기누적 각각의 시작일/종료일(`StartDate…`/`EndDate…`)을 별도 항목으로 관리.

> ⚠️ **기간 표준화는 이 프로젝트에서 가장 까다로운 부분**이다. 기업마다 기수정보 표기가
> 제각각(`25년2분기`·`2Q24`·`제71기`·명시적 날짜·무라벨 등)이라, 라벨 파싱 + 제출시점 추론 +
> 시계열 정합성을 결합해 표준화한다. **상세 로직·정규식 해설·도식·엣지케이스는 별도 문서 참조:**
> **[기간_표준화_로직.md](기간_표준화_로직.md)**

---

## 6. 지표(계정) 항목 — 각 기간 블록 공통

| 표시 라벨 | XBRL element | 네임스페이스 | 비고 |
|---|---|---|---|
| 매출액 | `Revenue` | ifrs-full | 금액(백만원) |
| 영업이익(손실) | `OperatingIncomeLoss` | **dart** | DART 확장 element |
| 법인세비용차감전계속사업이익(손실) | `ProfitLossFromContinuingOperationBeforeCorporateIncomeTax` | krx-common | |
| 당기순이익(손실) | `ProfitLoss` | ifrs-full | |
| 지배기업 소유주 귀속 당기순이익(손실) | `ProfitLossAttributableToOwnersOfParent` | ifrs-full | **연결 서식 전용** |
| 기타실적 | `OtherPerformanceIndicators` | krx-md-ot | typed 축과 연동 |

> 매출액·당기순이익은 IFRS 표준 element를 재사용하고, 영업이익은 DART 확장(`dart:OperatingIncomeLoss`), 법인세차감전이익은 KRX 공통(`krx-common`) element를 쓴다 — **IFRS·DART·KRX element의 혼합 참조** 구조.

---

## 7. 부가 섹션 (표 이외)

- **영업잠정실적 정보제공내용**: 정보제공자 / 정보제공대상자 / 제공일자 / 제공시간 / 제공장소 또는 행사
- **담당 연락처**: 공시책임자·공시담당자·공시담당부서의 이름/전화번호
- **기타 투자판단과 관련한 중요사항**, **관련공시**
- (진입점 후반부) **결산실적공시 예고**: 예고 회사명 / 대상기간(시작·종료) / 예정일 / 기타 중요사항 / 관련공시

---

## 8. XBRL 인스턴스에서의 표현 방식

실제 인스턴스(예: `instance_삼정(652개)/70956_instance.xml`, `99626_instance.xml`)의 표현 규칙:

- 루트에서 `link:schemaRef` → `entry_point/A700000401/A700000401_entry_point_2023-12-31.xsd` 참조
- `xbrli:context`의 `xbrli:segment` 안에서 축을 표현
  - `xbrldi:typedMember dimension="krx-md-ot:TypesOfOtherPerformanceIndicatorsAxis"` (기타실적, typed)
  - 잠정치는 `AuditedFinancialStatementsStatusAxis = 감사전잠정실적재무제표(PreauditPreliminaryFinancialStatements)` member로 태깅
  - 연결 실적은 `SubsidiariesAxis = 주요 자회사(MaterialSubsidiaries)` member 병행
- 금액 fact는 백만원 단위 monetary, 증감율은 percent, 흑자/적자 전환 여부는 문자열
- 별도(70953)에는 지배주주 귀속 순이익 fact가 나타나지 않고, 연결(70956)에는 나타남 — DP 설계와 일치

---

## 9. 이번 사후관리에서의 변경 내용

`3. 택사노미구축후서식변경.xlsx` 기준, 이 4개 잠정실적 서식은 모두 **"ⓐ 데이터포인트 추가"** 유형으로 개정되었다.

- 추가된 데이터포인트: **증감율**과 **흑자·적자 전환 여부** 컬럼이 정식 데이터포인트로 편입
  (예: `70953-28-1`, `70953-28-2`, `70953-29-1` … `-x-1`은 증감율, `-x-2`는 전환여부에 대응)
- **서식통합**: `700000101~700000401_공정공시_서식통합` — 공정공시 계열(전망·잠정실적·예고 등)을 단일 진입점 체계로 통합
- 버전 개정 이력: 99626은 5.10까지, 99620은 5.08까지 진행

이 작업은 보고서(PDF)의 "변경서식 — 택사노미 구축 후 변경분 31개 서식" 및 "향후 과제 — 지속적인 시장 간 서식 표준화"와 직접 연결된다.

---

## 10. 관측·유의점

1. **개별/별도 vs 연결을 구분하는 별도 축이 없다.** 구분은 (a) 서식 번호, (b) 지배주주 귀속 순이익 데이터포인트 유무, (c) 자회사 축 적용 여부로만 이뤄진다. 시스템에서 두 기준을 자동 판별하려면 서식 번호(또는 연결 전용 element의 존재)를 봐야 한다.
2. **'잠정'의 의미는 감사 이전(pre-audit)**임이 `PreauditPreliminaryFinancialStatements` member로 명시된다 — 확정치가 아닌 잠정치라는 주석("동 정보는 확정치가 아닌 잠정치…")과 일치.
3. 유가(99620/99626)와 코스닥(70953/70956)은 **표시(FormExplanatory)만 시장별로 다르고 데이터 모델은 동일**하다. 시장 간 실적 데이터의 비교·집계가 구조적으로 쉬워졌다.
4. 표본 인스턴스의 기업 식별자는 더미(`12345678`)이며, 삼정·안진 두 법인의 교차 검증 인스턴스로 존재한다(같은 서식번호가 두 폴더에 공존).

---

## 11. 재무계정 외 실적값 — 기타실적(`OtherPerformanceIndicators`) · 가변행 구조

표준 재무계정(매출액·영업이익 등)은 **element 하나 = 계정 하나**로 고정돼 있다. 반면 회사가
자율로 기재하는 실적값(현대차 판매대수, 오리온 국가별 매출, 지역난방 판매량 등)은 항목이
회사마다 달라 **미리 element로 정의할 수 없다.** taxonomy는 이를 **하나의 element +
타입드(typed) 축**으로 처리한다 — 이것이 "가변행" 메커니즘이다.

### (1) 두 방식의 대비

| | 표준 재무계정 | 기타실적(가변행) |
|---|---|---|
| element | 계정마다 별도 element (`ifrs-full:Revenue` = 매출액) | **단일 element** `krx-md-ot:OtherPerformanceIndicators` |
| 값 타입 | 금액(monetary, KRW) / 소수(percent) | **문자열(`xbrli:stringItemType`)** — 단위가 회사마다 달라(대·천Gcal·억원) 문자열로 |
| 행(항목) 식별 | element 자체가 식별 | **타입드 축 `기타실적구분`에 라벨을 문자열로** 부여 |
| 행 개수 | 고정(5개 지표) | **가변**(필러가 런타임에 무한 생성) |

### (2) Taxonomy 트리 (Entry Point `A700000401` 정의 링크베이스)

```
[표] 영업잠정실적에 대한 공시  DisclosureOfPreliminaryOperatingResultsTable  (하이퍼큐브)
 │
 ├─[축·explicit] 감사받은재무제표여부  AuditedFinancialStatementsStatusAxis
 │      └ 감사받은재무제표(기본값) / 감사전잠정실적재무제표          ← 멤버 고정(열거)
 │
 ├─[축·explicit] 자회사  SubsidiariesAxis
 │      └ 자회사분류(기본값) / 주요 자회사                          ← 멤버 고정(열거)
 │
 └─[축·TYPED] 기타실적구분  TypesOfOtherPerformanceIndicatorsAxis   ★ 가변행의 핵심
        └ typedDomainRef → TypesOfOtherPerformanceIndicatorsAxisDomain (xsd:string)
             = 멤버를 미리 두지 않음. 필러가 "국내"·"해외"·"계" 같은 라벨을 직접 입력

[항목] 영업잠정실적에 대한 공시 [항목]  LineItems
 └ 영업잠정실적내용  DetailsOfPreliminaryOperatingResultsAbstract
     ├ 당분기실적   → 매출액 / 영업이익 / … / 기타실적(OtherPerformanceIndicators)
     ├ 당분기누적   → … / 기타실적
     ├ 직전분기실적 → … / 기타실적
     ├ 전년동기실적 → … / 기타실적
     ├ 전년동기누적 → … / 기타실적
     ├ 증감율      → … / 기타실적 증감율(IncreaseAndDecreaseRate…OtherPerformanceIndicators)
     └ 흑자적자전환 → … / 기타실적 전환(StatusOfProfitLossTransition…OtherPerformanceIndicators)
```

**결정적 차이**: 세 축 중 explicit 축 두 개는 `dimension-domain → member` arc로 멤버가
고정 열거되지만, **`기타실적구분` 축은 typed라서 member arc가 아예 없다.** 멤버(=행의 정체)는
인스턴스에서 문자열로 생성된다.

### (3) 어떻게 "행"이 만들어지나 (매핑 도식)

```
        element(고정)                         축(가변, 문자열 라벨)              =  하나의 행
 ┌───────────────────────────┐      ┌──────────────────────────────┐
 │ OtherPerformanceIndicators │  ×   │ 기타실적구분 = "국내"          │  →  국내 판매대수
 │ (기타실적, 문자열)          │      │ 기타실적구분 = "해외"          │  →  해외 판매대수
 │                           │      │ 기타실적구분 = "계"            │  →  합계
 └───────────────────────────┘      └──────────────────────────────┘
        같은 element를 여러 행이 공유 ─ 행 구분은 오직 typed 멤버(라벨)로
```

### (4) 예시 — 현대자동차 (005380, 2026-06-01 16:13, 별도, 접수번호 20260601001279)

표준 재무칸은 비우고 **판매대수(단위: 대)**를 가변행으로 기재:

| 구분(기타실적구분) | 당월(2026.5) | 전월(2026.4) | 전년동월(2025.5) | 전월대비 | 전년동월대비 |
|---|--:|--:|--:|--:|--:|
| 국내 | 45,364 | 54,051 | 58,966 | −16.1% | −23.1% |
| 해외 | 280,109 | 271,878 | 293,654 | +3.0% | −4.6% |
| 계 | 325,473 | 325,929 | 352,620 | −0.1% | −7.7% |

→ XBRL 팩트로는 **같은 element `OtherPerformanceIndicators`가 (기간 × 기타실적구분) 조합마다** 생성:

```
OtherPerformanceIndicators [기간=2026-05, 감사전잠정, 기타실적구분="국내"] = 45,364
OtherPerformanceIndicators [기간=2026-04,          기타실적구분="국내"] = 54,051
OtherPerformanceIndicators [기간=2025-05,          기타실적구분="국내"] = 58,966
OtherPerformanceIndicators [기간=2026-05, 감사전잠정, 기타실적구분="해외"] = 280,109
   … (해외·계 동일 패턴) …
IncreaseAndDecreaseRate…PreviousQuarterOtherPerformanceIndicators [기타실적구분="국내"] = -0.161
IncreaseAndDecreaseRate…SamePeriodOfLastYearOtherPerformanceIndicators [기타실적구분="국내"] = -0.231
```

### (5) 인스턴스 실물 (현대차 국내 당월)

```xml
<xbrli:context id="OPI1_CUR">
  <xbrli:entity>
    <xbrli:identifier scheme="http://www.krx.or.kr/CIK">005380</xbrli:identifier>
    <xbrli:segment>
      <xbrldi:explicitMember dimension="krx-common:AuditedFinancialStatementsStatusAxis"
        >krx-md-ot:PreauditPreliminaryFinancialStatementsMember</xbrldi:explicitMember>
      <xbrldi:typedMember dimension="krx-md-ot:TypesOfOtherPerformanceIndicatorsAxis"
        ><krx-md-ot:TypesOfOtherPerformanceIndicatorsAxisDomain>국내</krx-md-ot:TypesOfOtherPerformanceIndicatorsAxisDomain></xbrldi:typedMember>
    </xbrli:segment>
  </xbrli:entity>
  <xbrli:period><xbrli:startDate>2026-05-01</xbrli:startDate><xbrli:endDate>2026-05-31</xbrli:endDate></xbrli:period>
</xbrli:context>

<krx-md-ot:OtherPerformanceIndicators contextRef="OPI1_CUR">45,364</krx-md-ot:OtherPerformanceIndicators>
<krx-md-ot:IncreaseAndDecreaseRateComparedToPreviousQuarterOtherPerformanceIndicators
    decimals="4" contextRef="OPI1_CUR" unitRef="PURE">-0.161</krx-md-ot:IncreaseAndDecreaseRateComparedToPreviousQuarterOtherPerformanceIndicators>
```

### (6) 유의점

- **단위 정보는 XBRL에 실리지 않는다.** 값이 문자열이라 "45,364"만 태깅되고, "대"라는 단위는
  구분 라벨(예: `판매대수 - 국내`)이나 서식 본문 텍스트로만 전달된다. 표준 재무계정(원 단위, monetary)과
  달리 기계적 단위 비교가 불가능한 점이 typed·문자열 설계의 한계.
- **행 식별이 문자열 라벨에 의존**하므로, 같은 라벨이 섹션만 다르게 반복되면(오리온: 국가별 매출 vs
  영업이익의 "한국") 라벨을 `섹션 / 항목`으로 합성해 유일화해야 한다.
- 표준 재무계정을 비운 채 기타실적만 채우는 회사(현대차·오리온 등)는 표준 표가 전부 "-"로 보이며,
  실질 데이터는 전부 이 가변행에 있다.

---

### 부록 A. 근거 파일 경로

- 진입점: `KRX_Taxonomy_instance포함_251118/entry_point/A700000401/`
  - `A700000401_entry_point_2023-12-31.xsd` (Role 정의)
  - `def_...xml` (축·항목 계층), `pre_...xml` (표시 순서)
- 라벨: `common/krx-md-ot/krx-md-ot_2023-12-31-label-ko.xml` (영업잠정실적* 항목)
- element 원천: `common/krx-common`, `ext/full_ifrs`(IFRS), `ext/dart`(영업이익 등)
- 서식↔번호 매핑: `3. 택사노미구축후서식변경.xlsx` 시트 `총괄표`, `DP(70953_504)`, `DP(70956_503)`, `Presentation(...)`
- 인스턴스 예: `instance_삼정(652개)/{70953,70956,99620,99626}_instance.xml`
