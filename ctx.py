#!/usr/bin/env python3
"""ctx.py FILE PATTERN [before] [after] — print context windows around regex matches."""
import re, sys
path, pat = sys.argv[1], sys.argv[2]
before = int(sys.argv[3]) if len(sys.argv) > 3 else 150
after = int(sys.argv[4]) if len(sys.argv) > 4 else 400
text = open(path, encoding='utf-8', errors='replace').read()
n = 0
for m in re.finditer(pat, text, re.IGNORECASE):
    s = max(0, m.start()-before); e = min(len(text), m.end()+after)
    print(f"--- @{m.start()}")
    print(text[s:e].replace('\n', ' '))
    n += 1
    if n >= 8: break
if n == 0: print("(no match)")
