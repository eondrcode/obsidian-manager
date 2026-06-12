<div align="center">

# Better Plugins Manager

**Obsidian을 위한 더 강력한 플러그인 관리자.**

플러그인이 많은 Obsidian vault도 지연 시작, 일괄 관리, 그룹과 태그, GitHub 설치, 충돌 진단으로 빠르고 정리된 상태를 유지할 수 있습니다.

<p>
  <a href="../README.md">English</a>
  ·
  <a href="README_CN.md">简体中文</a>
  ·
  <a href="README_JA.md">日本語</a>
  ·
  <a href="README_ES.md">Español</a>
  ·
  <a href="README_FR.md">Français</a>
  ·
  <a href="README_RU.md">Русский</a>
  ·
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">Releases</a>
  ·
  <a href="https://ifdian.net/a/eondr">Support</a>
</p>

<p>
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/zenozero-dev/obsidian-manager?style=flat-square&label=release">
  </a>
  <img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/zenozero-dev/obsidian-manager/total?style=flat-square&label=downloads">
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/zenozero-dev/obsidian-manager?style=flat-square&label=last%20commit">
  <img alt="Issues" src="https://img.shields.io/github/issues/zenozero-dev/obsidian-manager?style=flat-square&label=issues">
  <img alt="Stars" src="https://img.shields.io/github/stars/zenozero-dev/obsidian-manager?style=flat-square&label=stars">
  <img alt="License" src="https://img.shields.io/github/license/zenozero-dev/obsidian-manager?style=flat-square&label=license">
</p>

<p>
  <img alt="Obsidian Plugin" src="https://img.shields.io/badge/Obsidian-plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white">
  <img alt="Minimum Obsidian Version" src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.5.8-7C3AED?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Platform" src="https://img.shields.io/badge/platform-desktop%20%7C%20mobile-4B5563?style=flat-square">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-7%20languages-0F766E?style=flat-square">
  <img alt="GitHub Source Tracking" src="https://img.shields.io/badge/GitHub-source%20tracking-181717?style=flat-square&logo=github&logoColor=white">
  <a href="https://ifdian.net/a/eondr">
    <img alt="Sponsor on Afdian" src="https://img.shields.io/badge/Afdian-sponsor-946ce6?style=flat-square">
  </a>
</p>

</div>

![Screenshot](img/index.png)

---

## 🎯 BPM이란?

**Better Plugins Manager (BPM)** 는 Obsidian 커뮤니티 플러그인을 위한 컨트롤 센터입니다. 많은 플러그인을 사용하는 vault에서 단순한 켜기/끄기 이상의 관리가 필요할 때 유용합니다.

BPM은 시작 속도를 유지하고, 워크플로별로 플러그인을 정리하며, GitHub Release에서 설치하고, 문제가 생겼을 때 충돌 원인을 좁히는 데 도움을 줍니다.

| 🚀 시작 | 📦 관리 | 🏷️ 정리 | 📥 설치 | 🔍 진단 |
|--------|--------|----------|---------|---------|
| 플러그인 지연 시작과 시작 시 자체 검사 | 일괄 활성화/비활성화, 빠른 검색, 상태 필터 | 그룹, 태그, 메모, 설명, 사용자 지정 이름 | GitHub 저장소와 Release에서 설치 | 안내식 충돌 진단과 보고서 생성 |

---

## ✨ 핵심 기능

BPM은 다섯 개의 탭을 중심으로 구성됩니다. 각 탭은 하나의 워크플로를 담당하므로 관련 컨트롤이 한곳에 모이고, 데스크톱과 모바일 모두에서 쉽게 훑어볼 수 있습니다.

| Tab | Workflow |
|-----|----------|
| 🧩 Plugin View | 설치된 플러그인, 메타데이터, 필터, 시작 동작, 개별 플러그인 작업 관리 |
| 📥 Install Hub | GitHub에서 플러그인 또는 테마 설치, 추적 소스 관리 |
| 📦 Transfer Pack | vault 간 플러그인/테마 팩 내보내기, 가져오기, 복원 |
| 🎛️ Ribbon Order | Obsidian 리본 아이콘 순서와 표시 여부 제어 |
| 🔍 Conflict Diagnosis | 플러그인 문제를 좁히고 진단 보고서 생성 |

