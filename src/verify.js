// F13 「需核实」标记：识别 agent 在正文里标的未验证声明，渲染成可见状态 + 列表计数。
//
// 架构红线（SPEC §3 + F2 臣拟先例）：智能全在 agent 侧，门下只认一个**固定 token**并渲染。
// 零 LLM、零新数据源、零模糊匹配——只认 token 本体。
//
// 认哪两种（写侧 house rules 约定的写法，以本体出现为准）：
//   1. `【需核实】`         —— 方括号标记本体
//   2. `需核实：` / `需核实:` —— 后面紧跟中/英文冒号的说明式，也算一处
// 除此之外一概不认（「需核实吗」这种疑问句、散落的「需核实」二字都不算），免得误报冲淡信号。
export const VERIFY_RE = /【需核实】|需核实[：:]/g;

// 围栏识别照抄 `folder-body.js`：代码块里的 token 是示例不是声明，认错一次会把计数与角标全带偏。
const FENCE_RE = /^ {0,3}(?:```|~~~)/;

// 行内代码里的 token（`【需核实】`）同样是示例——先把 `...` 之间的内容剥掉再数。
// 只按成对反引号剥，落单的反引号原样留着（CommonMark 也不把它当代码起手）。
const stripInlineCode = (line) => line.replace(/`[^`]*`/g, '');

/**
 * 数一段文本里的「需核实」标记数。围栏块内、行内代码内都不算。
 * 纯函数，无 DOM 依赖——列表计数与单测都走它，是「什么算什么不算」的唯一事实源。
 */
export function countVerifyMarkers(text) {
  if (!text) return 0;
  let inFence = false;
  let n = 0;
  for (const raw of String(text).split('\n')) {
    if (FENCE_RE.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = stripInlineCode(raw).match(VERIFY_RE);
    if (m) n += m.length;
  }
  return n;
}

// 渲染后 DOM 处理（**不碰 render.js 的 html:false**）：遍历文本节点，把 token 包成
// `<span class="verify-marker">` —— 虚线下划线由 CSS 给，附一个小角标（tooltip 说明未验证）。
// 全程 createTextNode / createElement，不引入任何原始 HTML 注入路径。
//
// 跳过 <code>/<pre>：与 countVerifyMarkers 的围栏/行内代码规则对齐，渲染出来的代码块里
// 出现的 token 不加标记，读者看到的可见标记数与列表角标数才一致。
export function decorateVerifyMarkers(root, tip = 'AI 标注的未验证声明，看到请自行核实') {
  if (!root) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.includes('需核实')) return NodeFilter.FILTER_REJECT;
      for (let p = node.parentNode; p && p !== root; p = p.parentNode) {
        const tag = p.nodeName;
        if (tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets = [];
  let cur = walker.nextNode();
  while (cur) { targets.push(cur); cur = walker.nextNode(); }

  let count = 0;
  for (const node of targets) {
    const text = node.nodeValue;
    VERIFY_RE.lastIndex = 0;
    let m;
    let last = 0;
    const frag = document.createDocumentFragment();
    let hit = false;
    while ((m = VERIFY_RE.exec(text))) {
      hit = true;
      count++;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement('span');
      span.className = 'verify-marker';
      span.title = tip;
      span.appendChild(document.createTextNode(m[0]));
      const tag = document.createElement('sup');
      tag.className = 'verify-tag';
      tag.setAttribute('aria-hidden', 'true');
      tag.textContent = '?';
      span.appendChild(tag);
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (hit) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }
  return count;
}
