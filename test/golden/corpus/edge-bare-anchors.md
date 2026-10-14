# 裸锚边角

<a id="daily"></a>

## 每日

段落里夹一个 <a name="mid"></a>裸锚，前后文字照常。

<a name='single'/>
单引号自闭合裸锚在段首。

<a id=noquote>

带文字的 a 不剥：<a href="https://example.com">看得见的链接文字</a>

<a id="x" class="y"></a> 多属性的不算裸锚（正则只认单个 id/name）。

```
<a id="in-code"></a> 代码块里的裸锚也会被剥（预处理在解析前，不认代码块）
```

结尾。
