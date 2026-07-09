import type { Service, Zone } from "./types";

/** Qatar launch zones from the go-to-market plan (beachhead first, then expand). */
export const ZONES: Zone[] = [
  { id: "west-bay", name: "West Bay", nameAr: "الخليج الغربي", wave: 1 },
  { id: "the-pearl", name: "The Pearl", nameAr: "اللؤلؤة", wave: 1 },
  { id: "lusail", name: "Lusail", nameAr: "لوسيل", wave: 1 },
  { id: "al-sadd", name: "Al Sadd", nameAr: "السد", wave: 2 },
  { id: "al-rayyan", name: "Al Rayyan", nameAr: "الريان", wave: 2 },
  { id: "al-wakrah", name: "Al Wakrah", nameAr: "الوكرة", wave: 2 },
  { id: "msheireb", name: "Msheireb", nameAr: "مشيرب", wave: 2 },
  { id: "al-khor", name: "Al Khor", nameAr: "الخور", wave: 2 },
];

/** The 15-service catalog from the pitch deck, with packages and add-ons. */
export const SERVICES: Service[] = [
  {
    id: "house-cleaning",
    icon: "🧹",
    name: "House cleaning",
    nameAr: "تنظيف المنزل",
    tagline: "Trained, verified cleaners with materials included",
    accent: "teal",
    genderPreference: true,
    packages: [
      { id: "hc-2h", name: "2-hour clean (1 pro)", nameAr: "تنظيف ساعتين", description: "Kitchen, bathrooms, dusting & floors", price: 79, duration: 120, popular: true },
      { id: "hc-4h", name: "4-hour clean (1 pro)", nameAr: "تنظيف ٤ ساعات", description: "Full apartment refresh, ironing on request", price: 139, duration: 240 },
      { id: "hc-team", name: "Villa team (2 pros, 4h)", nameAr: "فريق فيلا", description: "Two professionals for villas & large homes", price: 259, duration: 240 },
    ],
    addons: [
      { id: "hc-fridge", name: "Fridge deep clean", nameAr: "تنظيف الثلاجة", price: 35, duration: 30 },
      { id: "hc-oven", name: "Oven deep clean", nameAr: "تنظيف الفرن", price: 40, duration: 40 },
      { id: "hc-iron", name: "Ironing (10 items)", nameAr: "كي الملابس", price: 30, duration: 30 },
      { id: "hc-balcony", name: "Balcony wash", nameAr: "غسيل الشرفة", price: 25, duration: 25 },
    ],
  },
  {
    id: "deep-cleaning",
    icon: "🛋️",
    name: "Deep cleaning",
    nameAr: "تنظيف عميق",
    tagline: "Move-in / move-out & seasonal deep cleans",
    accent: "navy",
    genderPreference: true,
    packages: [
      { id: "dc-1br", name: "1BR apartment", nameAr: "شقة غرفة واحدة", description: "Full deep clean incl. kitchen degrease", price: 349, duration: 300, popular: true },
      { id: "dc-2br", name: "2–3BR apartment", nameAr: "شقة غرفتين-٣", description: "Team of 2–3 with machine scrubbing", price: 549, duration: 360 },
      { id: "dc-villa", name: "Villa deep clean", nameAr: "تنظيف فيلا عميق", description: "Full villa incl. external glass", price: 949, duration: 480 },
    ],
    addons: [
      { id: "dc-sofa", name: "Sofa shampoo (per seat)", nameAr: "غسيل الكنب", price: 45, duration: 30 },
      { id: "dc-mattress", name: "Mattress steam", nameAr: "تعقيم المرتبة", price: 60, duration: 30 },
      { id: "dc-carpet", name: "Carpet shampoo (per m²)", nameAr: "غسيل السجاد", price: 12, duration: 10 },
    ],
  },
  {
    id: "plumbing",
    icon: "🔧",
    name: "Plumbing",
    nameAr: "السباكة",
    tagline: "Licensed plumbers, transparent fixed rates",
    accent: "teal",
    genderPreference: false,
    safetyNote: "For active leaks, shut the main valve and book an urgent visit.",
    packages: [
      { id: "pl-visit", name: "Inspection visit", nameAr: "زيارة فحص", description: "Diagnosis + quote, fee waived if you proceed", price: 49, duration: 45, popular: true },
      { id: "pl-leak", name: "Leak repair", nameAr: "إصلاح تسريب", description: "Tap, mixer or pipe joint leak fix", price: 129, duration: 90 },
      { id: "pl-wh", name: "Water heater install", nameAr: "تركيب سخان", description: "Supply & install or replace unit", price: 199, duration: 120 },
    ],
    addons: [
      { id: "pl-drain", name: "Drain unblocking", nameAr: "تسليك مجاري", price: 89, duration: 45 },
      { id: "pl-toilet", name: "Toilet flush repair", nameAr: "إصلاح السيفون", price: 69, duration: 40 },
    ],
  },
  {
    id: "ac-technician",
    icon: "❄️",
    name: "AC technician",
    nameAr: "فني تكييف",
    tagline: "Split & central AC service, gas refill, deep clean",
    accent: "navy",
    genderPreference: false,
    safetyNote: "Never open AC electrical panels yourself — book a certified technician.",
    packages: [
      { id: "ac-service", name: "AC service (per unit)", nameAr: "صيانة مكيف", description: "Filter, coil clean & performance check", price: 99, duration: 60, popular: true },
      { id: "ac-gas", name: "Gas top-up (R410/R22)", nameAr: "تعبئة غاز", description: "Pressure test + refrigerant refill", price: 179, duration: 75 },
      { id: "ac-deep", name: "AC deep clean (jet wash)", nameAr: "تنظيف عميق للمكيف", description: "Full indoor unit jet wash & sanitize", price: 149, duration: 90 },
    ],
    addons: [
      { id: "ac-duct", name: "Duct sanitization", nameAr: "تعقيم الدكت", price: 120, duration: 60 },
      { id: "ac-thermo", name: "Thermostat replacement", nameAr: "تغيير الثرموستات", price: 95, duration: 30 },
    ],
  },
  {
    id: "electrical",
    icon: "💡",
    name: "Electrical",
    nameAr: "الكهرباء",
    tagline: "Certified electricians for safe, guaranteed work",
    accent: "gold",
    genderPreference: false,
    safetyNote: "Sparks or burning smell? Switch off the breaker and book urgent help.",
    packages: [
      { id: "el-visit", name: "Inspection visit", nameAr: "زيارة فحص", description: "Diagnosis + fixed quote before work", price: 49, duration: 45, popular: true },
      { id: "el-fixture", name: "Light / fan installation", nameAr: "تركيب إنارة", description: "Chandeliers, spots, ceiling fans", price: 89, duration: 60 },
      { id: "el-socket", name: "Sockets & switches (up to 5)", nameAr: "أفياش ومفاتيح", description: "Replace or add sockets and switches", price: 119, duration: 90 },
    ],
    addons: [
      { id: "el-db", name: "DB panel check", nameAr: "فحص لوحة الكهرباء", price: 75, duration: 40 },
      { id: "el-emergency", name: "Same-day priority", nameAr: "أولوية نفس اليوم", price: 50, duration: 0 },
    ],
  },
  {
    id: "nanny",
    icon: "🧸",
    name: "Nanny services",
    nameAr: "خدمات مربية",
    tagline: "Background-checked, trained childcare professionals",
    accent: "gold",
    genderPreference: true,
    safetyNote: "All nannies are QID-verified with background checks and first-aid training.",
    packages: [
      { id: "nn-4h", name: "4-hour visit", nameAr: "زيارة ٤ ساعات", description: "In-home childcare with activity plan", price: 149, duration: 240, popular: true },
      { id: "nn-8h", name: "Full day (8 hours)", nameAr: "يوم كامل", description: "Full-day care incl. meals support", price: 269, duration: 480 },
      { id: "nn-month", name: "Monthly plan (22 days)", nameAr: "خطة شهرية", description: "Same trusted nanny, fixed schedule", price: 4900, duration: 0 },
    ],
    addons: [
      { id: "nn-twins", name: "Second child", nameAr: "طفل إضافي", price: 40, duration: 0 },
      { id: "nn-arabic", name: "Arabic-speaking nanny", nameAr: "مربية ناطقة بالعربية", price: 25, duration: 0 },
    ],
  },
  {
    id: "cooking",
    icon: "🍲",
    name: "Cooking",
    nameAr: "الطبخ",
    tagline: "Home chefs for daily meals & gatherings",
    accent: "teal",
    genderPreference: true,
    packages: [
      { id: "ck-meal", name: "Daily meal prep (2h)", nameAr: "تحضير وجبات", description: "Up to 3 dishes, your groceries", price: 119, duration: 120, popular: true },
      { id: "ck-gather", name: "Gathering chef (4h)", nameAr: "طباخ مناسبات", description: "Majlis & family gatherings up to 15 guests", price: 349, duration: 240 },
      { id: "ck-week", name: "Weekly plan (5 visits)", nameAr: "خطة أسبوعية", description: "Five 2-hour visits, same chef", price: 529, duration: 0 },
    ],
    addons: [
      { id: "ck-groceries", name: "Grocery shopping", nameAr: "شراء المقاضي", price: 45, duration: 60 },
      { id: "ck-clean", name: "Kitchen cleanup", nameAr: "تنظيف المطبخ", price: 30, duration: 30 },
    ],
  },
  {
    id: "pest-control",
    icon: "🐜",
    name: "Pest control",
    nameAr: "مكافحة الحشرات",
    tagline: "MoPH-approved treatments, child & pet safe options",
    accent: "navy",
    genderPreference: false,
    safetyNote: "Vacate treated rooms for 2–4 hours; our pros advise exact re-entry times.",
    packages: [
      { id: "pc-apt", name: "Apartment treatment", nameAr: "معالجة شقة", description: "Cockroach, ant & general pest spray", price: 149, duration: 60, popular: true },
      { id: "pc-villa", name: "Villa treatment", nameAr: "معالجة فيلا", description: "Full villa incl. external perimeter", price: 299, duration: 120 },
      { id: "pc-bedbug", name: "Bed bug protocol", nameAr: "علاج بق الفراش", description: "Two-visit heat + spray protocol", price: 399, duration: 180 },
    ],
    addons: [
      { id: "pc-gel", name: "Gel bait (kitchen)", nameAr: "طُعم جل", price: 60, duration: 20 },
      { id: "pc-warranty", name: "90-day re-treatment warranty", nameAr: "ضمان ٩٠ يوم", price: 49, duration: 0 },
    ],
  },
  {
    id: "laundry",
    icon: "👕",
    name: "Laundry & ironing",
    nameAr: "غسيل وكي",
    tagline: "Pickup, wash, iron & deliver in 24h",
    accent: "teal",
    genderPreference: false,
    packages: [
      { id: "ld-bag", name: "Wash & fold bag (8kg)", nameAr: "غسيل وطي", description: "Pickup + delivery included", price: 69, duration: 0, popular: true },
      { id: "ld-iron", name: "Iron only (20 items)", nameAr: "كي فقط", description: "Crisp ironing, hanger-ready", price: 59, duration: 0 },
      { id: "ld-premium", name: "Premium care (thobes & abayas)", nameAr: "عناية فاخرة", description: "Delicate & traditional garments", price: 99, duration: 0 },
    ],
    addons: [
      { id: "ld-express", name: "Same-day express", nameAr: "توصيل سريع", price: 30, duration: 0 },
      { id: "ld-softener", name: "Premium softener", nameAr: "منعم فاخر", price: 10, duration: 0 },
    ],
  },
  {
    id: "handyman",
    icon: "🛠️",
    name: "Handyman",
    nameAr: "أعمال صيانة",
    tagline: "Mounting, assembly, curtains & small fixes",
    accent: "gold",
    genderPreference: false,
    packages: [
      { id: "hm-hour", name: "Handyman hour", nameAr: "ساعة صيانة", description: "TV mounting, shelves, small repairs", price: 89, duration: 60, popular: true },
      { id: "hm-half", name: "Half-day (4h)", nameAr: "نصف يوم", description: "Furniture assembly & multi-task visits", price: 279, duration: 240 },
      { id: "hm-curtain", name: "Curtain installation", nameAr: "تركيب ستائر", description: "Rails, blackout & sheer curtains", price: 129, duration: 90 },
    ],
    addons: [
      { id: "hm-drill", name: "Extra wall drilling (5 holes)", nameAr: "تثقيب إضافي", price: 25, duration: 15 },
      { id: "hm-materials", name: "Basic materials kit", nameAr: "مواد أساسية", price: 40, duration: 0 },
    ],
  },
  {
    id: "salon",
    icon: "💇‍♀️",
    name: "Salon-at-home",
    nameAr: "صالون في المنزل",
    tagline: "Certified beauticians at your doorstep",
    accent: "gold",
    genderPreference: true,
    packages: [
      { id: "sl-mani", name: "Mani-pedi classic", nameAr: "مانيكير وباديكير", description: "Classic manicure + pedicure", price: 129, duration: 90, popular: true },
      { id: "sl-hair", name: "Hair cut & blow-dry", nameAr: "قص وتصفيف", description: "Cut, wash & professional styling", price: 149, duration: 75 },
      { id: "sl-bridal", name: "Party-ready package", nameAr: "باقة مناسبات", description: "Hair, makeup & nails for events", price: 449, duration: 180 },
    ],
    addons: [
      { id: "sl-gel", name: "Gel polish upgrade", nameAr: "طلاء جل", price: 45, duration: 30 },
      { id: "sl-mask", name: "Hydrating hair mask", nameAr: "ماسك مرطب", price: 55, duration: 20 },
    ],
  },
  {
    id: "appliance-repair",
    icon: "⚙️",
    name: "Appliance repair",
    nameAr: "تصليح أجهزة",
    tagline: "Washing machines, fridges, ovens & dishwashers",
    accent: "navy",
    genderPreference: false,
    packages: [
      { id: "ap-visit", name: "Diagnosis visit", nameAr: "زيارة تشخيص", description: "Fault diagnosis + fixed repair quote", price: 59, duration: 45, popular: true },
      { id: "ap-washer", name: "Washing machine repair", nameAr: "تصليح غسالة", description: "Common faults, parts quoted separately", price: 149, duration: 90 },
      { id: "ap-fridge", name: "Fridge / freezer repair", nameAr: "تصليح ثلاجة", description: "Cooling, gas & compressor issues", price: 179, duration: 120 },
    ],
    addons: [
      { id: "ap-warranty", name: "90-day repair warranty", nameAr: "ضمان ٩٠ يوم", price: 29, duration: 0 },
      { id: "ap-priority", name: "Same-day priority", nameAr: "أولوية نفس اليوم", price: 40, duration: 0 },
    ],
  },
  {
    id: "moving",
    icon: "🚚",
    name: "Moving help",
    nameAr: "مساعدة نقل",
    tagline: "Movers, packing & small truck transport",
    accent: "teal",
    genderPreference: false,
    packages: [
      { id: "mv-small", name: "Small move (van + 2 movers)", nameAr: "نقل صغير", description: "Studio / 1BR within Doha", price: 349, duration: 240, popular: true },
      { id: "mv-large", name: "Large move (truck + 3 movers)", nameAr: "نقل كبير", description: "2–3BR incl. wrap & basic packing", price: 649, duration: 480 },
      { id: "mv-item", name: "Single item transport", nameAr: "نقل قطعة واحدة", description: "Sofa, fridge or wardrobe A→B", price: 149, duration: 120 },
    ],
    addons: [
      { id: "mv-pack", name: "Full packing service", nameAr: "خدمة تغليف", price: 199, duration: 180 },
      { id: "mv-assembly", name: "Furniture disassembly/assembly", nameAr: "فك وتركيب", price: 99, duration: 90 },
    ],
  },
  {
    id: "car-wash",
    icon: "🚗",
    name: "Car washing",
    nameAr: "غسيل سيارات",
    tagline: "Waterless eco wash at your parking spot",
    accent: "navy",
    genderPreference: false,
    packages: [
      { id: "cw-ext", name: "Exterior wash", nameAr: "غسيل خارجي", description: "Eco waterless exterior + tires", price: 39, duration: 30, popular: true },
      { id: "cw-full", name: "Full wash (in & out)", nameAr: "غسيل كامل", description: "Exterior + interior vacuum & dash", price: 69, duration: 60 },
      { id: "cw-detail", name: "Mini detail", nameAr: "تلميع سريع", description: "Wash + wax + interior deep clean", price: 149, duration: 120 },
    ],
    addons: [
      { id: "cw-second", name: "Second car (exterior)", nameAr: "سيارة ثانية", price: 29, duration: 30 },
      { id: "cw-engine", name: "Engine bay clean", nameAr: "تنظيف المحرك", price: 40, duration: 20 },
    ],
  },
  {
    id: "elderly-care",
    icon: "🤝",
    name: "Elderly care",
    nameAr: "رعاية المسنين",
    tagline: "Trained companions & daily-living support",
    accent: "gold",
    genderPreference: true,
    safetyNote: "Care companions support daily living; they do not replace medical professionals.",
    packages: [
      { id: "ec-4h", name: "Companion visit (4h)", nameAr: "زيارة مرافقة", description: "Companionship, meals & mobility support", price: 179, duration: 240, popular: true },
      { id: "ec-8h", name: "Day support (8h)", nameAr: "دعم نهاري", description: "Full-day companion incl. appointments", price: 319, duration: 480 },
      { id: "ec-month", name: "Monthly plan (22 days)", nameAr: "خطة شهرية", description: "Consistent carer, weekly family report", price: 5900, duration: 0 },
    ],
    addons: [
      { id: "ec-night", name: "Overnight supervision", nameAr: "إشراف ليلي", price: 120, duration: 0 },
      { id: "ec-report", name: "Daily WhatsApp family updates", nameAr: "تقارير يومية", price: 0, duration: 0 },
    ],
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getZone(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
