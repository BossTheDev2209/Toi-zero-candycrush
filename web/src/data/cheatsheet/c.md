# C cheat sheet

## Program shape
A C program is made of headers, functions, and statements. Execution starts at `main`.

```c
#include <stdio.h>

int main(void) {
    printf("Hello, world!\n");
    return 0;
}
```

- `#include <stdio.h>` imports standard input/output functions.
- `main` is the first function the program runs.
- `{ ... }` groups statements into a block.
- Every statement ends with `;`.
- `return 0;` means the program finished successfully.

## Comments
Comments explain code to humans. The compiler ignores them.

```c
// One-line comment

/*
   Multi-line comment
*/
```

Use comments to explain why something works, not to repeat what the line already says.

## Variables and data types
A variable has a type, a name, and a value. C needs the type before the variable name.

```c
int age = 16;
long long population = 7000000000LL;
double price = 19.95;
char grade = 'A';
```

Common types:

- `int`: whole numbers, usually about -2 billion to 2 billion.
- `long long`: bigger whole numbers, useful for sums and products.
- `double`: decimal numbers.
- `char`: one character, written with single quotes.

```c
int x;      // declared, but not initialized
x = 10;    // assigned later

int y = 20; // declared and initialized
```

Local variables are not automatically zero. Give them a value before reading them.

## Operators
Operators combine or compare values.

```c
int a = 7;
int b = 3;

printf("%d\n", a + b); // 10
printf("%d\n", a - b); // 4
printf("%d\n", a * b); // 21
printf("%d\n", a / b); // 2, integer division
printf("%d\n", a % b); // 1, remainder
```

Comparison operators produce true or false-like values:

```c
a == b  // equal
a != b  // not equal
a < b
a <= b
a > b
a >= b
```

Logical operators:

```c
if (age >= 13 && age <= 19) printf("teen\n");
if (score < 0 || score > 100) printf("invalid\n");
if (!(x == 0)) printf("not zero\n");
```

## If, else, and conditions
Use `if` when code should run only in some cases.

```c
int score = 75;

if (score >= 80) {
    printf("pass\n");
} else if (score >= 50) {
    printf("retry\n");
} else {
    printf("fail\n");
}
```

In C, `0` is false. Any nonzero value is true.

## Loops
Loops repeat code.

Use `for` when you know how many times to repeat:

```c
for (int i = 0; i < 5; i++) {
    printf("%d\n", i);
}
```

Use `while` when the stopping point depends on a condition:

```c
int x = 10;
while (x > 0) {
    printf("%d\n", x);
    x--;
}
```

`break` stops a loop. `continue` skips to the next loop step.

```c
for (int i = 1; i <= 10; i++) {
    if (i == 5) continue;
    if (i == 8) break;
    printf("%d\n", i);
}
```

## Functions
A function is a named block of reusable code. Give it inputs as parameters and return a result.

```c
int add(int a, int b) {
    return a + b;
}

int main(void) {
    int answer = add(2, 3);
    printf("%d\n", answer);
    return 0;
}
```

Use `void` when a function returns nothing.

```c
void print_line(void) {
    printf("-----\n");
}
```

## I/O
Use `scanf` and `printf` for predictable speed. Always pass addresses to `scanf`.

```c
#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);

    long long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        sum += x;
    }

    printf("%lld\n", sum);
    return 0;
}
```

## Control flow
Keep conditions explicit. In C, `0` is false and nonzero is true.

```c
int best = -1;
for (int i = 0; i < n; i++) {
    if (a[i] < 0) continue;
    if (best == -1 || a[i] > a[best]) best = i;
}

if (best == -1) {
    printf("none\n");
} else {
    printf("%d\n", best);
}
```

## Arrays and vectors
C has fixed arrays, not vectors. For TOI-level tasks, define arrays large enough for constraints.

```c
#include <stdio.h>

#define MAXN 100005

int a[MAXN];
long long pref[MAXN];

int main(void) {
    int n;
    scanf("%d", &n);
    pref[0] = 0;
    for (int i = 1; i <= n; i++) {
        scanf("%d", &a[i]);
        pref[i] = pref[i - 1] + a[i];
    }

    int l, r;
    scanf("%d %d", &l, &r);
    printf("%lld\n", pref[r] - pref[l - 1]);
    return 0;
}
```

## Strings
C strings are null-terminated character arrays. Reserve one extra byte for `'\0'`.

```c
#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main(void) {
    char s[105];
    scanf("%104s", s);

    int len = (int)strlen(s);
    for (int i = 0; i < len; i++) {
        s[i] = (char)toupper((unsigned char)s[i]);
    }

    if (strstr(s, "TOI") != NULL) printf("found\n");
    printf("%s\n", s);
    return 0;
}
```

## Sorting and searching
Use `qsort` with a comparator. For binary search, hand-write the loop to avoid off-by-one bugs.

```c
#include <stdio.h>
#include <stdlib.h>

int cmp_int(const void *pa, const void *pb) {
    int a = *(const int *)pa;
    int b = *(const int *)pb;
    return (a > b) - (a < b);
}

int lower_bound_int(int a[], int n, int x) {
    int lo = 0, hi = n;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < x) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

int main(void) {
    int a[] = {5, 1, 4, 4, 9};
    int n = 5;
    qsort(a, n, sizeof(a[0]), cmp_int);
    printf("%d\n", lower_bound_int(a, n, 4));
    return 0;
}
```

## Stack, queue, deque
Implement simple stacks and queues with arrays. For BFS, keep `head` and `tail` indexes.

```c
#define MAXN 100005

int q[MAXN], dist[MAXN];
int head = 0, tail = 0;

q[tail++] = start;
dist[start] = 0;

while (head < tail) {
    int u = q[head++];
    for (int e = first[u]; e != -1; e = next[e]) {
        int v = to[e];
        if (dist[v] != -1) continue;
        dist[v] = dist[u] + 1;
        q[tail++] = v;
    }
}
```

## Maps and sets
C has no built-in map. For small integer keys, use arrays; for sorted records, sort then scan.

```c
#include <stdio.h>
#include <string.h>

int freq[1001];

int main(void) {
    int n;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        freq[x]++;
    }
    for (int x = 0; x <= 1000; x++) {
        if (freq[x]) printf("%d %d\n", x, freq[x]);
    }
    return 0;
}
```

## Math and bit tricks
Use `long long` for sums and products. Bit masks are normal integers when `n <= 30`.

```c
long long gcd_ll(long long a, long long b) {
    while (b != 0) {
        long long r = a % b;
        a = b;
        b = r;
    }
    return a;
}

int has_bit(int mask, int bit) {
    return (mask & (1 << bit)) != 0;
}

int set_bit(int mask, int bit) {
    return mask | (1 << bit);
}
```

## Common pitfalls
Initialize arrays, check bounds, and match format specifiers to types.

```c
#include <string.h>

int used[100005];
long long dist[100005];

memset(used, 0, sizeof(used));      // ok for 0
for (int i = 0; i < n; i++) {
    dist[i] = 4000000000000000000LL; // do not memset long long to INF
}
```

- `%d` for `int`, `%lld` for `long long`, `%s` for char arrays.
- Global arrays start as zero; local arrays do not.
- Avoid deep recursion in C on large graphs unless limits are small.
