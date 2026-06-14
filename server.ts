import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
    }
  }
  return aiClient;
}
// Cache holders for the official RBZ Rate
let cachedOfficialRate = 26.75; // Realistic baseline fallback if everything fails
let lastOfficialRateFetchAt = 0;
const REFRESH_INTERVAL = 1000 * 60 * 60 * 6; // Automatically check every 6 hours

/**
 * Local fallback function that calculates a trimmed mean of submitted rates
 * when the Gemini AI service is unavailable.
 */
function performLocalTrimmedMean(submissions: Submission[], officialRate: number): any {
  if (!submissions || submissions.length === 0) {
    return {
      parallelRate: officialRate,
      officialRate,
      exchangeGapPercentage: 0,
      high24h: officialRate,
      low24h: officialRate,
      submissionCount: 0,
      aiSummary: "No market submissions available."
    };
  }

  const rates = submissions.map(s => s.rate).sort((a, b) => a - b);
  
  // Calculate trimmed mean (remove top and bottom 10%)
  const trimAmount = Math.ceil(rates.length * 0.1);
  const trimmedRates = rates.slice(trimAmount, rates.length - trimAmount);
  
  const parallelRate = trimmedRates.length > 0 
    ? trimmedRates.reduce((sum, r) => sum + r, 0) / trimmedRates.length 
    : rates.reduce((sum, r) => sum + r, 0) / rates.length;
  
  const high24h = Math.max(...rates);
  const low24h = Math.min(...rates);
  const exchangeGapPercentage = ((parallelRate - officialRate) / officialRate) * 100;

  return {
    parallelRate: Number(parallelRate.toFixed(2)),
    officialRate,
    exchangeGapPercentage: Number(exchangeGapPercentage.toFixed(2)),
    high24h: Number(high24h.toFixed(2)),
    low24h: Number(low24h.toFixed(2)),
    submissionCount: submissions.length,
    aiSummary: `Local analysis: Parallel market at ${parallelRate.toFixed(2)} ZiG, premium of ${exchangeGapPercentage.toFixed(1)}% above official rate.`
  };
}

/**
 * Periodically pulls the official interbank rate from trusted financial feeds
 * or scrapes the RBZ homepage directly as a backup fallback.
 */
async function fetchLatestOfficialRate(): Promise<number> {
  const now = Date.now();
  
  // If the cache is fresh, return it instantly without making network calls
  if (now - lastOfficialRateFetchAt < REFRESH_INTERVAL && lastOfficialRateFetchAt !== 0) {
    return cachedOfficialRate;
  }

  console.log("Refreshing official interbank rate from global exchange channels...");

  try {
    // METHOD 1: Free Open-Exchange API tracking the ZWG ISO code
    const apiResponse = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!apiResponse.ok) throw new Error("Exchange API unavailable");
    
    const tokenData = await apiResponse.json();
    if (tokenData.rates && tokenData.rates.ZWG) {
      cachedOfficialRate = Number(Number(tokenData.rates.ZWG).toFixed(4));
      lastOfficialRateFetchAt = now;
      console.log(`[RBZ Sync] Successfully synced via API. Interbank Spot: ${cachedOfficialRate}`);
      return cachedOfficialRate;
    }
  } catch (apiError) {
    console.warn("Primary financial API failed. Deploying live RBZ webpage regex scraper...");

    // METHOD 2: Direct Fallback Scraper from the official RBZ website
    try {
      const rbzWebpage = await fetch("https://www.rbz.co.zw/", {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SolidrateSync/1.0' 
        }
      });
      const pageText = await rbzWebpage.text();
      
      // Look for interbank table structures like USD/ZWG or USD/ZWG index clusters
      const match = pageText.match(/USD\/ZWG[\s\S]*?([\d.]+)/i) || pageText.match(/USD\/ZWG.*?AVG.*?([\d.]+)/i);
      
      if (match && match[1]) {
        cachedOfficialRate = Number(parseFloat(match[1]).toFixed(4));
        lastOfficialRateFetchAt = now;
        console.log(`[RBZ Sync] Successfully parsed rate from homepage text: ${cachedOfficialRate}`);
        return cachedOfficialRate;
      }
    } catch (scraperError) {
      console.error("Web scraper blocked or structure changed. Retaining safe internal rate cache.", scraperError);
    }
  }

  // Fallback to previous cached state if both options completely fail
  return cachedOfficialRate;
}
const app = express();
const PORT = 3000;

