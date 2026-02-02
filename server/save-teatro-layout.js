// Script para guardar el layout del Teatro de la Ciudad correctamente

const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const BASE_URL = 'update.compratuboleto.mx';

// El layoutJson correcto con las 9 secciones
const layoutJson = {
  "canvas": {
    "version": "6.9.0",
    "objects": [
      // PREFERENTE IZQUIERDA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769728453039",
        "name": "PREFERENTE IZQUIERDA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 1166.2773,
        "top": 151.8154,
        "width": 417.3459,
        "height": 425.8316,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -208.6729,
            "top": -212.9158,
            "width": 414.3459,
            "height": 422.8316,
            "fill": "#E7AD0D60",
            "stroke": "#E7AD0D",
            "strokeWidth": 3,
            "points": [
              {"x": 1582.123123150405, "y": 347.44102313105344},
              {"x": 1454.9589818081763, "y": 576.1470061148934},
              {"x": 1167.777255923987, "y": 414.63386373141043},
              {"x": 1236.822325325124, "y": 153.31539219952924}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": -14.5298,
            "top": 8.1531,
            "text": "PREFERENTE IZQUIERDA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // PREFERENTE CENTRAL
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769728398974",
        "name": "PREFERENTE CENTRAL",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 668.2797,
        "top": 125.5709,
        "width": 521.6411,
        "height": 264.1528,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -260.8206,
            "top": -132.0764,
            "width": 518.6411,
            "height": 261.1528,
            "fill": "#E7AD0D60",
            "stroke": "#E7AD0D",
            "strokeWidth": 3,
            "points": [
              {"x": 1120.247856105699, "y": 386.8237458864778},
              {"x": 733.726746434553, "y": 388.22368165426235},
              {"x": 669.7796972759976, "y": 127.07088130539668},
              {"x": 1188.4208044390084, "y": 127.07088130539668}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": -1.0565,
            "top": -0.35,
            "text": "PREFERENTE CENTRAL",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // PREFERENTE DERECHA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769728342922",
        "name": "PREFERENTE DERECHA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 270.1917,
        "top": 153.6276,
        "width": 414.0076,
        "height": 428.1151,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -207.0038,
            "top": -214.0576,
            "width": 411.0076,
            "height": 425.1151,
            "fill": "#e7ad0d60",
            "stroke": "#e7ad0d",
            "strokeWidth": 3,
            "points": [
              {"x": 271.691735105304, "y": 354.8424223087342},
              {"x": 401.4802302469815, "y": 580.242764677117},
              {"x": 682.6993033776871, "y": 416.96862628689524},
              {"x": 617.7758252175163, "y": 155.1276312440205}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": 16.2163,
            "top": 9.1102,
            "text": "PREFERENTE DERECHA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // PLUS IZQUIERDA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769728289095",
        "name": "PLUS IZQUIERDA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 1077.6927,
        "top": 479.7864,
        "width": 319.6179,
        "height": 384.171,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -159.8089,
            "top": -192.0855,
            "width": 316.6179,
            "height": 381.171,
            "fill": "#1EC84060",
            "stroke": "#1EC840",
            "strokeWidth": 3,
            "points": [
              {"x": 1147.3983851522746, "y": 481.2864004828243},
              {"x": 1366.3744511389689, "y": 604.7542248826426},
              {"x": 1343.3999130682337, "y": 646.3887238081626},
              {"x": 1395.8105780420983, "y": 677.2556799081171},
              {"x": 1294.5790196679216, "y": 862.4574165078444},
              {"x": 1079.1927252547796, "y": 741.1431006731393}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": 33.6242,
            "top": -2.991,
            "text": "PLUS IZQUIERDA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // PLUS CENTRAL
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769728235816",
        "name": "PLUS CENTRAL",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 748.7221,
        "top": 455.0489,
        "width": 352.7012,
        "height": 263.4884,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -176.3506,
            "top": -131.7442,
            "width": 349.7012,
            "height": 260.4884,
            "fill": "#1EC84060",
            "stroke": "#1EC840",
            "strokeWidth": 3,
            "points": [
              {"x": 750.2221302124099, "y": 457.32418175452744},
              {"x": 868.0815105152811, "y": 456.5489186710867},
              {"x": 868.8569011751684, "y": 521.6710176801071},
              {"x": 991.3686254373637, "y": 521.6710176801071},
              {"x": 991.3686254373637, "y": 456.5489186710867},
              {"x": 1099.9233178215873, "y": 458.0994448379681},
              {"x": 1031.688939751504, "y": 717.0373147071682},
              {"x": 813.8041643231693, "y": 714.7115254568462}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": 1.8416,
            "top": -48.8416,
            "text": "PLUS CENTRAL",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // PLUS DERECHA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769727836867",
        "name": "PLUS DERECHA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 458.0043,
        "top": 485.8277,
        "width": 313.1043,
        "height": 379.6467,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -156.5521,
            "top": -189.8234,
            "width": 310.1043,
            "height": 376.6467,
            "fill": "#1ec84060",
            "stroke": "#1ec840",
            "strokeWidth": 3,
            "points": [
              {"x": 489.24758461393924, "y": 608.7938764938132},
              {"x": 513.5449125324321, "y": 651.0977791437073},
              {"x": 459.50430388612887, "y": 681.2550166763049},
              {"x": 564.7569483099562, "y": 863.9744444121759},
              {"x": 769.6085578296642, "y": 744.6020458456433},
              {"x": 699.3524482093832, "y": 487.32769892550715}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": -31.8873,
            "top": -2.8093,
            "text": "PLUS DERECHA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // VIP CENTRAL
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769727771832",
        "name": "VIP CENTRAL",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 812.2333,
        "top": 715.694,
        "width": 221.4166,
        "height": 136.8619,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -110.7083,
            "top": -68.431,
            "width": 218.4166,
            "height": 133.8619,
            "fill": "#0EA5E960",
            "stroke": "#0EA5E9",
            "strokeWidth": 3,
            "points": [
              {"x": 813.7333408318926, "y": 717.6825032064496},
              {"x": 1032.1498971768272, "y": 717.1939559584216},
              {"x": 997.945962178739, "y": 851.0559019181164},
              {"x": 845.9827652586615, "y": 851.0559019181164}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": -0.4886,
            "top": 0.1221,
            "text": "VIP CENTRAL",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // VIP IZQUIERDA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769727719701",
        "name": "VIP IZQUIERDA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 1042.53,
        "top": 742.1153,
        "width": 252.0975,
        "height": 238.5029,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -126.0487,
            "top": -119.2515,
            "width": 249.0975,
            "height": 235.5029,
            "fill": "#0EA5E960",
            "stroke": "#0EA5E9",
            "strokeWidth": 3,
            "points": [
              {"x": 1228.1399950141886, "y": 979.1182440673789},
              {"x": 1293.127471510556, "y": 862.355451788667},
              {"x": 1079.2629213703797, "y": 743.6153014435638},
              {"x": 1044.0299781484769, "y": 878.5419183318234}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": -7.4386,
            "top": 4.541,
            "text": "VIP IZQUIERDA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      },
      // VIP DERECHA
      {
        "subTargetCheck": true,
        "interactive": false,
        "_customType": "section",
        "id": "section-1769727657188",
        "name": "VIP DERECHA",
        "capacity": 0,
        "type": "Group",
        "version": "6.9.0",
        "originX": "left",
        "originY": "top",
        "left": 564.2847,
        "top": 743.6511,
        "width": 243.1116,
        "height": 234.63,
        "fill": "rgb(0,0,0)",
        "stroke": null,
        "strokeWidth": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "visible": true,
        "objects": [
          {
            "type": "Polygon",
            "version": "6.9.0",
            "originX": "left",
            "originY": "top",
            "left": -121.5558,
            "top": -117.315,
            "width": 240.1116,
            "height": 231.63,
            "fill": "#0EA5E960",
            "stroke": "#0EA5E9",
            "strokeWidth": 3,
            "points": [
              {"x": 565.7847468444967, "y": 865.4509311475183},
              {"x": 629.1108893552428, "y": 976.7810780281579},
              {"x": 805.8963705310757, "y": 874.420658621314},
              {"x": 770.0115564416528, "y": 745.1510567930832}
            ]
          },
          {
            "type": "IText",
            "version": "6.9.0",
            "originX": "center",
            "originY": "center",
            "left": 6.8603,
            "top": 4.4849,
            "text": "VIP DERECHA",
            "fontSize": 18,
            "fontWeight": "bold",
            "fill": "#ffffff",
            "stroke": "#00000080",
            "strokeWidth": 2
          }
        ]
      }
    ],
    "background": "#ffffff"
  },
  "zones": [
    {"id": "17d7b2d7-2ee1-4f92-a1b9-119963cb0ce4", "name": "PLUS", "color": "#89eca1", "price": 800, "type": "section", "visible": true},
    {"id": "351a655a-fe3c-4f39-8bb1-86789ac4130a", "name": "Diamante", "color": "#dc94f0", "price": 1000, "type": "section", "visible": true},
    {"id": "5d11b2ea-77aa-4d81-9593-104767c0bf5f", "name": "Preferente", "color": "#ffba42", "price": 700, "type": "section", "visible": true},
    {"id": "cb62f7be-4e23-4716-9ef0-be4361738440", "name": "VIP", "color": "#70a7f0", "price": 900, "type": "section", "visible": true}
  ],
  "sections": [
    {
      "id": "section-1769727657188",
      "name": "VIP DERECHA",
      "description": "",
      "color": "#0EA5E9",
      "polygonPoints": [
        {"x": 565.7847468444967, "y": 865.4509311475183},
        {"x": 629.1108893552428, "y": 976.7810780281579},
        {"x": 805.8963705310757, "y": 874.420658621314},
        {"x": 770.0115564416528, "y": 745.1510567930832}
      ],
      "labelPosition": {"x": 692.700890793117, "y": 865.4509311475184},
      "capacity": 0,
      "displayOrder": 0,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769727719701",
      "name": "VIP IZQUIERDA",
      "description": "",
      "color": "#0EA5E9",
      "polygonPoints": [
        {"x": 1228.1399950141886, "y": 979.1182440673789},
        {"x": 1293.127471510556, "y": 862.355451788667},
        {"x": 1079.2629213703797, "y": 743.6153014435638},
        {"x": 1044.0299781484769, "y": 878.5419183318234}
      ],
      "labelPosition": {"x": 1161.1400915109002, "y": 865.9077289078582},
      "capacity": 0,
      "displayOrder": 1,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769727771832",
      "name": "VIP CENTRAL",
      "description": "",
      "color": "#0EA5E9",
      "polygonPoints": [
        {"x": 813.7333408318926, "y": 717.6825032064496},
        {"x": 1032.1498971768272, "y": 717.1939559584216},
        {"x": 997.945962178739, "y": 851.0559019181164},
        {"x": 845.9827652586615, "y": 851.0559019181164}
      ],
      "labelPosition": {"x": 922.45299136153, "y": 784.2470657502761},
      "capacity": 0,
      "displayOrder": 2,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769727836867",
      "name": "PLUS DERECHA",
      "description": "",
      "color": "#1ec840",
      "polygonPoints": [
        {"x": 489.24758461393924, "y": 608.7938764938132},
        {"x": 513.5449125324321, "y": 651.0977791437073},
        {"x": 459.50430388612887, "y": 681.2550166763049},
        {"x": 564.7569483099562, "y": 863.9744444121759},
        {"x": 769.6085578296642, "y": 744.6020458456433},
        {"x": 699.3524482093832, "y": 487.32769892550715}
      ],
      "labelPosition": {"x": 582.6691258969173, "y": 672.8418102495253},
      "capacity": 0,
      "displayOrder": 3,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769728235816",
      "name": "PLUS CENTRAL",
      "description": "",
      "color": "#1EC840",
      "polygonPoints": [
        {"x": 750.2221302124099, "y": 457.32418175452744},
        {"x": 868.0815105152811, "y": 456.5489186710867},
        {"x": 868.8569011751684, "y": 521.6710176801071},
        {"x": 991.3686254373637, "y": 521.6710176801071},
        {"x": 991.3686254373637, "y": 456.5489186710867},
        {"x": 1099.9233178215873, "y": 458.0994448379681},
        {"x": 1031.688939751504, "y": 717.0373147071682},
        {"x": 813.8041643231693, "y": 714.7115254568462}
      ],
      "labelPosition": {"x": 926.9142768342309, "y": 537.9515424323622},
      "capacity": 0,
      "displayOrder": 4,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769728289095",
      "name": "PLUS IZQUIERDA",
      "description": "",
      "color": "#1EC840",
      "polygonPoints": [
        {"x": 1147.3983851522746, "y": 481.2864004828243},
        {"x": 1366.3744511389689, "y": 604.7542248826426},
        {"x": 1343.3999130682337, "y": 646.3887238081626},
        {"x": 1395.8105780420983, "y": 677.2556799081171},
        {"x": 1294.5790196679216, "y": 862.4574165078444},
        {"x": 1079.1927252547796, "y": 741.1431006731393}
      ],
      "labelPosition": {"x": 1271.1258453873795, "y": 668.8809243771217},
      "capacity": 0,
      "displayOrder": 5,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769728342922",
      "name": "PREFERENTE DERECHA",
      "description": "",
      "color": "#e7ad0d",
      "polygonPoints": [
        {"x": 271.691735105304, "y": 354.8424223087342},
        {"x": 401.4802302469815, "y": 580.242764677117},
        {"x": 682.6993033776871, "y": 416.96862628689524},
        {"x": 617.7758252175163, "y": 155.1276312440205}
      ],
      "labelPosition": {"x": 493.4117734868722, "y": 376.7953611291917},
      "capacity": 0,
      "displayOrder": 6,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769728398974",
      "name": "PREFERENTE CENTRAL",
      "description": "",
      "color": "#E7AD0D",
      "polygonPoints": [
        {"x": 1120.247856105699, "y": 386.8237458864778},
        {"x": 733.726746434553, "y": 388.22368165426235},
        {"x": 669.7796972759976, "y": 127.07088130539668},
        {"x": 1188.4208044390084, "y": 127.07088130539668}
      ],
      "labelPosition": {"x": 928.0437760638144, "y": 257.29729753788337},
      "capacity": 0,
      "displayOrder": 7,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    },
    {
      "id": "section-1769728453039",
      "name": "PREFERENTE IZQUIERDA",
      "description": "",
      "color": "#E7AD0D",
      "polygonPoints": [
        {"x": 1582.123123150405, "y": 347.44102313105344},
        {"x": 1454.9589818081763, "y": 576.1470061148934},
        {"x": 1167.777255923987, "y": 414.63386373141043},
        {"x": 1236.822325325124, "y": 153.31539219952924}
      ],
      "labelPosition": {"x": 1360.420421551923, "y": 372.88432129422165},
      "capacity": 0,
      "displayOrder": 8,
      "isActive": true,
      "hoverColor": "#0EA5E990",
      "selectedColor": "#0EA5E9B0",
      "visible": true
    }
  ]
};

// Guardar usando la API
function saveLayout() {
  const data = JSON.stringify({
    layoutId: LAYOUT_ID,
    layoutJson: layoutJson,
    version: 12, // Incrementar versión
    seats: [] // Sin asientos
  });

  const options = {
    hostname: BASE_URL,
    port: 443,
    path: `/api/venues/${VENUE_ID}/layout`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  console.log('Guardando layout en el VPS...');
  console.log('URL:', `https://${BASE_URL}/api/venues/${VENUE_ID}/layout`);

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ Layout guardado correctamente!');
      } else {
        console.log('❌ Error:', body);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Error de conexión:', e.message);
  });

  req.write(data);
  req.end();
}

saveLayout();
