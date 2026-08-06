// 回到顶部 / 回到底部（长折的救生圈）。
// PAIN 2026-08-05 #86：正文 189 行，读到中段想回去看前面一节只能靠滚轮磨。
// 大纲栏 1500px 以下压根不出（`.toc` 的媒体查询），那一档屏幕上连一个抓手都没有。
import { html, useState, useEffect } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';

// 谁在滚：宽屏是 `.work`（侧栏/顶栏钉死，只有版心动）；≤900px 的手机壳里 `.work` 改成
// overflow:visible、滚的是整页。**用「量得出溢出」来判，不复刻 CSS 断点**——
// 复刻的那份不会跟着断点改，只会静默指错元素（滚了个不动的容器，按钮看着像坏了）。
export function scroller() {
  const work = document.querySelector('.work');
  if (work && work.scrollHeight - work.clientHeight > 4) return work;
  return document.scrollingElement || document.documentElement;
}

// 够长才出这对按钮：短折上它们是噪音不是导航。600px ≈ 半屏多一点。
// ⚠️ **这一支冒烟盖不到**：demo 折跑到后半程时，展开的判/串/折首说明本身就撑过 600px，
// 换到三行的 guide 篇照样溢出 2700px，够不着「短」的那一侧。只人工验过（1440×900 真 Chrome）。
const MIN_OVERFLOW = 600;

// 两个钮**常驻**，不跟着滚动位置置灰。置灰要连续跟踪 scrollTop（scroll 监听 + rAF 去抖），
// 换来的只是一点提示，而在顶端点「回到顶部」本来就无害。少一条高频事件链，也少一处会漂的状态。
// （附带的好处：headless 冒烟里 `.work` 的 scroll 事件根本不派发，靠它驱动的状态在闸门下
//  永远测不着——那种「跑得过但没被验过」的代码正是这套测试要防的东西。）
//
// tick：换折/换篇时由调用方递一个新值，逼这只 effect 重新量一次。
// 不靠「组件重渲染时顺手量」——量高度要读布局，挂在渲染路径上是每帧一次的强制回流。
export function ScrollEnds({ tick }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const host = scroller();
      setShow(host.scrollHeight - host.clientHeight > MIN_OVERFLOW);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();

    // 高度往往在挂载**之后**才定下来：图片是异步 hydrate 的，批注卡也会撑高右缘。
    // 少了这只观察器，「加载完才够长」的那一篇要等到下次换篇才等到按钮。
    const work = document.querySelector('.work');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(kick) : null;
    if (ro && work?.firstElementChild) ro.observe(work.firstElementChild);

    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tick]);

  if (!show) return null;

  // 瞬时，不平滑：顶/底是「传送」不是「平移」，目的地毫无歧义；平滑滚过十几屏反而更晕，
  // 也让冒烟闸门有确定结果（平滑滚动在 headless 的虚拟时间里落不了地）。
  const to = (top) => scroller().scrollTo({ top });

  return html`
    <div class="scroll-ends">
      <button class="scroll-end" title=${S.jump.toTop} aria-label=${S.jump.toTop}
        onClick=${() => to(0)}>↑</button>
      <button class="scroll-end" title=${S.jump.toBottom} aria-label=${S.jump.toBottom}
        onClick=${() => to(scroller().scrollHeight)}>↓</button>
    </div>`;
}
