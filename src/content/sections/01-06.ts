import { LIGHT_LAYER, sectionArt } from "../art";
import type { Section } from "../types";

/**
 * 01.06 · آغاز کتاب → گفتار اندر آفرینش ماه
 * Couplets: text/chapters, section 01.06 (pdf p36), unchanged.
 * Paintings: art/prompts/01-06.md. Light layer reused from 01.01.
 */
const art = sectionArt("01.06");

export const section: Section = {
  id: "01.06",
  chapter: { id: "01", title: "آغاز کتاب" },
  title: "گفتار اندر آفرینش ماه",
  couplets: [
    ["چراغست مر تیره شب را بسیچ", "به بد تا توانی تو هرگز مپیچ"],
    ["چو سی روز گردش بپیمایدا", "شود تیره گیتی بدو روشنا"],
    ["پدید آید آنگاه باریک و زرد", "چو پشت کسی کو غم عشق خورد"],
    ["چو بیننده دیدارش از دور دید", "هم اندر زمان او شود ناپدید"],
    ["دگر شب نمایش کند بیشتر", "ترا روشنایی دهد بیشتر"],
    ["به دو هفته گردد تمام و درست", "بدان باز گردد که بود از نخست"],
    ["بود هر شبانگاه باریکتر", "به خورشید تابنده نزدیکتر"],
    ["بدینسان نهادش خداوند داد", "بود تا بود هم بدین یک نهاد"],
  ],
  scenes: [
    {
      image: art("00-shab"),
      sound: "threshold",
      alt: "شب لاجورد و قرص نقره‌ای ماه، با هسته‌ای روشن در میان",
      couplets: [],
    },
    {
      image: art("01-cheragh"),
      sound: { like: "dream", brightness: 0.58, bells: 0.85 },
      alt: "ماه تمام چون چراغ، با حلقه‌ای از نقطه‌های زرین بر فراز بامی تیره",
      couplets: [1, 2],
    },
    {
      image: art("02-gom"),
      sound: { like: "tender", brightness: 0.32, ney: 1 },
      alt: "هلال باریک زرد که نوکش در شب محو می‌شود، و پیکری کوچک خمیده در پایین",
      couplets: [3, 4],
    },
    {
      image: art("03-do-hafte"),
      sound: { like: "wonder", brightness: 0.72 },
      alt: "ماه تمام در میان کمان فازهای کوچک‌تر ماه",
      couplets: [5, 6],
    },
    {
      image: art("04-nahad"),
      sound: { like: "mystery", brightness: 0.48, bells: 0.9 },
      alt: "هلال و خورشید در دو سو، و نقطه‌ی نور در میان آن‌ها",
      couplets: [7, 8],
    },
  ],
  lightLayer: LIGHT_LAYER,
};
