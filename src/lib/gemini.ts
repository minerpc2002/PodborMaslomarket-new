import { GoogleGenAI, Type } from '@google/genai';
import { fetchRavenolData } from './ravenol';
import { CarData } from '../types';
import { decodeVin } from './vinApi';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

async function trackAiUsage(model: string) {
  try {
    const usageDoc = doc(db, 'settings', 'ai_usage');
    const fieldName = model.replace(/\./g, '_').replace(/-/g, '_');
    await setDoc(usageDoc, {
      [`${fieldName}_usage`]: increment(1),
      last_updated: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to track AI usage:', e);
  }
}

function isStaffUser() {
  try {
    const state = useAppStore.getState();
    const role = state.userProfile?.role;
    const email = state.userProfile?.email?.toLowerCase() || '';
    return role === 'admin' || role === 'moderator' || email === 'minerpc2002@gmail.com';
  } catch (e) {
    return false;
  }
}

function isAiSearchEnabledState() {
  try {
    const state = useAppStore.getState();
    return state.isAiSearchEnabled;
  } catch (e) {
    return true;
  }
}

const productSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    brand_name: { type: Type.STRING, description: "Must be 'Ravenol', 'Motul', 'BARDAHL', or 'Moly Green'" },
    product_name: { type: Type.STRING },
    category: { type: Type.STRING },
    viscosity: { type: Type.STRING },
    approvals: { type: Type.ARRAY, items: { type: Type.STRING } },
    description: { type: Type.STRING, description: "Описание продукта на РУССКОМ языке" }
  },
  required: ["id", "brand_name", "product_name", "category", "viscosity", "approvals"]
};

const recommendationSchema = {
  type: Type.OBJECT,
  properties: {
    unit: { type: Type.STRING, description: "Название узла на РУССКОМ языке. ОБЯЗАТЕЛЬНО включи: 'Масло в двигатель', 'Коробка передач', 'Раздаточная коробка', 'Дифференциал, передний', 'Дифференциал, задний', 'ГУР', 'Гидравлическая тормозная система, АБС', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'" },
    fluid_type: { type: Type.STRING },
    factory_viscosity: { type: Type.STRING, description: "Вязкость, рекомендованная заводом-изготовителем" },
    recommended_viscosity: { type: Type.STRING, description: "Вязкость, рекомендованная с учетом пробега и условий эксплуатации" },
    specification: { type: Type.STRING },
    approval: { type: Type.STRING },
    volume_liters: { type: Type.NUMBER },
    replacement_interval: { type: Type.STRING, description: "Интервал замены на РУССКОМ языке" },
    products: { type: Type.ARRAY, items: productSchema }
  },
  required: ["unit", "fluid_type", "factory_viscosity", "recommended_viscosity", "specification", "approval", "volume_liters", "replacement_interval", "products"]
};

const carDataSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    brand: { type: Type.STRING },
    model: { type: Type.STRING },
    year_from: { type: Type.INTEGER },
    year_to: { type: Type.INTEGER },
    generation: { type: Type.STRING },
    engine: { type: Type.STRING },
    engine_code: { type: Type.STRING },
    engine_type: { type: Type.STRING, description: "'petrol', 'diesel', 'hybrid', or 'gas'" },
    drive: { type: Type.STRING, description: "'fwd', 'rwd', or 'awd'" },
    transmission_type: { type: Type.STRING, description: "'mt', 'at', 'cvt', 'dsg', or 'robot'" },
    recommendations: { type: Type.ARRAY, items: recommendationSchema }
  },
  required: ["id", "brand", "model", "year_from", "year_to", "generation", "engine", "engine_code", "engine_type", "drive", "transmission_type", "recommendations"]
};

function getGeminiClient() {
  // 1. Try VITE_ prefix (Standard for Vite/Vercel)
  // 2. Try process.env (AI Studio injection via define)
  let apiKey = '';
  
  try { apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY; } catch (e) {}
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    try { apiKey = process.env.GEMINI_API_KEY; } catch (e) {}
  }
  
  apiKey = (apiKey || '').trim();
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'undefined' || apiKey === 'null') {
    console.error('Gemini API Key is missing. Checked import.meta.env.VITE_GEMINI_API_KEY and process.env.GEMINI_API_KEY');
    throw new Error('API ключ Gemini не настроен. Пожалуйста, добавьте VITE_GEMINI_API_KEY в настройки Vercel или Secrets в AI Studio.');
  }

  return new GoogleGenAI({ apiKey });
}

