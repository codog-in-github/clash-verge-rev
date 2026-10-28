<h1 align="center">
  <img src="./src-tauri/icons/icon.png" alt="Clash" width="128" />
  <br>
  Continuation of <a href="https://github.com/zzzgydi/clash-verge">Clash Verge</a>
  <br>
</h1>

<h3 align="center">
基于 <a href="https://github.com/tauri-apps/tauri">Tauri 2</a> 与 Mihomo 的跨平台代理客户端，提供重新设计的连接、节点、订阅和活动界面。
</h3>

<p align="center">
  Languages:
  <a href="./docs/README_en.md">English</a> ·
  <a href="./docs/README_es.md">Español</a> ·
  <a href="./docs/README_fa.md">فارسی</a> ·
  <a href="./docs/README_ja.md">日本語</a> ·
  <a href="./docs/README_ko.md">한국어</a> ·
  <a href="./docs/README_pt.md">Português</a> ·
  <a href="./docs/README_ru.md">Русский</a> ·
  <a href="./README.md">简体中文</a>
</p>

## 界面改版

本仓库基于 Clash Verge Rev，围绕连接状态、节点切换和流量排查重新组织界面，支持深色与浅色主题，并保留配置增强、系统代理、TUN 和诊断工具。

| 界面 | 主要功能 |
| --- | --- |
| 连接 | 连接总开关、代理模式与接管方式切换，查看流量路径、实时流量、出口 IP 和订阅用量，快速切换节点。 |
| 节点 | 按策略组浏览节点，搜索、排序和测速，并可切换到原有列表视图。 |
| 订阅 | 卡片式管理订阅，查看用量与更新时间，编辑 Merge 和 Script 扩展。 |
| 活动 | 在连接、日志和规则之间切换；查看连接详情与命中链路，复制主机名、关闭连接，或将精确域名规则写入当前订阅的规则扩展。 |
| 搜索与命令 | 使用 `⌘K` / `Ctrl+K` 搜索节点、订阅和操作，快速跳转或执行命令。 |
| 托盘快捷面板 | 在小窗口中切换节点与代理模式、测速、控制连接和 TUN，并打开主窗口。 |

## Preview

以下为上游原版界面截图，尚未更新为本仓库的改版界面。

| Dark                             | Light                             |
| -------------------------------- | --------------------------------- |
| ![预览](./docs/preview_dark.png) | ![预览](./docs/preview_light.png) |

## Install

