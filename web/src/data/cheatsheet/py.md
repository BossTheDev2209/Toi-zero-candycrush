# Python cheat sheet

## Program shape
A Python program is a list of statements. Python runs from top to bottom.

```python
print("Hello, world!")
```

Python uses indentation to group code blocks. Use spaces consistently.

```python
if True:
    print("inside the block")
print("outside the block")
```

Unlike C and C++, Python does not require semicolons or a `main` function for small scripts.

## Comments
Comments explain code to humans. Python ignores them.

```python
# One-line comment
```

Triple-quoted strings can span multiple lines, but they are strings, not normal comments.

```python
"""
This is often used as a long note or docstring.
"""
```

## Variables and data types
A variable name points to a value. Python figures out the type from the value.

```python
age = 16
price = 19.95
name = "Somchai"
passed = True
```

Common types:

- `int`: whole numbers, with no fixed overflow limit.
- `float`: decimal numbers.
- `str`: text.
- `bool`: `True` or `False`.
- `list`: ordered, changeable sequence.
- `tuple`: ordered, usually fixed sequence.
- `dict`: key-value table.
- `set`: unique values.

Check a value's type with `type`.

```python
x = 10
print(type(x))  # <class 'int'>
```

Use clear names. `total_score` is better than `ts` when learning.

## Operators
Operators combine or compare values.

```python
a = 7
b = 3

print(a + b)  # 10
print(a - b)  # 4
print(a * b)  # 21
print(a / b)  # 2.333...
print(a // b) # 2, integer division
print(a % b)  # 1, remainder
print(a ** b) # 343, power
```

Comparison operators:

```python
a == b  # equal
a != b  # not equal
a < b
a <= b
a > b
a >= b
```

Logical operators:

```python
if age >= 13 and age <= 19:
    print("teen")

if score < 0 or score > 100:
    print("invalid")

if not x == 0:
    print("not zero")
```

## If, elif, and else
Use `if` when code should run only in some cases.

```python
score = 75

if score >= 80:
    print("pass")
elif score >= 50:
    print("retry")
else:
    print("fail")
```

Python uses `elif`, not `else if`.

## Loops
Loops repeat code.

Use `for` to loop over a range or container:

```python
for i in range(5):
    print(i)

for x in [2, 4, 6]:
    print(x)
```

Use `while` when the stopping point depends on a condition:

```python
x = 10
while x > 0:
    print(x)
    x -= 1
```

`break` stops a loop. `continue` skips to the next loop step.

```python
for i in range(1, 11):
    if i == 5:
        continue
    if i == 8:
        break
    print(i)
```

## Functions
A function is a named block of reusable code. Give it inputs as parameters and return a result.

```python
def add(a, b):
    return a + b

answer = add(2, 3)
print(answer)
```

Functions can return nothing. In that case they return `None`.

```python
def print_line():
    print("-----")
```

Use functions to make your solution easier to test.

## I/O
Use `sys.stdin.buffer` for large input. Split all bytes when the format is simple.

```python
import sys

data = list(map(int, sys.stdin.buffer.read().split()))
n = data[0]
a = data[1:1 + n]
print(sum(a))
```

For line-based input, keep `input = sys.stdin.readline`.

```python
import sys

input = sys.stdin.readline
n = int(input())
names = [input().strip() for _ in range(n)]
print(names[0])
```

## Control flow
Python loops are clear but slower than C++. Keep nested loops within constraints.

```python
best = -1
for i, x in enumerate(a):
    if x < 0:
        continue
    if best == -1 or x > a[best]:
        best = i

if best == -1:
    print("none")
else:
    print(best)
```

## Arrays and vectors
Use lists for dynamic arrays. For grids, build independent rows, not repeated references.

```python
n, m = map(int, input().split())
grid = [list(map(int, input().split())) for _ in range(n)]

pref = [[0] * (m + 1) for _ in range(n + 1)]
for r in range(n):
    for c in range(m):
        pref[r + 1][c + 1] = (
            pref[r][c + 1] + pref[r + 1][c] - pref[r][c] + grid[r][c]
        )
```

```python
# Bad: rows share the same object.
bad = [[0] * m] * n

# Good: each row is separate.
good = [[0] * m for _ in range(n)]
```

## Strings
Strings are immutable. Build many pieces in a list, then join once.

```python
s = input().strip()
print(s[:3])
print(s.find("toi"))
print(s.upper())

out = []
for ch in s:
    if ch.isdigit():
        out.append("#")
    else:
        out.append(ch)
print("".join(out))
```

## Sorting and searching
Use `sort`, `sorted`, and `bisect`. The key function replaces most custom comparators.

```python
from bisect import bisect_left, bisect_right

a = [5, 1, 4, 4, 9]
a.sort()

x = 4
lo = bisect_left(a, x)
hi = bisect_right(a, x)
print(hi - lo)

jobs = [(3, 10), (1, 8), (2, 8)]
jobs.sort(key=lambda item: (item[1], item[0]))
```

## Stack, queue, deque
Use list as a stack. Use `collections.deque` for BFS queues and sliding windows.

```python
from collections import deque

dist = [-1] * n
q = deque([start])
dist[start] = 0

while q:
    u = q.popleft()
    for v in adj[u]:
        if dist[v] != -1:
            continue
        dist[v] = dist[u] + 1
        q.append(v)
```

```python
from collections import deque

dq = deque()
for i, x in enumerate(a):
    while dq and dq[0] <= i - k:
        dq.popleft()
    while dq and a[dq[-1]] >= x:
        dq.pop()
    dq.append(i)
    if i >= k - 1:
        print(a[dq[0]])
```

## Maps and sets
Use `dict`, `set`, `defaultdict`, and `Counter`. Sets are best for membership tests.

```python
from collections import Counter, defaultdict

words = input().split()
freq = Counter(words)
for word in sorted(freq):
    print(word, freq[word])

graph = defaultdict(list)
for _ in range(m):
    u, v = map(int, input().split())
    graph[u].append(v)
    graph[v].append(u)

seen = set()
if x not in seen:
    seen.add(x)
```

## Math and bit tricks
Python integers do not overflow, but slow huge numbers can still TLE. Use built-ins.

```python
from math import gcd, lcm, isqrt

print(gcd(24, 18))
print(lcm(12, 18))
print(isqrt(10**12))

mask = 0
mask |= 1 << 3
print(bool(mask & (1 << 3)))
print(mask.bit_count())
```

## Common pitfalls
Python passes many TOI tasks, but constant factors matter. Choose algorithms before micro-optimizing.

```python
# Fast output: collect strings.
ans = []
for x in values:
    ans.append(str(x * x))
print("\n".join(ans))

# Avoid O(n^2) membership in a list.
blocked = set(blocked_values)
for x in values:
    if x not in blocked:
        ans.append(str(x))
```

- `list.pop(0)` is O(n). Use `deque.popleft()`.
- Recursion may hit depth limits. Use iterative DFS or raise the limit carefully.
- Never use `eval` for parsing contest input.
