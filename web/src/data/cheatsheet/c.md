# C cheat sheet

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
