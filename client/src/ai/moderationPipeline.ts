import * as tf from '@tensorflow/tfjs';
import * as toxicity from '@tensorflow-models/toxicity';

// Threshold for toxicity classification confidence
const TOXICITY_THRESHOLD = 0.85;

// Singleton model reference
let toxicityModel: toxicity.ToxicityClassifier | null = null;
let isLoading = false;

// Custom Scam/Spam keywords
const SCAM_KEYWORDS = [
  'win money', 'win a prize', 'claim your prize', 'double your money', 
  'double your crypto', 'crypto giveaway', 'free bitcoin', 'invest and earn', 
  'get rich quick', 'gift card code', 'free money', 'send money to', 
  'verify your account', 'reset your login', 'confirm your password', 
  'security warning click', 'urgent verification', 'paypal refund', 
  'onlyfans leaked', 'make money fast', 'easy cash', 'no risk investment',
  'click here to win', 'western union transfer'
];

// Custom Prohibited Terrorist & Weapon trafficking keywords
const ILLEGAL_TERROR_KEYWORDS = [
  'bomb', 'explosive', 'detonator', 'semtex', 'c4 bomb', 'pipe bomb', 'dirty bomb',
  'jihad', 'isis', 'al-qaeda', 'terrorist', 'terror attack', 'mass shooting', 
  'hijack', 'hostage', 'assassination', 'hitman', 'buy guns', 'buy weapons', 
  'unregistered firearm', 'assault rifle', 'grenade', 'rocket launcher', 'sabotage',
  'extremist group', 'radicalize', 'cyberattack government',
  'darknet market', 'human trafficking', 'ricin poison', 'cyanide poison', 
  'fentanyl buy', 'cocaine buy', 'heroin buy', 'methamphetamine buy', 'hire hacker'
];

// Severe offensive slang & profanity keywords
const SEVERE_SLANGS = [
  // Core Profanities & Inflections
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'fuckers', 'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shitting', 'shitty', 'shitted', 'shithead', 'shitheads',
  'bitch', 'bitches', 'bitchy', 'bitching',
  'asshole', 'assholes', 'ass', 'asses', 'arse', 'arses', 'arsehole', 'arseholes',
  'cunt', 'cunts', 'dick', 'dicks', 'pussy', 'pussies', 'whore', 'whores', 'slut', 'sluts',
  'bastard', 'bastards', 'wanker', 'wankers', 'tosser', 'tossers', 'prick', 'pricks',
  
  // Consonant-only & stripped variations (to catch asterisk/symbol bypasses)
  'fck', 'fcking', 'fcked', 'fcks', 'fcker', 'fckers', 'motherfck', 'motherfcker', 'motherfcking',
  'sht', 'shts', 'shty', 'shitting', 'shithead',
  'btch', 'btches', 'btchy', 'btching',
  'cnt', 'cnts', 'slt', 'slts', 'ahole', 'aholes',
  
  // Spaced variations
  'mother fucker', 'mother fuckers', 'mother fucking',
  'cock sucker', 'cocksucker', 'cocksuckers',
  'ass hole', 'ass holes',
  'dick head', 'dick heads',
  'dumb ass', 'dumb asses',
  'shit head', 'shit heads',
  'piece of shit', 'pieces of shit',
  'piss off', 'pissing off',
  
  // Other Abusive Slangs
  'douche', 'douchebag', 'douchebags', 'dipshit', 'dipshits', 'dumbass', 'dumbasses',
  'scumbag', 'scumbags', 'jackass', 'jackasses', 'retard', 'retards', 'retarded',
  'spastic', 'sleazebag', 'sleazebags', 'skank', 'skanks', 'bimbo', 'bimbos',
  'bullshit', 'horseshit', 'jackshit',
  
  // Slurs
  'nigger', 'niggers', 'faggot', 'faggots', 'kike', 'kikes', 'spic', 'spics',
  'chink', 'chinks', 'gook', 'gooks', 'coon', 'coons', 'tranny', 'trannies',
  'dyke', 'dykes', 'wetback', 'wetbacks', 'towelhead', 'towelheads', 'paki',
  'negro', 'negroes'
];

