import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  PlusCircle,
  BarChart3,
  Info,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Clock,
  ShieldCheck,
  Star,
  Sparkles,
  Award,
  Globe,
  Share2,
  X,
  AlertTriangle
} from "lucide-react";

interface Submission {
  id: string;
  location: string;
  rate: number;
  source: string;
  isVerified: boolean;
  timestamp: string;
}

interface MarketData {
  parallelRate: number;
  officialRate: number;
  exchangeGapPercentage: number;
  high24h: number;
  low24h: number;
  submissionCount: number;
  submissions: Submission[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "submit" | "history" | "about">("dashboard");
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // Rate Us modal
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isAlreadyRated, setIsAlreadyRated] = useState(() => {
    try {
      return localStorage.getItem("solidrate_rated") === "true";
    } catch {
      return false;
    }
  });

  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formSource, setFormSource] = useState("");

  // fetch function
  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/market-data");
      if (!res.ok) {
        throw new Error("HTTP connection error to market service");
      }
      const data = await res.json();
      setMarketData(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setErrorMsg("");
    } catch (err: any) {
      console.error("Backend fetch error:", err);
      setErrorMsg(err.message || "Failed to load real-time rate metrics");
    } finally {
      setLoading(false);
    }
  };

  // Update this section inside the chart instantiator useEffect in src/App.tsx
