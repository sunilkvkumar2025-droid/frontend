// File: lib/scoring.ts
// Shared utilities for scoring and feedback

export function getScoreMessage(score: number): { headline: string; message: string } {
  if (score <= 25) {
    return {
      headline: "You're Building Your Foundation! 🌱",
      message: "Every expert was once a beginner. You're learning the basics—keep practicing and you'll see progress soon!"
    };
  }
  if (score <= 45) {
    return {
      headline: "You're Making Progress! 💪",
      message: "You're developing your English skills! Keep going—every conversation makes you stronger."
    };
  }
  if (score <= 60) {
    return {
      headline: "You're Getting Comfortable! ⭐",
      message: "Nice work! You can express your ideas well. Now let's add more variety and confidence."
    };
  }
  if (score <= 75) {
    return {
      headline: "You're Really Strong! 🎯",
      message: "Great job! Your English is clear and effective. With more practice, you'll sound even more natural."
    };
  }
  if (score <= 85) {
    return {
      headline: "You're Excellent! 🌟",
      message: "Impressive! You communicate really well in English. Just a few small improvements and you'll be perfect."
    };
  }
  return {
    headline: "You're Nearly Perfect! 🏆",
    message: "Wow! Your English is outstanding. You're ready for any conversation. Keep shining!"
  };
}
