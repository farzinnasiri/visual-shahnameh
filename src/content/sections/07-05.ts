import { LIGHT_LAYER, sectionArt } from "../art";
import type { Section } from "../types";

/**
 * 07.05 · فریدون → بخش کردن فریدون جهان را بر پسران
 * Couplets: text/chapters, section 07.05, unchanged.
 * Paintings: art/prompts/07-05.md. Light layer reused from 01.01.
 *
 * Thirteen couplets, five scenes. The threshold is the covered secret.
 * Then the world is divided, Salm takes the West, Tur takes Turan,
 * and Iraj receives Iran.
 */
const art = sectionArt("07.05");

export const section: Section = {
  id: "07.05",
  chapter: { id: "07", title: "فریدون" },
  title: "بخش کردن فریدون جهان را بر پسران",
  couplets: [
    ["نهفته چو بیرون کشید از نهان", "به سه بخش کرد آفریدون جهان"],
    ["یکی روم و خاور دگر ترک و چین", "سیم دشت گردان و ایران‌زمین"],
    ["نخستین به سلم اندرون بنگرید", "همه روم و خاور مراو را سزید"],
    ["به فرزند تا لشکری برگزید", "گرازان سوی خاور اندرکشید"],
    ["به تخت کیان اندر آورد پای", "همی خواندندیش خاور خدای"],
    ["دگر تور را داد توران زمین", "ورا کرد سالار ترکان و چین"],
    ["یکی لشکری نا مزد کرد شاه", "کشید آنگهی تور لشکر به راه"],
    ["بیامد به تخت کی برنشست", "کمر بر میان بست و بگشاد دست"],
    ["بزرگان برو گوهر افشاندند", "همی پاک توران شهش خواندند"],
    ["از ایشان چو نوبت به ایرج رسید", "مر او را پدر شاه ایران گزید"],
    ["هم ایران و هم دشت نیزه‌وران", "هم آن تخت شاهی و تاج سران"],
    ["بدو داد کورا سزا بود تاج", "همان کرسی و مهر و آن تخت عاج"],
    ["نشستند هر سه به آرام و شاد", "چنان مرزبانان فرخ نژاد"],
  ],
  scenes: [
    {
      image: art("00-seh-2"),
      sound: "threshold",
      alt: "باغ شب با سه تخت خالی و پارچه‌ای تیره که از میانه‌اش جرقه‌ای زرین بیرون می‌زند",
      couplets: [],
    },
    {
      image: art("01-bakhsh"),
      sound: { like: "court", brightness: 0.58 },
      alt: "فریدون با گرز گاوسر، و سه بوم که در یک ستاره‌ی زرین به هم می‌رسند",
      couplets: [1, 2],
    },
    {
      image: art("02-khavar"),
      sound: { like: "journey", wind: 0.55, brightness: 0.55, cues: [{ couplet: 5, sound: "horn" }] },
      alt: "سلم که به تخت خاور نزدیک می‌شود، و فروغ تخت در میانه",
      couplets: [3, 4, 5],
    },
    {
      image: art("03-turan-2"),
      sound: { like: "court", brightness: 0.6, bells: 0.35, cues: [{ couplet: 9, sound: "horn" }] },
      alt: "تور بر تخت توران، رو به گوهرِ درخشانی که بزرگان می‌افشانند",
      couplets: [6, 7, 8, 9],
    },
    {
      image: art("04-iran"),
      sound: { like: "wonder", brightness: 0.68, bells: 0.4 },
      focus: [0.46, 0.42],
      alt: "ایرج بر تخت عاج، و سلم و تور در دو سوی او، و فریدون در پشت تخت",
      couplets: [10, 11, 12, 13],
    },
  ],
  lightLayer: LIGHT_LAYER,
};