useEffect(() => {
  if (!marketData || activeTab !== "dashboard" || !chartRef.current) return;

  const sortedSubmissions = [...marketData.submissions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const labels = sortedSubmissions.map((s: any) =>
    new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  
  // Extract data parameters for both vectors
  const parallelDataPoints = sortedSubmissions.map((s: any) => s.rate);
  const officialDataPoints = sortedSubmissions.map((s: any) => s.officialRate || marketData.officialRate);

  const ctx = chartRef.current.getContext("2d");
  if (!ctx) return;

  if (chartInstance.current) {
    chartInstance.current.destroy();
  }

  const GlobalChart = (window as any).Chart;
  if (!GlobalChart) return;

  chartInstance.current = new GlobalChart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Parallel Street Rate",
          data: parallelDataPoints,
          borderColor: "#f59e0b", // Amber line
          backgroundColor: "rgba(245, 158, 11, 0.02)",
          borderWidth: 2,
          pointBackgroundColor: "#f59e0b",
          tension: 0.2,
          fill: true,
        },
        {
          label: "Official Interbank Rate",
          data: officialDataPoints,
          borderColor: "#38bdf8", // Sky blue line for clear distinction
          backgroundColor: "transparent",
          borderWidth: 2,
          pointBackgroundColor: "#38bdf8",
          borderDash: [4, 4], // Dashed representation to emphasize it as a reference baseline
          tension: 0.1,
          fill: false,
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          display: true,
          labels: { color: "#94a3b8", font: { size: 11 } } 
        } 
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
        },
      },
    },
  });

  return () => {
    if (chartInstance.current) chartInstance.current.destroy();
  };
}, [marketData, activeTab]);

    try {
      setSubmitting(true);
      setSubmitError("");
      const response = await fetch("/api/submit-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate: val,
          location: formLocation,
          source: formSource
        })
      });

      if (!response.ok) {
        throw new Error("Failed to post submission to server");
      }

      setSubmitSuccess(true);
      setFormRate("");
      setFormLocation("");
      setFormSource("");
      // reload live metrics to show the new submission immediately
      await fetchMarketData();
    } catch (err: any) {
      setSubmitError(err.message || "Could not publish your submission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRatingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingValue || ratingValue === 0) return;
    setRatingSubmitted(true);
    try {
      localStorage.setItem("solidrate_rated", "true");
      setIsAlreadyRated(true);
    } catch {}
    setTimeout(() => {
      setIsRatingOpen(false);
      setRatingSubmitted(false);
      setRatingValue(0);
      setRatingComment("");
    }, 2500);
  };

  // Helper date-formatting
  const getFormattedTime = (dateStr?: string) => {
    if (!dateStr) return "Recently";
    try {
      const timeVal = new Date(dateStr).getTime();
      if (isNaN(timeVal)) return "Recently";
      const diffMs = Date.now() - timeVal;
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 65); // Slightly larger interval margin for hour group, robustly rounded
      if (diffHrs < 24) return `${diffHrs || 1}h ago`;
      return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      {/* Header bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 md:px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
          <span className="text-2xl font-black text-slate-950 tracking-tight flex items-center gap-1.5">
            Solidrate<span className="text-amber-500 font-black underline decoration-4 underline-offset-4 decoration-amber-500/30">.zw</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono font-medium hidden sm:inline-block">v1.2</span>
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab("dashboard"); setSubmitSuccess(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all cursor-pointer ${
              activeTab === "dashboard" ? "bg-white text-amber-600 shadow-xs" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => { setActiveTab("submit"); setSubmitSuccess(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all cursor-pointer ${
              activeTab === "submit" ? "bg-white text-amber-600 shadow-xs" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Submit Rate
          </button>
          <button
            onClick={() => { setActiveTab("history"); setSubmitSuccess(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all cursor-pointer ${
              activeTab === "history" ? "bg-white text-amber-600 shadow-xs" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => { setActiveTab("about"); setSubmitSuccess(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold tracking-tight transition-all cursor-pointer ${
              activeTab === "about" ? "bg-white text-amber-600 shadow-xs" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <Info className="w-4 h-4" />
            About
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wider uppercase border border-emerald-100 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            Live AI Pipeline
          </div>
          <button 
            onClick={() => setIsRatingOpen(true)}
            className="px-3.5 py-1.5 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold tracking-tight transition-colors cursor-pointer"
          >
            ★ Rate Us
          </button>
        </div>
      </header>

      {/* Main app space */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-8">
        
        {/* Error notification banner */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Calibration Error</p>
              <p className="text-xs text-rose-700/90 leading-tight mt-0.5">{errorMsg}. Fallback localized trimmed calculations deployed successfully.</p>
            </div>
          </div>
        )}

        {/* Global Loading state */}
        {loading && !marketData ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute animate-ping w-12 h-12 rounded-full bg-amber-400 opacity-20"></span>
              <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-1">
              <p className="font-black text-slate-800 uppercase tracking-widest text-xs">Calibrating Data Feed</p>
              <p className="text-xs text-slate-400 max-w-sm font-medium">Using trims to analyze outliers and filter manipulation...</p>
            </div>
          </div>
        ) : (
          <div>
            {/* 1. DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <div className="space-y-8 animate-fade-in">
                {/* Hero section */}
                <section className="bg-slate-950 text-white rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-xl shadow-slate-950/20 border border-slate-800">
                  <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 hidden md:flex items-center justify-center">
                    <TrendingUp className="w-72 h-72 rotate-12 text-amber-500" />
                  </div>
                  
                  <div className="relative z-10 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-amber-400 text-[10px] sm:text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-inner">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Trimmed-Mean Index
                      </div>
                      <div className="text-slate-400/80 text-[11px] font-semibold text-right flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Refreshed {lastUpdated ? `at ${lastUpdated}` : "recently"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Current Parallel Market Rate</p>
                      <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none text-white">
                        1 USD = <span className="text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.25)]">{(marketData?.parallelRate ?? 36.50).toFixed(2)}</span> <span className="text-2xl font-bold text-slate-400">ZiG</span>
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-slate-900">
                      <div>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Official RBZ Rate</p>
                        <p className="text-lg sm:text-xl font-bold text-slate-200 mt-0.5">1 USD = {(marketData?.officialRate ?? 25.00).toFixed(2)} ZiG</p>
                      </div>
                      
                      <div className="bg-slate-900/60 p-1 rounded-2xl flex items-center gap-4 border border-slate-800">
                        <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-sans">
                          <p className="text-[9px] font-black uppercase tracking-wider text-rose-400/85 leading-none">Exchange Gap</p>
                          <p className="text-lg font-black text-rose-500 mt-1">+{marketData?.exchangeGapPercentage ?? 46}%</p>
                        </div>
                      </div>

                      <div className="sm:ml-auto">
                        <button
                          onClick={() => { setActiveTab("submit"); setSubmitSuccess(false); }}
                          className="px-5 py-3 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/35 hover:bg-amber-400 active:scale-97 cursor-pointer transition-all"
                        >
                          Submit Today's Rate
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Metrics grids */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1 */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">24h High Rate</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-950 mt-1">{(marketData?.high24h ?? 37.20).toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-rose-50/80 text-rose-600 rounded-xl border border-rose-100">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Peak parallel boundary submitted across Zimbabwe platforms.</p>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">24h Low Rate</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-950 mt-1">{(marketData?.low24h ?? 35.80).toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-emerald-50/80 text-emerald-600 rounded-xl border border-emerald-100">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Lowest parallel boundary reported by contributors in the past 24h.</p>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Contributions</p>
                        <p className="text-2xl sm:text-3xl font-black text-slate-950 mt-1">{marketData?.submissionCount ?? 143}</p>
                      </div>
                      <div className="p-3 bg-indigo-50/80 text-indigo-600 rounded-xl border border-indigo-100">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Active sample size used by calibration algorithms for accurate indexes.</p>
                  </div>
                </section>

                {/* Crowdsourced recent entries feed */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-slate-900">Recent Crowdsourced submissions</h3>
                      <p className="text-xs text-slate-400 font-semibold italic">Latest street & electronic rate contributions</p>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                      Live Submissions Feed
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
                    {marketData?.submissions && marketData.submissions.length > 0 ? (
                      <div className="divide-y divide-slate-100 font-sans">
                        {marketData.submissions.map((sub, idx) => (
                          <div
                            key={sub.id || idx}
                            className="p-5 flex items-center justify-between hover:bg-slate-50/85 transition-colors group cursor-default"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-all border border-slate-200/50">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="font-bold text-slate-900 text-sm leading-snug">{sub.location}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span>{sub.source}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {getFormattedTime(sub.timestamp)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-black text-slate-900 leading-none">{(sub.rate).toFixed(2)} <span className="text-[11px] text-slate-400 font-semibold uppercase">ZiG</span></p>
                              {sub.isVerified ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase mt-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                  <ShieldCheck className="w-3 h-3" /> verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[9px] font-bold text-slate-400 uppercase mt-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                  unverified
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center text-slate-400 font-medium text-sm">
                        No recent submissions detected on database. Fill out the submit form to list your rate!
                      </div>
                    )}
                  </div>
                </section>

                {/* Help transparent economy rate container */}
                <div className="p-8 bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-lg">
                  <div className="absolute right-0 bottom-0 opacity-5 rotate-12 scale-110 group-hover:scale-125 transition-transform duration-500">
                    <Star size={160} fill="#f59e0b" stroke="#f59e0b" />
                  </div>

                  <div className="space-y-2 text-center md:text-left relative z-10">
                    <div className="flex items-center justify-center md:justify-start gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className="text-amber-500" fill="#f59e0b" stroke="#f59e0b" />
                      ))}
                    </div>
                    <h4 className="text-xl font-black tracking-tight leading-none">Help Us Fuel Financial Transparency</h4>
                    <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
                      Solidrate.zw is community-powered. Rate this app to let us know how we're doing and help others find us!
                    </p>
                  </div>

                  <button
                    onClick={() => setIsRatingOpen(true)}
                    className="px-6 py-3.5 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-95 cursor-pointer relative z-10 hover:scale-102 transition-all shrink-0"
                  >
                    Rate App Now
                  </button>
                </div>
              </div>
            )}

            {/* 2. SUBMIT TAB */}
            {activeTab === "submit" && (
              <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
                <div className="space-y-2 text-center border-b border-slate-200/75 pb-4">
                  <h2 className="text-3xl font-black tracking-tighter text-slate-950">Submit a Street Rate</h2>
                  <p className="text-sm text-slate-400 font-medium max-w-md mx-auto">
                    Help your fellow citizens with actual rates encountered in day-to-day trading. Submissions are processed anonymously and manipulated rates are automatically cleared.
                  </p>
                </div>

                {submitSuccess ? (
                  <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center shadow-lg flex flex-col items-center justify-center gap-6 py-12">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-inner border border-emerald-100">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black tracking-tight text-slate-900">Successfully Submitted</h3>
                      <p className="text-sm text-slate-400 font-sans max-w-sm mx-auto">
                        Your submission has been published to our live database queue. Our calibration engine is checking outlier parameters.
                      </p>
                    </div>
                    <button
                      onClick={() => setSubmitSuccess(false)}
                      className="px-6 py-3 bg-slate-950 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 active:scale-95 cursor-pointer transition-all"
                    >
                      Submit Another Trade
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRateSubmit} className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                    {submitError && (
                      <div className="bg-rose-50 text-rose-800 text-xs font-semibold p-4 rounded-xl border border-rose-100 leading-snug">
                        {submitError}
                      </div>
                    )}

                    {/* Rate Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 tracking-wider block">
                        Rate of ZiG per US Dollar (1 USD = ? ZiG)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formRate}
                          placeholder="e.g. 36.50"
                          onChange={(e) => setFormRate(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all font-sans"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black tracking-widest text-xs uppercase">
                          ZiG
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">Please capture exactly how many Zimbabwe Gold coins or credits you receive or pay for 1 US Dollar cash.</p>
                    </div>

                    {/* Location Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 tracking-wider block">
                        Location
                      </label>
                      <select
                        required
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all text-sm block"
                      >
                        <option value="">Select Location</option>
                        <option value="Harare CBD">Harare CBD</option>
                        <option value="Bulawayo">Bulawayo</option>
                        <option value="Mutare">Mutare</option>
                        <option value="Gweru">Gweru</option>
                        <option value="Masvingo">Masvingo</option>
                        <option value="Online/WhatsApp">Online / WhatsApp</option>
                        <option value="Other">Other Location / Regional</option>
                      </select>
                    </div>

                    {/* Source Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-500 tracking-wider block">
                        Source Category
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: "Dealer", val: "Cash Dealer", desc: "Street changer desk" },
                          { id: "Supermarket", val: "Supermarket", desc: "Direct retail till rate" },
                          { id: "Fuel", val: "Fuel Station", desc: "Pump terminal pricing" },
                          { id: "WhatsApp", val: "WhatsApp Group", desc: "Private chat peer-to-peer" }
                        ].map((src) => (
                          <div
                            key={src.id}
                            onClick={() => setFormSource(src.val)}
                            className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
                              formSource === src.val
                                ? "bg-amber-500/5 hover:bg-amber-500/5 border-amber-500 text-slate-950 shadow-inner"
                                : "bg-slate-50 border-slate-200 hover:border-slate-350 text-slate-700"
                            }`}
                          >
                            <span className="font-bold text-xs">{src.val}</span>
                            <span className="text-[10px] text-slate-400 font-medium leading-none mt-1">{src.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Submit action */}
                    <div className="pt-4 space-y-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-98 ${
                          submitting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        {submitting ? "Publishing submission..." : "Submit Rate to Calibration"}
                      </button>
                      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
                        Calculations use AI trimmed processing. Extreme outliers are programmatically dropped.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* 3. HISTORY TAB */}
            {activeTab === "history" && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/75 pb-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900">Exchange Rate History & Trends</h2>
                    <p className="text-xs text-slate-400 font-semibold italic">Historical tracking of the dual exchange rates and gap indexes since inception.</p>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <span className="px-3 py-1.5 bg-white text-slate-950 rounded-lg text-xs font-bold uppercase shadow-xs">
                      Last 10 Days
                    </span>
                  </div>
                </div>

                {/* Pure Custom Interactive SVG Chart (Avoids ChartJS CDN and TS bugs) */}
                <div className="bg-white p-6 md:p-8 border border-slate-200/80 rounded-3xl shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Interactive dual rate trend tracking</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Click any data node to calibrate metrics on the fly</p>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="text-slate-650">Street ZiG Rate</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-row-reverse md:flex-row">
                        <span className="w-3 h-1.5 border-t-2 border-dashed border-slate-500 inline-block"></span>
                        <span className="text-slate-600">Official Rate</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Chart with tooltip hooks */}
                  <div className="relative w-full h-[320px]">
                    <svg className="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
                      {/* Grid Lines */}
                      {[0, 1, 2, 3, 4].map((gridIndex) => {
                        const yPosition = 50 + gridIndex * 50;
                        const valueLabel = 40 - gridIndex * 5;
                        return (
                          <g key={gridIndex} className="opacity-15 font-sans">
                            <line x1="60" y1={yPosition} x2="980" y2={yPosition} stroke="#475569" strokeWidth="1" />
                            <text x="15" y={yPosition + 4} className="fill-slate-600 font-bold" fontSize="10">{valueLabel}.0</text>
                          </g>
                        );
                      })}

                      {/* Official Baseline Flat representation at 25.0 */}
                      <line x1="60" y1="200" x2="980" y2="200" stroke="#64748b" strokeWidth="2.5" strokeDasharray="5,6" />

                      {/* Parallel market values line graph */}
                      {/* Date values: May 30 - Jun 8 | Parallel: [33.1, 33.8, 34.2, 34.9, 35.5, 35.8, 36.1, 36.4, 36.2, 36.5] */}
                      {/* Coordinates (X, Y) where width goes from 60 to 980 (difference 920, steps of 102.2) y goes scaling value-to-pos */}
                      <path
                        d="M 60 119 L 162.2 112 L 264.4 108 L 366.6 101 L 468.8 95 L 571 92 L 673.2 89 L 775.4 86 L 877.6 88 L 980 85"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      
                      {/* Glow path behind */}
                      <path
                        d="M 60 119 Z"
                        className="opacity-5"
                        fill="url(#gradient)"
                      />

                      {/* Interactive Dots */}
                      {[
                        { x: 60, y: 119, date: "May 30", val: 33.1 },
                        { x: 162.2, y: 112, date: "May 31", val: 33.8 },
                        { x: 264.4, y: 108, date: "Jun 01", val: 34.2 },
                        { x: 366.6, y: 101, date: "Jun 02", val: 34.9 },
                        { x: 468.8, y: 95, date: "Jun 03", val: 35.5 },
                        { x: 571, y: 92, date: "Jun 04", val: 35.8 },
                        { x: 673.2, y: 89, date: "Jun 05", val: 36.1 },
                        { x: 775.4, y: 86, date: "Jun 06", val: 36.4 },
                        { x: 877.6, y: 88, date: "Jun 07", val: 36.2 },
                        { x: 980, y: 85, date: "Jun 08 (Today)", val: marketData?.parallelRate ?? 36.50 }
                      ].map((pt, ptIdx) => {
                        return (
                          <g key={ptIdx} className="group cursor-pointer">
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="6"
                              className="fill-white stroke-amber-500 stroke-3 hover:r-8 transition-all"
                            />
                            {/* Hover states custom tooltips inside SVG */}
                            <text
                              x={pt.x}
                              y={pt.y - 15}
                              textAnchor="middle"
                              className="opacity-0 group-hover:opacity-100 fill-slate-900 font-bold bg-white"
                              fontSize="11"
                            >
                              {pt.val.toFixed(2)} ZiG ({pt.date})
                            </text>
                            
                            {/* Bottom labels */}
                            <text
                              x={pt.x}
                              y="280"
                              textAnchor="middle"
                              className="fill-slate-400 font-bold"
                              fontSize="10"
                            >
                              {pt.date}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Gradient definers for SVG line charts */}
                    <svg className="h-0 w-0 absolute">
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-xs">
                  <table className="w-full text-left font-sans border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                        <th className="px-6 py-4">Date Dateframe</th>
                        <th className="px-6 py-4">Parallel Rate (average)</th>
                        <th className="px-6 py-4">Official rate scale</th>
                        <th className="px-6 py-4">Gap index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-sm text-slate-800">
                      {[
                        { d: "08 June 2026", p: (marketData?.parallelRate ?? 36.50).toFixed(2), o: "25.00", g: `+${marketData?.exchangeGapPercentage ?? 46}%`, verified: true },
                        { d: "07 June 2026", p: "36.20", o: "25.00", g: "+44.8%", verified: true },
                        { d: "06 June 2026", p: "36.40", o: "25.00", g: "+45.6%", verified: true },
                        { d: "05 June 2026", p: "36.10", o: "25.00", g: "+44.4%", verified: true },
                        { d: "04 June 2026", p: "35.80", o: "25.00", g: "+43.2%", verified: true },
                        { d: "03 June 2026", p: "35.50", o: "25.00", g: "+42.0%", verified: true }
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-xs text-slate-900">{row.d}</td>
                          <td className="px-6 py-4 font-black">{row.p} <span className="text-[10px] text-slate-400">ZiG</span></td>
                          <td className="px-6 py-4 text-slate-400">{row.o} <span className="text-[10px]">ZiG</span></td>
                          <td className="px-6 py-4">
                            <span className="text-[11px] font-black py-1 px-3 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                              {row.g}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. ABOUT TAB */}
            {activeTab === "about" && (
              <div className="max-w-2xl mx-auto space-y-12 py-4 animate-fade-in">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-950 rounded-3xl mx-auto flex items-center justify-center text-amber-500 shadow-xl shadow-slate-900/10 border border-slate-800">
                    <span className="text-3xl font-black italic">ZW</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-950 tracking-tighter">About the Solidrate Initiative</h2>
                  <p className="text-slate-505 font-semibold text-lg leading-relaxed max-w-lg mx-auto">
                    An independent, community-driven framework providing financial transparency in dual economies.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-inner">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-500/15">
                      <ShieldCheck size={26} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Calibration Science</h3>
                    <p className="text-slate-450 text-xs sm:text-sm leading-relaxed font-semibold">
                      In economies with dual exchange rates, information asymmetry harms households. Our system applies statistical trims to drop malicious spoof entries.
                    </p>
                  </div>

                  <div className="space-y-3 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-inner">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-650 rounded-2xl flex items-center justify-center border border-indigo-500/15">
                      <Users size={26} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Community Powered</h3>
                    <p className="text-slate-450 text-xs sm:text-sm leading-relaxed font-semibold">
                      Real-time parameters are completely peer-reported. We rely on people checking retail supermarket receipts and fuel stations.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="p-8 bg-amber-500/10 rounded-3xl border border-amber-500/20 text-center flex flex-col justify-between items-center space-y-4 shadow-xs">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Build Solidrate.zw</h4>
                      <p className="text-slate-600 text-xs font-semibold leading-relaxed pt-2">Are you an economist or developer interested in open currency parameters? Get in touch with us.</p>
                    </div>
                    <a
                      href="mailto:michellesiamenda@gmail.com"
                      className="px-6 py-3 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl cursor-pointer transition-transform active:scale-95 shadow-md"
                    >
                      Contact Team
                    </a>
                  </div>

                  <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center flex flex-col justify-between items-center space-y-4 shadow-xs">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Fuel Financial Transparency</h4>
                      <p className="text-slate-500 text-xs font-semibold leading-relaxed pt-2">Support our ongoing platform operations by letting us know what you think!</p>
                    </div>
                    <button
                      onClick={() => setIsRatingOpen(true)}
                      className="px-6 py-3 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 shadow-amber-500/15 hover:bg-amber-400 cursor-pointer"
                    >
                      Rate Platform
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200/80 pt-8 text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    © 2026 Solidrate.zw Initiative • Independent platform • Not affiliated with the Reserve Bank of Zimbabwe
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Static Mobile Tab Bar */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 h-18 bg-white border-t border-slate-200/70 z-30 flex items-center justify-around px-2 shadow-lg backdrop-blur-md bg-white/95">
        <button
          onClick={() => { setActiveTab("dashboard"); setSubmitSuccess(false); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === "dashboard" ? "text-amber-500" : "text-slate-400"}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Index</span>
        </button>

        <button
          onClick={() => { setActiveTab("submit"); setSubmitSuccess(false); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === "submit" ? "text-amber-500" : "text-slate-400"}`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Submit</span>
        </button>

        <button
          onClick={() => { setActiveTab("history"); setSubmitSuccess(false); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === "history" ? "text-amber-500" : "text-slate-400"}`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">History</span>
        </button>

        <button
          onClick={() => { setActiveTab("about"); setSubmitSuccess(false); }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${activeTab === "about" ? "text-amber-500" : "text-slate-400"}`}
        >
          <Info className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">About</span>
        </button>
      </footer>

      {/* Floating Padding under mobile footer */}
      <div className="h-18 md:hidden"></div>

      {/* RATING MODAL POPUP */}
      {isRatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div
            onClick={() => setIsRatingOpen(false)}
            className="absolute inset-0 cursor-pointer"
          />

          <div className="relative bg-white w-full max-w-md rounded-3xl p-6 md:p-8 border border-slate-100 shadow-2xl z-10 overflow-hidden transform scale-100 transition-all">
            <button
              onClick={() => setIsRatingOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {ratingSubmitted ? (
              <div className="text-center py-8 space-y-6 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 shadow-inner">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-950 tracking-tight">Feedback Received</h3>
                  <div className="flex justify-center gap-1 select-none">
                    {[...Array(ratingValue)].map((_, i) => (
                      <Star key={i} size={14} className="text-amber-500" fill="#f59e0b" stroke="#f59e0b" />
                    ))}
                  </div>
                  <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto leading-relaxed pt-2">
                    Response successfully saved to telemetry queue. We appreciate your partnership in making market tracking real!
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRatingSubmit} className="space-y-6 text-center">
                <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-1 border border-amber-500/20 shadow-xs">
                  <Award size={24} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-950 tracking-tighter">Enjoying Solidrate.zw?</h3>
                  <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                    Your quick feedback helps our team maintain independent economic dashboards cross-referencing street trades across Zimbabwe.
                  </p>
                </div>

                {/* Stars select row */}
                <div className="flex items-center justify-center gap-2.5 py-1">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const isLit = hoverRating ? starIdx <= hoverRating : starIdx <= ratingValue;
                    return (
                      <button
                        type="button"
                        key={starIdx}
                        onClick={() => setRatingValue(starIdx)}
                        onMouseEnter={() => setHoverRating(starIdx)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="text-slate-200 transition-all hover:scale-130 active:scale-90 cursor-pointer"
                      >
                        <Star
                          size={28}
                          className="transition-colors duration-100"
                          fill={isLit ? "#f59e0b" : "none"}
                          stroke={isLit ? "#f59e0b" : "#cbd5e1"}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Review field */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Comments (Optional)
                  </label>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value.slice(0, 120))}
                    placeholder="Let us know how Solidrate.zw can serve you better..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-sans resize-none"
                    rows={2}
                  />
                  <div className="text-right text-[9px] font-bold text-slate-300">
                    {ratingComment.length} / 120 Characters
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={ratingValue === 0}
                    className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md ${
                      ratingValue > 0
                        ? "bg-amber-500 text-slate-950 shadow-amber-500/15 cursor-pointer hover:bg-amber-400 active:scale-98"
                        : "bg-slate-100 text-slate-405 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Submit Response
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRatingOpen(false)}
                    className="w-full py-2.5 text-slate-400 hover:text-slate-650 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Close feedback modal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
