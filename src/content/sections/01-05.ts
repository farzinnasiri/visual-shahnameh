import { LIGHT_LAYER, sectionArt } from "../art";
import type { Section } from "../types";

/**
 * 01.05 · آغاز کتاب → گفتار اندر آفرینش آفتاب
 * Couplets: text/chapters, section 01.05 (pdf p35), unchanged.
 * Paintings: art/prompts/01-05.md. Light layer reused from 01.01.
 */
const art = sectionArt("01.05");

export const section: Section = {
  id: "01.05",
  chapter: { id: "01", title: "آغاز کتاب" },
  title: "گفتار اندر آفرینش آفتاب",
  couplets: [
    ["ز یاقوت سرخست چرخ کبود", "نه از آب و گرد و نه از باد و دود"],
    ["به چندین فروغ و به چندین چراغ", "بیاراسته چون به نوروز باغ"],
    ["روان اندرو گوهر دلفروز", "کزو روشنایی گرفتست روز"],
    ["ز خاور برآید سوی باختر", "نباشد ازین یک روش راست‌تر"],
    ["ایا آنکه تو آفتابی همی", "چه بودت که بر من نتابی همی"],
  ],
  scenes: [
    {
      image: art("00-yaghut"),
      sound: "threshold",
      alt: "قرص یاقوت سرخ در چرخ لاجورد، با نقطه‌ی نوری که تازه بیدار می‌شود",
      couplets: [],
    },
    {
      image: art("01-nowruz"),
      sound: { like: "vast", brightness: 0.88, bells: 0.95 },
      alt: "خورشید یاقوتی در میان چراغ‌هایی به شکل شکوفه، و باغ نوروزی در پایین",
      couplets: [1, 2],
    },
    {
      image: art("02-gowhar"),
      sound: "wonder",
      alt: "گوهری درخشان بر نوار راست زرین از خاور تا باختر",
      couplets: [3, 4],
    },
    {
      image: art("03-natabi"),
      sound: { like: "tender", brightness: 0.6, ney: 1 },
      alt: "قرص خورشید که پرتوش به رهرو کوچک بیرون دایره نمی‌رسد",
      couplets: [5],
    },
  ],
  lightLayer: LIGHT_LAYER,
};
