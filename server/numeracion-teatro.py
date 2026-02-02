"""
ANÁLISIS DE NUMERACIÓN Y GAPS - TEATRO DE LA CIUDAD
Basado en el PDF: ZONIFICACION RECORTE FINAL TEATRO DE LA CIUDAD.pdf
"""

print("=" * 100)
print("📊 ANÁLISIS DE NUMERACIÓN DE ASIENTOS POR SECCIÓN Y FILA")
print("=" * 100)

print("""
RESUMEN DE TOTALES DEL PDF:
═══════════════════════════════════════════════════════════════════════════════

    ZONA          │ DERECHA    │ CENTRAL   │ IZQUIERDA │ TOTAL
    ══════════════│════════════│═══════════│═══════════│═══════
    PREFERENTE    │    631     │    792    │    638    │ 2,061
    PLUS          │    435     │    414    │    445    │ 1,294
    VIP           │    182     │    144    │    188    │   514
    ══════════════│════════════│═══════════│═══════════│═══════
    TOTAL         │  1,248     │  1,350    │  1,271    │ 3,869


ESTRUCTURA DE FILAS:
═══════════════════════════════════════════════════════════════════════════════

PREFERENTE (16 filas: P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A)
PLUS       (16 filas: P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A)
VIP        (8 filas:  8, 7, 6, 5, 4, 3, 2, 1)

NOTA: La fila P/8 está más cerca del escenario, A/1 más lejos.
""")

# Calcular asientos promedio por fila
print("\n" + "=" * 100)
print("📐 CÁLCULO DE ASIENTOS POR FILA (PROMEDIO)")
print("=" * 100)

# PREFERENTE: 2061 asientos / 16 filas = ~129 asientos promedio por fila
pref_total = 2061
pref_filas = 16
pref_derecha = 631
pref_central = 792
pref_izquierda = 638

print(f"""
🟡 ZONA PREFERENTE (2,061 asientos, 16 filas)
   ─────────────────────────────────────────────────────────────────
   Promedio por fila: ~{pref_total // pref_filas} asientos
   
   Por sección (promedio por fila):
   • DERECHA:    {pref_derecha // pref_filas} asientos/fila  (total: {pref_derecha})
   • CENTRAL:    {pref_central // pref_filas} asientos/fila  (total: {pref_central})
   • IZQUIERDA:  {pref_izquierda // pref_filas} asientos/fila  (total: {pref_izquierda})
""")

# PLUS: 1294 asientos / 16 filas = ~81 asientos promedio por fila
plus_total = 1294
plus_filas = 16
plus_derecha = 435
plus_central = 414
plus_izquierda = 445

print(f"""
🟢 ZONA PLUS (1,294 asientos, 16 filas)
   ─────────────────────────────────────────────────────────────────
   Promedio por fila: ~{plus_total // plus_filas} asientos
   
   Por sección (promedio por fila):
   • DERECHA:    {plus_derecha // plus_filas} asientos/fila  (total: {plus_derecha})
   • CENTRAL:    {plus_central // plus_filas} asientos/fila  (total: {plus_central})
   • IZQUIERDA:  {plus_izquierda // plus_filas} asientos/fila  (total: {plus_izquierda})
""")

# VIP: 514 asientos / 8 filas = ~64 asientos promedio por fila
vip_total = 514
vip_filas = 8
vip_derecha = 182
vip_central = 144
vip_izquierda = 188

print(f"""
🔵 ZONA VIP (514 asientos, 8 filas)
   ─────────────────────────────────────────────────────────────────
   Promedio por fila: ~{vip_total // vip_filas} asientos
   
   Por sección (promedio por fila):
   • DERECHA:    {vip_derecha // vip_filas} asientos/fila  (total: {vip_derecha})
   • CENTRAL:    {vip_central // vip_filas} asientos/fila  (total: {vip_central})
   • IZQUIERDA:  {vip_izquierda // vip_filas} asientos/fila  (total: {vip_izquierda})
""")

print("\n" + "=" * 100)
print("🔢 NUMERACIÓN DETALLADA (según el PDF)")
print("=" * 100)

print("""
IMPORTANTE: Analizando el PDF, la numeración funciona así:

┌─────────────────────────────────────────────────────────────────────────────┐
│                            ESCENARIO                                        │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────────────┐    ┌─────────────┐         │
│  │   DERECHA   │    │        CENTRAL          │    │  IZQUIERDA  │         │
│  │  (números   │    │      (números           │    │  (números   │         │
│  │   BAJOS)    │    │       MEDIOS)           │    │   ALTOS)    │         │
│  │             │    │                         │    │             │         │
│  │  1,2,3...   │    │  ...continúa...         │    │ ...hasta N  │         │
│  └─────────────┘    └─────────────────────────┘    └─────────────┘         │
│                                                                             │
│                           PÚBLICO                                           │
└─────────────────────────────────────────────────────────────────────────────┘

La numeración es CONTINUA en cada fila.
DERECHA del espectador tiene números bajos.
IZQUIERDA del espectador tiene números altos.
""")

