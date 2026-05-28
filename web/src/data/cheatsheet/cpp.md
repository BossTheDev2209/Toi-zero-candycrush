# C++ cheat sheet

## Program shape
A C++ program is made of headers, functions, and statements. Execution starts at `main`.

```cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, world!\n";
    return 0;
}
```

- `#include <iostream>` imports `cin` and `cout`.
- `using namespace std;` lets you write `cout` instead of `std::cout`.
- `main` is where the program starts.
- `{ ... }` groups statements into a block.
- Every statement ends with `;`.

For contests, many people use this header because it includes most standard libraries:

```cpp
#include <bits/stdc++.h>
using namespace std;
```

## Comments
Comments explain code to humans. The compiler ignores them.

```cpp
// One-line comment

/*
   Multi-line comment
*/
```

Use comments for intent, edge cases, or formulas that are not obvious.

## Variables and data types
A variable stores a value. C++ needs a type before the variable name.

```cpp
int age = 16;
long long population = 7000000000LL;
double price = 19.95;
char grade = 'A';
bool passed = true;
string name = "Somchai";
```

Common types:

- `int`: whole numbers, usually about -2 billion to 2 billion.
- `long long`: bigger whole numbers, useful for sums and products.
- `double`: decimal numbers.
- `char`: one character, written with single quotes.
- `bool`: `true` or `false`.
- `string`: text, written with double quotes.

```cpp
int x;      // declared, but not initialized
x = 10;    // assigned later

int y = 20; // declared and initialized
```

Local variables are not automatically zero. Initialize them before use.

## Operators
Operators combine or compare values.

```cpp
int a = 7;
int b = 3;

cout << a + b << '\n'; // 10
cout << a - b << '\n'; // 4
cout << a * b << '\n'; // 21
cout << a / b << '\n'; // 2, integer division
cout << a % b << '\n'; // 1, remainder
```

Comparison operators:

```cpp
a == b  // equal
a != b  // not equal
a < b
a <= b
a > b
a >= b
```

Logical operators:

```cpp
if (age >= 13 && age <= 19) cout << "teen\n";
if (score < 0 || score > 100) cout << "invalid\n";
if (!(x == 0)) cout << "not zero\n";
```

## If, else, and conditions
Use `if` when code should run only in some cases.

```cpp
int score = 75;

if (score >= 80) {
    cout << "pass\n";
} else if (score >= 50) {
    cout << "retry\n";
} else {
    cout << "fail\n";
}
```

Conditions should usually be explicit. Avoid clever one-line logic until the basic form feels easy.

## Loops
Loops repeat code.

Use `for` when you know how many times to repeat:

```cpp
for (int i = 0; i < 5; i++) {
    cout << i << '\n';
}
```

Use `while` when the stopping point depends on a condition:

```cpp
int x = 10;
while (x > 0) {
    cout << x << '\n';
    x--;
}
```

Use range-for to read every value in a container:

```cpp
vector<int> a = {2, 4, 6};
for (int x : a) {
    cout << x << '\n';
}
```

`break` stops a loop. `continue` skips to the next loop step.

## Functions
A function is a named block of reusable code. Give it inputs as parameters and return a result.

```cpp
int add(int a, int b) {
    return a + b;
}

int main() {
    int answer = add(2, 3);
    cout << answer << '\n';
}
```

Use `void` when a function returns nothing.

```cpp
void printLine() {
    cout << "-----\n";
}
```

Use `const` reference when passing a large object that the function should not change.

```cpp
int sumVector(const vector<int>& values) {
    int total = 0;
    for (int x : values) total += x;
    return total;
}
```

## I/O
Use fast I/O for almost every TOI task. Read with `cin`, print with `'\n'`, and avoid `endl` unless you really need a flush.

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<int> a(n);
    for (int &x : a) cin >> x;

    long long sum = 0;
    for (int x : a) sum += x;
    cout << sum << '\n';
}
```

## Control flow
Prefer simple loops and early `continue` for casework. This keeps edge cases visible.

```cpp
int best = -1;
for (int i = 0; i < n; i++) {
    if (a[i] < 0) continue;
    if (best == -1 || a[i] > a[best]) best = i;
}

