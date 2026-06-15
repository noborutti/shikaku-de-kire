import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, Info, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Volume2, VolumeX, Dices, Loader2, Globe, Sparkles } from 'lucide-react';

// --- Audio System ---

const createAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  return AudioContext ? new AudioContext() : null;
};

const playTone = (ctx: AudioContext | null, freq: number, type: OscillatorType = 'sine', duration = 0.1, volume = 0.1) => {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + duration);
};

const sounds = {
  select: (ctx: AudioContext | null) => playTone(ctx, 440, 'sine', 0.1, 0.05),
  place: (ctx: AudioContext | null) => {
    playTone(ctx, 523.25, 'sine', 0.15, 0.08);
    setTimeout(() => playTone(ctx, 659.25, 'sine', 0.15, 0.05), 50);
  },
  remove: (ctx: AudioContext | null) => playTone(ctx, 330, 'sine', 0.1, 0.05),
  error: (ctx: AudioContext | null) => playTone(ctx, 110, 'triangle', 0.2, 0.1),
  win: (ctx: AudioContext | null) => {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((note, i) => {
      setTimeout(() => playTone(ctx, note, 'sine', 0.5, 0.1), i * 150);
    });
  }
};

// --- Types ---

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  numberPoint: Point; // The point where the number is
}

interface Puzzle {
  id: number;
  name: string;
  width: number;
  height: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  numbers: { x: number; y: number; value: number }[];
  solution: { x: number; y: number; width: number; height: number }[];
}

// --- Helper Functions ---

const isPointInRect = (px: number, py: number, rx: number, ry: number, rw: number, rh: number) => {
  return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
};

const doRectsOverlap = (r1: Rectangle, r2: Rectangle) => {
  return !(r2.x >= r1.x + r1.width || 
           r2.x + r2.width <= r1.x || 
           r2.y >= r1.y + r1.height || 
           r2.y + r2.height <= r1.y);
};

const SAVE_KEY = 'shikaku_save_data';

type Language = 'en' | 'ja';

function getInitialLanguage(): Language {
  if (typeof navigator !== 'undefined') {
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
  }
  return 'en';
}

function loadSaveData() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Safe deep sanitization of all loaded localStorage values to prevent layout/state crashes
        const data: any = {};
        
        if (parsed.screen === 'menu' || parsed.screen === 'game' || parsed.screen === 'tutorial') {
          data.screen = parsed.screen;
        } else {
          data.screen = 'menu';
        }

        if (parsed.language === 'en' || parsed.language === 'ja') {
          data.language = parsed.language;
        } else {
          data.language = getInitialLanguage();
        }

        if (parsed.difficulty === 'Easy' || parsed.difficulty === 'Medium' || parsed.difficulty === 'Hard' || parsed.difficulty === 'Expert') {
          data.difficulty = parsed.difficulty;
        } else {
          data.difficulty = 'Easy';
        }

        if (parsed.puzzle && typeof parsed.puzzle === 'object' && typeof parsed.puzzle.width === 'number' && typeof parsed.puzzle.height === 'number' && Array.isArray(parsed.puzzle.numbers)) {
          data.puzzle = parsed.puzzle;
        } else {
          data.puzzle = null;
        }

        if (Array.isArray(parsed.rectangles)) {
          data.rectangles = parsed.rectangles;
        } else {
          data.rectangles = [];
        }

        data.isGameCleared = Boolean(parsed.isGameCleared);
        data.isMuted = Boolean(parsed.isMuted);

        data.clearedCount = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
        if (parsed.clearedCount && typeof parsed.clearedCount === 'object') {
          if (typeof parsed.clearedCount.Easy === 'number') data.clearedCount.Easy = parsed.clearedCount.Easy;
          if (typeof parsed.clearedCount.Medium === 'number') data.clearedCount.Medium = parsed.clearedCount.Medium;
          if (typeof parsed.clearedCount.Hard === 'number') data.clearedCount.Hard = parsed.clearedCount.Hard;
          if (typeof parsed.clearedCount.Expert === 'number') data.clearedCount.Expert = parsed.clearedCount.Expert;
        }

        data.elapsedTime = typeof parsed.elapsedTime === 'number' ? parsed.elapsedTime : 0;
        return data;
      }
    }
  } catch (e) {
    console.error("Failed to load save data", e);
  }
  return null;
}

const translations = {
  en: {
    gameInfo: "Game Info",
    title: "Shikaku",
    subtitle: "Divide by Squares",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    expert: "Expert",
    puzzle: "Puzzle",
    rectangles: "Rectangles",
    status: "Status",
    cleared: "Cleared",
    inProgress: "In Progress",
    howToPlayTitle: "How to Play:",
    howToPlayDesc: "Divide the grid into rectangles. Each must contain exactly one number representing its area.",
    muted: "Muted",
    soundOn: "Sound Effects",
    newPuzzle: "New Puzzle",
    hideSolution: "Hide Solution",
    showSolution: "Show Solution",
    hideRules: "Hide Rules",
    showRules: "Show Rules",
    resetPuzzle: "Reset Puzzle",
    giveUp: "Give Up",
    nextPuzzle: "Next Puzzle",
    rulesTitle: "Rules",
    rule1: "• Divide the grid into rectangles (including squares).",
    rule2: "• Each rectangle must contain exactly one number.",
    rule3: "• The number represents the total area of that rectangle.",
    rule4: "• Click and drag to draw. Click to remove.",
    winTitle: "Beautifully Solved",
    winDesc: "The forest is in perfect balance once again.",
    playAgain: "Play Again",
    solved: "Solved",
    error: "Error",
    incomplete: "Incomplete",
    randomPrefix: "Random",
    backToMenu: "Back to Menu",
    selectDifficulty: "Select a Difficulty Level to Start Playing",
    easyDesc: "5x5 grid — Gentle, relaxing puzzles for beginners.",
    mediumDesc: "7x7 grid — A balanced challenge for regular players.",
    hardDesc: "10x10 grid — Mind-bending logic requiring structured play.",
    expertDesc: "15x15 grid — Massive, intricate grids for true masters.",
    resumeGame: "Resume Active Game",
    // Tutorial strings
    tutorialBtn: "Interactive Tutorial ✦ Learn in 1 Min!",
    tutorialBtnDesc: "Learn with satisfying animations & sounds. Perfect for beginners!",
    tutorialTitle: "Shikaku Tutorial",
    tutorialSubtitle: "Learn how to play with fun animations & effects!",
    startTutorial: "Start Tutorial",
    nextStep: "Next Step",
    prevStep: "Previous",
    skipTutorial: "Skip to Game",
    finishTutorial: "Finish & Play!",
    tryYourself: "YOUR TURN",
    tutorialCongrats: "AWESOME SUCCESS!",
    tutorialSuccessDesc: "The mini puzzle is perfectly solved!",
    tutorialGoalStep: "Current Goal:",
    tutorialStep1Title: "1/5. Grid and Numbers",
    tutorialStep1Desc: "Meet the Shikaku grid! The board has cells and numbers. Your ultimate goal is to divide the ENTIRE board into rectangles.",
    tutorialStep1Action: "Observe: The numbers represent the target area of each rectangle we are going to draw.",
    tutorialStep2Title: "2/5. Only One Number",
    tutorialStep2Desc: "Rules state: Each rectangle must contain EXACTLY ONE number. No more, no less!",
    tutorialStep2Action: "Don't combine multiple numbers into a single block! Keep them strictly separate.",
    tutorialStep3Title: "3/5. Matching the Total Area",
    tutorialStep3Desc: "A number represents the exact area (cell count) of its rectangle. For example, a '2' requires a 2-cell block (like 2x1 or 1x2).",
    tutorialStep3Action: "Watch how a rectangle of 2 cells is drawn to encapsulate the number 2.",
    tutorialStep4Title: "4/5. Interactive Practice!",
    tutorialStep4Desc: "Now it's your turn! Drag on the 3x3 grid to solve it yourself.",
    tutorialStep4Action: "1. Draw a 2x1 box for 2. \n2. Draw a 1x3 vertical box for 3. \n3. Draw a 2x2 square box for 4.",
    tutorialStep5Title: "5/5. Certified Shikaku Master!",
    tutorialStep5Desc: "Outstanding! You solved the mini puzzle. You understand all the core layout and partitioning rules.",
    tutorialStep5Action: "You are ready to solve real puzzles of any difficulty. Let the grid challenge your brain!"
  },
  ja: {
    gameInfo: "ゲーム情報",
    title: "四角に切れ",
    subtitle: "四角形で分割",
    easy: "初級",
    medium: "中級",
    hard: "上級",
    expert: "エキスパート",
    puzzle: "問題",
    rectangles: "四角形",
    status: "ステータス",
    cleared: "クリア",
    inProgress: "プレイ中",
    howToPlayTitle: "遊び方:",
    howToPlayDesc: "盤面を四角形に分割します。各四角形には数字が1つだけ入り、その数字は四角形の面積を表します。",
    muted: "消音",
    soundOn: "効果音",
    newPuzzle: "新しい問題",
    hideSolution: "回答を隠す",
    showSolution: "回答を見る",
    hideRules: "ルールを隠す",
    showRules: "ルールを見る",
    resetPuzzle: "リセット",
    giveUp: "ギブアップ",
    nextPuzzle: "次の問題",
    rulesTitle: "ルール",
    rule1: "• 盤面を長方形または正方形に分割します。",
    rule2: "• 各四角形には数字が1つだけ入ります。",
    rule3: "• 数字は、その四角形の面積（マスの数）を表します。",
    rule4: "• ドラッグで四角形を描き、クリックで消去します。",
    winTitle: "クリア！",
    winDesc: "すべてのマスが正しく分割されました。",
    playAgain: "もう一度遊ぶ",
    solved: "正解",
    error: "エラー",
    incomplete: "未完成",
    randomPrefix: "ランダム",
    backToMenu: "メニューに戻る",
    selectDifficulty: "難易度を選択してゲームを開始する",
    easyDesc: "5x5グリッド — 優しくリラックスできる初心者難易度。",
    mediumDesc: "7x7グリッド — バランスの良い適度な挑戦レベル。",
    hardDesc: "10x10グリッド — じっくりと考え抜くための上級パズル。",
    expertDesc: "15x15グリッド — 精緻に組み上げられた最高峰の極大パズル。",
    resumeGame: "現在のゲームを再開",
    // チュートリアル用の文字列
    tutorialBtn: "体験チュートリアル ✦ 1分でわかる！",
    tutorialBtnDesc: "心地よいアニメーションと音で、誰でも今すぐルールを覚えられます！",
    tutorialTitle: "「四角に切れ」チュートリアル",
    tutorialSubtitle: "楽しいアニメーションと効果音でルールをマスターしよう！",
    startTutorial: "チュートリアルを始める",
    nextStep: "次へ進む",
    prevStep: "戻る",
    skipTutorial: "ゲームへスキップ",
    finishTutorial: "ゲームを始める！",
    tryYourself: "あなたの番です！",
    tutorialCongrats: "お見ごと！大成功！",
    tutorialSuccessDesc: "ミニパズルを完璧に解き明かしました！",
    tutorialGoalStep: "現在の目標:",
    tutorialStep1Title: "1/5. マスと数字のルール",
    tutorialStep1Desc: "「四角に切れ」の世界へようこそ！盤面はいくつかのマスと、数字で構成されています。すべてのマスを隙間なく四角形（長方形、正方形）で切り分けるのがゴールです。",
    tutorialStep1Action: "注目：表示されている数字は、そのマスを囲む「四角形の面積（マスの数）」を表しています。",
    tutorialStep2Title: "2/5. 四角の中に数字は1つだけ",
    tutorialStep2Desc: "切り分けたそれぞれの四角形の中には、必ず【数字が1つだけ】入っていなければいけません。数字のない四角形や、2つ以上の数字が入った四角形は作れません！",
    tutorialStep2Action: "2つの数字を1つの四角形にまとめてしまうのはNG！境界線でしっかり切り離しましょう。",
    tutorialStep3Title: "3/5. 数字と同じマス数で囲む",
    tutorialStep3Desc: "数字はカバーするマスの総数（面積）です。例えば、「2」は2マス（幅2×高1、または幅1×高2）の四角形で囲む必要があります。",
    tutorialStep3Action: "「2」の数字を、2つのマスで囲い込むようにドラッグするアニメーションを見てみましょう。",
    tutorialStep4Title: "4/5. 実際にやってみよう！",
    tutorialStep4Desc: "さあ、あなたの番です！この可愛い3x3のミニパズルを実際にドラッグ操作で解いてみましょう。マウスやタップでドラッグして四角形を描き、クリックで消せます。",
    tutorialStep4Action: "1. 「2」を2x1の長方形で囲む。\n2. 「3」を1x3の縦長の長方形で囲む。\n3. 「4」を2x2の正方形で囲む。",
    tutorialStep5Title: "5/5. 四角に切れマスター！",
    tutorialStep5Desc: "素晴らしい！これで完璧にルールをマスターしました。四角形同士が重ならず、すべてのマスが綺麗に切り分けられましたね！",
    tutorialStep5Action: "もう準備は万端です。お好きな難易度を選んで、本番のパズルを楽しみましょう！"
  }
};

