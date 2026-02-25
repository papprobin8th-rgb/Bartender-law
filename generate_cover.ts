
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function generateCover() {
  const prompt = 'A cinematic, dark, moody shot of an exhausted bartender leaning on a bar counter late at night, surrounded by dirty glasses, looking cynical and tired, neon lights reflecting, realistic style, high detail, 8k.';
  const filename = 'cover.png';
  
  console.log(`Generating ${filename}...`);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
    });

    let base64Data = null;
    if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                base64Data = part.inlineData.data;
                break;
            }
        }
    }

    if (base64Data) {
      const buffer = Buffer.from(base64Data, 'base64');
      const dir = path.join(process.cwd(), 'public', 'images');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`Successfully generated and saved ${filename}`);
    } else {
      console.error('Failed to generate image: No data received');
    }
  } catch (error) {
    console.error('Error generating image:', error);
  }
}

generateCover();
