

// ModelScope endpoints
// Using the local proxy to bypass CORS issues
export const DEFAULT_API_ENDPOINT = "/api/proxy/v1/images/generations";

// The specific model ID for Z-Image-Turbo on ModelScope
export const DEFAULT_MODEL_ID = "Tongyi-MAI/Z-Image-Turbo";

export const AVAILABLE_MODELS = [
  { id: "Tongyi-MAI/Z-Image-Turbo", label: "Z-Image-Turbo (Fast)" },
  { id: "Qwen/Qwen-Image", label: "Qwen-Image" },
  { id: "KookYan/Kook_Qwen_zshx_v2", label: "真实幻想V2" },
  { id: "MAILAND/majicflus_v1", label: "麦橘超然" },
  { id: "merjic/majicbeauty-qwen1", label: "麦橘千问美人" },
  { id: "MusePublic/majicMIX_realistic", label: "麦橘写实" },
  { id: "WANGMOON/MAJICFLUS-photo", label: "麦橘光影约拍" },
  { id: "yiwanji/FLUX_xiao_hong_shu_ji_zhi_zhen_shi_V2", label: "FLUX小红书极致真实V2" },
  { id: "MusePublic/46_ckpt_SD_XL", label: "亚洲人像" }
];

export const DEEPSEEK_MODEL_ID = "deepseek-ai/DeepSeek-V3.2";
export const DEFAULT_CHAT_ENDPOINT = "/api/proxy/v1/chat/completions";
export const DEFAULT_MAX_CHAT_TOKENS = 1024;

export const CHAT_MODELS = [
  { id: DEEPSEEK_MODEL_ID, label: "DeepSeek-V3.2" },
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", label: "Qwen3-235B-A22B-Instruct-2507" }
];

export const DEFAULT_SYSTEM_PROMPT = "回答要简短，不要长篇大论，直接给答案。你的设定是钢铁侠的助手甲维斯。";

export const DEFAULT_CHAT_MODEL_ID = "Qwen/Qwen3-235B-A22B-Instruct-2507";

export const LOCAL_STORAGE_KEY_API_KEY = "z_image_turbo_api_key";

export const DOWNLOAD_LINKS = {
  baidu: "https://pan.baidu.com/s/1KzrOTMeoGrJsIZIELTMpHA?pwd=tony",
  quark: "https://pan.quark.cn/s/79a8960bab96?pwd=XC2B"
};

export interface ResolutionOption {
  label: string;
  value: string;
  width: number;
  height: number;
}

export interface ResolutionGroup {
  name: string;
  options: ResolutionOption[];
}

export const RESOLUTION_GROUPS: ResolutionGroup[] = [
  {
    name: "Standard (SD)",
    options: [
      { label: "1:1 (512x512)", value: "512x512", width: 512, height: 512 },
      { label: "3:4 (768x1024)", value: "768x1024", width: 768, height: 1024 },
      { label: "4:3 (640x480)", value: "640x480", width: 640, height: 480 },
      { label: "16:9 (640x360)", value: "640x360", width: 640, height: 360 },
      { label: "9:16 (360x640)", value: "360x640", width: 360, height: 640 },
      { label: "3:2 (720x480)", value: "720x480", width: 720, height: 480 },
      { label: "2:3 (480x720)", value: "480x720", width: 480, height: 720 },
      { label: "21:9 (840x360)", value: "840x360", width: 840, height: 360 },
    ]
  },
  {
    name: "High Definition (HD)",
    options: [
      { label: "1:1 (1024x1024)", value: "1024x1024", width: 1024, height: 1024 },
      { label: "3:4 (1152x1536)", value: "1152x1536", width: 1152, height: 1536 },
      { label: "4:3 (1280x960)", value: "1280x960", width: 1280, height: 960 },
      { label: "16:9 (1600x900)", value: "1600x900", width: 1600, height: 900 },
      { label: "9:16 (900x1600)", value: "900x1600", width: 900, height: 1600 },
      { label: "3:2 (1536x1024)", value: "1536x1024", width: 1536, height: 1024 },
      { label: "2:3 (1024x1536)", value: "1024x1536", width: 1024, height: 1536 },
      { label: "21:9 (1680x720)", value: "1680x720", width: 1680, height: 720 },
    ]
  },
  {
    name: "Ultra HD (2K/4K)",
    options: [
      { label: "1:1 (2048x2048)", value: "2048x2048", width: 2048, height: 2048 },
      { label: "3:4 (1536x2048)", value: "1536x2048", width: 1536, height: 2048 },
      { label: "4:3 (2048x1536)", value: "2048x1536", width: 2048, height: 1536 },
      { label: "16:9 (2048x1152)", value: "2048x1152", width: 2048, height: 1152 },
      { label: "9:16 (1152x2048)", value: "1152x2048", width: 1152, height: 2048 },
      { label: "3:2 (2048x1365)", value: "2048x1365", width: 2048, height: 1365 },
      { label: "2:3 (1365x2048)", value: "1365x2048", width: 1365, height: 2048 },
      { label: "21:9 (2048x876)", value: "2048x876", width: 2048, height: 876 },
    ]
  }
];

// Keep for backward compatibility or default selection
export const DEFAULT_RESOLUTION = RESOLUTION_GROUPS[1].options[0]; // HD Square