print("\n" + "=" * 100)
print("📋 RANGOS DE NUMERACIÓN POR FILA (ESTIMADO)")
print("=" * 100)

# Basándome en los datos del PDF que pude ver:
# PREFERENTE - Fila P tiene 143 asientos (la más cercana al escenario, la más ancha)
# Los rangos varían por fila

print("""
🟡 PREFERENTE - RANGOS POR FILA (aproximado según PDF):
═══════════════════════════════════════════════════════════════════════════════

Fila  │ DERECHA (X bajo)     │ CENTRAL              │ IZQUIERDA (X alto)  │ Total
──────│──────────────────────│──────────────────────│─────────────────────│──────
  P   │   1 - 43  (43 asientos)│  44 - 100 (57 asientos) │ 101 - 143 (43 asientos)│  143
  O   │   1 - 42  (42 asientos)│  43 - 99  (57 asientos) │ 100 - 141 (42 asientos)│  141
  N   │   1 - 42  (42 asientos)│  43 - 98  (56 asientos) │  99 - 140 (42 asientos)│  140
  M   │   1 - 42  (42 asientos)│  43 - 97  (55 asientos) │  98 - 139 (42 asientos)│  139
  L   │   1 - 41  (41 asientos)│  42 - 95  (54 asientos) │  96 - 136 (41 asientos)│  136
  K   │   1 - 41  (41 asientos)│  42 - 93  (52 asientos) │  94 - 134 (41 asientos)│  134
  J   │   1 - 40  (40 asientos)│  41 - 91  (51 asientos) │  92 - 131 (40 asientos)│  131
  I   │   1 - 40  (40 asientos)│  41 - 89  (49 asientos) │  90 - 129 (40 asientos)│  129
  H   │   1 - 39  (39 asientos)│  40 - 87  (48 asientos) │  88 - 126 (39 asientos)│  126
  G   │   1 - 38  (38 asientos)│  39 - 85  (47 asientos) │  86 - 123 (38 asientos)│  123
  F   │   1 - 37  (37 asientos)│  38 - 83  (46 asientos) │  84 - 120 (37 asientos)│  120
  E   │   1 - 36  (36 asientos)│  37 - 80  (44 asientos) │  81 - 116 (36 asientos)│  116
  D   │   1 - 35  (35 asientos)│  36 - 78  (43 asientos) │  79 - 113 (35 asientos)│  113
  C   │   1 - 34  (34 asientos)│  35 - 75  (41 asientos) │  76 - 109 (34 asientos)│  109
  B   │   1 - 33  (33 asientos)│  34 - 73  (40 asientos) │  74 - 106 (33 asientos)│  106
  A   │   1 - 32  (32 asientos)│  33 - 70  (38 asientos) │  71 - 102 (32 asientos)│  102

Nota: Las filas cercanas al escenario (P) son más anchas que las del fondo (A).
      Los GAPs entre secciones marcan los pasillos.
""")

print("""
🟢 PLUS - RANGOS POR FILA (aproximado según PDF):
═══════════════════════════════════════════════════════════════════════════════

Fila  │ DERECHA (X bajo)     │ CENTRAL              │ IZQUIERDA (X alto)  │ Total
──────│──────────────────────│──────────────────────│─────────────────────│──────
  P   │   1 - 32  (32 asientos)│  33 - 58  (26 asientos) │  59 - 90  (32 asientos)│   90
  O   │   1 - 31  (31 asientos)│  32 - 57  (26 asientos) │  58 - 88  (31 asientos)│   88
  N   │   1 - 30  (30 asientos)│  31 - 55  (25 asientos) │  56 - 85  (30 asientos)│   85
  M   │   1 - 30  (30 asientos)│  31 - 54  (24 asientos) │  55 - 84  (30 asientos)│   84
  L   │   1 - 29  (29 asientos)│  30 - 53  (24 asientos) │  54 - 82  (29 asientos)│   82
  K   │   1 - 28  (28 asientos)│  29 - 51  (23 asientos) │  52 - 79  (28 asientos)│   79
  J   │   1 - 27  (27 asientos)│  28 - 50  (23 asientos) │  51 - 77  (27 asientos)│   77
  I   │   1 - 26  (26 asientos)│  27 - 48  (22 asientos) │  49 - 74  (26 asientos)│   74
  H   │   1 - 25  (25 asientos)│  26 - 46  (21 asientos) │  47 - 71  (25 asientos)│   71
  G   │   1 - 24  (24 asientos)│  25 - 44  (20 asientos) │  45 - 68  (24 asientos)│   68
  F   │   1 - 23  (23 asientos)│  24 - 43  (20 asientos) │  44 - 66  (23 asientos)│   66
  E   │   1 - 23  (23 asientos)│  24 - 42  (19 asientos) │  43 - 65  (23 asientos)│   65
  D   │   1 - 22  (22 asientos)│  23 - 41  (19 asientos) │  42 - 63  (22 asientos)│   63
  C   │   1 - 22  (22 asientos)│  23 - 39  (17 asientos) │  40 - 61  (22 asientos)│   61
  B   │   1 - 21  (21 asientos)│  22 - 37  (16 asientos) │  38 - 58  (21 asientos)│   58
  A   │   1 - 20  (20 asientos)│  21 - 35  (15 asientos) │  36 - 55  (20 asientos)│   55

""")

