# NAS App & Dashboard — Design System Token Prompt for Claude Code

Create a complete, mature variable system for the NAS App and Dashboard design system.

Output target: CSS custom properties (design tokens as code variables).

Do not create component-specific tokens.
Do not simplify the system.
Do not skip scopes.
Do not leave typography partially connected.
Do not use raw values on semantic tokens when a primitive alias is available.

────────────────────────────────
BRAND IDENTITY — FIXED. DO NOT ASK. USE EXACTLY THESE VALUES.
────────────────────────────────

All colors, fonts, and scales below are sourced directly from the existing NAS identity system. Do not modify, substitute, or invent any values.

────────────────────────────────
PHASE 1 — PRIMITIVE COLLECTIONS
────────────────────────────────

**A) primitives.color**

Create every primitive color ramp below with exact hex values. These are the raw palette — no roles attached yet.

**Deep Teal ramp**
```
color/deep-teal/100   #F2FBFA
color/deep-teal/200   #D5F2F0
color/deep-teal/300   #AAE5E1
color/deep-teal/400   #78D0CE
color/deep-teal/500   #4CB4B5
color/deep-teal/600   #339699
color/deep-teal/700   #26787B
color/deep-teal/800   #225F63
color/deep-teal/900   #1F4C50
color/deep-teal/950   #1E4043
color/deep-teal/1000  #0C2427
color/deep-teal/1000-08   rgba(12,36,39,0.08)
color/deep-teal/1000-16   rgba(12,36,39,0.16)
```

**Accent Sky ramp**
```
color/accent-sky/100   #F1FCFF
color/accent-sky/200   #EAFAFF
color/accent-sky/300   #D4F5FF
color/accent-sky/400   #75DEFF
color/accent-sky/500   #69C8E6
color/accent-sky/600   #5EB2CC
color/accent-sky/700   #58A7BF
color/accent-sky/800   #468599
color/accent-sky/900   #356473
color/accent-sky/1000  #294E59
color/accent-sky/400-08   rgba(117,222,255,0.08)
color/accent-sky/400-16   rgba(117,222,255,0.16)
color/accent-sky/400-24   rgba(117,222,255,0.24)
```

**Essential primitives** (4 raw values — sourced from Optional Tokens App / Colors / Essential)
```
color/essential/background   #FDFDFD
color/essential/text         #171819
color/essential/cta          #0C2427
color/essential/additional   #0C2427
```
Note: CTA and Additional both resolve to Deep Teal 1000 (#0C2427) at the primitive level. Background (#FDFDFD) is a distinct value — do not substitute grey/200 (#FCFCFC) or grey/100 (#FFFBF7).


```
color/grey/0      #FFFFFF
color/grey/50     #FAFAFA
color/grey/100    #FFFBF7
color/grey/200    #FCFCFC
color/grey/300    #F5F5F5
color/grey/400    #E6E7E8
color/grey/500    #CFD0D1
color/grey/600    #B8B9BA
color/grey/700    #8C8C8C
color/grey/750    #676E76
color/grey/800    #595959
color/grey/900    #454545
color/grey/1000   #171819
color/grey/2000   #000000
color/grey/700-08     rgba(140,140,140,0.08)
color/grey/750-08     rgba(103,110,118,0.08)
color/grey/750-16     rgba(103,110,118,0.16)
color/grey/2000-12    rgba(0,0,0,0.12)
color/grey/2000-64    rgba(0,0,0,0.64)
```

**Status — Green**
```
color/status/green/50       #E7F8F0
color/status/green/500      #0FB86A
color/status/green/500-08   rgba(15,184,106,0.08)
color/status/green/500-16   rgba(15,184,106,0.16)
color/status/green/500-40   rgba(15,184,106,0.4)
```

**Status — Orange (Warning / Hold)**
```
color/status/orange/50       #FEF4E6
color/status/orange/500      #F79008
color/status/orange/500-08   rgba(247,144,8,0.08)
color/status/orange/500-16   rgba(247,144,8,0.16)
color/status/orange/500-40   rgba(247,144,8,0.4)
```

**Status — Red (Danger / Warning)**
```
color/status/red/50       #FEECEB
color/status/red/500      #F14437
color/status/red/500-08   rgba(241,68,55,0.08)
color/status/red/500-16   rgba(241,68,55,0.16)
color/status/red/500-40   rgba(241,68,55,0.4)
```

**Operational / Categorical** (standalone — no ramp needed)
```
color/status/soft-coral       #FF8B6A
color/status/harbor-blue      #496E91
color/status/dusty-lilac      #BFAAE0
color/status/clay-terracotta  #EBD4A6
color/status/frosted-teal     #7BAEA1
```

**Utility**
```
color/black        #000000
color/white        #FFFFFF
color/transparent  rgba(0,0,0,0)
```

---

**B) primitives.dimension**

