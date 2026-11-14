"""Rebuild data/osdr-pwb.js: group means of rat muscle measures after 28 days of partial
weight bearing (1 g, 0.4 g, 0 g), intact (sham-operated) animals only, from NASA OSDR.

Raw inputs (downloaded on 2026-11-14 from the NASA Open Science Data Repository, not committed):
  GRIP  OSD-652 (LSDS-76), "LSDS-76_Force Transducer_Grip_Strength_Transformed.csv"
        https://osdr.nasa.gov/geode-py/ws/studies/OSD-652/download?source=datamanager&file=LSDS-76_Force+Transducer_Grip_Strength_Transformed.csv
  PLATE OSD-616 (LSDS-61), "LSDS-61_Force Plate_Force_Plate_Transformed_Reusable_Files.csv"
        https://osdr.nasa.gov/geode-py/ws/studies/OSD-616/download?source=datamanager&file=LSDS-61_Force+Plate_Force_Plate_Transformed_Reusable_Files.csv

Usage: python3 -I tools/data/build_osdr_pwb.py GRIP PLATE data/osdr-pwb.js

Sample names end in _<sex>_<treatment>_<loading>_<time>, for example
630684_Rear_Paw_F_C_0PWB_T0; treatment N = intact (sham), C = castrated/ovariectomized
(ISA sample table of OSD-652). Only N rows are used. Per sex, loading and day: number of
animals with a value and the mean (rounded to 0.0001). Empty, "NA" or "." cells are left
out (none occur in the intact rows). Grip uses the SECOND column named max_grip_Newtons:
the file has two columns with that name and the second equals the first times 4.44822
(pounds-force to newtons), so the first appears to be in pounds-force; the script stops
if that ratio does not hold.

Written with an SI tool (Claude) and reviewed by the team.
"""
import csv
import json
import statistics
import sys
from collections import defaultdict

grip_f, plate_f, out = sys.argv[1], sys.argv[2], sys.argv[3]
LOAD = {"100PWB": 1, "40PWB": 0.4, "0PWB": 0}
groups = defaultdict(list)


def num(s):
    s = s.strip()
    return None if s in ("", "NA", ".") else float(s)


def add(name, measure, value):
    sex, treat, load, t = name.split("_")[-4:]
    if treat == "N" and value is not None:
        groups[(sex, LOAD[load], measure, int(t[1:]))].append(value)


g = list(csv.reader(open(grip_f, encoding="utf-8-sig")))
assert g[0][3] == g[0][4] == "max_grip_Newtons", g[0][:5]
for row in g[1:]:
    a, b = num(row[3]), num(row[4])
    assert a is None or b is None or abs(b - a * 4.44822) <= 1e-4 * b, row[0]
    add(row[0], "grip", b)

p = list(csv.reader(open(plate_f, encoding="utf-8-sig")))
ig = p[0].index("Girth_FootPlate_Data_Girth")
ip = p[0].index("Girth_FootPlate_Data_Max_Plantar_flexion_Newtons_times_millimeters")
for row in p[1:]:
    add(row[0], "calfGirth", num(row[ig]))
    add(row[0], "plantarflexionTorque", num(row[ip]))

ORDER = {"grip": 0, "calfGirth": 1, "plantarflexionTorque": 2}
keys = sorted(groups, key=lambda k: (k[0], -k[1], ORDER[k[2]], k[3]))
rows = [[s, l, m, d, len(groups[(s, l, m, d)]), round(statistics.mean(groups[(s, l, m, d)]), 4)] for s, l, m, d in keys]

G = "https://osdr.nasa.gov/geode-py/ws/studies/"
data = {
    "name": "Rat muscle after 28 days of partial weight bearing (NASA OSDR OSD-652 and OSD-616)",
    "source": "NASA Open Science Data Repository: OSD-652 (LSDS-76, grip force; DOI 10.26030/z92y-7b97) and OSD-616 (LSDS-61, force plate; DOI 10.26030/e0yx-ta10), the same Fischer 344 rats. Paper: Rosa-Caldwell ME et al., Influence of gonadectomy on muscle health in micro- and partial-gravity environments in rats, J Appl Physiol 2023, doi:10.1152/japplphysiol.00023.2023 (PMID 37102698).",
    "url": G + "OSD-652/download?source=datamanager&file=LSDS-76_Force+Transducer_Grip_Strength_Transformed.csv",
    "files": [
        G + "OSD-652/download?source=datamanager&file=LSDS-76_Force+Transducer_Grip_Strength_Transformed.csv",
        G + "OSD-616/download?source=datamanager&file=LSDS-61_Force+Plate_Force_Plate_Transformed_Reusable_Files.csv",
    ],
    "retrieved": "2026-11-14",
    "units": "grip: maximum rear-paw grip force, newtons (second file column named max_grip_Newtons); plantarflexionTorque: maximum plantarflexion torque, newton millimetres (column Girth_FootPlate_Data_Max_Plantar_flexion_Newtons_times_millimeters; nerve-stimulated, 200 Hz tetanus per the OSD-616 protocol); calfGirth: calf girth, unit not stated in the file (column Girth_FootPlate_Data_Girth). loadingG: 1 = full weight bearing (PWB100), 0.4 = 40% weight bearing (PWB40, Mars-gravity analog), 0 = hindlimb unloading. day: day of the 28-day loading period.",
    "processing": "Intact (sham-operated, sample code N) animals only. Per sex, loading group, measure and day: n = animals with a value, mean = arithmetic mean rounded to 0.0001. Nothing smoothed, imputed or dropped. Rebuild: python3 -I tools/data/build_osdr_pwb.py <grip csv> <force plate csv> data/osdr-pwb.js",
    "terms": "NASA OSDR data are open (NASA open science policy, https://www.nasa.gov/open/); cite the dataset DOIs 10.26030/z92y-7b97 and 10.26030/e0yx-ta10 and the paper doi:10.1152/japplphysiol.00023.2023.",
    "loadings": [1, 0.4, 0],
    "columns": ["sex", "loadingG", "measure", "day", "n", "mean"],
    "rows": rows,
}
HEAD = """/*
 * Rat muscle measures after 28 days at 1 g, 0.4 g and 0 g weight bearing (intact
 * animals, group means): real data from NASA OSDR OSD-652 and OSD-616; see
 * data/README.md. Generated by tools/data/build_osdr_pwb.py; do not edit by hand.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
"""
body = json.dumps(data, separators=(",", ":")).replace('],[', '],\n[')
with open(out, "w") as f:
    f.write(HEAD + "(function (root) {\n  'use strict';\n  var ns = (root.MyoTwin = root.MyoTwin || {});\n  var data = " + body + ";\n"
            "  (ns.data = ns.data || {}).osdrPwb = data;\n  if (typeof module === 'object' && module.exports) module.exports = data;\n"
            "})(typeof globalThis !== 'undefined' ? globalThis : this);\n")
print(len(rows), "group rows")