app.use(express.json());

interface Submission {
  id: string;
  location: string;
  rate: number;
  source: string;
  isVerified: boolean;
  timestamp: Date;
}

const fallbackSubmissions: Submission[] = [
  { id: "s1", location: "Harare CBD", rate: 36.80, source: "Cash Dealer", isVerified: true, timestamp: new Date() },
  { id: "s2", location: "Bulawayo", rate: 36.50, source: "WhatsApp Group", isVerified: true, timestamp: new Date(Date.now() - 1000 * 60 * 12) },
  { id: "s3", location: "Mutare", rate: 37.00, source: "In-Store Rate", isVerified: false, timestamp: new Date(Date.now() - 1000 * 60 * 45) }
];

let memoizedResult: any = null;
let lastRefreshedAt = 0;
const CACHE_DURATION = 30 * 1000; 

// Sane market valuation thresholds (Option 3 Guardrail boundaries)
const MIN_RATE = 25.0;
const MAX_RATE = 50.0;

app.get("/api/market-data", async (req, res) => {
  const now = Date.now();
  
  try {
    // 1. Asynchronously fetch/verify the newest official rate index
    const liveOfficialRate = await fetchLatestOfficialRate();

    // 2. Query your persistent database rows
    const { data: dbEntries, error: dbError } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (dbError) throw dbError;

    const currentSubmissions: Submission[] = (dbEntries || []).map(item => ({
      id: item.id,
      location: item.location,
      rate: Number(item.rate),
      source: item.source,
      isVerified: item.is_verified,
      timestamp: item.created_at
    }));

    // Pass the liveOfficialRate down into your local mathematical fallback filter if needed
    if (memoizedResult && (now - lastRefreshedAt < CACHE_DURATION)) {
      return res.json({ ...memoizedResult, submissions: currentSubmissions, cached: true });
    }

    const client = getGeminiClient();
    if (!client) {
      // Pass live interbank rate to your local math processor out-of-the-box
      const fallbackData = performLocalTrimmedMean(currentSubmissions, liveOfficialRate);
      memoizedResult = fallbackData;
      lastRefreshedAt = now;
      return res.json({ ...fallbackData, submissions: currentSubmissions, cached: false });
    }

    // 3. Update the data prompt sent to Gemini with the current interbank baseline index!
    const contextPrompt = `
      Official Interbank Reference Rate: 1 USD = ${liveOfficialRate} ZWG
      Current Raw Submissions List:
      ${currentSubmissions.map(s => `ID: ${s.id}, Location: ${s.location}, Rate: ${s.rate}, Source: ${s.source}, Time: ${s.timestamp}`).join("\n")}
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["parallelRate", "officialRate", "exchangeGapPercentage", "high24h", "low24h", "submissionCount", "aiSummary"],
          properties: {
            parallelRate: { type: Type.NUMBER },
            officialRate: { type: Type.NUMBER },
            exchangeGapPercentage: { type: Type.INTEGER },
            high24h: { type: Type.NUMBER },
            low24h: { type: Type.NUMBER },
            submissionCount: { type: Type.INTEGER },
            aiSummary: { type: Type.STRING }
          }
        },
        systemInstruction: `You are the financial calibration engine for Solidrate.zw... Use the dynamic Official Interbank Reference Rate provided in the context prompt as 'officialRate'. Calculate exchangeGapPercentage using: Round(((parallelRate - officialRate) / officialRate) * 100).`
      },
      contents: contextPrompt
    });

    // ... rest of your validation checking loop logic and response piping

    const officialRate = liveOfficialRate;
    const count = currentSubmissions.length;
    const rates = currentSubmissions.map(s => s.rate);
    const parallelRate = rates.reduce((sum, r) => sum + r, 0) / count;
    const high24h = Math.max(...rates);
    const low24h = Math.min(...rates);
    const exchangeGapPercentage = ((parallelRate - officialRate) / officialRate) * 100;

    const finalMarketData = {
      parallelRate: Number(parallelRate.toFixed(2)),
      officialRate,
      exchangeGapPercentage: Number(exchangeGapPercentage.toFixed(2)),
      high24h: Number(high24h.toFixed(2)),
      low24h: Number(low24h.toFixed(2)),
      submissionCount: count,
      submissions: currentSubmissions
    };

    const ai = getGeminiClient();
    const cacheNow = Date.now();

    if (ai && (!memoizedResult || (cacheNow - lastRefreshedAt) > CACHE_DURATION)) {
      try {
        // Option 4: Upgraded analytical evaluation engine logic
        const analysisPrompt = `Analyze these recent crowdsourced ZiG parallel exchange rates from Zimbabwe: ${JSON.stringify(currentSubmissions.slice(0, 10))}. 
        The official central bank rate is currently stable around ${officialRate} ZiG. 
        Provide a dense 2-sentence macro-intelligence summary tracking:
        1. Current trajectory or regional variations (e.g., price spreads across distinct cities/hubs).
        2. A clear, direct warning or stabilization takeaway regarding the market premium deviation gap.
        Keep the tone completely objective, formal, and concise. Avoid all markdown asterisks or bullet styles in the text output.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: analysisPrompt,
        });
        
        memoizedResult = {
          ...finalMarketData,
          aiSummary: response.text?.trim() || "Market conditions trading sideways across regional centers.",
          cached: false
        };
        lastRefreshedAt = cacheNow;
        return res.json(memoizedResult);
      } catch (aiErr) {
        console.error("Gemini context pipeline exception:", aiErr);
      }
    }

    if (memoizedResult) {
      return res.json({
        ...finalMarketData,
        aiSummary: memoizedResult.aiSummary || "Market indices calculating smoothly.",
        cached: true
      });
    }

    return res.json({
      ...finalMarketData,
      aiSummary: "Tracking active transactional data feeds across provincial nodes.",
      cached: false
    });

  } catch (err) {
    console.error("Database route fetch execution failure:", err);
    return res.status(500).json({ error: "Failed to load live exchange matrix" });
  }
});

