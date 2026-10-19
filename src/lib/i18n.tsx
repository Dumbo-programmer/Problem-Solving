import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Lang, Localized, ProblemCategory, ProblemDifficulty, ProblemTopic, ProblemType } from "./types";
import { readLang, writeLang } from "./storage";

/**
 * Bangla-first bilingual UI.
 *
 * Every string the learner sees goes through `t()` so the whole product can be
 * switched between বাংলা and English instantly (and remembered per browser).
 */

export const STRINGS: Record<string, { en: string; bn: string }> = {
  /* ---- brand / chrome ---- */
  "brand.name": { en: "Gonit Ishkul Problem Solving", bn: "গণিত ইশকুল প্রবলেম সলভিং" },
  "brand.short": { en: "Gonit Ishkul", bn: "গণিত ইশকুল" },
  "brand.tagline": { en: "Problem Solving", bn: "প্রবলেম সলভিং" },
  "nav.home": { en: "Home", bn: "হোম" },
  "nav.problems": { en: "Problems", bn: "সমস্যা" },
  "nav.practice": { en: "Practice Test", bn: "প্র্যাকটিস টেস্ট" },
  "nav.past": { en: "Past Tests", bn: "পূর্ববর্তী টেস্ট" },
  "nav.menu": { en: "Menu", bn: "মেনু" },
  "nav.close": { en: "Close", bn: "বন্ধ" },
  "theme.toggle": { en: "Toggle theme", bn: "থিম বদলান" },
  "lang.toggle": { en: "English", bn: "বাংলা" },

  /* ---- hero ---- */
  "hero.badge": { en: "Free · Olympiad-flavoured · No sign-up", bn: "বিনামূল্যে · অলিম্পিয়াড ধাঁচের · রেজিস্ট্রেশন লাগে না" },
  "hero.title1": { en: "Problem solving,", bn: "সমস্যা সমাধান," },
  "hero.title2": { en: "one problem at a time.", bn: "একটি একটি করে।" },
  "hero.lede": {
    en: "A free, bilingual home for maths learners in Bangladesh — {n} olympiad and academic problems across six topics and four levels. Explore the bank and solve at your own pace, check answers instantly with a full solution, or sit a timed practice test whenever you're ready.",
    bn: "বাংলাদেশের গণিত শিক্ষার্থীদের জন্য একটি বিনামূল্যের দ্বিভাষিক ঠিকানা — ছয়টি টপিক ও চারটি স্তরে ছড়ানো {n}টি অলিম্পিয়াড ও একাডেমিক সমস্যা। নিজের গতিতে সমস্যা বেছে নিন ও সমাধান করুন, সাথে সাথে সঠিক উত্তর ও পুরো সমাধান দেখুন, কিংবা প্রস্তুত হলে সময় ধরে একটি প্র্যাকটিস টেস্ট দিন।"
  },
  "cta.browseProblems": { en: "Browse the problem bank", bn: "সমস্যার মজুদ দেখুন" },
  "cta.takeTest": { en: "Take a practice test", bn: "প্র্যাকটিস টেস্ট দিন" },
  "hero.statProblems": { en: "Problems in the bank", bn: "সমস্যার মজুদ" },
  "hero.statTopics": { en: "Topics covered", bn: "টপিক" },
  "hero.statLevels": { en: "Levels, Primary → HSC", bn: "স্তর, প্রাথমিক → উচ্চ মাধ্যমিক" },
  "hero.statLangs": { en: "Languages", bn: "ভাষা" },

  /* ---- generic actions ---- */
  "action.start": { en: "Start test", bn: "টেস্ট শুরু করুন" },
  "action.next": { en: "Next", bn: "পরবর্তী" },
  "action.prev": { en: "Previous", bn: "পূর্ববর্তী" },
  "action.submit": { en: "Submit test", bn: "টেস্ট জমা দিন" },
  "action.retry": { en: "Try again", bn: "আবার চেষ্টা করুন" },
  "action.viewResults": { en: "View results", bn: "ফলাফল দেখুন" },
  "action.back": { en: "Go back", bn: "ফিরে যান" },
  "action.clearAll": { en: "Reset", bn: "রিসেট" },
  "action.select": { en: "Select", bn: "নির্বাচন" },
  "action.selectAll": { en: "Select all", bn: "সব নির্বাচন" },
  "action.deselectAll": { en: "Clear selection", bn: "নির্বাচন মুছুন" },
  "action.seeSolution": { en: "See solution", bn: "সমাধান দেখুন" },
  "action.hideSolution": { en: "Hide solution", bn: "সমাধান লুকান" },
  "action.check": { en: "Check answer", bn: "উত্তর যাচাই করুন" },

  /* ---- filters ---- */
  "filter.title": { en: "Filter problems", bn: "সমস্যা ফিল্টার করুন" },
  "footer.quickLinks": { en: "Quick links", bn: "দ্রুত লিংক" },
  "filter.type": { en: "Type", bn: "টাইপ" },
  "filter.topic": { en: "Topic", bn: "টপিক" },
  "filter.category": { en: "Category", bn: "ক্যাটাগরি" },
  "filter.difficulty": { en: "Difficulty", bn: "কঠিনতা" },
  "filter.search": { en: "Search problems…", bn: "সমস্যা খুঁজুন…" },
  "filter.all": { en: "All", bn: "সব" },
  "filter.any": { en: "Any", bn: "যেকোনো" },
  "filter.matching": { en: "matching problems", bn: "মিল থাকা সমস্যা" },
  "filter.none": { en: "No problems match these filters.", bn: "এই ফিল্টারে কোনো সমস্যা মেলে নি।" },
  "filter.noneHint": { en: "Try widening the topic or difficulty selection.", bn: "টপিক বা কঠিনতার নির্বাচন একটু বাড়িয়ে দেখুন।" },

  /* ---- builder ---- */
  "builder.title": { en: "Practice test builder", bn: "প্র্যাকটিস টেস্ট বিল্ডার" },
  "builder.lede": {
    en: "Pick what you want to be tested on, choose how many questions and how long you get — then start.",
    bn: "কী নিয়ে পরীক্ষা হবে বেছে নিন, কটি প্রশ্ন ও কতক্ষণ সময় লাগবে ঠিক করুন — তারপর শুরু করুন।"
  },
  "builder.step1": { en: "1 · Choose the syllabus", bn: "১ · সিলেবাস বেছে নিন" },
  "builder.step2": { en: "2 · Pick your problems", bn: "২ · সমস্যা বেছে নিন" },
  "builder.step3": { en: "3 · Set the timer", bn: "৩ · টাইমার সেট করুন" },
  "builder.count": { en: "Number of questions", bn: "প্রশ্নের সংখ্যা" },
  "builder.duration": { en: "Time limit", bn: "সময়সীমা" },
  "builder.minutes": { en: "minutes", bn: "মিনিট" },
  "builder.minutesShort": { en: "min", bn: "মি." },
  "builder.perProblem": { en: "≈ {n} min per problem", bn: "≈ প্রতি সমস্যা {n} মিনিট" },
  "builder.pool": { en: "Available pool", bn: "পাওয়া যায় এমন" },
  "builder.selected": { en: "selected", bn: "নির্বাচিত" },
  "builder.autoPick": { en: "Auto-pick for me", bn: "নিজে থেকে বেছে দিন" },
  "builder.manualPick": { en: "I'll choose", bn: "আমি নিজে বাছব" },
  "builder.randomSeed": { en: "Shuffle", bn: "এলোমেলো করুন" },
  "builder.ready": { en: "Ready to start", bn: "শুরু করতে প্রস্তুত" },
  "builder.needProblems": { en: "Select at least one problem to begin.", bn: "শুরু করতে অন্তত একটি সমস্যা নির্বাচন করুন।" },
  "builder.needTime": { en: "Set a time limit first.", bn: "আগে একটি সময়সীমা দিন।" },
  "builder.confirm": { en: "Start the test", bn: "টেস্ট শুরু করুন" },

  /* ---- runner ---- */
  "runner.question": { en: "Question", bn: "প্রশ্ন" },
  "runner.of": { en: "of", bn: "এর মধ্যে" },
  "runner.remaining": { en: "Remaining", bn: "বাকি" },
  "runner.timeUp": { en: "Time's up!", bn: "সময় শেষ!" },
  "runner.answerPlaceholder": { en: "Type your answer…", bn: "উত্তর লিখুন…" },
  "runner.answered": { en: "answered", bn: "উত্তর দেওয়া হয়েছে" },
  "runner.unanswered": { en: "left blank", bn: "খালি" },
  "runner.progress": { en: "Progress", bn: "অগ্রগতি" },
  "runner.confirmSubmit": { en: "Submit the test now? You can't change answers afterwards.", bn: "এখনই টেস্ট জমা দেবেন? এরপর উত্তর বদলানো যাবে না।" },
  "runner.autoSubmitNotice": { en: "Time ran out — your paper was submitted automatically.", bn: "সময় শেষ হয়ে গেছে — আপনার কাগজ স্বয়ংক্রিয়ভাবে জমা হয়ে গেছে।" },
  "runner.notFound": { en: "We couldn't find this test.", bn: "এই টেস্টটি খুঁজে পাওয়া যায়নি।" },
  "runner.notFoundHint": {
    en: "It may have been deleted or opened in a different browser. Build a new one to get started.",
    bn: "সম্ভবত এটি মুছে ফেলা হয়েছে বা অন্য ব্রাউজারে খোলা হয়েছে। নতুন একটি টেস্ট তৈরি করে শুরু করুন।"
  },
  "runner.answerKindNumber": { en: "number", bn: "সংখ্যা" },
  "runner.answerKindFraction": { en: "fraction (a/b)", bn: "ভগ্নাংশ (a/b)" },

  /* ---- results ---- */
  "result.title": { en: "Your result", bn: "আপনার ফলাফল" },
  "result.score": { en: "Score", bn: "স্কোর" },
  "result.correct": { en: "Correct", bn: "সঠিক" },
  "result.incorrect": { en: "Incorrect", bn: "ভুল" },
  "result.skipped": { en: "Skipped", bn: "বাদ পড়েছে" },
  "result.timeTaken": { en: "Time taken", bn: "ব্যয়িত সময়" },
  "result.grade": { en: "Grade", bn: "গ্রেড" },
  "result.review": { en: "Review every problem", bn: "প্রতিটি সমস্যা দেখুন" },
  "result.yourAnswer": { en: "Your answer", bn: "আপনার উত্তর" },
  "result.correctAnswer": { en: "Correct answer", bn: "সঠিক উত্তর" },
  "result.explanation": { en: "Solution", bn: "সমাধান" },
  "result.saveNotice": { en: "Saved to your Past Practice Tests.", bn: "আপনার পূর্ববর্তী প্র্যাকটিস টেস্টে সংরক্ষিত হয়েছে।" },
  "result.newTest": { en: "Build another test", bn: "আরেকটি টেস্ট তৈরি করুন" },
  "result.backToPast": { en: "See past tests", bn: "পূর্ববর্তী টেস্ট দেখুন" },

  /* ---- past tests ---- */
  "past.title": { en: "Past practice tests", bn: "পূর্ববর্তী প্র্যাকটিস টেস্ট" },
  "past.lede": {
    en: "Every test you've sat in this browser — with the full answer review kept safe.",
    bn: "এই ব্রাউজারে আপনি যেসব টেস্ট দিয়েছেন তার সবই এখানে — পুরো উত্তর রিভিউ সহ।"
  },
  "past.empty": { en: "No tests yet.", bn: "এখনো কোনো টেস্ট নেই।" },
  "past.emptyHint": { en: "Build your first practice test and it will appear here automatically.", bn: "আপনার প্রথম প্র্যাকটিস টেস্ট তৈরি করুন — এখানে নিজে থেকেই দেখা যাবে।" },
  "past.create": { en: "Create your first test", bn: "প্রথম টেস্ট তৈরি করুন" },
  "past.taken": { en: "Taken on", bn: "যখন দিয়েছেন" },
  "past.duration": { en: "Duration", bn: "সময়কাল" },
  "past.questions": { en: "Questions", bn: "প্রশ্ন" },
  "past.delete": { en: "Delete", bn: "মুছুন" },
  "past.deleteConfirm": { en: "Delete this test permanently?", bn: "এই টেস্ট স্থায়ীভাবে মুছে ফেলবেন?" },
  "past.summary": { en: "Your summary", bn: "আপনার সারসংক্ষেপ" },
  "past.totalTests": { en: "Tests taken", bn: "দেওয়া টেস্ট" },
  "past.avgScore": { en: "Average score", bn: "গড় স্কোর" },
  "past.bestScore": { en: "Best score", bn: "সর্বোচ্চ স্কোর" },
  "past.totalCorrect": { en: "Problems solved right", bn: "সঠিকভাবে সমাধান করা সমস্যা" },
  "past.cloudSync": { en: "Synced", bn: "সিঙ্ক হয়েছে" },
  "past.localOnly": { en: "On this device", bn: "এই ডিভাইসে" },
  "past.statusSubmitted": { en: "Submitted", bn: "জমা হয়েছে" },

  /* ---- problems archive ---- */
  "archive.title": { en: "Problem archive", bn: "সমস্যার সংগ্রহ" },
  "archive.lede": {
    en: "Every problem in the bank, filterable by type, topic, category and difficulty.",
    bn: "মজুদের প্রতিটি সমস্যা — টাইপ, টপিক, ক্যাটাগরি ও কঠিনতা অনুযায়ী ফিল্টার করুন।"
  },
  "archive.addToTest": { en: "Add to a test", bn: "টেস্টে যোগ করুন" },
  "archive.showStatement": { en: "Show statement", bn: "প্রশ্ন দেখুন" },
  "archive.hideStatement": { en: "Hide statement", bn: "প্রশ্ন লুকান" },
  "archive.tryIt": { en: "Try it now", bn: "এখনই চেষ্টা করুন" },
  "archive.correct": { en: "Correct!", bn: "সঠিক!" },
  "archive.wrong": { en: "Not quite — try again.", bn: "একটু ভুল — আবার চেষ্টা করুন।" },
  "archive.from": { en: "Source", bn: "উৎস" },

  /* ---- home sections ---- */
  "home.howEyebrow": { en: "Problem solving", bn: "সমস্যা সমাধান" },
  "home.howTitle": { en: "How it works", bn: "কীভাবে কাজ করে" },
  "home.how1t": { en: "Choose your level & topics", bn: "স্তর ও টপিক বেছে নিন" },
  "home.how1d": {
    en: "Narrow 140+ problems down by type, topic, category and difficulty until you have exactly what you want to solve.",
    bn: "১৪০+ সমস্যার মধ্যে টাইপ, টপিক, ক্যাটাগরি ও কঠিনতা দিয়ে ফিল্টার করে ঠিক যা সমাধান করতে চান তা বেছে নিন।"
  },
  "home.how2t": { en: "Solve and check instantly", bn: "সমাধান করে সাথে সাথে যাচাই" },
  "home.how2d": {
    en: "Every problem is auto-gradable, so you know the moment your answer is right — then read the full solution in Bangla or English.",
    bn: "প্রতিটি সমস্যা স্বয়ংক্রিয়ভাবে যাচাই হয়, তাই উত্তর ঠিক হয়েছে কি না জানা যায় সঙ্গে সঙ্গে — এরপর বাংলা বা ইংরেজিতে পুরো সমাধানটি পড়ুন।"
  },
  "home.how3t": { en: "Sit a timed practice test", bn: "সময় ধরে প্র্যাকটিস টেস্ট দিন" },
  "home.how3d": {
    en: "When you're ready, gather your selection into a full paper — pick a question count, run the clock, and get graded the second you submit.",
    bn: "প্রস্তুত হলে নির্বাচিত সমস্যা দিয়ে পুরো একটি কাগজ করুন — প্রশ্নের সংখ্যা ঠিক করুন, ঘড়ি চালু করুন, আর জমা দেওয়ার সাথে সাথেই গ্রেড পান।"
  },
  "home.how4t": { en: "Track your progress", bn: "অগ্রগতি দেখে নিন" },
  "home.how4d": {
    en: "Each test is filed in your Past Practice Tests with every answer and solution, so you can revisit your mistakes whenever you like.",
    bn: "প্রতিটি টেস্ট সব উত্তর ও সমাধান সহ পূর্ববর্তী প্র্যাকটিস টেস্টে জমা থাকে, তাই ভুলগুলো যেকোনো সময় দেখে নিতে পারবেন।"
  },

  /* ---- platform parts (problem solving is the theme; tests are one part) ---- */
  "home.partsEyebrow": { en: "The platform", bn: "প্ল্যাটফর্ম" },
  "home.partsTitle": { en: "Practice tests are just one part of it", bn: "প্র্যাকটিস টেস্ট এর একটি অংশ মাত্র" },
  "home.partsLede": {
    en: "It starts with the problems themselves — solve, learn, and use tests when you want to measure yourself.",
    bn: "এর শুরু সমস্যাগুলো নিজে থেকেই — সমাধান করুন, শিখুন, আর নিজেকে যাচাই করতে চাইলে টেস্ট ব্যবহার করুন।"
  },
  "home.partsBankT": { en: "Explore the problem bank", bn: "সমস্যার মজুদ ঘুরে দেখুন" },
  "home.partsBankD": {
    en: "{n} problems filterable by type, topic, category and difficulty — each with its own full bilingual solution.",
    bn: "{n}টি সমস্যা — টাইপ, টপিক, ক্যাটাগরি ও কঠিনতা অনুযায়ী ফিল্টারযোগ্য; প্রতিটিরই পূর্ণ দ্বিভাষিক সমাধান আছে।"
  },
  "home.partsTestT": { en: "Build a timed test", bn: "সময়বদ্ধ টেস্ট তৈরি করুন" },
  "home.partsTestD": {
    en: "Turn any selection of problems into a full paper with a countdown, auto-submit and instant grading.",
    bn: "যেকোনো সমস্যা নিয়ে ঘড়ি, স্বয়ংক্রিয় জমা ও সাথে সাথে গ্রেডিং সহ পুরো একটি কাগজ তৈরি করুন।"
  },
  "home.partsReviewT": { en: "Learn from solutions", bn: "সমাধান থেকে শিখুন" },
  "home.partsReviewD": {
    en: "Compare your answer with the correct one and work through a written solution — in the language you think in.",
    bn: "নিজের উত্তর সঠিক উত্তরের সঙ্গে মেলান আর লিখিত সমাধানটি বুঝে নিন — আপনি যে ভাষায় ভাবেন সেই ভাষায়।"
  },
  "home.partsOpen": { en: "Open", bn: "খুলুন" },

  "home.topicsTitle": { en: "Explore by topic", bn: "টপিক অনুযায়ী দেখুন" },
  "home.topicsLede": {
    en: "Six pillars of competition mathematics, from primary level up to national olympiad standard.",
    bn: "প্রাথমিক থেকে জাতীয় অলিম্পিয়াড পর্যন্ত প্রতিযোগিতামূলক গণিতের ছয়টি স্তম্ভ।"
  },
  "home.problemsIn": { en: "problems", bn: "টি সমস্যা" },
  "home.practiceCtaTitle": { en: "Ready to solve your first problem?", bn: "প্রথম সমস্যাটি সমাধান করতে প্রস্তুত?" },
  "home.practiceCtaLede": {
    en: "Open the bank and solve one in seconds — or gather a handful into a timed paper when you want a challenge.",
    bn: "মজুদ খুলে কয়েক সেকেন্ডেই একটি সমস্যা সমাধান করুন — কিংবা চ্যালেঞ্জ চাইলে কয়েকটি নিয়ে একটি সময়বদ্ধ কাগজ করুন।"
  },
  "home.featuredBdmo": { en: "Olympiad-flavoured", bn: "অলিম্পিয়াড ধাঁচের" },
  "home.featuredBdmoD": {
    en: "A large share of the bank is modelled on BdMO Regional and National rounds.",
    bn: "মজুদের বড় অংশ বিডিএমও রিজিওনাল ও ন্যাশনাল রাউন্ডের আদলে তৈরি।"
  },
  "home.featuredBn": { en: "Bangla + English", bn: "বাংলা + ইংরেজি" },
  "home.featuredBnD": {
    en: "Read every statement and solution in the language you think in.",
    bn: "যে ভাষায় ভাবেন সেই ভাষায় প্রতিটি প্রশ্ন ও সমাধান পড়ুন।"
  },
  "home.featuredOffline": { en: "Works offline", bn: "অফলাইনেও কাজ করে" },
  "home.featuredOfflineD": {
    en: "The full problem bank ships with the site, so tests keep working even without a network.",
    bn: "পুরো সমস্যার মজুদ সাইটের সাথেই থাকে, তাই ইন্টারনেট ছাড়াও টেস্ট দেওয়া যায়।"
  },

  /* ---- 404 ---- */
  "notFound.body": {
    en: "The page you're looking for doesn't exist or has moved.",
    bn: "আপনি যে পাতাটি খুঁজছেন সেটি পাওয়া যায়নি।"
  },
  "notFound.action": { en: "Back to home", bn: "হোমে ফিরে যান" },

  /* ---- scheduled tests (weekly / monthly) ---- */
  "nav.tests": { en: "Scheduled Tests", bn: "নির্ধারিত টেস্ট" },
  "nav.leaderboard": { en: "Leaderboard", bn: "লিডারবোর্ড" },
  "kind.weekly": { en: "Weekly", bn: "সাপ্তাহিক" },
  "kind.monthly": { en: "Monthly", bn: "মাসিক" },
  "kind.custom": { en: "Custom", bn: "কাস্টম" },
  "time.d": { en: "d", bn: "দি" },
  "tests.eyebrow": { en: "Weekly & monthly", bn: "সাপ্তাহিক ও মাসিক" },
  "tests.title": { en: "Scheduled tests", bn: "নির্ধারিত টেস্ট" },
  "tests.intro": {
    en: "A fresh paper every week and a bigger challenge every month — one attempt each, timed, ranked live.",
    bn: "প্রতি সপ্তাহে নতুন একটি পত্র আর প্রতি মাসে বড় একটি চ্যালেঞ্জ — প্রতিটিতে একবারই দেওয়া যাবে, সময় ধরে, লাইভ র‍্যাঙ্কিংসহ।"
  },
  "tests.phase.live": { en: "Live now", bn: "এখন চলছে" },
  "tests.phase.upcoming": { en: "Upcoming", bn: "আসছে" },
  "tests.phase.ended": { en: "Ended", bn: "শেষ" },
  "tests.startsIn": { en: "Starts in", bn: "শুরু হবে" },
  "tests.endsIn": { en: "Ends in", bn: "শেষ হবে" },
  "tests.startsAt": { en: "Opens {when}", bn: "খুলবে {when}" },
  "tests.endsAt": { en: "Closes {when}", bn: "বন্ধ হবে {when}" },
  "tests.endedAt": { en: "Closed {when}", bn: "বন্ধ হয়েছে {when}" },
  "tests.duration": { en: "Duration", bn: "সময়" },
  "tests.minutes": { en: "{n} min", bn: "{n} মিনিট" },
  "tests.problems": { en: "{n} problems", bn: "{n}টি সমস্যা" },
  "tests.participants": { en: "{n} joined", bn: "{n} জন অংশ নিয়েছেন" },
  "tests.btn.start": { en: "Start test", bn: "টেস্ট শুরু করুন" },
  "tests.btn.resume": { en: "Resume attempt", bn: "চেষ্টা চালিয়ে যান" },
  "tests.btn.result": { en: "View result", bn: "ফলাফল দেখুন" },
  "tests.btn.standings": { en: "Standings", bn: "স্ট্যান্ডিংস" },
  "tests.btn.hideStandings": { en: "Hide standings", bn: "স্ট্যান্ডিংস লুকান" },
  "tests.standings.title": { en: "Standings", bn: "স্ট্যান্ডিংস" },
  "tests.standings.empty": {
    en: "No submissions yet — the first place is open.",
    bn: "এখনো কেউ জমা দেয়নি — প্রথম স্থানটি খালি।"
  },
  "tests.standings.hint": {
    en: "Score decides rank; a faster hand-in wins ties.",
    bn: "র‍্যাঙ্ক নির্ধারণ করে স্কোর; সমতায় দ্রুত জমা দেওয়াকে অগ্রাধিকার।"
  },
  "tests.name.title": { en: "Pick a display name", bn: "ডিসপ্লে নাম দিন" },
  "tests.name.hint": {
    en: "Shown on the standings and leaderboard. You can change it before your next attempt.",
    bn: "স্ট্যান্ডিংস ও লিডারবোর্ডে দেখানো হবে। পরের চেষ্টার আগে এটি বদলানো যাবে।"
  },
  "tests.name.placeholder": { en: "e.g. Rafiq R.", bn: "যেমন: রফিক র." },
  "tests.name.submit": { en: "Start the clock", bn: "ঘড়ি চালু করুন" },
  "tests.name.required": { en: "Please enter a name.", bn: "অনুগ্রহ করে একটি নাম দিন।" },
  "tests.closed": {
    en: "This test is no longer accepting attempts.",
    bn: "এই টেস্টে আর চেষ্টা করা যাচ্ছে না।"
  },
  "tests.notFound": { en: "That test could not be loaded.", bn: "টেস্টটি খোঁজা যায়নি।" },

  /* ---- leaderboard (problems solved) ---- */
  "lb.eyebrow": { en: "Problems solved", bn: "সমাধান করা সমস্যা" },
  "lb.title": { en: "Leaderboard", bn: "লিডারবোর্ড" },
  "lb.intro": {
    en: "The overall board: how many problems has each learner solved across every scheduled test? Ties break on best score, then time.",
    bn: "সামগ্রিক বোর্ড: প্রতিটি শিক্ষার্থী নির্ধারিত টেস্টগুলো মিলিয়ে মোট কতটি সমস্যা সমাধান করেছেন? সমতায় আগে সেরা স্কোর, তারপর সময়।"
  },
  "lb.tab.week": { en: "This week", bn: "এই সপ্তাহ" },
  "lb.tab.month": { en: "This month", bn: "এই মাস" },
  "lb.tab.all": { en: "All time", bn: "সব সময়" },
  "lb.col.rank": { en: "Rank", bn: "র‍্যাঙ্ক" },
  "lb.col.name": { en: "Learner", bn: "শিক্ষার্থী" },
  "lb.col.solved": { en: "Problems solved", bn: "সমাধান" },
  "lb.col.tests": { en: "Tests", bn: "টেস্ট" },
  "lb.col.best": { en: "Best score", bn: "সেরা স্কোর" },
  "lb.col.score": { en: "Score", bn: "স্কোর" },
  "lb.col.time": { en: "Time", bn: "সময়" },
  "lb.you": { en: "You", bn: "আপনি" },
  "lb.yourRank": { en: "You: #{rank} · {solved} solved", bn: "আপনি: #{rank} · {solved} সমাধান" },
  "lb.notRanked": {
    en: "You're not on the board yet — sit a scheduled test to enter.",
    bn: "আপনি এখনো বোর্ডে নেই — নির্ধারিত টেস্ট দিয়ে অংশ নিন।"
  },
  "lb.empty": {
    en: "No submissions in this window yet — the first board is yours to take.",
    bn: "এই সময়ে এখনো কিছু জমা পড়েনি — প্রথম স্থানটি আপনার জন্যই রয়ে গেছে।"
  },
  "lb.source.local": { en: "Offline — standings from this device.", bn: "অফলাইন — এই ডিভাইসের স্ট্যান্ডিংস দেখানো হচ্ছে।" },
  "lb.source.cloud": { en: "Live from the cloud.", bn: "ক্লাউড থেকে লাইভ।" },
  "results.standings": { en: "See the standings", bn: "স্ট্যান্ডিংস দেখুন" },
  "results.rank": { en: "Your rank", bn: "আপনার র‍্যাঙ্ক" },
  "results.rankOf": { en: "#{rank} of {total}", bn: "{total} জনের মধ্যে #{rank}" },

  /* ---- admin dashboard ---- */
  "admin.title": { en: "Admin dashboard", bn: "অ্যাডমিন ড্যাশবোর্ড" },
  "admin.eyebrow": { en: "Staff only", bn: "শুধু স্টাফ" },
  "admin.login.id": { en: "Admin ID", bn: "অ্যাডমিন আইডি" },
  "admin.login.password": { en: "Password", bn: "পাসওয়ার্ড" },
  "admin.login.submit": { en: "Sign in", bn: "সাইন ইন" },
  "admin.login.error": { en: "Wrong ID or password.", bn: "আইডি বা পাসওয়ার্ড ভুল।" },
  "admin.login.hint": {
    en: "Credentials come from the ADMIN_ID / ADMIN_PASSWORD environment variables (defaults: admin · gonit-ishkul).",
    bn: "পরিচয়পত্র ADMIN_ID / ADMIN_PASSWORD এনভায়রনমেন্ট ভেরিয়েবল থেকে আসে (ডিফল্ট: admin · gonit-ishkul)।"
  },
  "admin.logout": { en: "Sign out", bn: "সাইন আউট" },
  "admin.expired": { en: "Session expired — please sign in again.", bn: "সেশনের মেয়াদ শেষ — আবার সাইন ইন করুন।" },
  "admin.error": { en: "Request failed. Try again.", bn: "অনুরোধ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" },
  "admin.tab.overview": { en: "Overview", bn: "ওভারভিউ" },
  "admin.tab.problems": { en: "Problems", bn: "সমস্যা" },
  "admin.tab.tests": { en: "Scheduled tests", bn: "নির্ধারিত টেস্ট" },
  "admin.tab.submissions": { en: "Submissions", bn: "জমাদান" },
  "admin.stat.problems": { en: "Problems", bn: "সমস্যা" },
  "admin.stat.tests": { en: "Scheduled tests", bn: "নির্ধারিত টেস্ট" },
  "admin.stat.submissions": { en: "Submissions", bn: "জমাদান" },
  "admin.stat.learners": { en: "Learners", bn: "শিক্ষার্থী" },
  "admin.stat.source": { en: "Data source", bn: "ডেটা উৎস" },
  "admin.source.postgres": { en: "PostgreSQL", bn: "পোস্টগ্রেস" },
  "admin.source.file": { en: "Local file (no database reachable)", bn: "লোকাল ফাইল (ডেটাবেস পাওয়া যায়নি)" },
  "admin.problems.new": { en: "New problem", bn: "নতুন সমস্যা" },
  "admin.problems.edit": { en: "Edit", bn: "সম্পাদনা" },
  "admin.problems.delete": { en: "Delete", bn: "মুছুন" },
  "admin.problems.save": { en: "Save problem", bn: "সমস্যা সংরক্ষণ" },
  "admin.problems.cancel": { en: "Cancel", bn: "বাতিল" },
  "admin.problems.saved": { en: "Problem saved.", bn: "সমস্যা সংরক্ষিত হয়েছে।" },
  "admin.problems.deleted": { en: "Problem deleted.", bn: "সমস্যা মুছে ফেলা হয়েছে।" },
  "admin.problems.search": { en: "Search problems…", bn: "সমস্যা খুঁজুন…" },
  "admin.problems.count": { en: "{n} problems", bn: "{n}টি সমস্যা" },
  "admin.problems.newBadge": { en: "New", bn: "নতুন" },
  "admin.tests.new": { en: "New scheduled test", bn: "নতুন নির্ধারিত টেস্ট" },
  "admin.tests.edit": { en: "Edit test", bn: "টেস্ট সম্পাদনা" },
  "admin.tests.save": { en: "Save test", bn: "টেস্ট সংরক্ষণ" },
  "admin.tests.delete": { en: "Delete", bn: "মুছুন" },
  "admin.tests.saved": { en: "Test saved.", bn: "টেস্ট সংরক্ষিত হয়েছে।" },
  "admin.tests.deleted": { en: "Test deleted.", bn: "টেস্ট মুছে ফেলা হয়েছে।" },
  "admin.tests.confirm": { en: "Delete this test?", bn: "এই টেস্টটি মুছবেন?" },
  "admin.tests.count": { en: "{n} scheduled tests", bn: "{n}টি নির্ধারিত টেস্ট" },
  "admin.submissions.col.date": { en: "Submitted", bn: "জমা" },
  "admin.tests.invalid": { en: "Title, window and at least one problem are required.", bn: "শিরোনাম, সময় ও অন্তত একটি সমস্যা লাগবে।" },
  "admin.submissions.empty": { en: "No submissions yet.", bn: "এখনো কিছু জমা পড়েনি।" },
  "admin.confirmProblem": { en: "Delete this problem?", bn: "এই সমস্যাটি মুছবেন?" },
  "admin.f.kind": { en: "Kind", bn: "ধরন" },
  "admin.f.titleBn": { en: "Title — Bangla", bn: "শিরোনাম — বাংলা" },
  "admin.f.titleEn": { en: "Title — English", bn: "শিরোনাম — ইংরেজি" },
  "admin.f.descBn": { en: "Description — Bangla", bn: "বিবরণ — বাংলা" },
  "admin.f.descEn": { en: "Description — English", bn: "বিবরণ — ইংরেজি" },
  "admin.f.statementBn": { en: "Statement — Bangla", bn: "শর্ট — বাংলা" },
  "admin.f.statementEn": { en: "Statement — English", bn: "শর্ট — ইংরেজি" },
  "admin.f.solutionBn": { en: "Solution — Bangla", bn: "সমাধান — বাংলা" },
  "admin.f.solutionEn": { en: "Solution — English", bn: "সমাধান — ইংরেজি" },
  "admin.f.answer": { en: "Answer (exact)", bn: "উত্তর (নিখুঁত)" },
  "admin.f.type": { en: "Type", bn: "ধরন" },
  "admin.f.topic": { en: "Topic", bn: "বিষয়" },
  "admin.f.category": { en: "Category", bn: "শ্রেণি" },
  "admin.f.difficulty": { en: "Difficulty", bn: "কঠিনতা" },
  "admin.f.source": { en: "Source (optional)", bn: "উৎস (ঐচ্ছিক)" },
  "admin.f.start": { en: "Starts", bn: "শুরু" },
  "admin.f.end": { en: "Ends", bn: "শেষ" },
  "admin.f.durationMin": { en: "Duration (minutes)", bn: "সময় (মিনিট)" },
  "admin.f.problemIds": { en: "Problem IDs (comma separated)", bn: "সমস্যার আইডি (কমা দিয়ে)" },
  "admin.f.published": { en: "Published", bn: "প্রকাশিত" },
  "admin.f.optional": { en: "optional", bn: "ঐচ্ছিক" },
  "admin.window": { en: "{from} → {to}", bn: "{from} → {to}" },
  "admin.phase": { en: "Phase: {phase}", bn: "পর্ব: {phase}" },

  /* ---- misc ---- */
  "misc.loading": { en: "Loading…", bn: "লোড হচ্ছে…" },
  "misc.online": { en: "Cloud synced", bn: "ক্লাউড সিঙ্ক" },
  "misc.offline": { en: "Offline mode", bn: "অফলাইন মোড" },
  "misc.footerNote": {
    en: "A free, bilingual home for problem solving — olympiad and academic problems, full solutions and practice tests for every level.",
    bn: "সমস্যা সমাধানের একটি বিনামূল্যের দ্বিভাষিক ঠিকানা — সব স্তরের জন্য অলিম্পিয়াড ও একাডেমিক সমস্যা, পূর্ণ সমাধান ও প্র্যাকটিস টেস্ট।"
  },
  "misc.copyright": { en: "© {year} Gonit Ishkul Problem Solving. All rights reserved.", bn: "© {year} গণিত ইশকুল প্রবলেম সলভিং। সর্বস্বত্ব সংরক্ষিত।" }
};

