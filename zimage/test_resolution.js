import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually since we don't have dotenv
const loadEnv = () => {
    try {
        const envPath = path.join(__dirname, '.env.local');
        if (fs.existsSync(envPath)) {
            const data = fs.readFileSync(envPath, 'utf8');
            data.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                    process.env[key] = value;
                }
            });
        }
    } catch (err) {
        console.error('Error loading .env.local:', err);
    }
};
loadEnv();

const API_KEY = process.env.VITE_MODELSCOPE_API_KEY;

if (!API_KEY) {
    console.error("Error: VITE_MODELSCOPE_API_KEY not found in .env.local or environment variables.");
    process.exit(1);
}

const BASE_URL = "https://api-inference.modelscope.cn/v1/images/generations";
const TASK_URL = "https://api-inference.modelscope.cn/v1/tasks/";

async function testGeneration() {
    console.log("Starting 1:1 resolution test...");

    try {
        // 1. Submit Task
        console.log("Submitting task with size 1024x1024...");
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'X-ModelScope-Async-Mode': 'true'
            },
            body: JSON.stringify({
                model: "Tongyi-MAI/Z-Image-Turbo",
                prompt: "A cute cat, high quality, 1024x1024",
                n: 1,
                size: "1024x1024"
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Request Failed: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const taskId = data.task_id;
        console.log(`Task submitted. ID: ${taskId}`);

        // 2. Poll for results
        let imageUrl = null;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

            const pollResponse = await fetch(`${TASK_URL}${taskId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'X-ModelScope-Task-Type': 'image_generation'
                }
            });

            const pollData = await pollResponse.json();
            console.log(`Task Status: ${pollData.task_status}`);

            if (pollData.task_status === 'SUCCEED') {
                imageUrl = pollData.output_images[0];
                break;
            } else if (pollData.task_status === 'FAILED') {
                throw new Error(`Task Failed: ${JSON.stringify(pollData)}`);
            }
        }

        // 3. Download Image
        console.log(`Downloading image from: ${imageUrl}`);
        const imgResponse = await fetch(imageUrl);
        const buffer = await imgResponse.buffer();
        
        const outputPath = path.join(__dirname, 'test_result_1024x1024.jpg');
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`Image saved to: ${outputPath}`);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testGeneration();
