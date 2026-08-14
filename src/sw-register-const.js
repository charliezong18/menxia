// kill-switch 标志文件的位置。sw-register.js 与 sw.js 共用同一个值（改一处即可）。
// 相对 './' 跟随部署目录（/menxia/）。拨法：把这个文件内容改成 {"kill": true} 推 main。
// 详见 README「离线包 · kill-switch」。
export const KILL_SWITCH_URL = './menxia-sw-kill.json';