### 🧩 Plugin View

일상적인 플러그인 관리를 위한 기본 탭입니다.

![Plugin View](img/PluginView.png)

| 영역 | 기능 |
|------|------|
| **플러그인 목록** | 설치된 커뮤니티 플러그인을 간결하고 검색 가능한 관리 화면에서 확인 |
| **일괄 작업** | 플러그인을 한꺼번에 활성화/비활성화하고 그룹 단위 작업 수행 |
| **필터** | 활성 상태, 그룹, 태그, 지연 설정, 키워드로 필터링 |
| **정리** | 사용자 지정 이름, 설명, 메모, 그룹, 태그 추가 |
| **시작 제어** | 지연 시작 프리셋을 지정하고 목록에서 시작 동작 확인 |
| **플러그인 작업** | 업데이트 확인, 업데이트 다운로드, 플러그인 재시작, 임시 시작, 설정 열기, 폴더 열기, ID 복사, 저장소 열기, 설정 초기화, 숨기기, 삭제 |
| **BPM 태그** | BPM으로 설치한 플러그인에 `bpm-install`을 자동 표시하고 `bpm-ignore`로 관리 제외 가능 |

### 📥 Install Hub

Install Hub는 GitHub 기반 설치와 설치 후 BPM이 추적할 수 있는 소스를 관리합니다.

![Install Hub](img/installHub.png)

| 영역 | 기능 |
|------|------|
| **설치 유형** | 플러그인 설치와 테마 설치 전환 |
| **저장소 입력** | `user/repo` 또는 전체 GitHub 저장소 URL 지원 |
| **Release 선택** | GitHub Release를 가져와 최신 버전 또는 선택한 버전을 설치 |
| **Release notes** | 사용 가능한 경우 설치 전 Release 정보 표시 |
| **최근 설치** | 반복 설치를 빠르게 하기 위해 최근 사용한 저장소 저장 |
| **소스 추적** | 설치된 저장소를 추적하여 이후 확인, 업데이트, 재설치에 활용 |
| **소스 관리** | 추적 중인 플러그인/테마 소스, 업데이트 대상, 재설치 항목, 소스 메타데이터 관리 |

### 📦 Transfer Pack

Transfer Pack은 vault 간 플러그인 구성을 이동하기 위한 기능입니다. 수동 체크리스트를 만들 필요가 없습니다.

![Transfer Pack](img/transferPack.png)

| 영역 | 기능 |
|------|------|
| **내보내기 목록** | 로컬 플러그인과 테마를 선택해 JSON 전송 팩 생성 |
| **플러그인 설정** | 필요한 플러그인 설정 파일을 선택해 내보내기 |
| **분류 데이터** | BPM 그룹, 태그, 지연 프리셋 내보내기 |
| **레이아웃 데이터** | 관리자 순서, 숨김 항목, Ribbon 레이아웃 내보내기 |
| **소스 데이터** | GitHub 저장소 매핑, 소스 구독, 설치 기록 내보내기 |
| **작업 공간 설정** | 스타일, 지연 모드, 태그 표시, 시작 시 확인 설정 내보내기 |
| **가져오기 미리보기** | 적용 전에 포함된 플러그인, 테마, 소스, 설정, 레이아웃 데이터 확인 |
| **복원 옵션** | 누락된 플러그인/테마 설치, 플러그인 설정 병합, 활성 상태 복원, 레이아웃 적용, 소스 병합, 테마 가져오기 |

### 🎛️ Ribbon Order

Ribbon Order는 Obsidian 왼쪽 리본 순서를 안정적으로 유지합니다. 지연 시작 플러그인이 시작 후 아이콘을 등록하는 경우 특히 유용합니다.

![Ribbon Order](img/ribbonOrder.png)

| 영역 | 기능 |
|------|------|
| **아이콘 순서** | 리본 항목을 드래그해 안정적인 순서로 정렬 |
| **표시 제어** | 개별 리본 아이콘 표시/숨김 |
| **Native Sync Mode** | Obsidian workspace 설정 대신 BPM 데이터에 리본 레이아웃 저장 |
| **초기화** | 모든 리본 항목을 표시하고 이름순으로 정렬 |
| **다시 로드 안내** | 시작 시 숨겨진 아이콘을 표시하려면 Obsidian 새로고침이 필요한 경우 안내 |

