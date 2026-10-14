# diff 块

```diff
@@ -1,4 +1,5 @@
 上下文行
-删掉的行
+新增的行
+<script>alert(1)</script>

 空行之后的上下文
@@ -20,2 +21,2 @@ function foo() {
-  return 1;
+  return 2;
```

info 首词是 diff、后面还有别的：

```diff js
-a
+b
```

不是 diff 的 patch 语言：

```patch
-a
+b
```

结尾段落。
