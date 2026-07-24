import { GoogleGenAI, Type } from '@google/genai';
import { fetchRavenolData } from './ravenol';
import { CarData } from '../types';
import { decodeVin } from './vinApi';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

function parseJsonFromAiResponse(text: string): any {
  if (!text) return null;
  let cleaned = text.trim();
  
  // Clean up markdown wrapping if present
  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1].split('```')[0].trim();
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1].split('```')[0].trim();
  }
  
  // Fallback: extract substring from first '{' to last '}' OR first '[' to last ']'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  const isObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const isArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;
  
  if (isObject && isArray) {
    if (firstBrace < firstBracket) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    } else {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  } else if (isObject) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (isArray) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  
  return JSON.parse(cleaned);
}

async function trackAiUsage(model: string) {
  try {
    const usageDoc = doc(db, 'settings', 'ai_usage');
    const fieldName = model.replace(/\./g, '_').replace(/-/g, '_').replace(/\//g, '_').replace(/:/g, '_');
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
    unit: { type: Type.STRING, description: "Название узла на РУССКОМ языке. Если для одного узла (например, раздаточная коробка или дифференциал) есть несколько модификаций, выведи каждую ОТДЕЛЬНО с уточнением в названии (например, 'Дифференциал, задний (с LSD)'). ОБЯЗАТЕЛЬНО включи: 'Масло в двигатель', 'Коробка передач', 'Раздаточная коробка', 'Дифференциал, передний', 'Дифференциал, задний', 'ГУР', 'Тормозная система', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'" },
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
    search_type: { type: Type.STRING, description: "'vin' or 'manual'" },
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
    "qwen/qwen3.6-plus:free"
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
          "temperature": 0.4,
          "max_tokens": 8192,
          ...(schema ? { "response_format": { "type": "json_object" } } : {})
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
    return parseJsonFromAiResponse(text) as string[];
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
    return parseJsonFromAiResponse(text) as string[];
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
    return parseJsonFromAiResponse(text) as string[];
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
    return parseJsonFromAiResponse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function recognizeVinFromPhoto(base64Image: string, mimeType: string = 'image/jpeg'): Promise<{ vin: string, brand?: string, model?: string, year?: string }> {
  const ai = getGeminiClient();
  const models = getEnabledModels();

  if (models.length === 0) {
    throw new Error('Модели ИИ отключены.');
  }

  // Strip data URL scheme prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  const promptText = `Проанализируй данное изображение СТС/ПТС (свидетельства о регистрации ТС) или маркировочной таблички автомобиля.
Твоя задача — максимально точно и без ошибок извлечь следующие данные:

1. VIN номер или Номер кузова/шасси. 
   - Внимательно посмотри в поля "Идентификационный номер (VIN)", "Кузов (кабина, прицеп) №", или "Шасси (рама) №".
   - Для японских авто номер кузова обычно имеет формат БУКВЫЦИФРЫ-ЦИФРЫ (например LA150S-0071790, M110A-005337). 
   - ВАЖНО: Перепиши номер кузова/VIN СИМВОЛ В СИМВОЛ, включая дефисы, если они есть. Если в документе номер написан слитно (например M110A005337), перепиши слитно. Ошибаться нельзя.
2. Марка (Brand) и Модель (Model).
   - Извлеки марку и точную модель из поля "Марка, модель" или "Марка" / "Модель".
   - Если указана модификация (например, Custom, Conte, Spacia Custom), обязательно включи её в название модели! Не сокращай название.
3. Год выпуска.

Верни СТРОГО JSON следующий вид:
{
  "vin": "ТОЧНЫЙ_VIN_ИЛИ_НОМЕР_КУЗОВА",
  "brand": "МАРКА_АВТО",
  "model": "ПОЛНАЯ_МОДЕЛЬ_АВТО (включая все слова, например Move Custom)",
  "year": "ГОД_ВЫПУСКА"
}
Если VIN или номер кузова/шасси вообще отсутствует или нечитаем, верни:
{
  "vin": null,
  "reason": "Не удалось чётко разобрать VIN код или номер кузова на фото"
}`;

  try {
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64
          }
        },
        promptText
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('ИИ не вернул ответа при анализе фото.');
    }

    const parsed = parseJsonFromAiResponse(text);
    if (parsed && parsed.vin && typeof parsed.vin === 'string') {
      const cleanVin = parsed.vin.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (cleanVin.length >= 6) {
        return {
          vin: cleanVin,
          brand: parsed.brand || undefined,
          model: parsed.model || undefined,
          year: parsed.year ? String(parsed.year) : undefined
        };
      }
    }

    if (parsed && parsed.reason) {
      throw new Error(parsed.reason);
    }

    throw new Error('VIN код или номер кузова не обнаружен на изображении. Убедитесь, что фото чёткое и хорошо освещено.');
  } catch (error: any) {
    console.error('VIN Photo recognition failed:', error);
    throw new Error(error.message || 'Ошибка распознавания VIN с фотографии');
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
    return parseJsonFromAiResponse(text) as string[];
  } catch (error) {
    console.error("Gemini failed", error);
    return [];
  }
}

export async function searchByVin(vin: string, mileage?: string, conditions?: string, power?: string, handDrive?: string, fuelType?: string, onStatusChange?: (status: string) => void, vehicleHintParam?: string): Promise<CarData> {
  const ai = getGeminiClient();

  onStatusChange?.('Поиск в каталоге...');
  
  // 1. Try Ravenol by VIN directly first (highest priority)
  let ravenolData = await fetchRavenolData(vin);
  let vehicleHint: string | undefined = vehicleHintParam;

  // 1.2 If VIN looks like a JDM chassis (with or without hyphen), extract the chassis code
  if (!ravenolData) {
    let chassisCode = '';
    if (vin.includes('-')) {
      chassisCode = vin.split('-')[0];
    } else {
      // e.g. M110A005337 -> M110A
      const jdmMatch = vin.match(/^([A-Z0-9]{3,6})[0-9]{6,7}$/);
      if (jdmMatch) {
        chassisCode = jdmMatch[1];
      }
    }
    
    if (chassisCode.length >= 3) {
      onStatusChange?.('Поиск по коду кузова...');
      ravenolData = await fetchRavenolData(chassisCode, vehicleHint);
    }
  }

  // 1.5 If not found by VIN but we have a hint from photo, use it
  if (!ravenolData && vehicleHint) {
    onStatusChange?.(`Поиск технических данных...`);
    ravenolData = await fetchRavenolData(vehicleHint, vehicleHint);
  }

  // 2. If not found, try NHTSA Decoder
  if (!ravenolData && (!vehicleHint || vehicleHint.length < 5)) {
    onStatusChange?.('Идентификация автомобиля...');
    const vehicle = await decodeVin(vin);
    if (vehicle) {
      vehicleHint = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
      onStatusChange?.(`Поиск технических данных...`);
      ravenolData = await fetchRavenolData(vehicleHint, vehicleHint);
    }
  }

  // 3. If still not found, try Gemini for a hint (neural network as last resort for decoding)
  if (!ravenolData && (!vehicleHint || vehicleHint.length < 5)) {
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
  const aiPrompts = useAppStore.getState().aiPrompts;
  
  if (!ravenolData) {
    prompt = aiPrompts.vinNoData
      .replace('{{VIN}}', vin)
      .replace('{{VEHICLE_HINT}}', vehicleHint || '')
      .replace('{{MILEAGE}}', mileage || 'Not specified')
      .replace('{{CONDITIONS}}', conditions || 'Normal')
      .replace('{{POWER}}', power || 'Not specified')
      .replace('{{HAND_DRIVE}}', handDrive || 'Not specified')
      .replace('{{FUEL_TYPE}}', fuelType || 'Not specified');
  } else {
    prompt = aiPrompts.vinWithData
      .replace('{{VIN}}', vin)
      .replace('{{VEHICLE_HINT_SECTION}}', vehicleHint ? `Vehicle hint: ${vehicleHint}.` : '')
      .replace('{{RAVENOL_DATA}}', ravenolData.substring(0, 50000))
      .replace('{{MILEAGE}}', mileage || 'Not specified')
      .replace('{{CONDITIONS}}', conditions || 'Normal')
      .replace('{{POWER}}', power || 'Not specified')
      .replace('{{HAND_DRIVE}}', handDrive || 'Not specified')
      .replace('{{FUEL_TYPE}}', fuelType || 'Not specified');
  }

  onStatusChange?.('Анализ данных...');
  try {
    const models = getEnabledModels();
    if (models.length === 0) {
      throw new Error('Все модели ИИ отключены администратором.');
    }
    
    const aiTemperature = useAppStore.getState().aiTemperature ?? 0.4;
    
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: carDataSchema,
        temperature: aiTemperature,
        maxOutputTokens: 8192,
      }
    });

    const text = response.text;
    if (!text) throw new Error('Пустой ответ от ИИ');
    
    let carData: CarData;
    try {
      carData = parseJsonFromAiResponse(text) as CarData;
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

    carData.search_type = 'vin';
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
  const aiPrompts = useAppStore.getState().aiPrompts;

  if (!ravenolData) {
    onStatusChange?.('Интеллектуальный подбор...');
    prompt = aiPrompts.manualNoData
      .replace('{{QUERY}}', query)
      .replace('{{BRAND}}', brand)
      .replace('{{MODEL}}', model)
      .replace('{{YEAR}}', year || '')
      .replace('{{BODY}}', body || '')
      .replace('{{ENGINE}}', engine || '')
      .replace('{{TRANSMISSION}}', transmission || '')
      .replace('{{MILEAGE}}', mileage || 'Not specified')
      .replace('{{CONDITIONS}}', conditions || 'Normal')
      .replace('{{POWER}}', power || 'Not specified')
      .replace('{{HAND_DRIVE}}', handDrive || 'Not specified')
      .replace('{{FUEL_TYPE}}', fuelType || 'Not specified');
  } else {
    prompt = aiPrompts.manualWithData
      .replace('{{QUERY}}', query)
      .replace('{{RAVENOL_DATA}}', ravenolData.substring(0, 50000))
      .replace('{{MILEAGE}}', mileage || 'Not specified')
      .replace('{{CONDITIONS}}', conditions || 'Normal')
      .replace('{{POWER}}', power || 'Not specified')
      .replace('{{HAND_DRIVE}}', handDrive || 'Not specified')
      .replace('{{FUEL_TYPE}}', fuelType || 'Not specified');
  }

  onStatusChange?.('Анализ данных...');
  try {
    const models = getEnabledModels();
    if (models.length === 0) {
      throw new Error('Все модели ИИ отключены администратором.');
    }
    
    const aiTemperature = useAppStore.getState().aiTemperature ?? 0.4;
    
    const response = await callGeminiWithRetry(ai, {
      model: models[0],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: carDataSchema,
        temperature: aiTemperature,
        maxOutputTokens: 8192,
      }
    });

    const text = response.text;
    if (!text) throw new Error('Пустой ответ от ИИ');
    
    let carData: CarData;
    try {
      carData = parseJsonFromAiResponse(text) as CarData;
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

    carData.search_type = 'manual';
    return carData;
  } catch (error) {
    console.error("Gemini failed", error);
    throw error;
  }
}
