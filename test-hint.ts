import { GoogleGenAI } from "@google/genai";
async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const vin = "VF3LRHNYWFS343639";
  const prompt = `You are an expert automotive VIN and Chassis decoder for ALL world vehicles.
Analyze this VIN / Frame / Chassis number: ${vin}.

CRITICAL INSTRUCTIONS FOR ACCURACY:
- Pay extreme attention to exact OEM VIN structures. 
- For Peugeot/Citroen (PSA), the 4th and 5th characters strictly define the model and body style. (e.g. For Peugeot, VF3L... is 308, VF3M... is 3008, VF3C... is 208, VF38... is 508, etc.). Do not hallucinate the model!
- Double-check the 4th-8th characters (VDS) against official manufacturer decoding rules before returning the model.

Identify:
1. Brand (e.g. BMW, Audi, Toyota, Nissan, Kia, Mercedes-Benz, Volkswagen, Subaru, Peugeot)
2. Exact Model name and trim (e.g. 320i, A4 2.0 TFSI, Allion 1.8, X-Trail 2.0, 308 1.2, Forester 2.0)
3. Chassis/Generation/Body code (e.g. F30, 8K, ZRT260, NT32, FB, W205, SJ5, T9, P84)
4. Exact Chassis or Model code (e.g. F30, 8K2, ZRT260, NT32, G4FG, 205.077, SJ5)
5. Generate an array of search_terms specifically formatted to match how the oil catalog (podbor.ravenol.ru) indexes vehicles.
Include:
- Model/Chassis code (e.g. "205.077", "F30", "8K2", "ZRT260", "NT32", "SJ5")
- Brand + Model + Chassis (e.g. "BMW F30 320i", "Audi A4 8K", "Toyota Allion ZRT260", "Nissan X-Trail T32", "Peugeot 308 T9")
- Model + Chassis / Engine (e.g. "320i F30", "308 T9", "Forester 2.0 SJ", "A4 B8 2.0")

Return ONLY JSON in this format:
{
  "brand": "string",
  "model": "string",
  "chassis": "string",
  "model_code": "string",
  "vehicle_hint": "string",
  "search_terms": ["string"]
}`;
  try {
  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });
  console.log(response.text);
  } catch (e) { console.error(e) }
}
run();