// getInitialLanguage has been moved to the top of the file above loadSaveData

// --- Components ---

export default function ShikakuGame() {
  const [saveData] = useState(loadSaveData);
  
  const [screen, setScreen] = useState<'menu' | 'game' | 'tutorial'>(() => {
    const savedScreen = saveData?.screen;
    if (savedScreen === 'menu' || savedScreen === 'game' || savedScreen === 'tutorial') return savedScreen;
    return 'menu';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const savedLang = saveData?.language;
    if (savedLang === 'en' || savedLang === 'ja') return savedLang;
    return getInitialLanguage();
  });
  const t = translations[language] || translations.ja;

  // --- Interactive Tutorial State ---
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [tutorialRectangles, setTutorialRectangles] = useState<Rectangle[]>([]);
  const [tutorialSelection, setTutorialSelection] = useState<{ start: Point; end: Point } | null>(null);
  const [isTutorialDragging, setIsTutorialDragging] = useState(false);
  const [tutorialSolved, setTutorialSolved] = useState(false);
  const tutorialGridRef = useRef<HTMLDivElement>(null);

  const tutorialPuzzleObj = useMemo(() => ({
    width: 3,
    height: 3,
    numbers: [
      { x: 0, y: 0, value: 2 },
      { x: 2, y: 1, value: 3 },
      { x: 0, y: 2, value: 4 }
    ],
    solution: [
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 2, y: 0, width: 1, height: 3 },
      { x: 0, y: 1, width: 2, height: 2 }
    ]
  }), []);

  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert'>(saveData?.difficulty || 'Easy');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(saveData?.puzzle || null);
  const [rectangles, setRectangles] = useState<Rectangle[]>(saveData?.rectangles || []);
  const [isGameCleared, setIsGameCleared] = useState(saveData?.isGameCleared || false);
  const [isMuted, setIsMuted] = useState(saveData?.isMuted || false);
  const [clearedCount, setClearedCount] = useState<Record<'Easy' | 'Medium' | 'Hard' | 'Expert', number>>(() => {
    const defaultCount = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
    if (!saveData || !saveData.clearedCount) return defaultCount;
    return {
      Easy: typeof saveData.clearedCount.Easy === 'number' ? saveData.clearedCount.Easy : 0,
      Medium: typeof saveData.clearedCount.Medium === 'number' ? saveData.clearedCount.Medium : 0,
      Hard: typeof saveData.clearedCount.Hard === 'number' ? saveData.clearedCount.Hard : 0,
      Expert: typeof saveData.clearedCount.Expert === 'number' ? saveData.clearedCount.Expert : 0,
    };
  });
  const [elapsedTime, setElapsedTime] = useState<number>(saveData?.elapsedTime || 0);
  
  const [selection, setSelection] = useState<{ start: Point; end: Point } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isShowingSolution, setIsShowingSolution] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Generate random confetti particles for celebrating
  const confettiParticles = useMemo(() => {
    if (!isGameCleared) return [];
    const colorsList = ['#F97316', '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#F87171', '#38BDF8'];
    const shapesList = ['circle', 'square', 'triangle', 'star'];
    return Array.from({ length: 70 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 60 + Math.random() * 160; // distance
      const destX = Math.cos(angle) * velocity;
      const destY = Math.sin(angle) * velocity - (30 + Math.random() * 70); // upwards bias
      const color = colorsList[Math.floor(Math.random() * colorsList.length)];
      const shape = shapesList[Math.floor(Math.random() * shapesList.length)];
      const size = 6 + Math.random() * 10;
      const delay = Math.random() * 0.4;
      const duration = 1.8 + Math.random() * 1.6;
      return {
        id: i,
        x: destX,
        y: destY,
        color,
        shape,
        size,
        delay,
        duration,
        rotate: Math.random() * 720 - 360,
      };
    });
  }, [isGameCleared]);
  
  const audioCtx = useRef<AudioContext | null>(null);

  // Timer Effect
  useEffect(() => {
    if (screen !== 'game' || isGameCleared || isShowingSolution) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, isGameCleared, isShowingSolution]);

  // Format Elapsed Time: MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs.toString().padStart(2, '0')}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectDifficulty = (d: 'Easy' | 'Medium' | 'Hard' | 'Expert') => {
    setDifficulty(d);
    setScreen('game');
    generateLogicPuzzle(d, true);
  };

  useEffect(() => {
    audioCtx.current = createAudioContext();
    return () => {
      if (audioCtx.current) audioCtx.current.close();
    };
  }, []);

  const playSound = useCallback((soundName: keyof typeof sounds) => {
    if (isMuted || !audioCtx.current) return;
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
    sounds[soundName](audioCtx.current);
  }, [isMuted]);
  
  const generateLogicPuzzle = useCallback((targetDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' = difficulty, playAudio = true) => {
    setIsGenerating(true);
    if (playAudio) playSound('select');

    try {
      const size = targetDifficulty === 'Easy' ? 5 : targetDifficulty === 'Medium' ? 7 : targetDifficulty === 'Hard' ? 10 : 15;
      
      // Logic-based generation using BSP (Binary Space Partitioning)
      interface Rect { x: number; y: number; width: number; height: number; }
      
      function splitRect(r: Rect): Rect[] {
        const area = r.width * r.height;
        // Stop splitting if area is small enough
        if (area <= 2) return [r];
        if (area <= 6 && Math.random() < 0.6) return [r];
        if (area <= 12 && Math.random() < 0.3) return [r];

        let splitH = false;
        if (r.width === 1) splitH = true;
        else if (r.height === 1) splitH = false;
        else splitH = Math.random() > 0.5;

        if (splitH) {
          // Split horizontally (cut across y-axis)
          const splitPoint = Math.floor(Math.random() * (r.height - 1)) + 1;
          return [
            ...splitRect({ x: r.x, y: r.y, width: r.width, height: splitPoint }),
            ...splitRect({ x: r.x, y: r.y + splitPoint, width: r.width, height: r.height - splitPoint })
          ];
        } else {
          // Split vertically (cut across x-axis)
          const splitPoint = Math.floor(Math.random() * (r.width - 1)) + 1;
          return [
            ...splitRect({ x: r.x, y: r.y, width: splitPoint, height: r.height }),
            ...splitRect({ x: r.x + splitPoint, y: r.y, width: r.width - splitPoint, height: r.height })
          ];
        }
      }

      const initialRect = { x: 0, y: 0, width: size, height: size };
      const solutionRects = splitRect(initialRect);

      // Place exactly one number in each rectangle
      const numbers = solutionRects.map(r => {
        const numX = r.x + Math.floor(Math.random() * r.width);
        const numY = r.y + Math.floor(Math.random() * r.height);
        return { x: numX, y: numY, value: r.width * r.height };
      });

      const newPuzzle: Puzzle = {
        id: Date.now(),
        name: `Random ${size}x${size}`,
        width: size,
        height: size,
        difficulty: targetDifficulty,
        numbers: numbers,
        solution: solutionRects
      };

      setPuzzle(newPuzzle);
      setRectangles([]);
      setIsGameCleared(false);
      setIsShowingSolution(false);
      setElapsedTime(0);
      if (playAudio) playSound('place');
    } catch (error) {
      console.error("Failed to generate puzzle:", error);
      if (playAudio) playSound('error');
    } finally {
      setIsGenerating(false);
    }
  }, [difficulty, playSound]);

  // Generate initial puzzle if none was loaded
  useEffect(() => {
    if (!puzzle) {
      generateLogicPuzzle(difficulty, false);
    }
  }, []); // Only run once on mount

  // Save game state to local storage
  useEffect(() => {
    if (puzzle) {
      try {
        const dataToSave = {
          screen: screen === 'tutorial' ? 'menu' : screen,
          language,
          difficulty,
          puzzle,
          rectangles,
          isGameCleared,
          isMuted,
          clearedCount,
          elapsedTime
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        console.error("Failed to save game state to localStorage:", e);
      }
    }
  }, [screen, language, difficulty, puzzle, rectangles, isGameCleared, isMuted, clearedCount, elapsedTime]);

  const gridRef = useRef<HTMLDivElement>(null);

  // Check for win condition
  useEffect(() => {
    if (!puzzle || rectangles.length === 0 || isShowingSolution) return;

    // 1. All cells must be covered
    const totalArea = rectangles.reduce((acc, r) => acc + (r.width * r.height), 0);
    if (totalArea !== puzzle.width * puzzle.height) return;

    // 2. Each rectangle must contain exactly one number
    // 3. The area must match the number
    const allValid = rectangles.every(rect => {
      const numbersInRect = puzzle.numbers.filter(n => 
        isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height)
      );
      
      if (numbersInRect.length !== 1) return false;
      if (rect.width * rect.height !== numbersInRect[0].value) return false;
      return true;
    });

    if (allValid && !isGameCleared) {
      setIsGameCleared(true);
      playSound('win');
      setClearedCount(prev => ({
        ...prev,
        [difficulty]: prev[difficulty] + 1
      }));
    }
  }, [rectangles, puzzle, playSound, isShowingSolution, difficulty, isGameCleared]);

  const handleMouseDown = (x: number, y: number) => {
    if (isGameCleared) return;
    
    // If user interacts with the board while solution is shown, hide it
    if (isShowingSolution) {
      setIsShowingSolution(false);
      return; // Don't place/remove a rectangle on this click, just hide the solution
    }
    
    // If clicking on an existing rectangle, remove it
    const existingRectIndex = rectangles.findIndex(r => isPointInRect(x, y, r.x, r.y, r.width, r.height));
    if (existingRectIndex !== -1) {
      const newRects = [...rectangles];
      newRects.splice(existingRectIndex, 1);
      setRectangles(newRects);
      playSound('remove');
      return;
    }

    setIsDragging(true);
    setSelection({ start: { x, y }, end: { x, y } });
    playSound('select');
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (isDragging && selection) {
      setSelection({ ...selection, end: { x, y } });
    }
  };

  const handleMouseUp = () => {
    if (!isDragging || !selection) return;

    const x = Math.min(selection.start.x, selection.end.x);
    const y = Math.min(selection.start.y, selection.end.y);
    const width = Math.abs(selection.start.x - selection.end.x) + 1;
    const height = Math.abs(selection.start.y - selection.end.y) + 1;

    // Find if this new rectangle contains exactly one number
    const numbersInRect = puzzle.numbers.filter(n => 
      isPointInRect(n.x, n.y, x, y, width, height)
    );

    const newRect: Rectangle = {
      id: Math.random().toString(36).substr(2, 9),
      x, y, width, height,
      numberPoint: numbersInRect.length === 1 ? { x: numbersInRect[0].x, y: numbersInRect[0].y } : { x: -1, y: -1 }
    };

    // Check for overlaps with existing rectangles
    const overlaps = rectangles.some(r => doRectsOverlap(r, newRect));

    if (!overlaps) {
      setRectangles([...rectangles, newRect]);
      playSound('place');
    } else {
      playSound('error');
    }

    setIsDragging(false);
    setSelection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !selection || !gridRef.current || !puzzle) return;
    
    const touch = e.touches[0];
    const rect = gridRef.current.getBoundingClientRect();
    
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return;
    
    const cellX = Math.floor((x / rect.width) * puzzle.width);
    const cellY = Math.floor((y / rect.height) * puzzle.height);
    
    const clampedX = Math.max(0, Math.min(puzzle.width - 1, cellX));
    const clampedY = Math.max(0, Math.min(puzzle.height - 1, cellY));
    
    handleMouseEnter(clampedX, clampedY);
  };

  const resetPuzzle = () => {
    setRectangles([]);
    setIsGameCleared(false);
    setIsShowingSolution(false);
  };

  const toggleSolution = () => {
    if (isGameCleared) return;
    setIsShowingSolution(!isShowingSolution);
    playSound('select');
  };

  const handleGiveUp = () => {
    if (isGameCleared) return;
    setIsShowingSolution(true);
    playSound('select');
  };

  // Render selection overlay
  const renderSelection = () => {
    if (!selection || !puzzle) return null;
    const x = Math.min(selection.start.x, selection.end.x);
    const y = Math.min(selection.start.y, selection.end.y);
    const width = Math.abs(selection.start.x - selection.end.x) + 1;
    const height = Math.abs(selection.start.y - selection.end.y) + 1;

    return (
      <div 
        className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none z-10 transition-all duration-75"
        style={{
          left: `${x * 100 / puzzle.width}%`,
          top: `${y * 100 / puzzle.height}%`,
          width: `${width * 100 / puzzle.width}%`,
          height: `${height * 100 / puzzle.height}%`,
        }}
      />
    );
  };

  // --- Tutorial Verification Hook ---
  useEffect(() => {
    if (screen !== 'tutorial' || tutorialStep !== 3) return;
    
    // Check total area
    const totalArea = tutorialRectangles.reduce((acc, r) => acc + (r.width * r.height), 0);
    if (totalArea !== 9) return;
    
    // Check overlaps
    let overlaps = false;
    for (let i = 0; i < tutorialRectangles.length; i++) {
      for (let j = i + 1; j < tutorialRectangles.length; j++) {
        if (doRectsOverlap(tutorialRectangles[i], tutorialRectangles[j])) {
          overlaps = true;
          break;
        }
      }
    }
    if (overlaps) return;

    // Check validity of numbers inside
    const allValid = tutorialRectangles.every(rect => {
      const numbersInRect = tutorialPuzzleObj.numbers.filter(n => 
        isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height)
      );
      if (numbersInRect.length !== 1) return false;
      if (rect.width * rect.height !== numbersInRect[0].value) return false;
      return true;
    });

    if (allValid) {
      setTutorialSolved(true);
      playSound('win');
      setTimeout(() => {
        setTutorialStep(4);
      }, 1500);
    }
  }, [tutorialRectangles, screen, tutorialStep, tutorialPuzzleObj, playSound]);

  // --- Tutorial Mouse/Touch Handlers ---
  const handleTutorialMouseDown = (x: number, y: number) => {
    if (tutorialStep !== 3 || tutorialSolved) return;
    
    const existingRectIndex = tutorialRectangles.findIndex(r => isPointInRect(x, y, r.x, r.y, r.width, r.height));
    if (existingRectIndex !== -1) {
      const newRects = [...tutorialRectangles];
      newRects.splice(existingRectIndex, 1);
      setTutorialRectangles(newRects);
      playSound('remove');
      return;
    }

    setIsTutorialDragging(true);
    setTutorialSelection({ start: { x, y }, end: { x, y } });
    playSound('select');
  };

  const handleTutorialMouseEnter = (x: number, y: number) => {
    if (isTutorialDragging && tutorialSelection) {
      setTutorialSelection({ ...tutorialSelection, end: { x, y } });
    }
  };

  const handleTutorialMouseUp = () => {
    if (!isTutorialDragging || !tutorialSelection) return;

    const x = Math.min(tutorialSelection.start.x, tutorialSelection.end.x);
    const y = Math.min(tutorialSelection.start.y, tutorialSelection.end.y);
    const width = Math.abs(tutorialSelection.start.x - tutorialSelection.end.x) + 1;
    const height = Math.abs(tutorialSelection.start.y - tutorialSelection.end.y) + 1;

    const numbersInRect = tutorialPuzzleObj.numbers.filter(n => 
      isPointInRect(n.x, n.y, x, y, width, height)
    );

    const newRect: Rectangle = {
      id: Math.random().toString(36).substr(2, 9),
      x, y, width, height,
      numberPoint: numbersInRect.length === 1 ? { x: numbersInRect[0].x, y: numbersInRect[0].y } : { x: -1, y: -1 }
    };

    const overlaps = tutorialRectangles.some(r => doRectsOverlap(r, newRect));

    if (!overlaps) {
      setTutorialRectangles([...tutorialRectangles, newRect]);
      playSound('place');
    } else {
      playSound('error');
    }

    setIsTutorialDragging(false);
    setTutorialSelection(null);
  };

  const handleTutorialTouchMove = (e: React.TouchEvent) => {
    if (!isTutorialDragging || !tutorialSelection || !tutorialGridRef.current) return;
    
    const touch = e.touches[0];
    const rect = tutorialGridRef.current.getBoundingClientRect();
    
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return;
    
    const cellX = Math.floor((x / rect.width) * 3);
    const cellY = Math.floor((y / rect.height) * 3);
    
    const clampedX = Math.max(0, Math.min(2, cellX));
    const clampedY = Math.max(0, Math.min(2, cellY));
    
    handleTutorialMouseEnter(clampedX, clampedY);
  };

  const renderTutorialSelection = () => {
    if (!tutorialSelection) return null;
    const x = Math.min(tutorialSelection.start.x, tutorialSelection.end.x);
    const y = Math.min(tutorialSelection.start.y, tutorialSelection.end.y);
    const width = Math.abs(tutorialSelection.start.x - tutorialSelection.end.x) + 1;
    const height = Math.abs(tutorialSelection.start.y - tutorialSelection.end.y) + 1;

    return (
      <div 
        className="absolute border-2 border-dashed border-natural-olive bg-natural-olive/20 pointer-events-none z-10 transition-all duration-75"
        style={{
          left: `${x * 100 / 3}%`,
          top: `${y * 100 / 3}%`,
          width: `${width * 100 / 3}%`,
          height: `${height * 100 / 3}%`,
        }}
      />
    );
  };

  // --- Interactive Tutorial Helpers & Timers ---
  const [step2Cycle, setStep2Cycle] = useState<'bad' | 'good'>('bad');
  const [step3Cycle, setStep3Cycle] = useState<'idle' | 'dragging' | 'done'>('idle');

  useEffect(() => {
    if (screen !== 'tutorial') return;
    if (tutorialStep === 1) {
      const interval = setInterval(() => {
        setStep2Cycle(prev => prev === 'bad' ? 'good' : 'bad');
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [screen, tutorialStep]);

  useEffect(() => {
    if (screen !== 'tutorial') return;
    if (tutorialStep === 2) {
      const interval = setInterval(() => {
        setStep3Cycle(prev => {
          if (prev === 'idle') return 'dragging';
          if (prev === 'dragging') return 'done';
          return 'idle';
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [screen, tutorialStep]);

  const is2Solved = useMemo(() => {
    return tutorialRectangles.some(r => isPointInRect(0, 0, r.x, r.y, r.width, r.height) && r.width * r.height === 2);
  }, [tutorialRectangles]);

  const is3Solved = useMemo(() => {
    return tutorialRectangles.some(r => isPointInRect(2, 1, r.x, r.y, r.width, r.height) && r.width * r.height === 3);
  }, [tutorialRectangles]);

  const is4Solved = useMemo(() => {
    return tutorialRectangles.some(r => isPointInRect(0, 2, r.x, r.y, r.width, r.height) && r.width * r.height === 4);
  }, [tutorialRectangles]);

  if (screen === 'tutorial') {
    return (
      <div className="h-screen h-[100dvh] max-h-screen md:h-auto md:min-h-screen md:max-h-none bg-natural-bg text-natural-ink font-sans selection:bg-natural-sand/50 flex flex-col items-center justify-start p-3 md:p-8 relative overflow-hidden">
        {/* Ambient forest decor */}
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-natural-sage/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-natural-olive/5 blur-3xl pointer-events-none" />

        <div className="w-full max-w-4xl flex flex-col items-center relative z-10 h-full md:h-auto min-h-0 justify-between">
          {/* Header row */}
          <div className="w-full flex justify-between items-center mb-2 md:mb-6 shrink-0">
            <button
              onClick={() => {
                playSound('select');
                setScreen('menu');
              }}
              className="py-1.5 px-3 md:py-2.5 md:px-4 bg-white/60 hover:bg-white text-natural-ink hover:text-natural-olive rounded-xl md:rounded-2xl font-bold transition-all border border-natural-line/50 flex items-center gap-1.5 text-[11px] md:text-xs shadow-xs cursor-pointer"
            >
              <ChevronLeft size={13} /> {t.backToMenu}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] md:text-xs font-bold text-natural-olive/80 uppercase tracking-widest">{t.tutorialTitle}</span>
              <Sparkles size={14} className="text-amber-500 animate-pulse" />
            </div>
            <button
              onClick={() => {
                playSound('select');
                setScreen('menu');
              }}
              className="text-[11px] md:text-xs font-medium text-[#B7B7A4] hover:text-natural-olive transition-colors underline cursor-pointer"
            >
              {t.skipTutorial}
            </button>
          </div>

          {/* Stepper progress indicator */}
          <div className="w-full bg-white/40 border border-natural-line py-1.5 px-2.5 rounded-xl mb-3 md:mb-8 flex items-center justify-between gap-1.5 md:gap-4 shadow-xs shrink-0">
            {Array.from({ length: 5 }).map((_, idx) => {
              const isActive = tutorialStep === idx;
              const isPast = tutorialStep > idx;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${isPast ? 'bg-natural-olive' : isActive ? 'bg-amber-400 animate-pulse shadow-md shadow-amber-400/20' : 'bg-natural-line/40'}`} />
                  <span className={`text-[10px] font-sans font-bold mt-1 hidden sm:inline ${isActive ? 'text-natural-olive font-extrabold scale-105' : 'text-natural-ink/40'}`}>
                    {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main columns */}
          <div className="w-full flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-8 items-stretch justify-center">
            {/* Guide explanations (Left Panel) */}
            <div className="md:col-span-5 flex flex-col justify-between bg-white/40 border border-natural-line p-3.5 md:p-8 rounded-3xl md:rounded-[40px] shadow-xs relative overflow-hidden min-h-0 md:min-h-[460px] flex-1 md:flex-initial mb-2 md:mb-0">
              {/* Background botanical shadow */}
              <div className="absolute right-[-20%] bottom-[-10%] w-40 h-40 bg-natural-sage/5 rounded-full pointer-events-none" />

              <div className="relative z-10 w-full min-h-0 flex-1 flex flex-col justify-center">
                {/* Step contents with micro animation */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tutorialStep}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col h-full w-full justify-center"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-widest text-natural-sage mb-0.5 md:mb-2 inline-flex items-center gap-1">
                      <Sparkles size={9} className="text-amber-500" />
                      {tutorialStep === 4 ? t.tutorialCongrats : `STEP ${tutorialStep + 1}`}
                    </span>
                    <h2 className="font-serif italic text-base md:text-3xl text-natural-olive tracking-tight leading-snug mb-1 md:mb-4">
                      {tutorialStep === 0 && t.tutorialStep1Title}
                      {tutorialStep === 1 && t.tutorialStep2Title}
                      {tutorialStep === 2 && t.tutorialStep3Title}
                      {tutorialStep === 3 && t.tutorialStep4Title}
                      {tutorialStep === 4 && t.tutorialStep5Title}
                    </h2>
                    <p className="text-[11px] leading-relaxed md:text-sm text-natural-ink/80 mb-2 md:mb-6 font-medium">
                      {tutorialStep === 0 && t.tutorialStep1Desc}
                      {tutorialStep === 1 && t.tutorialStep2Desc}
                      {tutorialStep === 2 && t.tutorialStep3Desc}
                      {tutorialStep === 3 && t.tutorialStep4Desc}
                      {tutorialStep === 4 && t.tutorialStep5Desc}
                    </p>

                    {/* Action Callout Box */}
                    <div className="p-2.5 md:p-4 bg-white/70 border border-natural-line/40 rounded-2xl shadow-xs text-[10px] md:text-xs">
                      <div className="font-extrabold uppercase text-[9px] md:text-[10px] tracking-wider text-natural-olive mb-0.5 md:mb-1 flex items-center gap-1">
                        <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-amber-400 rounded-full animate-ping" />
                        {tutorialStep === 3 ? t.tryYourself : t.tutorialGoalStep}
                      </div>
                      <p className="text-natural-ink/75 leading-relaxed font-sans font-semibold whitespace-pre-line">
                        {tutorialStep === 0 && t.tutorialStep1Action}
                        {tutorialStep === 1 && t.tutorialStep2Action}
                        {tutorialStep === 2 && t.tutorialStep3Action}
                        {tutorialStep === 3 && t.tutorialStep4Action}
                        {tutorialStep === 4 && t.tutorialStep5Action}
                      </p>
                    </div>

                    {/* Real-time Checklist for Step 4 */}
                    {tutorialStep === 3 && (
                      <div className="mt-2 md:mt-4 p-2 md:p-4 bg-white/40 border border-natural-line/20 rounded-2xl flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${is2Solved ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-natural-line/70 bg-white/65'}`}>
                            {is2Solved ? '✓' : ''}
                          </div>
                          <span className={`text-[10px] md:text-xs ${is2Solved ? 'text-green-700 font-bold line-through' : 'text-natural-ink/70'}`}>
                            {language === 'en' ? 'Enclose 2 (2x1)' : '「2」を2マスの四角形(2x1)で囲む'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${is3Solved ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-natural-line/70 bg-white/65'}`}>
                            {is3Solved ? '✓' : ''}
                          </div>
                          <span className={`text-[10px] md:text-xs ${is3Solved ? 'text-green-700 font-bold line-through' : 'text-natural-ink/70'}`}>
                            {language === 'en' ? 'Enclose 3 (1x3)' : '「3」を3マスの四角形(1x3)で囲む'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${is4Solved ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-natural-line/70 bg-white/65'}`}>
                            {is4Solved ? '✓' : ''}
                          </div>
                          <span className={`text-[10px] md:text-xs ${is4Solved ? 'text-green-700 font-bold line-through' : 'text-natural-ink/70'}`}>
                            {language === 'en' ? 'Enclose 4 (2x2)' : '「4」を4マスの四角形(2x2)で囲む'}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation row inside Guide */}
              <div className="flex justify-between items-center mt-3 md:mt-6 pt-2 md:pt-4 border-t border-natural-line/40 z-10 shrink-0">
                <button
                  onClick={() => {
                    playSound('select');
                    if (tutorialStep > 0) setTutorialStep(tutorialStep - 1);
                  }}
                  disabled={tutorialStep === 0}
                  className="py-1.5 px-3 md:py-2.5 md:px-4 bg-white/50 hover:bg-white text-natural-ink rounded-xl border border-natural-line transition-all text-xs font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {t.prevStep}
                </button>

                {tutorialStep < 4 ? (
                  <button
                    onClick={() => {
                      playSound('select');
                      setTutorialStep(tutorialStep + 1);
                    }}
                    disabled={tutorialStep === 3 && !tutorialSolved}
                    className={`py-1.5 px-4 md:py-2.5 md:px-5 rounded-xl text-white font-bold transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer ${tutorialStep === 3 && !tutorialSolved ? 'bg-natural-line text-natural-ink/40 cursor-not-allowed shadow-none' : 'bg-natural-olive hover:bg-natural-olive/95 hover:shadow-lg shadow-natural-olive/15'}`}
                  >
                    {t.nextStep} <ChevronRight size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      playSound('win');
                      setScreen('menu');
                    }}
                    className="py-2 px-4 md:py-3 md:px-6 bg-gradient-to-r from-[#A5A58D] to-[#6B705C] hover:opacity-95 text-white font-bold rounded-xl md:rounded-2xl transition-all shadow-lg flex items-center gap-1.5 text-xs animate-bounce cursor-pointer"
                  >
                    <Trophy size={13} className="text-amber-300" /> {t.finishTutorial}
                  </button>
                )}
              </div>
            </div>

            {/* Simulated Animated Canvas (Right Panel) */}
            <div className="md:col-span-7 flex flex-col items-center justify-center p-1 md:p-4 min-h-0 w-full shrink-0">
              <div 
                ref={tutorialGridRef}
                onTouchMove={handleTutorialTouchMove}
                onTouchEnd={handleTutorialMouseUp}
                className="relative w-full max-w-[170px] xs:max-w-[190px] md:max-w-[340px] aspect-square bg-white rounded-2xl md:rounded-3xl shadow-lg border-4 md:border-[10px] border-natural-sidebar overflow-hidden select-none touch-none"
              >
                {/* Grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border-[0.5px] border-natural-line/25" />
                  ))}
                </div>

                {/* Numbers Layer */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-15">
                  {tutorialPuzzleObj.numbers.map((num, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center font-bold text-natural-olive text-xl md:text-2xl select-none"
                      style={{
                        gridColumnStart: num.x + 1,
                        gridRowStart: num.y + 1,
                      }}
                    >
                      <span className={`relative duration-500 ${tutorialStep === 0 ? 'scale-110 md:scale-125 font-black text-amber-500 bg-amber-100/40 rounded-full px-2 animate-bounce' : ''}`}>
                        {num.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Animated Blocks / Interactive Drawing */}
                <div className="absolute inset-0">
                  {/* Step 2 (Only One Number) Animated Cycle blocks */}
                  {tutorialStep === 1 && (
                    <AnimatePresence mode="wait">
                      {step2Cycle === 'bad' ? (
                        <motion.div
                          key="bad"
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: [1, 0.98, 1.02, 0.98, 1], opacity: 0.8 }}
                          transition={{ type: "tween", duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
                          className="absolute border-4 border-dashed border-red-500 bg-red-400/20 rounded-2xl flex items-center justify-center font-sans font-medium"
                          style={{
                            left: 0,
                            top: 0,
                            width: "33.33%",
                            height: "100%",
                            zIndex: 10
                          }}
                        >
                          <div className="bg-red-500 text-white font-black text-[8px] md:text-[10px] py-0.5 px-1.5 md:py-1 md:px-2 rounded-full shadow-md leading-none border border-red-300 text-center">
                            NG!
                          </div>
                        </motion.div>
                      ) : (
                        <div key="good" className="absolute inset-0 z-10 pointer-events-none">
                          {/* Rectangle for 2 */}
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 0.85 }}
                            className="absolute border-2 md:border-4 border-natural-sage bg-natural-sage/25 rounded-xl md:rounded-2xl flex items-center justify-center"
                            style={{
                              left: 0,
                              top: 0,
                              width: "66.66%",
                              height: "33.33%"
                            }}
                          >
                            <span className="bg-green-600 text-white font-extrabold text-[7px] md:text-[8px] px-1 md:px-1.5 py-0.5 rounded-full shadow-xs leading-none">
                              ✓ OK (2)
                            </span>
                          </motion.div>
                          {/* Rectangle for 4 */}
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 0.85 }}
                            transition={{ delay: 0.15 }}
                            className="absolute border-2 md:border-4 border-natural-sage bg-natural-sage/25 rounded-xl md:rounded-2xl flex items-center justify-center"
                            style={{
                              left: 0,
                              top: "33.33%",
                              width: "66.66%",
                              height: "66.66%"
                            }}
                          >
                            <span className="bg-green-600 text-white font-extrabold text-[7px] md:text-[8px] px-1 md:px-1.5 py-0.5 rounded-full shadow-xs leading-none">
                              ✓ OK (4)
                            </span>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Step 3 (Area total) Dragging animation */}
                  {tutorialStep === 2 && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                      {step3Cycle === 'idle' && (
                        <div className="absolute top-[8%] left-[8%] w-10 h-10 border-2 border-transparent" />
                      )}
                      
                      {step3Cycle === 'dragging' && (
                        <motion.div
                          initial={{ width: "33.33%" }}
                          animate={{ width: "66.66%" }}
                          transition={{ duration: 1 }}
                          className="absolute border-2 md:border-4 border-dashed border-amber-400 bg-amber-400/20 rounded-xl md:rounded-2xl animate-pulse"
                          style={{
                            left: 0,
                            top: 0,
                            height: "33.33%"
                          }}
                        />
                      )}

                      {step3Cycle === 'done' && (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 0.9 }}
                          className="absolute border-2 md:border-4 border-natural-sage bg-natural-sage/25 rounded-xl md:rounded-2xl flex flex-col items-center justify-center animate-pulse"
                          style={{
                            left: 0,
                            top: 0,
                            width: "66.66%",
                            height: "33.33%"
                          }}
                        >
                          <span className="bg-green-600 text-white font-bold text-[7px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded-full animate-bounce">
                            ✓ Area=2
                          </span>
                        </motion.div>
                      )}

                      {/* Mock hand cursor */}
                      <motion.div
                        className="absolute z-40 text-xl md:text-3xl"
                        animate={
                          step3Cycle === 'dragging'
                            ? { x: ["8%", "45%"], y: ["8%", "8%"] }
                            : step3Cycle === 'done'
                            ? { x: "45%", y: "8%", scale: 1.1 }
                            : { x: "8%", y: "8%", scale: 1 }
                        }
                        transition={{ duration: 1 }}
                      >
                        👉
                      </motion.div>
                    </div>
                  )}

                  {/* Step 4: Try it yourself Interactive Drawing Layer */}
                  {tutorialStep === 3 && (
                    <div className="absolute inset-0 z-20">
                      {/* Interaction listener grid */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-auto">
                        {Array.from({ length: 3 }).map((_, y) => (
                          Array.from({ length: 3 }).map((_, x) => (
                            <div
                              key={`${x}-${y}`}
                              className="w-full h-full cursor-crosshair"
                              onMouseDown={() => handleTutorialMouseDown(x, y)}
                              onMouseEnter={() => handleTutorialMouseEnter(x, y)}
                              onMouseUp={handleTutorialMouseUp}
                              onTouchStart={() => handleTutorialMouseDown(x, y)}
                            />
                          ))
                        ))}
                      </div>

                      {/* Render rectangles drawn so far */}
                      {tutorialRectangles.map((rect) => {
                        const numInRect = tutorialPuzzleObj.numbers.find(n => isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height));
                        const isValid = numInRect && (rect.width * rect.height === numInRect.value);
                        const hasMultiple = tutorialPuzzleObj.numbers.filter(n => isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height)).length > 1;

                        let bgColor = "bg-natural-sand/35";
                        let borderColor = "border-natural-sand";
                        
                        if (isValid) {
                          bgColor = "bg-natural-sage/25";
                          borderColor = "border-natural-sage";
                        } else if (hasMultiple || (numInRect && rect.width * rect.height !== numInRect.value)) {
                          bgColor = "bg-natural-tan/25";
                          borderColor = "border-natural-tan";
                        }

                        return (
                          <motion.div
                            key={rect.id}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`absolute border-2 md:border-4 ${borderColor} ${bgColor} rounded-xl md:rounded-2xl pointer-events-none flex items-center justify-center`}
                            style={{
                              left: `${rect.x * 100 / 3}%`,
                              top: `${rect.y * 100 / 3}%`,
                              width: `${rect.width * 100 / 3}%`,
                              height: `${rect.height * 100 / 3}%`,
                            }}
                          >
                            {isValid && (
                              <span className="scale-75 md:scale-100 bg-green-500 text-white font-extrabold text-[7px] md:text-[9px] px-1 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                ✓ OK
                              </span>
                            )}
                          </motion.div>
                        );
                      })}

                      {renderTutorialSelection()}
                    </div>
                  )}

                  {/* Step 5: Beautiful Complete solved grid */}
                  {tutorialStep === 4 && (
                    <div className="absolute inset-0 z-20 pointer-events-none">
                      {tutorialPuzzleObj.solution.map((sol, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: [1, 1.03, 1], opacity: 1 }}
                          transition={{ type: "tween", delay: index * 0.1, duration: 0.4 }}
                          className="absolute border-2 md:border-4 border-natural-sage bg-natural-sage/35 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg"
                          style={{
                            left: `${sol.x * 100 / 3}%`,
                            top: `${sol.y * 100 / 3}%`,
                            width: `${sol.width * 100 / 3}%`,
                            height: `${sol.height * 100 / 3}%`,
                          }}
                        >
                          <Sparkles size={14} className="text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                        </motion.div>
                      ))}

                      {/* Confetti / Particle overlays */}
                      <div className="absolute inset-0 bg-natural-sage/10 backdrop-blur-xs flex flex-col items-center justify-center text-center p-3">
                        <motion.div
                          initial={{ scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", bounce: 0.5 }}
                          className="mb-1"
                        >
                          <Trophy size={32} className="text-amber-400 animate-bounce" />
                        </motion.div>
                        <h4 className="font-serif italic text-sm md:text-lg text-natural-olive tracking-tight text-center leading-none">
                          {t.tutorialCongrats}
                        </h4>
                        <p className="text-[9px] font-bold text-natural-ink/75 mt-0.5">
                          {t.tutorialSuccessDesc}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subtext tips */}
              <p className="text-[9px] md:text-[10px] text-natural-ink/40 uppercase tracking-widest font-bold mt-2 md:mt-4">
                {tutorialStep === 3 ? (language === 'en' ? 'TIP: Click on a box to delete it!' : 'ヒント: 四角形をタップで消せます！') : 'Interactive visual illustration'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-natural-bg text-natural-ink font-sans selection:bg-natural-sand/50 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
        {/* Decorative elements or background */}
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-natural-sage/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-natural-olive/5 blur-3xl pointer-events-none" />

        <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif italic text-5xl md:text-6xl text-natural-olive tracking-tight">
              {t.title}
            </h1>
          </div>

          {/* Active game resume button (highly practical) */}
          {puzzle && !isGameCleared && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-6 text-natural-ink"
            >
              <button 
                onClick={() => {
                  playSound('select');
                  setScreen('game');
                }}
                className="w-full py-5 px-6 bg-natural-olive text-white rounded-3xl font-bold hover:bg-natural-olive/95 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-between shadow-lg shadow-natural-olive/15 group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Trophy size={18} className="text-natural-sand" />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold">
                      {t.resumeGame}
                    </div>
                    <div className="font-serif italic text-lg leading-tight">
                      {t[(difficulty?.toLowerCase() || 'easy') as keyof typeof t] || 'Easy'} ({puzzle?.width || 0}x{puzzle?.height || 0})
                    </div>
                  </div>
                </div>
                <div className="mr-2 group-hover:translate-x-1.5 transition-transform">
                  <ChevronRight size={24} />
                </div>
              </button>
            </motion.div>
          )}

          {/* Interactive Tutorial Banner */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full mb-6 text-natural-ink"
          >
            <button
              onClick={() => {
                playSound('select');
                setTutorialStep(0);
                setTutorialRectangles([]);
                setTutorialSolved(false);
                setScreen('tutorial');
              }}
              className="w-full relative overflow-hidden py-5 px-6 rounded-3xl font-bold bg-gradient-to-r from-natural-olive to-natural-sage text-white hover:bg-natural-olive/95 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-between shadow-lg shadow-natural-olive/15 group border border-natural-olive/40 cursor-pointer"
            >
              <div className="flex items-center gap-4 z-10 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 animate-pulse">
                  <Sparkles size={22} className="text-amber-200" />
                </div>
                <div className="text-left">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400 text-natural-ink rounded-full text-[9px] uppercase tracking-wider font-extrabold mb-1">
                    ✦ RECOMMENDED
                  </div>
                  <h3 className="font-serif italic text-xl leading-tight">
                    {t.tutorialBtn}
                  </h3>
                  <p className="text-white/80 text-xs font-normal mt-0.5 max-w-[340px] md:max-w-none">
                    {t.tutorialBtnDesc}
                  </p>
                </div>
              </div>
              <div className="mr-2 group-hover:translate-x-1.5 transition-transform z-10 shrink-0">
                <ChevronRight size={26} className="text-amber-200" />
              </div>
            </button>
          </motion.div>

          {/* Selector / Levels Card */}
          <div className="bg-white/40 backdrop-blur-sm p-6 md:p-8 rounded-[40px] border border-natural-line w-full mb-8 shadow-sm">
            <h3 className="text-center font-bold text-natural-ink/75 mb-6 text-xs uppercase tracking-wider">
              {t.selectDifficulty}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map(d => {
                let sizeText = d === 'Easy' ? '5 x 5' : d === 'Medium' ? '7 x 7' : d === 'Hard' ? '10 x 10' : '15 x 15';
                let desc = d === 'Easy' ? t.easyDesc : d === 'Medium' ? t.mediumDesc : d === 'Hard' ? t.hardDesc : t.expertDesc;
                
                return (
                  <button 
                    key={d}
                    onClick={() => handleSelectDifficulty(d)}
                    className="flex flex-col text-left p-5 rounded-[24px] bg-white hover:bg-natural-sage/5 transition-all border border-natural-line hover:border-natural-sage hover:shadow-md hover:scale-[1.02] group duration-300 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start w-full mb-2 z-10">
                      <div className="flex flex-col">
                        <span className="font-bold text-lg text-natural-ink group-hover:text-natural-olive transition-colors leading-tight">
                          {t[d.toLowerCase() as keyof typeof t]}
                        </span>
                        <span className="text-[10px] font-bold text-natural-sage/80 mt-0.5">
                          Level {clearedCount[d] + 1}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-natural-sage/15 text-natural-sage rounded-full text-[10px] font-bold tracking-wider shrink-0">
                        {sizeText}
                      </span>
                    </div>
                    <p className="text-xs text-natural-ink/60 leading-relaxed font-sans z-10">{desc}</p>
                    
                    {/* Tiny visual forest accent on hover */}
                    <div className="absolute right-[-20px] bottom-[-20px] w-20 h-20 bg-natural-sage/5 rounded-full scale-0 group-hover:scale-100 transition-all duration-300" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Config Row (Language & sound) */}
          <div className="flex gap-4 justify-center items-center mt-2 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full border border-natural-line/40 shadow-xs shrink-0">
            <button 
              onClick={() => {
                setIsMuted(!isMuted);
                playSound('select');
              }}
              className="flex items-center gap-2 text-xs font-bold text-natural-ink/80 hover:text-natural-olive transition-all cursor-pointer"
            >
              {isMuted ? <><VolumeX size={16} className="text-red-500" /> {t.muted}</> : <><Volume2 size={16} className="text-natural-sage" /> {t.soundOn}</>}
            </button>
            <div className="w-[1px] h-4 bg-natural-line/50" />
            <button 
              onClick={() => {
                setLanguage(language === 'en' ? 'ja' : 'en');
                playSound('select');
              }}
              className="flex items-center gap-2 text-xs font-bold text-natural-ink/80 hover:text-natural-olive transition-all cursor-pointer"
            >
              <Globe size={16} className="text-natural-sage" /> {language === 'en' ? 'English (EN)' : '日本語 (JA)'}
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-natural-bg">
        <Loader2 className="animate-spin text-natural-olive" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-natural-bg text-natural-ink font-sans selection:bg-natural-sand/50">
      {/* Sidebar */}
      <aside className="w-full md:w-[320px] bg-natural-sidebar p-4 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-natural-line shrink-0">
        <div className="flex flex-col">

          <header className="mb-4 md:mb-8">
            <div className="flex items-center gap-3 mb-1 md:mb-2">
              <h1 className="font-serif italic text-3xl md:text-4xl text-natural-olive tracking-tight">{t.title}</h1>
            </div>
            <p className="text-natural-ink/60 text-xs md:text-sm font-medium uppercase tracking-widest">{t.subtitle}</p>
          </header>

          {/* Stats Panel */}
          <div className="bg-white/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl mb-4 md:mb-8 border border-white/20">
            <div className="flex justify-between items-center mb-2.5 md:mb-4">
              <span className="text-xs md:text-sm font-medium opacity-70">{t.puzzle}</span>
              <span className="font-bold text-natural-sage text-xs md:text-sm">{t[difficulty.toLowerCase() as keyof typeof t]} {puzzle.width}x{puzzle.height}</span>
            </div>
            <div className="flex justify-between items-center mb-2.5 md:mb-4">
              <span className="text-xs md:text-sm font-medium opacity-70">{language === 'ja' ? 'レベル' : 'Level'}</span>
              <span className="font-bold text-natural-sage text-xs md:text-sm">Level {clearedCount[difficulty] + 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs md:text-sm font-medium opacity-70">{language === 'ja' ? '経過時間' : 'Elapsed Time'}</span>
              <span className="font-bold text-natural-sage text-xs md:text-sm">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>

          {/* Mobile Back to Menu button */}
          <button 
            onClick={() => {
              playSound('select');
              setScreen('menu');
            }}
            className="w-full mb-4 py-2.5 bg-white/60 hover:bg-white text-natural-ink hover:text-natural-olive/90 rounded-2xl font-bold transition-all border border-natural-line flex items-center justify-center gap-2 text-xs shadow-xs cursor-pointer md:hidden animate-fade-in"
          >
            <ChevronLeft size={14} /> {t.backToMenu}
          </button>



          <div className="hidden md:flex mb-8 gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`flex-1 p-3 rounded-xl transition-all border flex items-center justify-center gap-2 ${isMuted ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white/50 text-natural-ink border-natural-line hover:bg-white/80'}`}
            >
              {isMuted ? <><VolumeX size={20} /> {t.muted}</> : <><Volume2 size={20} /> {t.soundOn}</>}
            </button>
            <button 
              onClick={() => setLanguage(language === 'en' ? 'ja' : 'en')}
              className="p-3 rounded-xl transition-all border bg-white/50 text-natural-ink border-natural-line hover:bg-white/80 flex items-center justify-center gap-2"
              title="Toggle Language"
            >
              <Globe size={20} /> {language === 'en' ? 'EN' : 'JA'}
            </button>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-3">
          {isShowingSolution || isGameCleared ? (
            <button 
              onClick={() => generateLogicPuzzle(difficulty, true)}
              disabled={isGenerating}
              className="w-full py-4 bg-natural-olive text-white rounded-full font-bold transition-all hover:opacity-90 shadow-lg shadow-natural-olive/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ChevronRight size={18} />
              )}
              {t.nextPuzzle}
            </button>
          ) : (
            <button 
              onClick={handleGiveUp}
              className="w-full py-4 bg-red-600/10 text-red-700 hover:bg-red-600/20 rounded-full font-bold transition-all flex items-center justify-center gap-2 border border-red-200 cursor-pointer"
            >
              <AlertCircle size={18} /> {t.giveUp}
            </button>
          )}

          {/* Desktop Back to Menu button */}
          <button 
            onClick={() => {
              playSound('select');
              setScreen('menu');
            }}
            className="w-full py-3.5 bg-white/60 hover:bg-white text-natural-ink hover:text-natural-olive/90 rounded-2xl font-bold transition-all border border-natural-line flex items-center justify-center gap-2 text-sm shadow-xs cursor-pointer mt-1"
          >
            <ChevronLeft size={16} /> {t.backToMenu}
          </button>
        </div>
      </aside>

      {/* Main Game Area */}
      <main className="flex-1 p-4 md:p-12 flex flex-col items-center justify-center">

        {/* Puzzle Board */}
        <div 
          className="relative w-full max-w-sm xs:max-w-md md:max-w-[min(76vh,640px)] aspect-square bg-white rounded-3xl shadow-2xl shadow-natural-ink/5 border-[12px] border-natural-sidebar overflow-hidden select-none touch-none"
          style={{ containerType: 'inline-size' }}
        >
          {/* Grid Lines */}
          <div className="absolute inset-0 grid" style={{ 
            gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
            gridTemplateRows: `repeat(${puzzle.height}, 1fr)`
          }}>
            {Array.from({ length: puzzle.width * puzzle.height }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-natural-line/30" />
            ))}
          </div>

          {/* Interactive Layer */}
          <div 
            ref={gridRef}
            className="absolute inset-0 grid z-20 touch-none"
            style={{ 
              gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
              gridTemplateRows: `repeat(${puzzle.height}, 1fr)`
            }}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            onTouchCancel={handleMouseUp}
          >
            {Array.from({ length: puzzle.height }).map((_, y) => (
              Array.from({ length: puzzle.width }).map((_, x) => (
                <div 
                  key={`${x}-${y}`}
                  className="w-full h-full cursor-crosshair"
                  onMouseDown={() => handleMouseDown(x, y)}
                  onMouseEnter={() => handleMouseEnter(x, y)}
                  onMouseUp={handleMouseUp}
                  onTouchStart={() => handleMouseDown(x, y)}
                />
              ))
            ))}
          </div>

          {/* Numbers Layer */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {puzzle.numbers.map((num, i) => {
              const digits = num.value.toString().length;
              let fontSizeStyle = '7.5cqw'; // Default (Easy 5x5)
              if (puzzle.width === 7) {
                fontSizeStyle = '5.2cqw';
              } else if (puzzle.width === 10) {
                fontSizeStyle = '3.5cqw';
              } else if (puzzle.width === 15) {
                if (digits >= 3) fontSizeStyle = '1.7cqw';
                else if (digits === 2) fontSizeStyle = '2.1cqw';
                else fontSizeStyle = '2.5cqw';
              }

              return (
                <div 
                  key={i}
                  className="absolute flex items-center justify-center font-bold text-natural-olive select-none text-center leading-none"
                  style={{ 
                    left: `${num.x * 100 / puzzle.width}%`,
                    top: `${num.y * 100 / puzzle.height}%`,
                    width: `${100 / puzzle.width}%`,
                    height: `${100 / puzzle.height}%`,
                    fontSize: fontSizeStyle,
                  }}
                >
                  {num.value}
                </div>
              );
            })}
          </div>

          {/* Rectangles Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {(isShowingSolution ? puzzle.solution.map((s, i) => {
              const numInRect = puzzle.numbers.find(n => isPointInRect(n.x, n.y, s.x, s.y, s.width, s.height));
              return {
                id: `sol-${i}`,
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height,
                numberPoint: numInRect ? { x: numInRect.x, y: numInRect.y } : { x: -1, y: -1 }
              };
            }) : rectangles).map((rect) => {
              const numInRect = puzzle.numbers.find(n => isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height));
              const isValid = numInRect && (rect.width * rect.height === numInRect.value);
              const hasMultiple = puzzle.numbers.filter(n => isPointInRect(n.x, n.y, rect.x, rect.y, rect.width, rect.height)).length > 1;
              
              let bgColor = "bg-natural-sand/40";
              let borderColor = "border-natural-sand";
              
              if (isShowingSolution || isValid) {
                bgColor = "bg-natural-sage/30";
                borderColor = "border-natural-sage";
              } else if (hasMultiple || (numInRect && rect.width * rect.height !== numInRect.value)) {
                bgColor = "bg-natural-tan/30";
                borderColor = "border-natural-tan";
              }

              return (
                <motion.div 
                  key={rect.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`absolute border-4 ${borderColor} ${bgColor} rounded-xl transition-colors duration-300 ${isShowingSolution ? 'opacity-80' : ''}`}
                  style={{
                    left: `${rect.x * 100 / puzzle.width}%`,
                    top: `${rect.y * 100 / puzzle.height}%`,
                    width: `${rect.width * 100 / puzzle.width}%`,
                    height: `${rect.height * 100 / puzzle.height}%`,
                  }}
                />
              );
            })}
            {!isShowingSolution && renderSelection()}
          </div>

          {/* Win Overlay */}
          <AnimatePresence>
            {isGameCleared && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-natural-olive/95 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center overflow-hidden"
              >
                {/* Flashy Confetti Particles */}
                {confettiParticles.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ x: 0, y: 120, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{ 
                      x: p.x, 
                      y: p.y, 
                      scale: [0, 1.4, 1.1, 0.8, 0],
                      opacity: [1, 1, 1, 0.8, 0],
                      rotate: p.rotate 
                    }}
                    transition={{ 
                      type: "tween",
                      duration: p.duration, 
                      delay: p.delay,
                      ease: [0.1, 0.8, 0.3, 1]
                    }}
                    className="absolute pointer-events-none"
                    style={{
                      backgroundColor: p.shape !== 'star' && p.shape !== 'triangle' ? p.color : undefined,
                      width: p.size,
                      height: p.size,
                      borderRadius: p.shape === 'circle' ? '50%' : '0%',
                      left: '50%',
                      top: '35%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {p.shape === 'star' && (
                      <svg viewBox="0 0 24 24" fill={p.color} style={{ width: p.size, height: p.size }}>
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    )}
                    {p.shape === 'triangle' && (
                      <svg viewBox="0 0 24 24" fill={p.color} style={{ width: p.size, height: p.size }}>
                        <polygon points="12,2 2,22 22,22" />
                      </svg>
                    )}
                  </motion.div>
                ))}

                {/* Pulsating Glowing Trophy Area */}
                <div className="relative mb-6 flex items-center justify-center">
                  {/* Outer Pulsation Rings */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
                    className="absolute w-24 h-24 rounded-full border-2 border-natural-sand/60"
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.9], opacity: [0.4, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, delay: 0.7, ease: "easeOut" }}
                    className="absolute w-24 h-24 rounded-full border-2 border-natural-sand/40"
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, delay: 1.4, ease: "easeOut" }}
                    className="absolute w-24 h-24 rounded-full border-2 border-natural-sand/20"
                  />
                  
                  {/* Rotating decorative background rays */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                    className="absolute w-36 h-36 opacity-30 pointer-events-none"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full text-natural-sand" fill="currentColor">
                      {Array.from({ length: 16 }).map((_, idx) => (
                        <line
                          key={idx}
                          x1="50"
                          y1="50"
                          x2={50 + Math.cos((idx * Math.PI * 2) / 16) * 48}
                          y2={50 + Math.sin((idx * Math.PI * 2) / 16) * 48}
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeDasharray="5,5"
                        />
                      ))}
                    </svg>
                  </motion.div>

                  {/* Bouncy Golden Trophy with rich shadows */}
                  <motion.div
                    initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      rotate: 0,
                      opacity: 1
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 110, 
                      damping: 12,
                      delay: 0.1 
                    }}
                    className="relative z-10 bg-white/10 p-6 rounded-full backdrop-blur-md border border-white/30 shadow-2xl"
                  >
                    <Trophy size={80} className="text-natural-sand drop-shadow-[0_0_20px_rgba(245,214,142,0.8)]" />
                  </motion.div>
                </div>

                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-serif italic mb-2 tracking-tight text-natural-sand"
                >
                  {t.winTitle}
                </motion.h2>

                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="text-white/80 mb-8 max-w-[240px]"
                >
                  {t.winDesc}
                </motion.p>

                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col gap-2.5 w-full max-w-[220px]"
                >
                  <button 
                    onClick={() => generateLogicPuzzle(difficulty, true)}
                    className="w-full py-4 bg-white text-natural-olive rounded-full font-bold transition-all shadow-xl hover:bg-natural-sand hover:scale-105 active:scale-95 duration-200 cursor-pointer"
                  >
                    {t.nextPuzzle}
                  </button>
                  <button 
                    onClick={() => {
                      playSound('select');
                      setScreen('menu');
                    }}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition-all border border-white/20 hover:scale-105 active:scale-95 duration-200 cursor-pointer text-sm"
                  >
                    {t.backToMenu}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile controls (Only visible on mobile) */}
        <div className="w-full max-w-md mt-6 flex flex-col gap-3 md:hidden relative z-30">
          {/* Main Action Buttons */}
          <div className="flex flex-col gap-2.5">
            {isShowingSolution || isGameCleared ? (
              <button 
                onClick={() => generateLogicPuzzle(difficulty, true)}
                disabled={isGenerating}
                className="w-full py-3.5 bg-natural-olive text-white rounded-full font-bold transition-all hover:opacity-90 shadow-md shadow-natural-olive/15 flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
                {t.nextPuzzle}
              </button>
            ) : (
              <button 
                onClick={handleGiveUp}
                className="w-full py-3.5 bg-red-600/10 text-red-700 hover:bg-red-600/20 rounded-full font-bold transition-all flex items-center justify-center gap-2 text-sm cursor-pointer border border-red-200"
              >
                <AlertCircle size={16} /> {t.giveUp}
              </button>
            )}
          </div>

          {/* Sound & Language Toggles */}
          <div className="flex gap-2 mt-1">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`flex-1 py-2.5 px-3 rounded-xl transition-all border flex items-center justify-center gap-2 text-xs cursor-pointer ${isMuted ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white/50 text-natural-ink border-natural-line hover:bg-white/80'}`}
            >
              {isMuted ? <><VolumeX size={16} /> {t.muted}</> : <><Volume2 size={16} /> {t.soundOn}</>}
            </button>
            <button 
              onClick={() => setLanguage(language === 'en' ? 'ja' : 'en')}
              className="py-2.5 px-4 rounded-xl transition-all border bg-white/50 text-natural-ink border-natural-line hover:bg-white/80 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Toggle Language"
            >
              <Globe size={16} /> {language === 'en' ? 'EN' : 'JA'}
            </button>
          </div>

          {/* Back to Menu (Mobile) */}
          <button 
            onClick={() => {
              playSound('select');
              setScreen('menu');
            }}
            className="w-full mt-1.5 py-3.5 bg-white/60 hover:bg-white text-natural-ink hover:text-natural-olive/90 rounded-2xl font-bold transition-all border border-natural-line flex items-center justify-center gap-2 text-sm shadow-xs cursor-pointer"
          >
            <ChevronLeft size={16} /> {t.backToMenu}
          </button>
        </div>

        {/* Legend */}
        <div className="mt-8 flex gap-6 text-[10px] font-bold text-natural-ink/40 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-natural-sage/30 border border-natural-sage rounded-sm" />
            <span>{t.solved}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-natural-tan/30 border border-natural-tan rounded-sm" />
            <span>{t.error}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-natural-sand/40 border border-natural-sand rounded-sm" />
            <span>{t.incomplete}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
