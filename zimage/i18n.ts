
export const translations = {
  en: {
    title: "Z-Image-Turbo",
    subtitle: "ModelScope Inference Web Client",
    promptPlaceholder: "Describe the image you want to generate... (e.g., A futuristic cyberpunk city with neon lights, detailed, 8k)",
    modelLabel: "Model:",
    qualityLabel: "Quality:",
    ratioLabel: "Ratio:",
    generateButton: "Generate",
    creatingButton: "Creating...",
    recentGenerations: "Recent Generations",
    clearHistory: "Clear History",
    download: "Download",
    promptLabel: "Prompt:",
    apiKeyPlaceholder: "Enter ModelScope API Key",
    apiKeyError: "Please enter your ModelScope API Key first.",
    unknownError: "An unknown error occurred.",
    downloadFailed: "Download failed, trying direct link",
    footer: "Powered by ModelScope & Z-Image-Turbo | Developed by Jarvis",
    updateApiKey: "Update API Key",
    getApiKey: "Get API Key",
    saveKey: "Save Key",
    cancel: "Cancel",
    stepsTitle: "How to use:",
    steps: [
      "Get and set your ModelScope API key",
      "Enter your image prompt",
      "Select model and resolution",
      "Click Generate",
      "Download your image"
    ],
    ratios: {
      Square: "Square",
      Portrait: "Portrait",
      Landscape: "Landscape",
      Ultrawide: "Ultrawide"
    },
    qualities: {
      "Standard (SD)": "Standard (SD)",
      "High Definition (HD)": "High Definition (HD)",
      "Ultra HD (2K/4K)": "Ultra HD (2K)"
    },
    rateLimitNotice: "Public demo key may hit rate limits (429). Please set your own ModelScope API Key in the top-right.",
    configTutorial: "Setup Guide"
    ,
    chatTitle: "Chat",
    downloadApp: "Download App",
    downloadModalTitle: "Download App",
    baiduPan: "Baidu Netdisk",
    quarkPan: "Quark Netdisk",
    linkPending: "Link pending, please contact author",
    chatPromptPlaceholder: "Ask anything... (e.g., Explain cyberpunk aesthetics)",
    askButton: "Send",
    chatResult: "Response:",
    imageTab: "Image",
    chatTab: "Chat",
    clearChat: "Clear Chat"
  },
  zh: {
    title: "Z-Image-Turbo",
    subtitle: "ModelScope 推理 Web 客户端",
    promptPlaceholder: "描述你想生成的图片... (例如：未来赛博朋克城市，霓虹灯，细节丰富，8k)",
    modelLabel: "模型:",
    qualityLabel: "清晰度:",
    ratioLabel: "比例:",
    generateButton: "生成",
    creatingButton: "生成中...",
    recentGenerations: "最近生成",
    clearHistory: "清除历史",
    download: "下载",
    promptLabel: "提示词:",
    apiKeyPlaceholder: "输入 ModelScope API Key",
    apiKeyError: "请先输入您的 ModelScope API Key。",
    unknownError: "发生了未知错误。",
    downloadFailed: "下载失败，尝试直接链接",
    footer: "由 ModelScope & Z-Image-Turbo 驱动 | 由Jarvis开发",
    updateApiKey: "更新 API Key",
    getApiKey: "获取 API Key",
    saveKey: "保存 Key",
    cancel: "取消",
    stepsTitle: "使用步骤:",
    steps: [
      "获取并设置魔搭密钥",
      "输入图片提示词",
      "选择模型和分辨率",
      "点击生成",
      "下载图片"
    ],
    ratios: {
      Square: "方形 (1:1)",
      Portrait: "竖屏 (9:16)",
      Landscape: "横屏 (16:9)",
      Ultrawide: "超宽屏 (21:9)"
    },
    qualities: {
      "Standard (SD)": "标准 (SD)",
      "High Definition (HD)": "高清 (HD)",
      "Ultra HD (2K/4K)": "超清 (2K)"
    },
    rateLimitNotice: "当前演示密钥可能触发限流（429）。请在右上角设置你自己的 ModelScope API Key，以避免使用受限。",
    configTutorial: "配置教程"
    ,
    chatTitle: "对话",
    downloadApp: "下载软件",
    downloadModalTitle: "软件下载",
    baiduPan: "百度网盘",
    quarkPan: "夸克网盘",
    linkPending: "下载链接待配置，请联系作者",
    chatPromptPlaceholder: "输入你的问题...（例如：解释赛博朋克美学）",
    askButton: "发送",
    chatResult: "回复：",
    imageTab: "图片",
    chatTab: "聊天",
    clearChat: "清空对话"
  }
};

export type Language = 'en' | 'zh';

export function getSystemLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}