Granular spacing scale sourced from the NAS spacing system. All values in px.
Token naming: `size/{value}`

```
size/0    0
size/2    2
size/4    4
size/8    8
size/10   10
size/12   12
size/14   14
size/16   16
size/18   18
size/20   20
size/22   22
size/24   24
size/26   26
size/28   28
size/30   30
size/32   32
size/34   34
size/36   36
size/38   38
size/40   40
size/42   42
size/44   44
size/46   46
size/48   48
size/50   50
size/52   52
size/54   54
size/56   56
size/58   58
size/60   60
size/62   62
size/64   64
```

---

**C) primitives.radius**

Sourced from NAS border-radius system. All values in px.

**Default radius set**
```
radius/none   0
radius/5xs    2
radius/4xs    4
radius/3xs    6
radius/2xs    8
radius/xs     10
radius/sm     12
radius/md     14
radius/lg     16
radius/xl     18
radius/2xl    20
radius/3xl    22
radius/4xl    24
radius/pill   9999
```

**Rounded radius set** (each step +4 from default, minimum 4)
```
radius-rounded/none   0
radius-rounded/5xs    4
radius-rounded/4xs    6
radius-rounded/3xs    8
radius-rounded/2xs    10
radius-rounded/xs     12
radius-rounded/sm     14
radius-rounded/md     16
radius-rounded/lg     18
radius-rounded/xl     20
radius-rounded/2xl    22
radius-rounded/3xl    24
radius-rounded/4xl    28
radius-rounded/pill   9999
```

**No-radius set** (all zero, pill becomes a soft stub)
```
radius-none/none   0
radius-none/5xs    0
radius-none/4xs    0
radius-none/3xs    0
radius-none/2xs    0
radius-none/xs     0
radius-none/sm     0
radius-none/md     0
radius-none/lg     0
radius-none/xl     0
radius-none/2xl    0
radius-none/3xl    0
radius-none/4xl    0
radius-none/pill   4
```

---

**D) primitives.typography**

Split by property. All values sourced directly from the NAS Figma Semantic Tokens App (Font group: Size, Height, Weight, Family, Letter Spacing).
The Arabic type scale (Almarai) uses the same size and line-height values as the English scale — only the font family changes.

**Font families** (STRING variables)
```
font-family/english   Fira Sans
font-family/arabic    Almarai
```
Note: There is no code/mono font in this system. Do not add one.

**Font weights** (NUMBER variables — 5 tokens in Figma)
```
font-weight/regular     400
font-weight/medium      500
font-weight/semibold    600
font-weight/bold        700
font-weight/extra-bold  800
```
Note: Semibold (600) and Extra Bold (800) are present in the Figma Weight group (5 tokens total). Include both.

**Font sizes** (NUMBER variables — 12 named tokens from Figma Font/Size)
```
font-size/3XS        10    (aliases Font/Size/10)
font-size/2XS        12    (aliases Font/Size/12)
font-size/XS         14    (aliases Font/Size/14)
font-size/S          16    (aliases Font/Size/16)
font-size/Button-S   12    (aliases Font/Size/12)
font-size/Button-M   14    (aliases Font/Size/14)
font-size/Button-L   16    (aliases Font/Size/16)
font-size/M          18    (aliases Font/Size/18)
font-size/XL         24    (aliases Font/Size/24)
font-size/L          20    (aliases Font/Size/20)
font-size/2XL        32    (aliases Font/Size/32)
font-size/3XL        48    (aliases Font/Size/48)
```

**Line heights** (NUMBER variables — 11 named tokens from Figma Font/Height)
```
font-height/3XS        12      (aliases Font/Height/12)
font-height/2XS        14.4    (aliases Font/Height/14dot4)
font-height/XS         16.8    (aliases Font/Height/16dot8)
font-height/S          19.2    (aliases Font/Height/19dot2)
font-height/Button-S   16.8    (aliases Font/Height/16dot8)
font-height/Button-M   19.6    (aliases Font/Height/19dot6)
font-height/Button-L   25.2    (aliases Font/Height/25dot2)
font-height/M          21.6    (aliases Font/Height/21dot6)
font-height/L          24      (aliases Font/Height/24)
font-height/XL         28.8    (aliases Font/Height/28dot8)
font-height/2XL        38.8    (aliases Font/Height/38dot8)
```

