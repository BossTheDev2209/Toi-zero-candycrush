#include <cstdio>
int main() {
  std::freopen("train1.in",  "r", stdin);
  std::freopen("train1.out", "w", stdout);
  int a, b; scanf("%d %d", &a, &b);
  printf("%d\n", a + b);
  return 0;
}