function getEnabledModels(): string[] {
  try {
    const state = useAppStore.getState();
    if (state.aiModelsConfig && state.aiModelsConfig.length > 0) {
      return state.aiModelsConfig
        .filter(m => m.enabled)
        .sort((a, b) => a.priority - b.priority)
        .map(m => m.id);
    }
  } catch (e) {
    console.error('Failed to get AI models config:', e);
  }
  
  // Default fallback
  return [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash'
  ];
}

let currentModelIndex = 0; // Global rotation index

async function callOpenRouter(prompt: string, schema?: any): Promise<any> {
  let apiKey = '';
  try { apiKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY; } catch (e) {}
  if (!apiKey) {
    try { apiKey = process.env.OPENROUTER_API_KEY; } catch (e) {}
  }
  
  // Use the provided key as a hardcoded fallback if not in env
  if (!apiKey || apiKey === 'sk-or-v1-...') {
    apiKey = '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';
  }

  const openRouterModels = [
    "stepfun/step-3.5-flash"
  ];

  let lastError = null;

  for (const modelName of openRouterModels) {
    console.log(`Calling OpenRouter (${modelName})...`);
    
    const finalPrompt = schema 
      ? `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object matching this schema: ${JSON.stringify(schema)}. Do not include any other text or markdown formatting.`
      : prompt;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Oil Selector App",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": modelName, 
          "messages": [
            { "role": "system", "content": "You are a professional automotive technical assistant. Always respond in Russian. If JSON is requested, output ONLY valid JSON." },
            { "role": "user", "content": finalPrompt }
          ],
          "temperature": 0.3
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn(`OpenRouter API Error for ${modelName}:`, error);
        lastError = new Error(`OpenRouter error (${modelName}): ${error.error?.message || response.statusText}`);
        continue; // Try next model
      }

      const data = await response.json();
      let text = data.choices[0].message.content;
      
      // Clean up potential markdown code blocks if the model ignored the instruction
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0].trim();
      }
      
      // Track usage
      trackAiUsage(`openrouter_${modelName}`);

      return {
        text,
        candidates: [{ content: { parts: [{ text }] } }]
      };
    } catch (err) {
      console.warn(`Failed to call ${modelName}:`, err);
      lastError = err;
    }
  }

  // If all models failed
  const errorMsg = lastError?.message || "All OpenRouter free models failed.";
  if (isStaffUser()) {
    throw new Error(`Ошибка резервных ИИ: ${errorMsg}`);
  } else {
    throw new Error("Сервис временно недоступен из-за высокой нагрузки. Пожалуйста, попробуйте позже.");
  }
}