/**
 * Normalizes text to counter bypass strategies like leetspeak, spaces inside words, and special symbols.
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  
  // Replace common leet-speak character substitutions
  normalized = normalized.replace(/@/g, 'a');
  normalized = normalized.replace(/\$/g, 's');
  normalized = normalized.replace(/!/g, 'i');
  normalized = normalized.replace(/1/g, 'i');
  normalized = normalized.replace(/3/g, 'e');
  normalized = normalized.replace(/0/g, 'o');
  normalized = normalized.replace(/4/g, 'a');
  normalized = normalized.replace(/5/g, 's');
  normalized = normalized.replace(/7/g, 't');
  normalized = normalized.replace(/8/g, 'b');
  
  // Strip non-alphabetic/non-numeric characters except spaces to check basic spelling
  const stripped = normalized.replace(/[^a-z0-9\s]/g, '');

  // Collapse consecutive spaces to single space to keep it clean
  const singleSpaced = stripped.replace(/\s+/g, ' ');

  // Collapse single letters separated by space (e.g. "y o u   a r e   s h i t" -> "you are shit")
  // We run it repeatedly to collapse multiple adjacent single letters
  let despaced = singleSpaced;
  let previous;
  do {
    previous = despaced;
    despaced = despaced.replace(/\b([a-z0-9])\s(?=[a-z0-9]\b)/g, '$1');
  } while (despaced !== previous);

  return despaced.trim();
}

export interface ModerationResult {
  isBlocked: boolean;
  score: number; // 0 to 1
  reasons: string[];
  details: {
    toxicityScore: number;
    spamScore: number;
    phishingScore: number;
    illegalScore: number;
    toxicLabelsFlagged: string[];
  };
}

/**
 * Initializes and loads the TensorFlow.js Toxicity model.
 * @param onProgress Callback function to receive status updates
 */
export async function initializeModerationPipeline(
  onProgress?: (status: string) => void
): Promise<void> {
  if (toxicityModel) {
    if (onProgress) onProgress('Model already loaded');
    return;
  }

  if (isLoading) {
    if (onProgress) onProgress('Model is currently loading...');
    return;
  }

  isLoading = true;
  if (onProgress) onProgress('Initializing TensorFlow.js...');
  
  try {
    // Ensure TensorFlow.js engine is ready
    await tf.ready();
    
    if (onProgress) onProgress('Downloading toxicity model (approx. 25MB)...');
    
    // Load the model with standard toxicity labels
    toxicityModel = await toxicity.load(TOXICITY_THRESHOLD, [
      'identity_attack',
      'insult',
      'obscene',
      'severe_toxicity',
      'sexual_explicit',
      'threat',
      'toxicity'
    ]);
    
    isLoading = false;
    if (onProgress) onProgress('AI Moderation Pipeline ready');
  } catch (error) {
    isLoading = false;
    console.error('Failed to initialize AI model:', error);
    if (onProgress) onProgress('Failed to load AI model. Offline heuristics active.');
    throw error;
  }
}

/**
 * Check if the model has finished loading
 */
export function isModelLoaded(): boolean {
  return toxicityModel !== null;
}

/**
 * Custom spam engine rules:
 * - High density of scam keywords
 * - Message-wide capitalization (shouting)
 * - Word and character repetitions
 * - Basic text entropy
 */
function analyzeSpam(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  if (!text || text.trim().length === 0) {
    return { score, reasons };
  }

  const cleanText = text.toLowerCase().trim();

  // 1. Scam Keyword Checks
  let keywordMatches = 0;
  SCAM_KEYWORDS.forEach(keyword => {
    if (cleanText.includes(keyword)) {
      keywordMatches++;
    }
  });

  if (keywordMatches > 0) {
    const keywordScore = Math.min(keywordMatches * 0.3, 0.9);
    score += keywordScore;
    reasons.push(`Contains scam keywords/phrases (${keywordMatches} match(es))`);
  }

  // 2. Capitalization / Shouting Checks
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 8) {
    const upperCaseLetters = letters.replace(/[^A-Z]/g, '');
    const upperRatio = upperCaseLetters.length / letters.length;
    if (upperRatio > 0.75) {
      score += 0.3;
      reasons.push('Excessive uppercase text (shouting)');
    }
  }

  // 3. Repeated Characters
  // Check for 6+ identical characters consecutively (e.g., "aaaaaa" or "!!!!!")
  if (/([a-zA-Z0-9!?.])\1{5,}/.test(cleanText)) {
    score += 0.35;
    reasons.push('Repetitive character sequence detected');
  }

  // 4. Repeated Words
  // Check for a word repeated 3+ times consecutively or frequently
  const words = cleanText.split(/\s+/);
  let consecutiveWordCount = 1;
  let maxConsecutive = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1] && words[i].length > 1) {
      consecutiveWordCount++;
      if (consecutiveWordCount > maxConsecutive) {
        maxConsecutive = consecutiveWordCount;
      }
    } else {
      consecutiveWordCount = 1;
    }
  }

  if (maxConsecutive >= 3) {
    score += 0.4;
    reasons.push(`Repetitive word sequence ("${words[words.indexOf(words[0])]}" repeated ${maxConsecutive} times)`);
  }

  return {
    score: Math.min(score, 1.0),
    reasons
  };
}

