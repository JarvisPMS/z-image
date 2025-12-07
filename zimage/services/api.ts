
import { DEFAULT_API_ENDPOINT, DEFAULT_MODEL_ID } from '../constants';

interface GenerateImageParams {
  prompt: string;
  apiKey: string;
  model?: string;
  n?: number;
  size?: string;
}

interface OpenAIImageResponse {
  created: number;
  data: {
    url: string;
    b64_json?: string; 
    revised_prompt?: string;
  }[];
}

interface ModelScopeErrorResponse {
  code?: string;
  message?: string;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}


export const generateImage = async ({
  prompt,
  apiKey,
  model = DEFAULT_MODEL_ID,
  n = 1,
  size = "1024x1024"
}: GenerateImageParams): Promise<string> => {
  try {
    // 1. Submit Task (Async Mode)
    const response = await fetch(DEFAULT_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-ModelScope-Async-Mode': 'true'
      },
      body: JSON.stringify({
        model,
        prompt,
        n,
        size
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Initial request failed with status ${response.status}`);
    }

    const data = await response.json();
    const taskId = data.task_id;

    if (!taskId) {
      throw new Error("Failed to retrieve task_id from API response");
    }

    // 2. Poll for Task Status
    // Also proxy this request to avoid CORS if needed, though GET requests might be more lenient.
    // To be safe, let's use the proxy for this as well.
    // The proxy is configured for /api/proxy -> https://api-inference.modelscope.cn
    // So we construct the local URL.
    const taskUrl = `/api/proxy/v1/tasks/${taskId}`;
    
    // Polling loop
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const taskResponse = await fetch(taskUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'X-ModelScope-Task-Type': 'image_generation'
            }
          });

          if (!taskResponse.ok) {
             // If polling request fails, stop and reject
             reject(new Error(`Polling failed with status ${taskResponse.status}`));
             return;
          }

          const taskData = await taskResponse.json();
          
          if (taskData.task_status === 'SUCCEED') {
             if (taskData.output_images && taskData.output_images.length > 0) {
                 resolve(taskData.output_images[0]);
             } else {
                 reject(new Error("Task succeeded but no output images found"));
             }
          } else if (taskData.task_status === 'FAILED') {
             reject(new Error("Image Generation Failed: " + (taskData.message || "Unknown error")));
          } else {
             // Still running (RUNNING, PENDING, etc.), wait and poll again
             setTimeout(poll, 2000); // Poll every 2 seconds
          }

        } catch (err) {
          reject(err);
        }
      };

      // Start polling
      poll();
    });

  } catch (error) {
    console.error("Generation Error Details:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred during image generation');
  }
};