### 🔍 Conflict Diagnosis

Conflict Diagnosis는 플러그인 충돌 테스트를 단계별로 안내하고 테스트 상태와 결과를 한곳에 보관합니다.

![Conflict Diagnosis](img/conflictScan.png)

| 영역 | 기능 |
|------|------|
| **사전 확인** | 다른 플러그인을 비활성화해도 문제가 남는지 확인 |
| **이분 탐색** | 분할 테스트로 의심 플러그인 범위를 줄임 |
| **충돌 쌍 탐색** | 두 플러그인 간 충돌을 찾고 그룹을 넘는 경우도 지원 |
| **수동 피드백** | 각 단계에서 문제가 남는지 사용자가 확인 |
| **상태 제어** | 이전 단계 되돌리기, Obsidian 재시작, 진단 종료, 원래 상태 복원, 현재 상태 유지 |
| **결과 보고서** | 감지된 플러그인과 제안 작업을 포함한 Markdown 보고서 생성 |

---

## 📦 설치

### Community Plugins

대부분의 사용자에게 권장됩니다.

1. **Obsidian Settings → Community Plugins** 를 엽니다.
2. **Better Plugins Manager** 를 검색합니다.
3. 설치하고 활성화합니다.

### 수동 설치

GitHub Release를 직접 설치하고 싶을 때 사용합니다.