/**
 * Regex-based phishing URL detection
 */
function analyzePhishingUrls(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Find all URLs in the message
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlRegex);

  if (!urls || urls.length === 0) {
    return { score, reasons };
  }

  for (const urlStr of urls) {
    try {
      const url = new URL(urlStr);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      // 1. IP address in hostname (e.g., http://192.168.0.1/login.html)
      // Checks for both IPv4 and IPv6 patterns
      const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      const ipv6Regex = /^\[?[a-fA-F0-9:]+\]?$/;
      if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
        score += 0.8;
        reasons.push(`IP address used as link destination: ${hostname}`);
      }

      // 2. Suspicious/High-Risk TLDs
      const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.buzz', '.fit', '.top', '.click', '.club', '.support', '.secure-verify'];
      suspiciousTlds.forEach(tld => {
        if (hostname.endsWith(tld)) {
          score += 0.4;
          reasons.push(`Suspicious domain extension (${tld}) in link: ${hostname}`);
        }
      });

      // 3. Double extensions (e.g. statement.pdf.exe)
      if (/\.[a-z0-9]+\.(exe|scr|bat|pif|cmd|vbs|msi|zip|rar)$/i.test(pathname)) {
        score += 0.9;
        reasons.push(`Suspicious double file extension in link: ${pathname}`);
      }

      // 4. Phishing keywords in URL path / subdomains
      const phishingKeywords = ['login', 'signin', 'verification', 'verify', 'account', 'secure', 'billing', 'banking', 'update-password', 'confirm-identity'];
      let keywordCount = 0;
      phishingKeywords.forEach(keyword => {
        if (hostname.includes(keyword) || pathname.includes(keyword)) {
          keywordCount++;
        }
      });

      if (keywordCount > 0) {
        // Legitimate sites shouldn't look like update-login-verify-paypal.com
        const subdomainCount = hostname.split('.').length - 2;
        if (subdomainCount > 2 || keywordCount >= 2) {
          score += 0.6;
          reasons.push(`Phishing-like keywords and subdomain count in URL: ${hostname}`);
        }
      }

      // 5. Auth obfuscation in URL (e.g. http://paypal.com@badsite.com)
      if (url.username || url.password) {
        score += 0.9;
        reasons.push(`Obfuscated link credentials detected: ${hostname}`);
      }

    } catch (e) {
      // Invalid URL format within regex match
      score += 0.3;
      reasons.push(`Malformed link structure detected: ${urlStr}`);
    }
  }

  return {
    score: Math.min(score, 1.0),
    reasons
  };
}

/**
 * Inspects for severe vulgar slangs, hate terms, weapon trades, or terrorist activities.
 */
function analyzeIllegalContent(text: string): { score: number; reasons: string[]; isCritical: boolean } {
  const reasons: string[] = [];
  let score = 0;
  let isCritical = false;

  if (!text || text.trim().length === 0) {
    return { score, reasons, isCritical };
  }

  // Normalize to catch leet-speak, spaced letters, and symbols
  const cleanText = normalizeText(text);

  // 0. Pre-scan for wildcards or symbol-obfuscated severe profanities (e.g. f*ck, b*tch, sh*t, c*nt, sl*t) on original text
  const obfuscatedProfanities = [
    /\bf[*_\-.]ck\w*/i,
    /\bb[*_\-.]tch\w*/i,
    /\bsh[*_\-.]t\w*/i,
    /\bc[*_\-.]nt\w*/i,
    /\bsl[*_\-.]t\w*/i,
    /\bm[*_\-.]th[*_\-.]rf[*_\-.]ck\w*/i,
    /\bc[*_\-.]cks[*_\-.]ck\w*/i,
    /\ba[*_\-.]sshole\w*/i,
    /\bn[*_\-.]gg\w*/i,
    /\bf[*_\-.]gg[*_\-.]t\w*/i
  ];

  let obfuscatedMatches = 0;
  obfuscatedProfanities.forEach(pattern => {
    if (pattern.test(text)) {
      obfuscatedMatches++;
    }
  });

  if (obfuscatedMatches > 0) {
    score = Math.max(score, 0.85);
    reasons.push(`Flagged for obfuscated/censored profanities (${obfuscatedMatches} match(es))`);
  }

  // 1. Scan for Terror Activity, Weapons, or Extreme Violence
  let terrorMatches = 0;
  ILLEGAL_TERROR_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(cleanText)) {
      terrorMatches++;
    }
  });

  if (terrorMatches > 0) {
    score = 1.0;
    isCritical = true;
    reasons.push(`Flagged for illegal activities or terrorist/weapon coordination (${terrorMatches} match(es))`);
  }

  // 2. Scan for Severe Vulgar Slangs / Abusive Terms
  let slangMatches = 0;
  SEVERE_SLANGS.forEach(slang => {
    // If it's a highly specific severe slang, check if it's a substring to catch fully joined words.
    // Otherwise require word boundaries to avoid Scunthorpe false positives.
    const isSpecificSevere = [
      'fuck', 'fucker', 'fucking', 'fucked', 'fucks', 'fuckers', 'motherfucker', 'motherfuckers', 'motherfucking',
      'cunt', 'cunts', 'bitch', 'bitches', 'bitchy', 'bitching',
      'nigger', 'niggers', 'faggot', 'faggots', 'kike', 'kikes', 'spic', 'spics',
      'chink', 'chinks', 'gook', 'gooks', 'tranny', 'trannies', 'dyke', 'dykes'
    ].includes(slang);

    if (isSpecificSevere) {
      if (cleanText.includes(slang)) {
        slangMatches++;
      }
    } else {
      const regex = new RegExp(`\\b${slang}\\b`, 'i');
      if (regex.test(cleanText)) {
        slangMatches++;
      }
    }
  });

  if (slangMatches > 0) {
    score = Math.max(score, 0.85);
    reasons.push(`Flagged for severe slang or abusive profanities (${slangMatches} match(es))`);
  }

  return {
    score,
    reasons,
    isCritical
  };
}