**Letter spacing** (NUMBER variables — 9 tokens from Figma Font/Letter Spacing)
```
font-tracking/Neutral   0
font-tracking/2XS      -0.36
font-tracking/XS       -0.42
font-tracking/S        -0.48
font-tracking/M        -0.54
font-tracking/L        -0.60
font-tracking/XL       -0.72
font-tracking/2XL      -0.96
font-tracking/3XL      -1.44
```
Note: Letter spacing IS part of the semantic token system (confirmed in Figma). Include it.

**Paragraph spacing** (NUMBER variables)
```
paragraph-spacing/none   0
paragraph-spacing/sm     4
paragraph-spacing/md     8
paragraph-spacing/lg     12
```

**Paragraph indent** (NUMBER variable)
```
paragraph-indent/none   0
```

---

**E) primitives.number**

**Opacity** (NUMBER variables — values 0–100)
```
opacity/0     0
opacity/5     5
opacity/8     8
opacity/10    10
opacity/16    16
opacity/20    20
opacity/24    24
opacity/30    30
opacity/40    40
opacity/50    50
opacity/60    60
opacity/64    64
opacity/70    70
opacity/80    80
opacity/90    90
opacity/100   100
```

**Stroke width** (NUMBER variables)
```
stroke-width/0   0
stroke-width/1   1
stroke-width/2   2
stroke-width/3   3
stroke-width/4   4
```

---

**F) primitives.shadow**

Shadow value strings, tuned with deep teal undertones to match NAS brand.
```
shadow/none   0px 0px 0px 0px rgba(12,36,39,0)
shadow/sm     0px 1px 2px 0px rgba(12,36,39,0.08)
shadow/md     0px 2px 8px 0px rgba(12,36,39,0.12), 0px 0px 1px 0px rgba(12,36,39,0.08)
shadow/lg     0px 4px 16px 0px rgba(12,36,39,0.12), 0px 0px 2px 0px rgba(12,36,39,0.08)
shadow/xl     0px 8px 32px 0px rgba(12,36,39,0.16), 0px 0px 4px 0px rgba(12,36,39,0.08)
```

---

────────────────────────────────
PHASE 2 — SEMANTIC COLLECTIONS
────────────────────────────────

All semantic tokens must alias primitive tokens. Do not hardcode hex values into semantic variables unless a primitive alias is impossible.

The semantic layer uses the NAS CSS naming convention as its source of truth.
In the CSS: `--colors-primary-*` = Deep Teal, `--colors-additionally-*` / `--colors-neutral-*` = Accent Sky / Grey.
The semantic token names below reflect this exactly.

---

**A) semantic.color — single mode**