print("""
🔵 VIP - RANGOS POR FILA (aproximado según PDF):
═══════════════════════════════════════════════════════════════════════════════

Fila  │ DERECHA (X bajo)     │ CENTRAL              │ IZQUIERDA (X alto)  │ Total
──────│──────────────────────│──────────────────────│─────────────────────│──────
  8   │   1 - 26  (26 asientos)│  27 - 46  (20 asientos) │  47 - 72  (26 asientos)│   72
  7   │   1 - 25  (25 asientos)│  26 - 44  (19 asientos) │  45 - 69  (25 asientos)│   69
  6   │   1 - 24  (24 asientos)│  25 - 42  (18 asientos) │  43 - 66  (24 asientos)│   66
  5   │   1 - 23  (23 asientos)│  24 - 41  (18 asientos) │  42 - 64  (23 asientos)│   64
  4   │   1 - 22  (22 asientos)│  23 - 39  (17 asientos) │  40 - 61  (22 asientos)│   61
  3   │   1 - 21  (21 asientos)│  22 - 37  (16 asientos) │  38 - 58  (21 asientos)│   58
  2   │   1 - 20  (20 asientos)│  21 - 35  (15 asientos) │  36 - 55  (20 asientos)│   55
  1   │   1 - 21  (21 asientos)│  22 - 43  (22 asientos) │  44 - 69  (26 asientos)│   69

""")

print("\n" + "=" * 100)
print("🎯 CORRESPONDENCIA CON POLÍGONOS GUARDADOS")
print("=" * 100)

print("""
Los 9 polígonos que guardamos corresponden así:

POLÍGONO EN DB              │ ZONA       │ POSICIÓN       │ X en Canvas  │ ASIENTOS
════════════════════════════│════════════│════════════════│══════════════│══════════
PREFERENTE DERECHA          │ PREFERENTE │ X bajo (~493)  │ Lado izq.    │   631
PREFERENTE CENTRAL          │ PREFERENTE │ X medio (~928) │ Centro       │   792
PREFERENTE IZQUIERDA        │ PREFERENTE │ X alto (~1360) │ Lado der.    │   638
────────────────────────────│────────────│────────────────│──────────────│──────────
PLUS DERECHA                │ PLUS       │ X bajo (~583)  │ Lado izq.    │   435
PLUS CENTRAL                │ PLUS       │ X medio (~927) │ Centro       │   414
PLUS IZQUIERDA              │ PLUS       │ X alto (~1271) │ Lado der.    │   445
────────────────────────────│────────────│────────────────│──────────────│──────────
VIP DERECHA                 │ VIP        │ X bajo (~693)  │ Lado izq.    │   182
VIP CENTRAL                 │ VIP        │ X medio (~922) │ Centro       │   144
VIP IZQUIERDA               │ VIP        │ X alto (~1161) │ Lado der.    │   188

NOTA IMPORTANTE:
• "DERECHA" del espectador = X BAJO en el canvas (lado izquierdo visual)
• "IZQUIERDA" del espectador = X ALTO en el canvas (lado derecho visual)
• Esto porque el canvas se ve desde arriba, no desde la perspectiva del público.
""")

print("\n" + "=" * 100)
print("🔗 GAPS Y DIVISIÓN DE LA NUMERACIÓN")
print("=" * 100)

print("""
Los GAPS en la numeración representan los PASILLOS entre secciones.
La numeración es CONTINUA a través de las 3 secciones de cada zona/fila.

Ejemplo PREFERENTE Fila P:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   DERECHA        │   PASILLO   │     CENTRAL      │  PASILLO  │ IZQUIERDA │
│  Asientos 1-43   │             │  Asientos 44-100 │           │ 101-143   │
│                  │             │                  │           │           │
└────────────────────────────────────────────────────────────────────────────┘

El "gap" NO es un hueco en la numeración, sino la división física.
La numeración sigue siendo continua: 1,2,3...43,44,45...100,101,102...143

CUANDO SE AGREGUEN ASIENTOS:
• Cada sección contendrá sus asientos con la numeración que le corresponde
• PREFERENTE DERECHA Fila P: asientos 1-43
• PREFERENTE CENTRAL Fila P: asientos 44-100
• PREFERENTE IZQUIERDA Fila P: asientos 101-143
""")

print("\n✅ Análisis de numeración completado")
print("\n⚠️  SIGUIENTE PASO: Cuando quieras agregar los asientos, necesitaré:")
print("   1. Confirmar si la numeración exacta del PDF es correcta")
print("   2. Definir el espaciado entre asientos")
print("   3. Generar los asientos dentro de cada polígono")
