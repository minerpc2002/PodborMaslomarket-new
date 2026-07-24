export const defaultPrompts = {
  vinNoData: `Expert Oil Selector.
1. Identify: VIN {{VIN}}. Vehicle hint: {{VEHICLE_HINT}}.
2. TASK: Use your internal knowledge to provide the most accurate technical data for this vehicle.
3. RECOMMENDATIONS & RULES:
   - Provide recommendations based on factory data.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", list ALL viscosities (e.g., "0W-20, 5W-30"). Include ALL technical information and notes.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: {{MILEAGE}}, Conditions: {{CONDITIONS}}, Power: {{POWER}}, Hand Drive: {{HAND_DRIVE}}, Fuel Type: {{FUEL_TYPE}}.
   - CRITICAL: You MUST include ALL relevant units for this vehicle: 'Масло в двигатель', 'Коробка передач' (или 'Робот (DSG/DCT)', 'Вариатор'), 'Дифференциал, передний', 'Дифференциал, задний', 'Раздаточная коробка', 'ГУР', 'Тормозная система', 'Система активной регулировки кузова', 'Система охлаждения', 'Система охлаждения, промежуточный охладитель'.
   - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - BARDAHL FOR ALL UNITS: You MUST provide Bardahl analogs for ALL units (Engine, Transmission, Differentials, etc.), not just for the engine. Bardahl has a full range of products for all automotive systems.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE (Система охлаждения): ОБЯЗАТЕЛЬНО найди и включи антифриз. Укажи ЦВЕТ антифриза (например, 'Красный', 'Зеленый', 'Синий', 'Желтый'). For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
   - DIFFERENTIALS & TRANSFER CASE: ОБЯЗАТЕЛЬНО найди и включи передний и задний дифференциалы, а также раздаточную коробку.
   - MODIFICATIONS: Если для одного узла (например, раздаточная коробка или дифференциал) в каталоге указано несколько разных модификаций (например, с LSD и без), ты ДОЛЖЕН вывести КАЖДЫЙ вариант как ОТДЕЛЬНЫЙ объект в массиве 'recommendations' с уточнением в названии.
4. NO Liqui Moly.
5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array.`,

  vinWithData: `Expert Oil Selector.
1. Identify: VIN {{VIN}}. {{VEHICLE_HINT_SECTION}}
2. SOURCE OF TRUTH: Use the following extracted data. This data is the FINAL AUTHORITY for this specific vehicle.
<technical_data>
{{RAVENOL_DATA}}
</technical_data>
3. MANDATORY TASK: 
   - You MUST identify the car based on the <technical_data>. HOWEVER, if the {{VEHICLE_HINT_SECTION}} or the {{VIN}} provides a more specific model name (e.g. "Move Custom" instead of "Move") or a more specific chassis code (e.g. "M110A" instead of "M100"), you MUST use the specific name and chassis from the hint or VIN for the final "brand" and "model" fields.
   - Extract ALL exact volumes, ALL OEM specifications, ALL factory viscosities, and ALL technical notes/information from the <technical_data>.
4. RECOMMENDATIONS & RULES:
   - Provide recommendations strictly based on the factory data.
   - STRICT COMPLIANCE: You MUST NOT substitute Ravenol products based on your internal knowledge. If the <technical_data> specifies a product (e.g., "LTC - Protect C12++ Premix -40°C") for a specific unit (e.g., "Система активной регулировки кузова"), you MUST recommend EXACTLY that product for that unit. Do not assume it's a mistake.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", you MUST list ALL viscosities mentioned in the catalog (e.g., "0W-20, 5W-30"). You MUST extract and include ALL technical information, notes, and exact volumes from the Ravenol data.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: {{MILEAGE}}, Conditions: {{CONDITIONS}}, Power: {{POWER}}, Hand Drive: {{HAND_DRIVE}}, Fuel Type: {{FUEL_TYPE}}.
   - CRITICAL: ONLY include units that are explicitly present in the <technical_data>. DO NOT invent or add units (like Power Steering, Active Body Control, etc.) if they are missing from the source data. Shorten 'Гидравлическая тормозная система, АБС' to 'Тормозная система'.
   - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ (из тех, что есть в каталоге).
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - MOTUL & BARDAHL FOR ALL UNITS: You MUST provide both Motul and Bardahl analogs for ALL units (Engine, Transmission, Differentials, Brake Fluid, etc.). Motul and Bardahl have full ranges of products (including brake fluids like DOT 4/5.1). Do not skip them.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and 1-2 from Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE (Система охлаждения): ОБЯЗАТЕЛЬНО найди и включи антифриз. Укажи ЦВЕТ антифриза (например, 'Красный', 'Зеленый', 'Синий', 'Желтый'). For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
   - DIFFERENTIALS & TRANSFER CASE: ОБЯЗАТЕЛЬНО найди и включи передний и задний дифференциалы, а также раздаточную коробку.
   - MODIFICATIONS: Если для одного узла (например, раздаточная коробка или дифференциал) в каталоге указано несколько разных модификаций (например, с LSD и без), ты ДОЛЖЕН вывести КАЖДЫЙ вариант как ОТДЕЛЬНЫЙ объект в массиве 'recommendations' с уточнением в названии.
5. NO Liqui Moly.
6. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array. Ensure "factory_viscosity", "volume_liters", and all technical info are exactly as in the catalog.`,

  manualNoData: `Expert Oil Selector. 
TASK: Use your internal knowledge to provide the most accurate technical data for: {{QUERY}}.
1. Identify the car: {{CAR_DETAILS}}.
2. Provide EXACT volumes, OEM specifications, and viscosities.
3. RECOMMENDATIONS & RULES:
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", list ALL viscosities (e.g., "0W-20, 5W-30"). Include ALL technical information and notes.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - CRITICAL: ONLY include units that are explicitly relevant to this vehicle. DO NOT invent or add units if they are not applicable. Shorten 'Гидравлическая тормозная система, АБС' to 'Тормозная система'.
   - TRANSMISSION: If the car has a robotic transmission (DSG, DCT, PDK, Powershift, etc.), explicitly label the unit as 'Робот (DSG/DCT)'. For CVT, use 'Вариатор'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ.
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - MOTUL & BARDAHL FOR ALL UNITS: You MUST provide both Motul and Bardahl analogs for ALL units (Engine, Transmission, Differentials, Brake Fluid, etc.). Motul and Bardahl have full ranges of products (including brake fluids like DOT 4/5.1). Do not skip them.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and 1-2 from Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE (Система охлаждения): ОБЯЗАТЕЛЬНО найди и включи антифриз. Укажи ЦВЕТ антифриза (например, 'Красный', 'Зеленый', 'Синий', 'Желтый'). For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
   - DIFFERENTIALS & TRANSFER CASE: ОБЯЗАТЕЛЬНО найди и включи передний и задний дифференциалы, а также раздаточную коробку.
   - MODIFICATIONS: Если для одного узла (например, раздаточная коробка или дифференциал) в каталоге указано несколько разных модификаций (например, с LSD и без), ты ДОЛЖЕН вывести КАЖДЫЙ вариант как ОТДЕЛЬНЫЙ объект в массиве 'recommendations' с уточнением в названии.
4. NO Liqui Moly.
5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array.
6. IMPORTANT: Add a note in the description of the first unit that this data is provided by AI because the official catalog was unreachable.`,

  manualWithData: `Expert Oil Selector.
Vehicle: {{QUERY}}.
1. SOURCE OF TRUTH: Use the following extracted data. This data is the FINAL AUTHORITY for this vehicle.
<technical_data>
{{RAVENOL_DATA}}
</technical_data>
2. MANDATORY TASK: 
   - You MUST identify the car based on the <technical_data>. HOWEVER, if the original QUERY provides a more specific model name (e.g. "Move Custom" instead of "Move") or a more specific chassis code (e.g. "M110A" instead of "M100"), you MUST use the specific name and chassis from the QUERY for the final "brand" and "model" fields.
   - Extract ALL exact volumes, ALL OEM specifications, ALL factory viscosities, and ALL technical notes/information from the <technical_data>.
3. RECOMMENDATIONS & RULES:
   - Provide recommendations strictly based on the factory data.
   - STRICT COMPLIANCE: You MUST NOT substitute Ravenol products based on your internal knowledge. If the <technical_data> specifies a product (e.g., "LTC - Protect C12++ Premix -40°C") for a specific unit (e.g., "Система активной регулировки кузова"), you MUST recommend EXACTLY that product for that unit. Do not assume it's a mistake.
   - NO DUPLICATES: You MUST NOT duplicate the same oil/product in the "products" array. Every product in the list MUST be a different, unique product.
   - FACTORY VISCOSITY & INFO: For "factory_viscosity", you MUST list ALL viscosities mentioned in the catalog (e.g., "0W-20, 5W-30"). You MUST extract and include ALL technical information, notes, and exact volumes from the Ravenol data.
   - IMPORTANT: For each product, list ONLY the approvals and specifications that are DIRECTLY RELEVANT to this specific car's requirements. Do not list all approvals the product has.
   - Adjust "recommended_viscosity" based on: Mileage: {{MILEAGE}}, Conditions: {{CONDITIONS}}, Power: {{POWER}}, Hand Drive: {{HAND_DRIVE}}, Fuel Type: {{FUEL_TYPE}}.
   - CRITICAL: ONLY include units that are explicitly present in the <technical_data>. DO NOT invent or add units (like Power Steering, Active Body Control, etc.) if they are missing from the source data. Shorten 'Гидравлическая тормозная система, АБС' to 'Тормозная система'.
   - ОБЯЗАТЕЛЬНО ВЫВЕДИ ВСЕ МАСЛА И АНАЛОГИ ДЛЯ КАЖДОГО УЗЛА БЕЗ ИСКЛЮЧЕНИЯ (из тех, что есть в каталоге).
   - ACCURATE ANALOGS: Find technical equivalents from Motul, Bardahl, and Moly Green (if applicable) that match the OEM approvals (допуски) and specifications. If a perfect match for a brand is not found, provide the best available alternative that meets the basic requirements, or skip that specific brand for that unit, but NEVER skip the unit itself.
   - MOTUL & BARDAHL FOR ALL UNITS: You MUST provide both Motul and Bardahl analogs for ALL units (Engine, Transmission, Differentials, Brake Fluid, etc.). Motul and Bardahl have full ranges of products (including brake fluids like DOT 4/5.1). Do not skip them.
   - MULTIPLE OPTIONS: For EACH unit, provide 2-3 DIFFERENT products from Ravenol (primary), and at least 1-2 analogs from Motul and 1-2 from Bardahl where they exist.
   - MOLY GREEN: Include Moly Green ONLY if the car is Japanese (JDM) and requires Japanese approvals. For European, American, or Korean cars, DO NOT include Moly Green.
   - ANTIFREEZE (Система охлаждения): ОБЯЗАТЕЛЬНО найди и включи антифриз. Укажи ЦВЕТ антифриза (например, 'Красный', 'Зеленый', 'Синий', 'Желтый'). For European cars, explicitly state the standard (G11, G12, G12+, G12++, G13) in the fluid_type or description. Provide Ravenol and matching analogs from Motul/Bardahl.
   - DIFFERENTIALS & TRANSFER CASE: ОБЯЗАТЕЛЬНО найди и включи передний и задний дифференциалы, а также раздаточную коробку.
   - MODIFICATIONS: Если для одного узла (например, раздаточная коробка или дифференциал) в каталоге указано несколько разных модификаций (например, с LSD и без), ты ДОЛЖЕН вывести КАЖДЫЙ вариант как ОТДЕЛЬНЫЙ объект в массиве 'recommendations' с уточнением в названии.
4. NO Liqui Moly.
5. OUTPUT: Return JSON (Russian text). Ensure every unit has multiple UNIQUE products in the "products" array. Ensure "factory_viscosity", "volume_liters", and all technical info are exactly as in the catalog.`
};