**ESSENTIAL** (4 tokens — aliases of Optional Tokens App / Colors / Essential primitives)
```
color/essential/Primary      → essential/background   (#FDFDFD)
color/essential/Secondary    → essential/text          (#171819)
color/essential/Tertiary     → essential/cta           (#0C2427 = Deep Teal 1000)
color/essential/Additionally → essential/additional    (#0C2427 = Deep Teal 1000)
```
Note: Tertiary and Additionally both point to the same primitive value (#0C2427). This is correct and intentional — do not merge or remove either token.

**PRIMARY** (10 tokens — alias of Deep Teal ramp, exactly 100–1000)
```
color/primary/100   → deep-teal/100
color/primary/200   → deep-teal/200
color/primary/300   → deep-teal/300
color/primary/400   → deep-teal/400
color/primary/500   → deep-teal/500
color/primary/600   → deep-teal/600
color/primary/700   → deep-teal/700
color/primary/800   → deep-teal/800
color/primary/900   → deep-teal/900
color/primary/1000  → deep-teal/1000
```
Note: No 950, no alpha variants at this semantic level. Figma shows exactly 10 steps.

**NEUTRAL** (22 tokens — the actual Grey ramp from Figma, including alpha variants)
```
color/neutral/50       → grey/50
color/neutral/100      → grey/100
color/neutral/100-20   → grey/100-20
color/neutral/200      → grey/200
color/neutral/250      → grey/250
color/neutral/300      → grey/300
color/neutral/300-40   → grey/300-40
color/neutral/350      → grey/350
color/neutral/400      → grey/400
color/neutral/400-60   → grey/400-60
color/neutral/400-40   → grey/400-40
color/neutral/450      → grey/450
color/neutral/500      → grey/500
color/neutral/550      → grey/550
color/neutral/600      → grey/600
color/neutral/700      → grey/700
color/neutral/750      → grey/750
color/neutral/800      → grey/800
color/neutral/900      → grey/900
color/neutral/1000     → grey/1000
color/neutral/1000-20  → grey/1000-20
color/neutral/1000-10  → grey/1000-10
```
Note: The Neutral ramp includes steps at 250, 350, 450, 550 that the old version was missing. It also uses -20, -40, -60 alpha suffixes (not -08/-16). Update primitive grey ramp to match.

**STATUS** (22 tokens total across Warning, Success, Hold, Operational, Neutral Alert)

Warning group — aliases Colors/Status/Red:
```
color/status/warning         → status/red/500
color/status/warning-08      → status/red/500-08
color/status/warning-10      → status/red/500-10
color/status/warning-16      → status/red/500-16
color/status/warning-20      → status/red/500-20
color/status/warning-40      → status/red/500-40
color/status/warning/50      → status/red/50
```

Success group — aliases Colors/Status/Green:
```
color/status/success         → status/green/500
color/status/success-08      → status/green/500-08
color/status/success-10      → status/green/500-10
color/status/success-16      → status/green/500-16
color/status/success-40      → status/green/500-40
color/status/success/50      → status/green/50
```

Hold group — aliases Colors/Status/Orange (5 tokens):
```
color/status/hold/50      → status/orange/50
color/status/hold/500     → status/orange/500
color/status/hold/500-08  → status/orange/500-08
color/status/hold/500-16  → status/orange/500-16
color/status/hold/500-40  → status/orange/500-40
```

Operational — aliases Colors/Status/Blue:
```
color/status/operational      → status/blue/500
color/status/operational-10   → status/blue/500-10
```

Neutral Alert — aliases Colors/Status/Purple:
```
color/status/neutral-alert    → status/purple/500
```

Note: Status color naming in Figma uses Warning=Red, Hold=Orange (not Warning). "Hold" and "Warning" are distinct semantic states. Do not conflate them.

---

**B) semantic.dimension — single mode**

Spacing tokens use named semantic aliases (not inset/stack/inline groups). All 31 tokens below alias primitives.dimension exactly as defined in Figma Semantic Tokens App.

```
spacing/17XS  → size/2
spacing/16XS  → size/4
spacing/15XS  → size/8
spacing/14XS  → size/10
spacing/13XS  → size/12
spacing/12XS  → size/14
spacing/11XS  → size/16
spacing/10XS  → size/18
spacing/9XS   → size/20
spacing/8XS   → size/22
spacing/7XS   → size/24
spacing/6XS   → size/26
spacing/5XS   → size/28
spacing/4XS   → size/30
spacing/3XS   → size/32
spacing/2XS   → size/34
spacing/XS    → size/36
spacing/S     → size/38
spacing/M     → size/40
spacing/XL    → size/42
spacing/2XL   → size/44
spacing/3XL   → size/46
spacing/4XL   → size/48
spacing/5XL   → size/50
spacing/6XL   → size/52
spacing/7XL   → size/54
spacing/8XL   → size/56
spacing/9XL   → size/58
spacing/10XL  → size/60
spacing/11XL  → size/62
spacing/12XL  → size/64
```

Note: Spacing names in Figma do not follow inset/stack/inline groups. They are a flat named scale from 17XS (2px) to 12XL (64px). Use these token names — do not rename or restructure them.

---

**C) semantic.radius — modes: default, rounded, no-corner-radius**

