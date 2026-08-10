---
name: Marczelloo Dashboard
description: Ciemny panel operacyjny z karmazynowym akcentem do zarządzania projektami i infrastrukturą.
colors:
  background: "hsl(0 0% 4%)"
  foreground: "hsl(0 0% 95%)"
  card: "hsl(0 0% 7%)"
  popover: "hsl(0 0% 9%)"
  primary: "hsl(0 72% 51%)"
  primary-foreground: "hsl(0 0% 100%)"
  secondary: "hsl(0 0% 12%)"
  muted: "hsl(0 0% 15%)"
  muted-foreground: "hsl(0 0% 60%)"
  border: "hsl(0 0% 14%)"
  success: "hsl(142 71% 45%)"
  warning: "hsl(38 92% 50%)"
  danger: "hsl(0 72% 51%)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
---

# Design System: Marczelloo Dashboard

## Overview

**Creative North Star: "Crimson Control Room"**

Marczelloo Dashboard jest gęstym, ciemnym panelem operacyjnym. Jego charakter wynika z neutralnych, prawie czarnych powierzchni, oszczędnego karmazynowego akcentu i czytelnych stanów systemowych. Interfejs ma wyglądać jak narzędzie do pracy: spokojne w spoczynku, jednoznaczne podczas akcji i alarmujące tylko wtedy, gdy stan naprawdę tego wymaga.

Warstwy budują głównie różnice tonalne i cienkie obramowania. Karmazyn prowadzi uwagę do aktywnej nawigacji, głównej akcji, fokusu i kluczowych sygnałów marki. Kompaktowa typografia i 4-pikselowy rytm pozwalają pokazywać dużo informacji bez wizualnego chaosu.

**Key Characteristics:**

- ciemne, neutralne powierzchnie o małych różnicach jasności;
- jeden karmazynowy akcent dla marki, akcji i fokusu;
- kompaktowy rytm, cienkie obramowania i promień bazowy 8 px;
- wyraźne semantyczne kolory sukcesu, ostrzeżenia i błędu;
- ikony konturowe Lucide o grubości linii 2 px.

## Colors

Paleta jest niemal monochromatyczna; kolor pojawia się jako sygnał akcji albo stanu, a nie dekoracja.

### Primary

- **Crimson Action** (`hsl(0 72% 51%)`): główne przyciski, aktywna nawigacja, fokus, znak „M” i krytyczne akcenty.
- **Action Foreground** (`hsl(0 0% 100%)`): tekst oraz ikony umieszczone bezpośrednio na akcencie.

### Neutral

- **Console Black** (`hsl(0 0% 4%)`): główne tło aplikacji i pól formularzy.
- **Panel Charcoal** (`hsl(0 0% 7%)`): karty, sidebar i podstawowe powierzchnie.
- **Raised Charcoal** (`hsl(0 0% 9%)`): popovery i powierzchnie ponad treścią.
- **Control Graphite** (`hsl(0 0% 12%)`): drugorzędne kontrolki oraz stany hover.
- **Muted Graphite** (`hsl(0 0% 15%)`): wypełnienia pomocnicze i szkielety ładowania.
- **Hairline Graphite** (`hsl(0 0% 14%)`): obramowania, separatory oraz stroke pól.
- **Signal White** (`hsl(0 0% 95%)`): podstawowy tekst.
- **Muted Silver** (`hsl(0 0% 60%)`): opisy, metadane i mniej istotne etykiety.

### Status

- **Operational Green** (`hsl(142 71% 45%)`): sukces i stan online.
- **Attention Amber** (`hsl(38 92% 50%)`): ostrzeżenie i stan wymagający uwagi.
- **Failure Crimson** (`hsl(0 72% 51%)`): błąd, destrukcyjna akcja i stan offline.

**The Signal Color Rule.** Kolory nieneutralne oznaczają akcję albo rzeczywisty stan systemu; nie są dekoracyjnym wypełniaczem.

## Typography

**Display Font:** Inter z fallbackiem `ui-sans-serif, system-ui, sans-serif`  
**Body Font:** Inter z fallbackiem `ui-sans-serif, system-ui, sans-serif`  
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

**Character:** Sans-serif jest zwarty, techniczny i neutralny. Monospace rozróżnia dane operacyjne — logi, identyfikatory, porty, ścieżki i polecenia — od języka interfejsu.

### Hierarchy

- **Headline** (600, 20 px/28 px, tracking -0.025em): tytuł strony w nagłówku.
- **Title** (600, 18 px/1, tracking -0.025em): tytuł karty i sekcji.
- **Body** (400–500, 14 px/20 px): treść, akcje i wartości w komponentach.
- **Label** (600, 12 px/16 px, tracking 0.05em; opcjonalnie uppercase): kategorie, badge’e i małe etykiety.
- **Micro label** (600, 10 px, szerokie tracking): podpis „Dashboard” w znaku aplikacji.
- **Mono** (400–500, zwykle 12–14 px): logi, terminal, SHA, porty i dane techniczne.

**The Operational Mono Rule.** Monospace służy danym maszynowym; nawigacja, opisy i akcje pozostają w sans-serif.

## Layout

Desktopowy shell ma stały sidebar szerokości 256 px i nagłówek wysokości 64 px. Główna treść zaczyna się po lewej z offsetem 256 px. Standardowe marginesy treści i kart są oparte na rytmie 4 px: najczęściej 8, 12, 16, 24 i 32 px. Kontener pomocniczy ma maksymalną szerokość `80rem` i responsywne marginesy poziome 16/24/32 px na breakpointach Tailwind.