以下链接指向上游发行版，不包含本仓库的界面改动。体验改版请从本仓库源码构建，参见 [Development](#development) 和 [构建说明](./CONTRIBUTING.md#build-the-project)。

请到发布页面下载对应的安装包：[Release page](https://github.com/clash-verge-rev/clash-verge-rev/releases)<br>
Go to the [Release page](https://github.com/clash-verge-rev/clash-verge-rev/releases) to download the corresponding installation package<br>
Supports Windows (x64/x86), Linux (x64/arm64) and macOS 11+ (intel/apple).
支持 Windows (x64/x86)、Linux (x64/arm64) 和 macOS 11+ (intel/apple)。

#### 我应当怎样选择发行版

| 版本        | 特征                                     | 链接                                                                                   |
| :---------- | :--------------------------------------- | :------------------------------------------------------------------------------------- |
| Stable      | 正式版，高可靠性，适合日常使用。         | [Release](https://github.com/clash-verge-rev/clash-verge-rev/releases)                 |
| Alpha(废弃) | 测试发布流程。                           | [Alpha](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/alpha)         |
| AutoBuild   | 滚动更新版，适合测试反馈，可能存在缺陷。 | [AutoBuild](https://github.com/clash-verge-rev/clash-verge-rev/releases/tag/autobuild) |

#### 安装说明和常见问题，请到 [文档页](https://clash-verge-rev.github.io/) 查看

### TG 频道: [@clash_verge_rev](https://t.me/clash_verge_re)

---

## Promotion

### ✈️ [AI云边 -- 全新架构机场 ClaudeBorder](https://cruise.54678999.xyz/#/register?code=58q5UJZc)

🔥热销中使用本链接注册即送 **3 天免费试用**，每日 **1GB 流量**：👉 [点此注册](https://cruise.54678999.xyz/#/register?code=58q5UJZc)

#### AI云边 -- 全新架构机场。

- 💻 多次**技术迭代后**全新亮相。
- 🗺 全**高速稳定**正价节点。
- 🌏 **海外团队**，不跑路
- 🚀 线路**冗余**设计，**自动化运维**对抗各类封锁
- 👨‍🦲 团队架构师为**大厂**网络架构师
- 💰 极致**稳定**，亲民价**价格**
- 🌐 全面支持**流媒体及各AI访问**
- 🙋 7*12小时真人客服。解决您的各类问题。

🌐 官网：👉 [https://www.claudeborder.com](https://cruise.54678999.xyz/#/register?code=58q5UJZc)

### 🤖 [GPTKefu —— 与 Crisp 深度整合的 AI 智能客服平台](https://gptkefu.com)

- 🧠 深度理解完整对话上下文 + 图片识别，自动给出专业、精准的回复，告别机械式客服。
- ♾️ **不限回答数量**，无额度焦虑，区别于其他按条计费的 AI 客服产品。
- 💬 售前咨询、售后服务、复杂问题解答，全场景轻松覆盖，真实用户案例已验证效果。
- ⚡ 3 分钟极速接入，零门槛上手，即刻提升客服效率与客户满意度。
- 🎁 高级套餐免费试用 14 天，先体验后付费：👉 [立即试用](https://gptkefu.com)
- 📢 智能客服TG 频道：[@crisp_ai](https://t.me/crisp_ai)

---

## Features

- 基于性能强劲的 Rust 和 Tauri 2 框架
- 内置[Clash.Meta(mihomo)](https://github.com/MetaCubeX/mihomo)内核，并支持切换 `Alpha` 版本内核。
- 统一的深浅主题与卡片式界面，提供连接总览、节点浏览、订阅管理、活动详情、命令面板和托盘快捷控制。
- 支持自定义主题颜色、代理组/托盘图标以及 `CSS Injection`。
- 配置文件管理和增强（Merge 和 Script），配置文件语法提示。
- 系统代理和守卫、`TUN(虚拟网卡)` 模式。
- 可视化节点和规则编辑
- WebDav 配置备份和同步

### FAQ

Refer to [Doc FAQ Page](https://clash-verge-rev.github.io/faq/windows.html)

### Donation

[捐助Clash Verge Rev的开发](https://github.com/sponsors/clash-verge-rev)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

To run the development server, execute the following commands after all prerequisites for **Tauri** are installed:

```shell
pnpm i
pnpm run prebuild
pnpm dev
```

`pnpm dev` preserves the Development Channel's installed service state: an
existing service is used, while a previously uninstalled service remains
uninstalled and the app starts in Sidecar mode. Use `pnpm dev:service` to
explicitly install or update the isolated development service before launch,
or `pnpm dev:sidecar` to force the unprivileged Sidecar workflow.

## Contributions

Issue and PR welcome!

## Acknowledgement

Clash Verge rev was based on or inspired by these projects and so on:

- [zzzgydi/clash-verge](https://github.com/zzzgydi/clash-verge): A Clash GUI based on tauri. Supports Windows, macOS and Linux.
- [tauri-apps/tauri](https://github.com/tauri-apps/tauri): Build smaller, faster, and more secure desktop applications with a web frontend.
- [Dreamacro/clash](https://github.com/Dreamacro/clash): A rule-based tunnel in Go.
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo): A rule-based tunnel in Go.
- [Fndroid/clash_for_windows_pkg](https://github.com/Fndroid/clash_for_windows_pkg): A Windows/macOS GUI based on Clash.
- [vitejs/vite](https://github.com/vitejs/vite): Next generation frontend tooling. It's fast!

## Privacy

Clash Verge Rev 不收集任何用户数据，配置与日志仅保存在本地。详见[隐私政策](./PRIVACY.md)。

Clash Verge Rev does not collect any user data; configuration and logs stay on
your own device. See the [Privacy Policy](./PRIVACY.md) for details.

## License

GPL-3.0 License. See [License here](./LICENSE) for details.