```
radius/control/xs      default → radius/4xs    rounded → radius/3xs    no-corner-radius → radius/none
radius/control/sm      default → radius/2xs    rounded → radius/xs     no-corner-radius → radius/none
radius/control/md      default → radius/sm     rounded → radius/md     no-corner-radius → radius/none
radius/control/lg      default → radius/lg     rounded → radius/xl     no-corner-radius → radius/none
radius/container/sm    default → radius/sm     rounded → radius/lg     no-corner-radius → radius/none
radius/container/md    default → radius/lg     rounded → radius/2xl    no-corner-radius → radius/none
radius/container/lg    default → radius/xl     rounded → radius/3xl    no-corner-radius → radius/none
radius/container/xl    default → radius/2xl    rounded → radius/4xl    no-corner-radius → radius/none
radius/dialog          default → radius/2xl    rounded → radius/4xl    no-corner-radius → radius/none
radius/pill            default → radius/pill   rounded → radius/pill   no-corner-radius → radius/xs
```

---

**D) semantic.typography — single mode**

All semantic typography variables alias primitives.typography.
Property naming pattern: `typography/{style}/{weight}/{property}`

Each style has three weight variants (bold, medium, regular). The Arabic column uses `font-family/arabic` (Almarai) with the same size and line-height as the English column — no other values change.

| Style | Weight | font-size | font-height | font-tracking |
|---|---|---|---|---|
| large-heading | bold | font-size/2XL | font-height/2XL | font-tracking/2XL |
| large-heading | medium | font-size/2XL | font-height/2XL | font-tracking/2XL |
| large-heading | regular | font-size/2XL | font-height/2XL | font-tracking/2XL |
| h1 | bold | font-size/XL | font-height/XL | font-tracking/XL |
| h1 | medium | font-size/XL | font-height/XL | font-tracking/XL |
| h1 | regular | font-size/XL | font-height/XL | font-tracking/XL |
| h1-small | bold | font-size/L | font-height/L | font-tracking/L |
| h1-small | medium | font-size/L | font-height/L | font-tracking/L |
| h1-small | regular | font-size/L | font-height/L | font-tracking/L |
| h2 | bold | font-size/M | font-height/M | font-tracking/M |
| h2 | medium | font-size/M | font-height/M | font-tracking/M |
| h2 | regular | font-size/M | font-height/M | font-tracking/M |
| subtitle | bold | font-size/S | font-height/S | font-tracking/S |
| subtitle | medium | font-size/S | font-height/S | font-tracking/S |
| subtitle | regular | font-size/S | font-height/S | font-tracking/S |
| subtitle-small | bold | font-size/XS | font-height/XS | font-tracking/XS |
| subtitle-small | medium | font-size/XS | font-height/XS | font-tracking/XS |
| subtitle-small | regular | font-size/XS | font-height/XS | font-tracking/XS |
| body | bold | font-size/S | font-height/S | font-tracking/Neutral |
| body | medium | font-size/S | font-height/S | font-tracking/Neutral |
| body | regular | font-size/S | font-height/S | font-tracking/Neutral |
| body-small | bold | font-size/XS | font-height/XS | font-tracking/Neutral |
| body-small | medium | font-size/XS | font-height/XS | font-tracking/Neutral |
| body-small | regular | font-size/XS | font-height/XS | font-tracking/Neutral |
| button-large | bold | font-size/Button-L | font-height/Button-L | font-tracking/Neutral |
| button-large | medium | font-size/Button-L | font-height/Button-L | font-tracking/Neutral |
| button-large | regular | font-size/Button-L | font-height/Button-L | font-tracking/Neutral |
| button | bold | font-size/Button-M | font-height/Button-M | font-tracking/Neutral |
| button | medium | font-size/Button-M | font-height/Button-M | font-tracking/Neutral |
| button | regular | font-size/Button-M | font-height/Button-M | font-tracking/Neutral |
| button-small | bold | font-size/Button-S | font-height/Button-S | font-tracking/Neutral |
| button-small | medium | font-size/Button-S | font-height/Button-S | font-tracking/Neutral |
| button-small | regular | font-size/Button-S | font-height/Button-S | font-tracking/Neutral |
| caption | bold | font-size/2XS | font-height/2XS | font-tracking/Neutral |
| caption | medium | font-size/2XS | font-height/2XS | font-tracking/Neutral |
| caption | regular | font-size/2XS | font-height/2XS | font-tracking/Neutral |
| minimum-size | bold | font-size/3XS | font-height/3XS | font-tracking/Neutral |
| minimum-size | medium | font-size/3XS | font-height/3XS | font-tracking/Neutral |
| minimum-size | regular | font-size/3XS | font-height/3XS | font-tracking/Neutral |

Font family rule: All styles use `font-family/english` (Fira Sans) by default. In RTL/Arabic contexts, swap to `font-family/arabic` (Almarai) — size, height, and tracking values remain identical.

