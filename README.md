<div align="center">

# dubcopilot

**AI 视频配音工具** —— 上传整门课程，自动转写、翻译、合成配音，一键导出带字幕的成片。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/官网-dubcopilot.com-black)](https://dubcopilot.com)

[功能特性](#功能特性) · [本地开发](#本地开发) · [自托管部署](#自托管部署) · [项目结构](#项目结构)

</div>

---

## 功能特性

- **批量课程本地化** — `/course` 批量中心一次导入 100+ 节课，转写 → 翻译 → 配音 → 导出全自动流水线，支持断点续跑
- **多种导入方式** — 本地文件夹直读（不上传、写回同目录）、YouTube 视频/播放列表、Google Drive / OneDrive 分享链接、视频直链
- **本地转写** — 浏览器内 Whisper（WebGPU 加速），音频不离开设备；自带字幕的视频直接跳过转写
- **多语言翻译** — DeepSeek 驱动，源语言自动检测，目标语言覆盖中/英/日/西等可配音语种
- **自然配音** — 豆包（火山引擎）BigTTS，任意 voice_type 自定义音色，语速自适应贴合原时长
- **灵活导出** — 写回课程目录 `_localized/` 或打包 ZIP，字幕可软挂或烧录进画面
- **隐私优先** — 无账号、无数据库：项目数据与 API 密钥全部保存在你自己的浏览器里

> 基于开源视频编辑器 [OpenCut](https://github.com/OpenCut-app/OpenCut)（MIT）二次开发，保留完整的时间轴精修能力；原始版权声明见 [LICENSE](LICENSE)。

## 本地开发

只需要 [Bun](https://bun.sh)——没有数据库、没有 Redis，克隆即跑：

```bash
bun install
bun dev:web        # → http://localhost:3000
```

DeepSeek / 豆包 TTS 的 API Key 在应用内「配音设置 → 语音/翻译凭据」里填写，仅保存在浏览器 localStorage，不经过任何服务器存储。

## 自托管部署

仓库自带单容器 `docker-compose.yml`：

```bash
docker network create dokploy-network          # 仅首次；Dokploy 服务器自带此网络
NEXT_PUBLIC_SITE_URL=https://your.domain \
  docker compose up -d --build
```

- `NEXT_PUBLIC_SITE_URL` 是**构建参数**（编译期写进前端产物），更换域名后需要重新 build
- 推荐用 [Dokploy](https://dokploy.com) 部署：新建 **Compose** 类型服务 → Compose Path `./docker-compose.yml` → Domains 绑定 `web` 服务 + 容器端口 `3000` + Let's Encrypt
- 可选环境变量 `FREESOUND_CLIENT_ID` / `FREESOUND_API_KEY`：只有「音效」搜索用到，不配也能正常运行

## 项目结构

```
apps/web/        Next.js 应用（src/dub/ 配音模块、/course 批量中心）
apps/desktop/    GPUI 桌面端（进行中）
rust/            GPU 合成器 / 特效 / WASM 绑定（发布为 opencut-wasm）
docs/            架构与子系统文档（editor/ · plans/ · specs/）
```

## WASM 本地开发

仅当你要改 `rust/wasm` 并让 web 端用本地构建（而非已发布的 `opencut-wasm` 包）时需要：

```bash
# 一次性环境：rustup + wasm-pack + cargo-watch（见 rust/scripts/setup-rust）
bun run build:wasm                 # 构建到 rust/wasm/pkg
cd rust/wasm/pkg && bun link       # 注册本地包
cd apps/web && bun link opencut-wasm
bun dev:wasm                       # 文件变更自动重建
```

切回已发布包：`cd apps/web && bun add opencut-wasm`。

## License

[MIT](LICENSE)