export const TOPIC_LABELS: Record<ProblemTopic, Localized> = {
  NUMBER_THEORY: { en: "Number Theory", bn: "সংখ্যাতত্ত্ব" },
  ALGEBRA: { en: "Algebra", bn: "বীজগণিত" },
  GEOMETRY: { en: "Geometry", bn: "জ্যামিতি" },
  COMBINATORICS: { en: "Combinatorics", bn: "যোজনবিদ্যা" },
  INEQUALITY: { en: "Inequality", bn: "অসমতা" },
  PROBABILITY: { en: "Probability", bn: "সম্ভাব্যতা" }
};

export const CATEGORY_LABELS: Record<ProblemCategory, Localized> = {
  PRIMARY: { en: "Primary", bn: "প্রাথমিক" },
  JUNIOR: { en: "Junior", bn: "জুনিয়র" },
  SECONDARY: { en: "Secondary", bn: "মাধ্যমিক" },
  HIGHER_SECONDARY: { en: "Higher Secondary", bn: "উচ্চ মাধ্যমিক" }
};

export const DIFFICULTY_LABELS: Record<ProblemDifficulty, Localized> = {
  EASY: { en: "Easy", bn: "সহজ" },
  MEDIUM: { en: "Medium", bn: "মাঝারি" },
  HARD: { en: "Hard", bn: "কঠিন" },
  OLYMPIAD: { en: "Olympiad", bn: "অলিম্পিয়াড" }
};

export const TYPE_LABELS: Record<ProblemType, Localized> = {
  OLYMPIAD: { en: "Olympiad", bn: "অলিম্পিয়াড" },
  ACADEMICS: { en: "Academics", bn: "একাডেমিক" }
};

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a dictionary key, interpolating `{name}` placeholders. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Pick the current language's field from a Localized object. */
  L: (value: Localized) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());

  useEffect(() => {
    document.documentElement.lang = lang === "bn" ? "bn" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeLang(l);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "bn" ? "en" : "bn";
      writeLang(next);
      return next;
    });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const entry = STRINGS[key];
      let out = entry ? entry[lang] : key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return out;
    };
    return {
      lang,
      setLang,
      toggle,
      t,
      L: (value: Localized) => value[lang]
    };
  }, [lang, setLang, toggle]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