---

**E) semantic.elevation — single mode**

```
elevation/surface/sunken  → surface/bg/sunken
elevation/surface/default → surface/bg/default
elevation/surface/raised  → surface/bg/raised
elevation/surface/overlay → surface/bg/overlay
elevation/shadow/none     → shadow/none
elevation/shadow/sm       → shadow/sm
elevation/shadow/md       → shadow/md
elevation/shadow/lg       → shadow/lg
elevation/shadow/xl       → shadow/xl
```

---

**F) semantic.number — single mode**

```
opacity/disabled       → opacity/40
opacity/subtle         → opacity/8
opacity/overlay        → opacity/64
stroke-width/default   → stroke-width/1
stroke-width/strong    → stroke-width/2
stroke-width/focus     → stroke-width/2
```

---

────────────────────────────────
PHASE 3 — CODE SYNTAX (CSS VARIABLE OUTPUT)
────────────────────────────────

Set WEB code syntax on all variables. Convert slash token names to CSS custom property format:

```
color/deep-teal/500         → var(--color-deep-teal-500)
color/primary/1000          → var(--color-primary-1000)
color/essential/background  → var(--color-essential-background)
surface/bg/default          → var(--surface-bg-default)
typography/body/md/font-size → var(--typography-body-md-font-size)
space/inset/md              → var(--space-inset-md)
radius/control/md           → var(--radius-control-md)
```

Apply consistently across all collections and all variables.

---

────────────────────────────────
PHASE 4 — VARIABLE SCOPES
────────────────────────────────

Apply scopes narrowly. Do not leave any variable on "all properties."

- Primitive color variables → broadly scoped (fill, stroke, effects — palettes used everywhere)
- Semantic surface/bg colors → frame fill, shape fill
- Semantic text colors → text fill only
- Semantic icon colors → shape fill only
- Semantic border colors → stroke only
- Overlay/focus colors → effects
- Semantic dimension tokens → auto layout gap, auto layout padding
- Semantic radius tokens + primitive radius → corner radius only
- Font-size variables → font size only
- Line-height variables → line height only
- Letter-spacing variables → letter spacing only
- Paragraph-spacing variables → paragraph spacing only
- Paragraph-indent variables → paragraph indent only
- Font-weight NUMBER variables → font weight only
- Font-family STRING variables → font family only
- Opacity tokens → layer opacity only
- Stroke-width tokens → stroke only

---

────────────────────────────────
EXECUTION ORDER
────────────────────────────────

1. Create all primitive collections with every token listed
2. Create all semantic collections aliasing primitives
3. Apply code syntax (CSS variable output) to all variables
4. Apply variable scopes
5. Run quality control

---

────────────────────────────────
QUALITY CONTROL — VERIFY ALL BEFORE FINISHING
────────────────────────────────

1. All 12 collections exist: 6 primitive + 6 semantic.
2. Only semantic.radius has multiple modes: default, rounded, no-corner-radius. All other collections are single mode only.
3. All semantic tokens alias primitives — no hardcoded hex in semantic layer.
4. All 3 radius modes switch correctly.
5. color/primary/* aliases deep-teal/* exactly.
6. color/additionally/* aliases accent-sky/* exactly.
7. color/neutral/* aliases grey/* exactly.
8. color/essential/* tokens exist and match the CSS --colors-essential-* values.
9. All operational/categorical status colors exist as standalone primitives.
10. font-family/english (Fira Sans) and font-family/arabic (Almarai) exist. There is NO code/mono font and NO semibold weight in this system.
11. All 13 type styles exist with bold, medium, and regular weight variants each. Arabic column uses font-family/arabic with identical size and line-height values.
12. Variable scopes applied narrowly across all collections.
13. CSS variable code syntax applied to all variables.
14. No component-specific tokens were created.
15. All color values exactly match NAS identity source — no invented values.

After finishing, output a short summary confirming:
- Brand color: Deep Teal (#0C2427 as /1000)
- Accent color: Accent Sky (#75DEFF as /400)
- Neutral family: Grey
- Fonts: Fira Sans (font-family/english) + Almarai (font-family/arabic). No code/mono font. No semibold weight.
- Type styles: 13 styles × 3 weight variants each, with Arabic column using Almarai + identical size/line-height
- All collections, modes (radius only), and scopes created successfully
- Any fallbacks applied
