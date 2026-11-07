import { LIGHT_LAYER, sectionArt } from "../art";
import type { Section } from "../types";

/**
 * 07.18 · فریدون → درگذشتن فریدون
 * Couplets: text/chapters, section 07.18 (pdf p120), unchanged.
 * Paintings: art/prompts/07-18.md. Light layer reused from 01.01.
 *
 * Eleven couplets, four scenes. The threshold is the failing plane tree
 * and the empty throne. The last doorway is the boss of the sealed tomb.
 */
const art = sectionArt("07.18");

export const section: Section = {
  id: "07.18",
  chapter: { id: "07", title: "فریدون" },
  title: "درگذشتن فریدون",
  couplets: [
    ["چو این کرده شد روز برگشت بخت", "بپژمرد برگ کیانی درخت"],
    ["کرانه گزید از بر تاج و گاه", "نهاده بر خود سر هر سه شاه"],
    ["پر از خون دل و پر ز گریه دو روی", "چنین تا زمانه سرآمد بروی"],
    ["فریدون شد و نام ازو ماند باز", "برآمد برین روزگار دراز"],
    ["همان نیکنامی به و راستی", "که کرد ای پسر سود برکاستی"],
    ["منوچهر بنهاد تاج کیان", "بزنار خونین ببستش میان"],
    ["برآیین شاهان یکی دخمه کرد", "چه از زر سرخ و چه از لاژورد"],
    ["نهادند زیر اندرش تخت عاج", "بیاویختند از بر عاج تاج"],
    ["بپدرود کردنش رفتند پیش", "چنان چون بود رسم آیین و کیش"],
    ["در دخمه بستند بر شهریار", "شد آن ارجمند از جهان زار و خوار"],
    ["جهانا سراسر فسوسی و باد", "بتو نیست مرد خردمند شاد"],
  ],
  scenes: [
    {
      image: art("00-derakht"),
      sound: "threshold",
      alt: "درخت چنار در شب، برگی زرین در میانه، و تختی خالی",
      couplets: [],
    },
    {
      image: art("01-seh-sar"),
      sound: { like: "lament", brightness: 0.26, cues: [{ couplet: 1, sound: "gong" }] },
      focus: [0.49, 0.6],
      alt: "فریدون پیر کنار سه سرِ آرام، و چراغی افتاده",
      couplets: [1, 2, 3],
    },
    {
      image: art("02-taj"),
      sound: {
        like: "lament",
        brightness: 0.4,
        bells: 0.45,
        cues: [{ couplet: 4, sound: "hush" }],
      },
      focus: [0.54, 0.41],
      alt: "منوچهر دیهیم فیروزه بر تارک، و کمربند سرخ، کنار تخت خالی",
      couplets: [4, 5, 6],
    },
    {
      image: art("03-dakhmeh"),
      sound: {
        like: "lament",
        brightness: 0.3,
        wind: 0.4,
        bells: 0.35,
        cues: [{ couplet: 11, sound: "hush" }],
      },
      focus: [0.51, 0.68],
      alt: "دخمه‌ی لاجورد و زر، تاج آویخته، و دری که بسته می‌شود",
      couplets: [7, 8, 9, 10, 11],
    },
  ],
  lightLayer: LIGHT_LAYER,
};
