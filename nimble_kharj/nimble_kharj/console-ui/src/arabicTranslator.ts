/**
 * Smart Rule-Based Logistics Translator for Almarai SAP Waybills & Console UI
 * Automatically converts English trip titles, locations, routes, and UI terms to proper Arabic.
 */

// Core English -> Arabic Logistics Terms
export const LOGISTICS_GLOSSARY: Record<string, string> = {
  // Facilities & Types
  "CPP": "سي بي بي",
  "DEPOT": "مستودع",
  "WH": "مستودع",
  "WAREHOUSE": "مستودع",
  "PLANT": "مصنع",
  "CENTRAL": "مركزي",
  "FORECOURT": "ساحة العمليات",
  "ASRS": "المستودع الآلي",
  "STATION": "محطة",
  "BAY": "بوابة",
  
  // Cities & Regions
  "RIYADH": "الرياض",
  "KHARJ": "الخرج",
  "AL KHARJ": "الخرج",
  "AL-KHARJ": "الخرج",
  "DAMMAM": "الدمام",
  "JEDDAH": "جدة",
  "MECCA": "مكة",
  "MAKKAH": "مكة المكرمة",
  "MEDINA": "المدينة المنورة",
  "MADINAH": "المدينة المنورة",
  "TAIF": "الطائف",
  "TABUK": "تبوك",
  "BURAYDAH": "بريدة",
  "QASSIM": "القصيم",
  "HAIL": "حائل",
  "HOFUF": "الهفوف",
  "JUBAIL": "الجبيل",
  "KHOBAR": "الخبر",
  "ABHA": "أبها",
  "KHAMIS": "خميس مشيط",
  "JIZAN": "جازان",
  "NAJRAN": "نجران",
  "YANBU": "ينبع",

  // Directions
  "SOUTH": "جنوب",
  "NORTH": "شمال",
  "EAST": "شرق",
  "WEST": "غرب",

  // Divisions & Product Lines
  "FOODS": "أغذية",
  "FOOD": "أغذية",
  "DAIRY": "ألبان",
  "JUICE": "عصائر",
  "JUICES": "عصائر",
  "BAKERY": "مخبوزات",
  "POULTRY": "دواجن",
  "FEED": "أعلاف",
  "ADBLUE": "أدبلو",
  "DEF": "أدبلو سائل عادم الديزل",

  // Entities & Roles
  "CUSTOMER": "عميل",
  "CUSTOMERS": "عملاء",
  "DRIVER": "سائق",
  "TRAINEE": "متدرب",
  "NUPCO": "نوبكو",
  "ALMARAI": "المراعي",
  
  // Actions & Types
  "EXPRESS": "إكسبريس",
  "HIGHWAY": "طريق سريع",
  "ROUTE": "مسار",
  "COLLECTION": "استلام",
  "DELIVERY": "توصيل",
  "RETURN": "مرتجع",
  "EXPIRED": "منتهي الصلاحية",
  "PRODUCTS": "منتجات",
};

/**
 * Compound phrase replacements to enforce natural Arabic grammar
 * e.g. "RIYADH SOUTH" -> "جنوب الرياض" instead of "الرياض جنوب"
 */
const COMPOUND_PHRASES: [RegExp, string][] = [
  [/\bRIYADH SOUTH\b/gi, "جنوب الرياض"],
  [/\bRIYADH NORTH\b/gi, "شمال الرياض"],
  [/\bRIYADH EAST\b/gi, "شرق الرياض"],
  [/\bRIYADH WEST\b/gi, "غرب الرياض"],
  [/\bJEDDAH CENTRAL\b/gi, "وسط جدة"],
  [/\bJEDDAH NORTH\b/gi, "شمال جدة"],
  [/\bJEDDAH SOUTH\b/gi, "جنوب جدة"],
  [/\bKHARJ CENTRAL\b/gi, "وسط الخرج"],
  [/\bDAMMAM HIGHWAY\b/gi, "طريق الدمام السريع"],
];

/**
 * Automatically translates English trip or route text into standard Arabic SAP waybill format.
 *
 * Example Input:  "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)"
 * Example Output: "سي بي بي جنوب الرياض (أغذية) 01 (عميل)"
 */
export function autoGenerateArabicDesc(englishText: string): string {
  if (!englishText || typeof englishText !== "string") return "";

  let processed = englishText.trim();

  // 1. Match compound multi-word phrases first
  for (const [pattern, replacement] of COMPOUND_PHRASES) {
    processed = processed.replace(pattern, `__${replacement}__`);
  }

  // 2. Tokenize preserving brackets, spaces, and hyphens
  const tokens = processed.split(/([()\s,/-]+)/);

  const translatedTokens = tokens.map((token) => {
    if (token.startsWith("__") && token.endsWith("__")) {
      return token.slice(2, -2);
    }

    const cleanToken = token.trim().toUpperCase();
    if (!cleanToken) return token;

    if (LOGISTICS_GLOSSARY[cleanToken]) {
      return LOGISTICS_GLOSSARY[cleanToken];
    }

    return token;
  });

  return translatedTokens.join("").replace(/\s{2,}/g, " ").trim();
}

/**
 * Standard UI translations for waybill tables & headers
 */
export const WAYBILL_UI_LABELS = {
  roadSafetyTab: "السلامة على الطريق (ابقَ آمناً)",
  staySafeHeading: "ابقَ آمناً على الطريق",
  safetyMotto: "سلامتك هي أولويتنا : قد بحكمة. قد بأمان. ارجع سالماً. عائلتك تحتاجك",
  warehouseLocation: "موقع المستودع",
  bayNumber: "رقم البوابة",
  loadingStart: "تاريخ و وقت بداية التحميل",
  loadingEnd: "تاريخ و وقت نهاية التحميل",
  guaranteeNotice: "جميع السلع مضمونة في المملكة العربية السعودية",
};