/**
 * Main AI Moderation Pipeline:
 * Analyzes message locally.
 */
export async function moderateMessage(text: string): Promise<ModerationResult> {
  const reasons: string[] = [];
  const toxicLabelsFlagged: string[] = [];
  let toxicityScore = 0;

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return {
      isBlocked: false,
      score: 0,
      reasons: [],
      details: { toxicityScore: 0, spamScore: 0, phishingScore: 0, illegalScore: 0, toxicLabelsFlagged: [] }
    };
  }

  // 1. Run TensorFlow.js Toxicity Model if loaded
  if (toxicityModel) {
    try {
      const predictions = await toxicityModel.classify([cleanText]);
      let toxicCount = 0;
      
      predictions.forEach(prediction => {
        // prediction.results is an array where index 0 matches our input
        const matchResult = prediction.results[0];
        if (matchResult.match === true) {
          toxicCount++;
          toxicLabelsFlagged.push(prediction.label);
          reasons.push(`Flagged for offensive language (${prediction.label})`);
        }
        
        // Track the maximum probability of toxicity
        const prob = matchResult.probabilities[1]; // Index 1 is the positive match probability
        if (prob > toxicityScore) {
          toxicityScore = prob;
        }
      });

      if (toxicCount > 0) {
        toxicityScore = Math.max(toxicityScore, 0.85);
      }
    } catch (err) {
      console.error('Toxicity model classification failed:', err);
    }
  }

  // 2. Run Custom Heuristic Spam Check
  const spamAnalysis = analyzeSpam(cleanText);
  const spamScore = spamAnalysis.score;
  reasons.push(...spamAnalysis.reasons);

  // 3. Run Phishing Link Check
  const phishingAnalysis = analyzePhishingUrls(cleanText);
  const phishingScore = phishingAnalysis.score;
  reasons.push(...phishingAnalysis.reasons);

  // 4. Run Illegal & Extremist Activities Check
  const illegalAnalysis = analyzeIllegalContent(cleanText);
  const illegalScore = illegalAnalysis.score;
  reasons.push(...illegalAnalysis.reasons);

  // 5. Heuristic Combining Score
  // Max-pool of scores representing absolute hazard detection, plus a blended rate.
  const maxScore = Math.max(toxicityScore, spamScore, phishingScore, illegalScore);
  
  // Blended average: gives importance to combinations (e.g., toxic spam links)
  const blendedScore = (toxicityScore * 0.3) + (illegalScore * 0.3) + (phishingScore * 0.25) + (spamScore * 0.15);
  
  // Final score logic
  const finalScore = Math.max(maxScore, blendedScore);
  
  // Decide whether to block
  // If the max score of any individual category is high, or the combined score is hazardous, or it's a critical illegal talk, block it.
  const isBlocked = finalScore >= 0.6 || toxicLabelsFlagged.length > 0 || illegalAnalysis.isCritical;

  return {
    isBlocked,
    score: Number(finalScore.toFixed(3)),
    reasons: Array.from(new Set(reasons)), // Deduplicate reasons
    details: {
      toxicityScore: Number(toxicityScore.toFixed(3)),
      spamScore: Number(spamScore.toFixed(3)),
      phishingScore: Number(phishingScore.toFixed(3)),
      illegalScore: Number(illegalScore.toFixed(3)),
      toxicLabelsFlagged
    }
  };
}