Układy danych używają siatek i stosów, a powtarzalne sekcje zachowują 16–24 px odstępu. Obecny shell jest zoptymalizowany dla desktopu; przed dodaniem osobnego zachowania mobilnego nie należy udawać, że istnieje zwijana nawigacja.

## Elevation & Depth

System jest tonalnie warstwowy i płaski w spoczynku. Główną separację zapewniają powierzchnie `background`, `card`, `popover` oraz obramowania. Małe cienie wspierają kontrolki i karty, a czerwony glow jest zarezerwowany dla znaku marki, stanów i celowych punktów uwagi.

### Shadow Vocabulary

- **Control shadow** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): inputy, przyciski outline i lekkie kontrolki.
- **Surface shadow** (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): karty i główne przyciski.
- **Crimson glow** (`0 0 20px hsl(var(--primary) / 0.3)`): rzadki, mocniejszy sygnał akcentu.
- **Crimson glow small** (`0 0 10px hsl(var(--primary) / 0.2)`): lokalny sygnał stanu lub aktywności.

**The Flat-at-Rest Rule.** Każda powierzchnia zaczyna jako tonalna i obramowana; silniejszy cień albo glow musi wynikać ze stanu lub hierarchii.

## Shapes

Bazowy promień wynosi 8 px. Kontrolki zwykle używają 6 px, małe elementy 4 px, a karty i pozycje nawigacji 8 px. Status dots i avatarowe znaczniki są okrągłe. Obramowania mają 1 px i korzystają z tokenu `border`; aktywna pozycja sidebaru dostaje dodatkową lewą linię 2 px w kolorze primary.

Ikony korzystają z natywnej siatki Lucide 24 × 24, `currentColor`, zaokrąglonych zakończeń i grubości linii 2 px. W komponentach są zwykle wyświetlane jako 16 px; małe etykiety używają 14 px.

## Components

### Buttons

- **Shape:** promień 6 px, wysokość domyślna 36 px, odstęp między ikoną i tekstem 8 px.
- **Primary:** karmazynowe tło, biały tekst, padding 8 × 16 px i subtelny cień.
- **Hover / Focus:** hover przyciemnia wypełnienie do 90%; fokus ma ring 2 px i offset 2 px na kolorze tła; aktywacja skaluje główne warianty do 0.98.
- **Outline / Secondary / Ghost:** outline używa transparentnego tła i borderu; secondary używa grafitowego wypełnienia; ghost dostaje je dopiero na hover.
- **Icon-only:** kwadrat 36 × 36 px; dostępna nazwa musi pochodzić z `aria-label` albo tooltipa.

### Chips

- **Style:** badge ma promień 6 px, padding 2 × 10 px, tekst 12 px semibold i opcjonalny border.
- **State:** statusowe warianty używają koloru semantycznego na tle z 20% opacity; nie zastępują tekstowej nazwy statusu.

### Cards / Containers

- **Corner Style:** promień 8 px.
- **Background:** `card` z tekstem `card-foreground`.
- **Shadow Strategy:** mały cień powierzchni i obramowanie 1 px; hover może dodać border primary/30 oraz bardzo słaby czerwony cień.
- **Border:** token `border`.
- **Internal Padding:** standardowo 24 px; treść pod nagłówkiem usuwa górny padding.

### Inputs / Fields

- **Style:** wysokość 36 px, tło `background`, border `input`, promień 6 px i padding poziomy 12 px.
- **Focus:** ring 2 px w kolorze primary z offsetem 2 px.
- **Error / Disabled:** disabled używa opacity 50% i kursora `not-allowed`; błąd powinien korzystać z `danger` oraz komunikatu tekstowego.

### Navigation

Sidebar używa małych ikon 16 px, etykiet 14 px i kategorii 12 px uppercase z szerszym trackingiem. Pozycja aktywna ma primary/15, tekst primary i lewy border 2 px. Pozycja nieaktywna ma tekst muted i grafitowe tło dopiero na hover. Kategorie zwijają się animacją 200 ms; nawigacja pierwszego poziomu zachowuje promień 8 px.

### Status Indicators

Status dot ma 8 × 8 px, pełny promień i delikatny glow w kolorze semantycznym. Loader korzysta z ikony `Loader2` albo lokalnego spinnera i zawsze komunikuje trwającą operację także tekstem lub stanem kontrolki.

## Do's and Don'ts

### Do:

- **Do** korzystaj z istniejących tokenów CSS i komponentów `src/components/ui` jako źródła prawdy.
- **Do** używaj Lucide, `currentColor`, siatki 24 px i stroke 2 px; renderuj zwykle w rozmiarze 16 px.
- **Do** zachowuj rytm odstępów będący wielokrotnością 4 px i promienie 4/6/8 px.
- **Do** pokazuj status kolorem, ikoną i czytelną etykietą, zwłaszcza dla deployów i operacji destrukcyjnych.
- **Do** respektuj `prefers-reduced-motion` przy dodawaniu nowych animacji.

### Don't:

- **Don't** dodawaj drugiego koloru marki, gradientów niezwiązanych z istniejącym znakiem ani dekoracyjnych kolorów statusowych.
- **Don't** mieszaj Lucide z inną rodziną ikon na tej samej powierzchni.
- **Don't** używaj emoji jako ikon interfejsu ani ikon bez dostępnej nazwy w przyciskach icon-only.
- **Don't** zwiększaj promieni do „pill” poza statusami, avatarami i innymi elementami, które już są kołowe.
- **Don't** zastępuj tonalnej hierarchii ciężkimi cieniami lub stałym glowem.
