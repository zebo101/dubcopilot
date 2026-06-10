// Translation prompt for DeepSeek — encodes the "code-subtitle" skill's
// three-role rewriting method + code-protection rules, parameterized by the
// TARGET LANGUAGE so the same pipeline can dub into any supported language.
// The EN→zh glossary is only injected for Chinese targets.

const ZH_GLOSSARY = `function=函数 variable=变量 constant=常量 array=数组 object=对象 class=类 method=方法 property=属性 parameter=参数 argument=参数 return value=返回值 type=类型 instance=实例 module=模块 package=包 library=库 framework=框架 interface=接口 implementation=实现 inheritance=继承 dependency=依赖 reference=引用 exception=异常 error=错误 debug=调试 log=日志
component=组件 state=状态 props=props[KEEP] hook=Hook[KEEP] effect=副作用 render=渲染 lifecycle=生命周期 event=事件 callback=回调 promise=Promise[KEEP] async=异步 await=等待 DOM=DOM[KEEP] virtual DOM=虚拟DOM JSX=JSX[KEEP] selector=选择器 responsive=响应式 layout=布局 route=路由 middleware=中间件 endpoint=端点 API=API[KEEP] request=请求 response=响应 hydration=水合 server-side rendering=服务端渲染 bundle=打包 lazy loading=懒加载
server=服务器 client=客户端 database=数据库 query=查询 schema=模式 migration=迁移 cache=缓存 session=会话 token=令牌 authentication=认证 authorization=授权 hash=哈希 container=容器 proxy=代理 protocol=协议 stream=流 buffer=缓冲区 concurrency=并发
algorithm=算法 data structure=数据结构 recursion=递归 iteration=迭代 complexity=复杂度 optimization=优化 dynamic programming=动态规划
deploy=部署 build=构建 compile=编译 runtime=运行时 environment=环境 repository=仓库 branch=分支 commit=提交 pull request=合并请求 version=版本 rollback=回滚`;

const DEFAULT_TARGET_LABEL = "简体中文";

function isChineseTarget(label: string): boolean {
	return label.includes("中文");
}

function buildSystemPrompt({ targetLabel }: { targetLabel: string }): string {
	const glossaryBlock = isChineseTarget(targetLabel)
		? `\n术语表（用于保持一致，[KEEP] 表示保留英文；格式 英文=中文）：\n${ZH_GLOSSARY}\n`
		: "";
	return `你是一名资深「编程教学视频字幕翻译」专家，目标语言是【${targetLabel}】。内部按三角色流水线工作：重写译者（按意思重写初稿，不照搬原文语序）→ 批判审校（揪出生硬直译、术语不一致、代码泄漏）→ 定稿编辑（产出自然终稿）。把翻译当作「重写」：忠于含义、不忠于字面。

核心改写规则：
- 按【${targetLabel}】的自然语序与表达习惯重写：拆成短句、避免直译腔。
- 译文要符合目标语言母语者的口语习惯。字幕要简洁——观众边看代码边读。问句保持问句、命令保持命令。

代码保护（最高优先级，违反则字幕作废）——以下一律保留原文（英文）、绝不翻译：
反引号包裹的内容、缩进代码块、标识符（变量/函数/类/类型名）、关键字（if/else/for/return/async/await/import/export/const/let/class/function 等）、CLI 命令（npm install / git clone 等）、文件路径、协议/格式名（REST/JSON/JSX/HTML/CSS/DOM）、库与框架名（React/Vue/Next.js 等）、屏幕上出现的 UI 文案与报错、版本号与命令行参数（--save / v18.2.0 / -p 3000）。
例：「So we call useState here」→ 译文中 useState 保持原样，不意译。
${glossaryBlock}
输出要求：
- 只翻译每条的自然语言部分，代码 token 原样保留。
- 不增不减信息；整段字幕术语前后一致。
- 【数量与 id 必须完全对齐】输入有几条，就必须返回几条，一条都不能漏；每条的 id 原样照抄、不得改写或合并；text 不得为空。
- 严格返回 JSON 对象：{"translations":[{"id":"<原id>","text":"<${targetLabel}译文>"}]}，不要任何额外文字或解释。`;
}

export interface TranslateItem {
	id: string;
	text: string;
}

export function buildTranslateMessages({
	items,
	targetLabel = DEFAULT_TARGET_LABEL,
}: {
	items: TranslateItem[];
	targetLabel?: string;
}): { role: "system" | "user"; content: string }[] {
	const user = `把下面的字幕逐条翻译为${targetLabel}，按上述规则${
		isChineseTarget(targetLabel) ? "与术语表" : ""
	}。仅返回 JSON。\n\n${JSON.stringify({ items }, null, 0)}`;
	return [
		{ role: "system", content: buildSystemPrompt({ targetLabel }) },
		{ role: "user", content: user },
	];
}