switch (best == -1 ? 0 : 1) {
    case 0: cout << "none\n"; break;
    case 1: cout << best << '\n'; break;
}
```

## Arrays and vectors
Use `vector` when size is input-dependent. Reserve before many pushes when you know the final size.

```cpp
int n, m;
cin >> n >> m;

vector<vector<int>> grid(n, vector<int>(m));
for (int r = 0; r < n; r++) {
    for (int c = 0; c < m; c++) cin >> grid[r][c];
}

vector<int> odds;
odds.reserve(n * m);
for (auto &row : grid) {
    for (int x : row) if (x % 2) odds.push_back(x);
}
```

## Strings
`string` supports indexing, slicing, searching, and conversion. Check bounds before indexing.

```cpp
string s;
cin >> s;

string first3 = s.substr(0, min<int>(3, s.size()));
size_t pos = s.find("toi");
if (pos != string::npos) cout << "found at " << pos << '\n';

for (char &ch : s) ch = char(toupper((unsigned char)ch));
cout << s << '\n';

int value = stoi("12345");
string back = to_string(value);
```

## Sorting and searching
Sort before binary search. `lower_bound` gives first position where value could be inserted.

```cpp
vector<int> a = {5, 1, 4, 4, 9};
sort(a.begin(), a.end());

int x = 4;
auto lo = lower_bound(a.begin(), a.end(), x);
auto hi = upper_bound(a.begin(), a.end(), x);
cout << "count=" << (hi - lo) << '\n';

vector<pair<int, int>> jobs = {{3, 10}, {1, 8}, {2, 8}};
sort(jobs.begin(), jobs.end(), [](auto lhs, auto rhs) {
    if (lhs.second != rhs.second) return lhs.second < rhs.second;
    return lhs.first < rhs.first;
});
```

## Stack, queue, deque
Use `stack` for last-in-first-out, `queue` for BFS, and `deque` for sliding windows.

```cpp
queue<int> q;
vector<int> dist(n, -1);
q.push(start);
dist[start] = 0;

while (!q.empty()) {
    int u = q.front();
    q.pop();
    for (int v : adj[u]) {
        if (dist[v] != -1) continue;
        dist[v] = dist[u] + 1;
        q.push(v);
    }
}
```

```cpp
deque<int> dq; // indexes, increasing values
for (int i = 0; i < n; i++) {
    while (!dq.empty() && dq.front() <= i - k) dq.pop_front();
    while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
    dq.push_back(i);
    if (i >= k - 1) cout << a[dq.front()] << '\n';
}
```

## Maps and sets
Use ordered containers when you need sorted keys. Use unordered containers for average fast lookup.

```cpp
map<string, int> freq;
for (int i = 0; i < n; i++) {
    string word;
    cin >> word;
    freq[word]++;
}

for (auto &[word, count] : freq) {
    cout << word << ' ' << count << '\n';
}

unordered_set<int> seen;
if (!seen.count(x)) seen.insert(x);
```

## Math and bit tricks
Promote to `long long` before multiplication. Bits are useful for masks and parity.

```cpp
long long gcd_ll(long long a, long long b) {
    while (b) {
        long long r = a % b;
        a = b;
        b = r;
    }
    return a;
}

long long lcm_ll(long long a, long long b) {
    return a / gcd_ll(a, b) * b;
}

int mask = 0;
mask |= (1 << 3);          // set bit 3
bool on = mask & (1 << 3); // test bit 3
int bits = __builtin_popcount((unsigned)mask);
```

## Common pitfalls
Check limits before choosing `int`, recursion, or nested loops. Most WA/TLE bugs come from one hidden bound.

```cpp
// Overflow-safe product comparison: a * b <= limit
bool product_leq(long long a, long long b, long long limit) {
    if (a == 0 || b == 0) return true;
    return a <= limit / b;
}

// Inclusive ranges often need <=, but vector indexes usually need <.
for (int i = 0; i < (int)a.size(); i++) {
    // safe index
}
```

- Use `long long` when products or sums may exceed about 2 * 10^9.
- `endl` flushes output and can cause TLE. Use `'\n'`.
- Clear global arrays between test cases when the judge gives multiple cases.