1. [latest release](https://github.com/zenozero-dev/obsidian-manager/releases)를 다운로드합니다.
2. `main.js`, `manifest.json`, `styles.css`를 `.obsidian/plugins/better-plugins-manager/`에 복사합니다.
3. Obsidian을 다시 시작합니다.
4. **Settings → Community Plugins** 에서 **Better Plugins Manager** 를 활성화합니다.

---

## 🚦 빠른 시작

### BPM 열기

플러그인을 활성화한 후 다음 방법 중 하나로 BPM을 엽니다.

- 왼쪽 리본의 BPM 아이콘을 클릭합니다.
- 명령 팔레트에서 **Open the plugin manager** 를 실행합니다.

### 첫 단계

1. **Plugin View** 에서 설치된 플러그인, 필터, 그룹, 태그, 지연 설정을 확인합니다.
2. GitHub에서 플러그인이나 테마를 설치할 때는 **Install Hub** 를 사용합니다.
3. vault 간 구성을 이동할 때는 **Transfer Pack** 을 사용합니다.
4. 플러그인 문제를 좁혀야 할 때는 **Conflict Diagnosis** 를 사용합니다.

### 상호작용 팁

- **왼쪽 클릭** 으로 토글, 편집, 설치, 가져오기, 작업 실행을 수행합니다.
- **오른쪽 클릭** 으로 플러그인 항목의 컨텍스트 메뉴를 엽니다.
- 툴바 버튼에 **마우스를 올리면** 설명이 표시됩니다. 터치 기기에서는 지원되는 곳에서 길게 누르기를 사용할 수 있습니다.

---

## 🔍 Conflict Diagnosis 튜토리얼

커뮤니티 플러그인을 활성화한 뒤 문제가 생겼고 원인을 구조적으로 좁히고 싶다면 **Conflict Diagnosis** 를 사용하세요.

### 워크플로

1. **Conflict Diagnosis** 탭을 열거나 명령 팔레트에서 **Troubleshoot plugin conflicts** 를 실행합니다.
2. 진단 세션을 시작합니다. BPM은 변경 전에 현재 플러그인 상태를 기록합니다.
3. 각 단계 후 vault를 테스트한 다음 **Problem Still Exists** 또는 **Problem Gone** 을 선택합니다.
4. 안내식 분할 테스트를 계속해 결과를 플러그인 또는 플러그인 쌍으로 좁힙니다.
5. 결과를 확인하고 원래 상태를 복원하거나 현재 상태를 유지한 뒤 필요하면 Markdown 보고서를 생성합니다.

### 참고

- 진단은 각 단계의 피드백에 의존합니다. 매번 같은 테스트 동작을 사용하세요.
- 간헐적 버그, 로드 순서 문제, 설정 의존 버그, 세 개 이상의 플러그인이 얽힌 충돌은 수동 확인이 필요할 수 있습니다.
- 이전 단계 되돌리기, 테스트 중 Obsidian 재시작, 세션 종료, 원래 상태 복원, 현재 상태 유지가 가능합니다.

---

## 🛡️ 시작 인계

**Delayed Startup** 이 켜져 있으면 BPM은 `.obsidian/community-plugins.json`을 확인해 Obsidian과 BPM이 같은 플러그인을 동시에 제어하지 않도록 합니다.

| 상황 | BPM 동작 |
|------|----------|
| 관리되지 않는 플러그인 없음 | 정상 시작 |
| 관리되지 않는 플러그인 감지 | 인계 프롬프트 표시 |
| Auto Takeover 켜짐 | 감지된 플러그인을 BPM 관리로 자동 이동 |
| `bpm-ignore` 표시 플러그인 | Obsidian 기본 시작 목록에 유지 |

인계는 지연 시작, 활성 상태, BPM 플러그인 기록을 일관되게 유지합니다. 성공 후에는 Obsidian을 다시 시작해 시작 목록이 깔끔하게 적용되도록 하세요.

---

## 📦 Transfer 및 Legacy Export

현재 버전에서는 vault 간 구성을 이동할 때 **Transfer Pack** 을 사용하세요. 플러그인 목록, 테마, 선택한 플러그인 설정, 그룹, 태그, 지연 프리셋, 레이아웃 데이터, 리본 순서, 소스 구독, 설치 기록, 작업 공간 설정을 내보내고 가져올 수 있습니다.

이전 Markdown/frontmatter Obsidian Base export는 레거시 데이터 호환을 위해서만 유지됩니다. 새 설정에서는 Base export 폴더를 구성하지 말고 **Transfer Pack** 을 사용하세요.

---

## ⚙️ 설정

BPM 설정은 기능별 페이지로 나뉩니다.

| 페이지 | 설정 내용 |
|--------|----------|
| **Basic** | 언어, 필터 유지, 지연 시작, 자동 인계, 시작 시 업데이트 확인, 소스 업데이트 확인, 소스 자동 업데이트, BPM 태그 표시, Ribbon order, 명령, 디버그 모드, GitHub token |
| **Main Page Actions** | 어떤 플러그인 작업을 카드에 직접 표시하고 어떤 작업을 오른쪽 클릭 메뉴에 둘지 선택 |
| **Style** | 플러그인 목록 레이아웃, 항목 표시 스타일, 그룹/태그 스타일, 비활성 플러그인 흐리게 표시 |
| **Groups** | 플러그인 그룹 생성, 이름 변경, 색상 변경, 삭제 |
| **Tags** | 플러그인 태그 생성, 이름 변경, 색상 변경, 삭제 |
| **Delay** | 지연 시작 프로필 생성 및 관리. 지연 시작이 켜져 있을 때만 표시 |

---

## ⌨️ 명령

| 명령 | 사용 가능 조건 | 설명 |
|------|----------------|------|
| **Open the plugin manager** | 항상 사용 가능 | BPM 메인 화면 열기 |
| **Troubleshoot plugin conflicts** | 항상 사용 가능 | 충돌 진단 워크플로 시작 |
| **Enable/Disable [Plugin Name]** | 선택 설정 | 플러그인별 직접 전환 명령 등록 |
| **One-click Enable/Disable [Group Name]** | 선택 설정 | 그룹 단위 일괄 전환 명령 등록 |

---

## 📱 호환성

| 플랫폼 | 지원 |
|--------|------|
| Windows / macOS / Linux | ✅ |
| Android | ✅ |
| iOS / iPadOS | ✅ |

플러그인은 플랫폼에 따라 데스크톱/모바일 레이아웃을 자동으로 전환합니다.

---

## 🤝 기여

Issue와 PR을 환영합니다.

- **버그 보고**: 로그와 재현 단계를 포함해 주세요.
- **기능 요청**: 먼저 discussion 또는 issue를 여는 것을 권장합니다.

## 🙏 감사

- Ribbon sorting 기능은 [Obsidian-ribbon-sort](https://github.com/yunrr/Obsidian-app-ribbon-sorting)에서 영감을 받았습니다.

---

## 📄 License

[MIT](../LICENSE)