// Option 3: Backend Verification Firewall Protected Input Endpoint
app.post("/api/submit-rate", async (req, res) => {
  const { rate, location, source } = req.body;
  
  if (!rate || isNaN(Number(rate)) || !location || !source) {
    return res.status(400).json({ error: "Incomplete dataset parameters provided." });
  }

  const numericRate = Number(rate);

  // Hard firewall against bad actors/typos warp attempts
  if (numericRate < MIN_RATE || numericRate > MAX_RATE) {
    return res.status(400).json({ 
      error: `Security Alert: Submitted rate (${numericRate} ZiG) violates market reality safeguards. Must remain between ${MIN_RATE} and ${MAX_RATE}.` 
    });
  }

  try {
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          rate: numericRate,
          location: String(location).trim(),
          source: String(source).trim(),
          is_verified: true
        }
      ])
      .select();

    if (error) throw error;

    const addedRecord = data[0];
    memoizedResult = null;
    lastRefreshedAt = 0;

    return res.json({ 
      success: true, 
      submission: {
        id: addedRecord.id,
        location: addedRecord.location,
        rate: Number(addedRecord.rate),
        source: addedRecord.source,
        isVerified: addedRecord.is_verified,
        timestamp: new Date(addedRecord.timestamp)
      }
    });
  } catch (err) {
    console.error("Database write injection error:", err);
    return res.status(500).json({ error: "Cloud architecture write timeout error." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Solidrate.zw Core online at http://localhost:${PORT}`);
  });
}

startServer();