async function callGeminiWithRetry(ai: any, params: any, retries = 3): Promise<any> {
  let attempt = 0;
  const models = getEnabledModels();
  
  if (models.length === 0) {
    throw new Error('Все модели ИИ отключены администратором.');
  }

  const totalAttempts = retries * models.length;
  
  while (attempt < totalAttempts) {
    // Ensure index is within bounds if models array changed
    if (currentModelIndex >= models.length) {
      currentModelIndex = 0;
    }
    
    const currentModel = models[currentModelIndex];
    try {
      params.model = currentModel;
      console.log(`Calling Gemini (${currentModel}), attempt ${attempt + 1}/${totalAttempts}...`);
      
      const response = await ai.models.generateContent(params);
      
      // Track usage
      trackAiUsage(currentModel);

      // On success, we stay on the current working model
      return response;
    } catch (error: any) {
      const errorMsg = error.message || '';
      console.error(`Gemini error (${currentModel}):`, errorMsg);

      const isQuotaError = errorMsg.includes('429') || 
                          errorMsg.includes('quota') || 
                          errorMsg.includes('RESOURCE_EXHAUSTED') ||
                          errorMsg.includes('Too Many Requests');

      const isLocationError = errorMsg.includes('User location is not supported') || 
                              errorMsg.includes('location is not supported');

      if (isLocationError) {
        if (!isAiSearchEnabledState()) {
          throw new Error('Gemini недоступен в вашем регионе, а резервный ИИ (OpenRouter) временно отключен администратором.');
        }
        console.warn('Gemini is not available in this region. Switching to OpenRouter immediately...');
        try {
          const prompt = typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents);
          const orResponse = await callOpenRouter(prompt, params.config?.responseSchema);
          console.log('OpenRouter fallback successful (Region Block Bypass)!');
          return orResponse;
        } catch (orError: any) {
          console.error('OpenRouter fallback failed after region block:', orError.message);
          if (isStaffUser()) {
            if (orError.message.includes('User not found') || orError.message.includes('401')) {
              throw new Error('Ошибка: Резервный ключ OpenRouter недействителен. Пожалуйста, создайте бесплатный ключ на openrouter.ai и добавьте его в настройки (VITE_OPENROUTER_API_KEY).');
            }
            throw new Error(`Gemini недоступен в вашем регионе, а резервные ИИ-модели вернули ошибку: ${orError.message}`);
          } else {
            throw new Error("Сервис временно недоступен из-за высокой нагрузки. Пожалуйста, попробуйте позже.");
          }
        }
      }

      const isClientError = errorMsg.includes('400') || 
                           errorMsg.includes('INVALID_ARGUMENT') ||
                           errorMsg.includes('401') ||
                           errorMsg.includes('403') ||
                           errorMsg.includes('PERMISSION_DENIED');
      
      if (isClientError && !isQuotaError) {
        if (isStaffUser()) {
          if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
            throw new Error('Указан неверный API ключ Gemini. Проверьте правильность ключа в Vercel (VITE_GEMINI_API_KEY).');
          }
          throw new Error(`Ошибка запроса к ИИ: ${errorMsg.substring(0, 100)}...`); // Don't retry on fatal client errors
        } else {
          throw new Error("Внутренняя ошибка сервиса. Пожалуйста, обратитесь в поддержку.");
        }
      }

      // Rotate immediately on error
      currentModelIndex = (currentModelIndex + 1) % models.length;
      attempt++;
      
      if (attempt < totalAttempts) {
        // Small delay before retry (shorter for quota errors to quickly switch)
        const delay = isQuotaError ? 300 : Math.pow(2, Math.floor(attempt / models.length)) * 1000;
        console.warn(`Переключение на модель ${models[currentModelIndex]} через ${delay}ms... (Попытка ${attempt + 1}/${totalAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If all Gemini models failed, try OpenRouter as a last resort
      if (!isAiSearchEnabledState()) {
        throw new Error('Все модели Gemini исчерпаны, а резервный ИИ (OpenRouter) временно отключен администратором.');
      }
      console.warn('Все модели Gemini исчерпаны. Переключение на OpenRouter (MiniMax)...');
      try {
        const prompt = typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents);
        const orResponse = await callOpenRouter(prompt, params.config?.responseSchema);
        console.log('OpenRouter fallback successful!');
        return orResponse;
      } catch (orError: any) {
        console.error('OpenRouter fallback also failed:', orError.message);
        if (isStaffUser()) {
          throw new Error(`Все ИИ-модели (Gemini и OpenRouter) недоступны: ${errorMsg} | ${orError.message}`);
        } else {
          throw new Error("Сервис временно недоступен из-за высокой нагрузки. Пожалуйста, попробуйте позже.");
        }
      }
    }
  }
  
  if (isStaffUser()) {
    throw new Error('Все доступные модели ИИ временно перегружены или исчерпали лимит. Пожалуйста, попробуйте через минуту.');
  } else {
    throw new Error('Сервис временно недоступен из-за высокой нагрузки. Пожалуйста, попробуйте позже.');
  }
}

async function getGeminiVinHint(ai: any, vin: string): Promise<string | null> {
  try {
    const prompt = `Decode this VIN: ${vin}. Return ONLY the Brand and Model. Example: "BMW X4". 
    IMPORTANT: This is a specialized task. Do not guess. 
    If you are not 100% sure, return "Unknown".`;
    
    const response = await callGeminiWithRetry(ai, {
      contents: prompt,
      config: {
        temperature: 0,
      }
    }, 1);
    const text = response.text?.trim();
    return text === 'Unknown' ? null : text;
  } catch (e) {
    return null;
  }
}

export async function suggestCarBodies(brand: string, model: string, year: string): Promise<string[]> {
  const ai = getGeminiClient();

  const prompt = `List the known body codes (кузова/поколения) for ${brand} ${model} from the year ${year}. 
Return ONLY a JSON array of strings. Example: ["XV70", "XV50", "ASV70"].`;

  try {
    const models = getEnabledModels();
    if (models.length === 0) return [];
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function suggestCarModels(brand: string): Promise<string[]> {
  const ai = getGeminiClient();

  const prompt = `List the most popular car models for the brand ${brand}.
Return ONLY a JSON array of strings. Example: ["Camry", "Corolla", "RAV4"].`;

  try {
    const models = getEnabledModels();
    if (models.length === 0) return [];
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function suggestCarEngines(brand: string, model: string, year: string, body: string): Promise<string[]> {
  const ai = getGeminiClient();

  const prompt = `List the known engine codes and volumes (двигатели) for ${brand} ${model} ${year} (${body}).
Return ONLY a JSON array of strings. Example: ["2.5 2AR-FE", "3.5 2GR-FKS", "2.0 M20A-FKS"].`;

  try {
    const models = getEnabledModels();
    if (models.length === 0) return [];
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function suggestEnginePower(brand: string, model: string, year: string, body: string, engine: string): Promise<string[]> {
  const ai = getGeminiClient();

  const prompt = `List the known engine power options (л.с. / кВт) for ${brand} ${model} ${year} (${body}) with engine ${engine}.
Return ONLY a JSON array of strings. Example: ["181 л.с. / 133 кВт", "249 л.с. / 183 кВт"].`;

  try {
    const models = getEnabledModels();
    if (models.length === 0) return [];
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function suggestTransmissions(brand: string, model: string, year: string, body: string, engine: string): Promise<string[]> {
  const ai = getGeminiClient();

  const prompt = `List the known transmission types (КПП) for ${brand} ${model} ${year} (${body}) with engine ${engine}.
Return ONLY a JSON array of strings. Example: ["АКПП", "МКПП", "Вариатор (CVT)", "Робот (DSG/DCT)"].`;

  try {
    const models = getEnabledModels();
    if (models.length === 0) return [];
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function searchByVin(vin: string, mileage?: string, conditions?: string, power?: string, handDrive?: string, fuelType?: string, onStatusChange?: (status: string) => void): Promise<CarData> {
  const ai = getGeminiClient();

  onStatusChange?.('Поиск в каталоге...');
  
  // 1. Try Ravenol by VIN directly first (highest priority)
  let ravenolData = await fetchRavenolData(vin);
  let vehicleHint: string | undefined;

  // 2. If not found, try NHTSA Decoder
  if (!ravenolData) {
    onStatusChange?.('Идентификация автомобиля...');
    const vehicle = await decodeVin(vin);
    if (vehicle) {
      vehicleHint = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
      onStatusChange?.(`Поиск технических данных...`);
      ravenolData = await fetchRavenolData(vehicleHint, vehicleHint);
    }
  }

  // 3. If still not found, try Gemini for a hint (neural network as last resort for decoding)
  if (!ravenolData) {
    onStatusChange?.('Интеллектуальный анализ VIN...');
    const geminiHint = await getGeminiVinHint(ai, vin);
    if (geminiHint) {
      vehicleHint = geminiHint;
      onStatusChange?.(`Поиск технических данных...`);
      ravenolData = await fetchRavenolData(geminiHint, geminiHint);
    }
  }
  
  if (!ravenolData && !vehicleHint) {
    throw new Error('Автомобиль с таким VIN не найден. Пожалуйста, проверьте VIN или воспользуйтесь ручным поиском.');
  }

  let prompt = '';
  if (!ravenolData) {
    prompt = `Expert Oil Selector.
1. Identify: VIN ${vin}. Vehicle hint: ${vehicleHint}.
2. TASK: Use your internal knowledge to provide the most accurate technical data for this vehicle.
3. RECOMMENDATIONS & RULES:
   - Provide recommendations based on factory data.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", list ALL viscosities (e.g., "0W-20, 5W-30"). Include ALL technical information and notes.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: ${mileage || 'Not specified'}, Conditions: ${conditions || 'Normal'}, Power: ${power || 'Not specified'}, Hand Drive: ${handDrive || 'Not specified'}, Fuel Type: ${fuelType || 'Not specified'}.
   - CRITICAL: You MUST include ALL relevant units for this vehicle: 'Масло в двигатель', 'Коробка передач' (или 'Робот (DSG/DCT)', 'Вариатор'), 'Дифференциал, передний', 'Дифференциал, задний', 'Раздаточная коробка', 'ГУР', 'Гидравлическая тормозная система, АБС', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'.
   - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - BARDAHL FOR ALL UNITS: You MUST provide Bardahl analogs for ALL units (Engine, Transmission, Differentials, etc.), not just for the engine. Bardahl has a full range of products for all automotive systems.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE: For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
4. NO Liqui Moly.
5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array.`;
  } else {
    prompt = `Expert Oil Selector.
1. Identify: VIN ${vin}. ${vehicleHint ? `Vehicle hint: ${vehicleHint}.` : ''}
2. SOURCE OF TRUTH: Use the following extracted data. This data is the FINAL AUTHORITY for this specific vehicle.
<technical_data>
${ravenolData.substring(0, 50000)}
</technical_data>
3. MANDATORY TASK: 
   - You MUST identify the car EXACTLY as it is written in the <technical_data>.
   - Extract ALL exact volumes, ALL OEM specifications, ALL factory viscosities, and ALL technical notes/information from the <technical_data>.
4. RECOMMENDATIONS & RULES:
   - Provide recommendations strictly based on the factory data.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", you MUST list ALL viscosities mentioned in the catalog (e.g., "0W-20, 5W-30"). You MUST extract and include ALL technical information, notes, and exact volumes from the Ravenol data.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: ${mileage || 'Not specified'}, Conditions: ${conditions || 'Normal'}, Power: ${power || 'Not specified'}, Hand Drive: ${handDrive || 'Not specified'}, Fuel Type: ${fuelType || 'Not specified'}.
   - CRITICAL: You MUST include ALL relevant units for this vehicle: 'Масло в двигатель', 'Коробка передач' (или 'Робот (DSG/DCT)', 'Вариатор'), 'Дифференциал, передний', 'Дифференциал, задний', 'Раздаточная коробка', 'ГУР', 'Гидравлическая тормозная система, АБС', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'.
   - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - BARDAHL FOR ALL UNITS: You MUST provide Bardahl analogs for ALL units (Engine, Transmission, Differentials, etc.), not just for the engine. Bardahl has a full range of products for all automotive systems.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE: For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
5. NO Liqui Moly.
6. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array. Ensure "factory_viscosity", "volume_liters", and all technical info are exactly as in the catalog.`;
  }

  onStatusChange?.('Анализ данных...');
  try {
    const models = getEnabledModels();
    if (models.length === 0) {
      throw new Error('Все модели ИИ отключены администратором.');
    }
    
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: carDataSchema,
        temperature: 0.4,
        maxOutputTokens: 8192,
      }
    });

    const text = response.text;
    if (!text) throw new Error('Пустой ответ от ИИ');
    
    let carData: CarData;
    try {
      carData = JSON.parse(text) as CarData;
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text);
      throw new Error(`Ошибка парсинга ответа ИИ: ${text.substring(0, 50)}...`);
    }
    
    // Safety filter: ensure Liqui Moly is NEVER in the results
    if (carData.recommendations) {
      carData.recommendations.forEach(rec => {
        if (rec.products) {
          rec.products = rec.products.filter(p => 
            !p.brand_name.toLowerCase().includes('liqui')
          );
        }
      });
    }

    if (carData.id === 'INVALID_VIN') {
      throw new Error('VIN-код не найден или недействителен');
    }
    return carData;
  } catch (error) {
    console.error("Gemini failed", error);
    throw error;
  }
}

export async function searchByCarDetails(brand: string, model: string, year?: string, body?: string, engine?: string, transmission?: string, mileage?: string, conditions?: string, power?: string, handDrive?: string, fuelType?: string, onStatusChange?: (status: string) => void): Promise<CarData> {
  const ai = getGeminiClient();

  const query = `${brand} ${model} ${year || ''} ${body || ''} ${engine || ''} ${transmission || ''}`.trim();
  
  onStatusChange?.('Поиск технических данных...');
  let ravenolData = await fetchRavenolData(query);

  // Fallback: if specific query fails, try a simpler one (Brand + Model + Body)
  if (!ravenolData && (year || body || engine)) {
    onStatusChange?.('Уточнение параметров...');
    const simplerQuery = `${brand} ${model} ${body || ''}`.trim();
    if (simplerQuery !== query) {
      ravenolData = await fetchRavenolData(simplerQuery, query);
    }
  }

  let prompt = '';
  if (!ravenolData) {
    onStatusChange?.('Интеллектуальный подбор...');
    prompt = `Expert Oil Selector. 
    TASK: Use your internal knowledge to provide the most accurate technical data for: ${query}.
    1. Identify the car: ${brand} ${model} ${year || ''} ${body || ''} ${engine || ''} ${transmission || ''}.
    2. Provide EXACT volumes, OEM specifications, and viscosities.
    3. RECOMMENDATIONS & RULES:
       - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
       - FACTORY VISCOSITY & INFO: For "factory_viscosity", list ALL viscosities (e.g., "0W-20, 5W-30"). Include ALL technical information and notes.
       - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
       - CRITICAL: You MUST include ALL relevant units for this vehicle: 'Масло в двигатель', 'Коробка передач' (или 'Робот (DSG/DCT)', 'Вариатор'), 'Дифференциал, передний', 'Дифференциал, задний', 'Раздаточная коробка', 'ГУР', 'Гидравлическая тормозная система, АБС', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'.
       - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
       - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
       - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
       - BARDAHL FOR ALL UNITS: You MUST provide Bardahl analogs for ALL units (Engine, Transmission, Differentials, etc.), not just for the engine. Bardahl has a full range of products for all automotive systems.
       - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and Bardahl where they exist.
       - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
       - ANTIFREEZE: For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
    4. NO Liqui Moly.
    5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array.
    6. IMPORTANT: Add a note in the description of the first unit that this data is provided by AI because the official catalog was unreachable.`;
  } else {
    prompt = `Expert Oil Selector.
Vehicle: ${query}.
1. SOURCE OF TRUTH: Use the following extracted data. This data is the FINAL AUTHORITY for this vehicle.
<technical_data>
${ravenolData.substring(0, 50000)}
</technical_data>
2. MANDATORY TASK: 
   - You MUST identify the car EXACTLY as it is written in the <technical_data>.
   - Extract ALL exact volumes, ALL OEM specifications, ALL factory viscosities, and ALL technical notes/information from the <technical_data>.
3. RECOMMENDATIONS & RULES:
   - Provide recommendations strictly based on the factory data.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", you MUST list ALL viscosities mentioned in the catalog (e.g., "0W-20, 5W-30"). You MUST extract and include ALL technical information, notes, and exact volumes from the Ravenol data.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: ${mileage || 'Not specified'}, Conditions: ${conditions || 'Normal'}, Power: ${power || 'Not specified'}, Hand Drive: ${handDrive || 'Not specified'}, Fuel Type: ${fuelType || 'Not specified'}.
   - CRITICAL: You MUST include ALL relevant units for this vehicle: 'Масло в двигатель', 'Коробка передач' (или 'Робот (DSG/DCT)', 'Вариатор'), 'Дифференциал, передний', 'Дифференциал, задний', 'Раздаточная коробка', 'ГУР', 'Гидравлическая тормозная система, АБС', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - BARDAHL FOR ALL UNITS: You MUST provide Bardahl analogs for ALL units (Engine, Transmission, Differentials, etc.), not just for the engine. Bardahl has a full range of products for all automotive systems.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE: For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
4. NO Liqui Moly.
5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array. Ensure "factory_viscosity", "volume_liters", and all technical info are exactly as in the catalog.`;
  }

  onStatusChange?.('Анализ данных...');
  try {
    const models = getEnabledModels();
    if (models.length === 0) {
      throw new Error('Все модели ИИ отключены администратором.');
    }
    
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: carDataSchema,
        temperature: 0.4,
        maxOutputTokens: 8192,
      }
    });

    const text = response.text;
    if (!text) throw new Error('Пустой ответ от ИИ');
    
    let carData: CarData;
    try {
      carData = JSON.parse(text) as CarData;
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text);
      throw new Error(`Ошибка парсинга ответа ИИ: ${text.substring(0, 50)}...`);
    }

    // Safety filter: ensure Liqui Moly is NEVER in the results
    if (carData.recommendations) {
      carData.recommendations.forEach(rec => {
        if (rec.products) {
          rec.products = rec.products.filter(p => 
            !p.brand_name.toLowerCase().includes('liqui')
          );
        }
      });
    }

    return carData;
  } catch (error) {
    console.error("Gemini failed", error);
    throw error;
  }
}
