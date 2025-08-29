/* eslint-disable react/no-unescaped-entities */
"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";


type Attachment =
  | { kind: "image"; url: string; alt?: string; name?: string }
  | { kind: "file"; name: string; url?: string; mime?: string }
  | { kind: "url"; url: string; title?: string; domain?: string };

type Entry = {
  id: string;
  title: string;
  createdAt: string;
  text: string;
  attachments: Attachment[];
};

type ChatAttachment = {
  name: string;
  url?: string;
  type: "image" | "file";
};

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  content?: string;
  html?: string;
  timestamp: string;
  attachment?: ChatAttachment;
};

const delayMs = () => 1000 + Math.floor(Math.random() * 4000);
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const makeId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const ordinal = (n: number) => {
  const s = ["th","st","nd","rd"] as const;
  const v = n % 100;
  const idx = (v - 20) % 10;
  const key = (idx >= 1 && idx <= 3) ? (idx as 1|2|3) : (v >= 1 && v <= 3 ? (v as 1|2|3) : 0);
  return `${n}${s[key]}`;
};

function parseNthQuery(q: string): number | null {
  const text = q.toLowerCase();
  const m = text.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  // Heuristic: require a hint word to avoid random numbers
  if (!/(entry|journal|note|log|memory|show|open|go to|goto)/.test(text)) return null;
  return n;
}

function generateInsights(es: Entry[]): string {
  const n = es.length; if (n === 0) return "Start capturing moments and I’ll reflect them back with care.";
  const recent = es.slice(0, Math.min(20, n));
  const names = ["Maya","Arun","Priya","Sofia","Daniel","Leo","Mom","Dad","Riya","Sam"];
  const nameCounts: Record<string, number> = {}; names.forEach(nm => nameCounts[nm] = 0);
  recent.forEach(e => { names.forEach(nm => { if (e.text.includes(nm)) nameCounts[nm]++; }); });
  const topName = Object.entries(nameCounts).sort((a,b)=>b[1]-a[1]).find(([,c])=>c>0)?.[0];

  const topicMap: Record<string, string[]> = {
    outdoors: ["park","beach","hike","mountain","trail","walk","river","garden"],
    creative: ["creative","paint","draw","art","write","song","sketch","design"],
    reading: ["book","read","novel","chapter","library"],
    running: ["run","jog","5k","marathon"],
    cooking: ["cook","recipe","bake","dinner","lunch","breakfast","meal"],
    gratitude: ["grateful","gratitude","thankful","appreciate"],
  };
  const topicCounts: Record<string, number> = {}; Object.keys(topicMap).forEach(k=>topicCounts[k]=0);
  recent.forEach(e => { for (const [k, kws] of Object.entries(topicMap)) { if (kws.some(w => e.text.toLowerCase().includes(w))) topicCounts[k]++; } });
  const topTopics = Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]).filter(([,c])=>c>0).map(([k])=>k).slice(0,2);

  const photos = es.filter(e=>e.attachments.some(a=>a.kind==="image")).length;
  const s1 = `You’ve captured ${n} moments so far${photos>0?`, including ${photos} photo ${photos===1?"memory":"memories"}`:""}.`;
  const s2 = topTopics.length>0
    ? `Lately I’m seeing ${topTopics.join(" and ")} showing up in your recent entries—they seem to restore your energy.`
    : `Your recent entries show steady reflection—keep noticing what leaves you feeling restored.`;
  const s3 = topName
    ? `You mention ${topName} often in uplifting moments; consider a small check‑in or a shared walk with ${topName} this week.`
    : `Consider a tiny ritual this week (a 15‑minute walk or a page of writing) to anchor your days.`;
  return `${s1} ${s2} ${s3}`;
}

function generateRandomEntries(): Entry[] {
  const randomTitles = [
    "Morning coffee thoughts", "Weekend hiking adventure", "Book club meeting", "Team retrospective",
    "Grocery store encounter", "Late night coding session", "Sunday brunch", "Museum visit",
    "Workout milestone", "Recipe experiment", "Phone call with mom", "Concert experience",
    "Travel planning", "Garden update", "Movie night", "Volunteer work",
    "Learning new skill", "Photography walk", "Cooking disaster", "Friend's birthday",
    "Work presentation", "Doctor appointment", "Library visit", "Pet store trip",
    "Bike ride adventure", "Meditation session", "Online course progress", "Home renovation",
    "Beach day memories", "City exploration", "Art gallery visit", "Podcast discovery",
    "Farmers market haul", "Yoga class breakthrough", "Reading corner setup", "Investment research",
    "Tech meetup insights", "Cooking class fun", "Park bench reflection", "Gaming session",
    "Morning routine update", "Evening walk thoughts", "Weekend project", "Social media break",
    "News article reaction", "Health check update", "Car maintenance day", "Seasonal transition",
    "Family dinner stories", "Professional development"
  ];
  
  const randomTexts = [
    "Had some interesting thoughts today about productivity and creativity.",
    "Discovered a new favorite spot in the city. The atmosphere was perfect.",
    "Tried something completely different today and it turned out better than expected.",
    "Reflecting on recent conversations and how they've shaped my perspective.",
    "Small victories matter more than I sometimes realize.",
    "The weather was perfect for outdoor activities today.",
    "Learning never stops, and today was a great reminder of that.",
    "Sometimes the best moments are the unplanned ones.",
    "Grateful for the people who make ordinary days extraordinary.",
    "Progress isn't always linear, but it's always worth celebrating."
  ];
  
  const entries: Entry[] = [];
  
  for (let i = 0; i < 50; i++) {
    const randomDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    entries.push({
      id: `random_${i + 1}`,
      title: randomTitles[Math.floor(Math.random() * randomTitles.length)],
      createdAt: randomDate.toISOString(),
      text: randomTexts[Math.floor(Math.random() * randomTexts.length)],
      attachments: []
    });
  }
  
  return entries;
}

function seedEntries(): Entry[] {
  // Start with only random memories - no Max/SF/Project X content initially
  const randomEntries = generateRandomEntries();
  
  return randomEntries.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export default function CortexDemoPage() {
  const [entries, setEntries] = useState<Entry[]>(() => seedEntries());

  const [headerQuery, setHeaderQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [searchLeadIn, setSearchLeadIn] = useState<string | undefined>();
  const [searchHighlights, setSearchHighlights] = useState<Record<string, string>>({});
  const [searchActive, setSearchActive] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [entryText, setEntryText] = useState("");
  const [entryFiles, setEntryFiles] = useState<File[]>([]);
  const [entryPreviews, setEntryPreviews] = useState<string[]>([]);
  const [entryUrl, setEntryUrl] = useState("");
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pitchPrimed, setPitchPrimed] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightText, setInsightText] = useState<string>("");
  const [proactivePrompt, setProactivePrompt] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState(0);
  const [demoEntries, setDemoEntries] = useState<Entry[]>([]);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<Date>(() => new Date());

  const detectedUrl = useMemo(() => {
    if (entryUrl.trim()) return entryUrl.trim();
    const m = entryText.match(/https?:\/\/\S+/i);
    return m ? m[0] : null;
  }, [entryText, entryUrl]);

  const entryDateLabel = useMemo(
    () => entryDate.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" }),
    [entryDate]
  );

  useEffect(() => {
    const el = chatScrollRef.current; if (!el) return; el.scrollTo({ top: el.scrollHeight });
  }, [messages, isTyping]);

  const simulatedSearch = useCallback((query: string): Promise<{ leadIn?: string; results: Entry[]; highlights?: Record<string, string> }> => {
    const q = query.trim().toLowerCase();
    return new Promise((resolve) => {
      setTimeout(() => {
        let leadIn: string | undefined; let results: Entry[] = []; const highlights: Record<string, string> = {};
        if (q.length === 0) { leadIn = "Browsing your recent entries."; resolve({ leadIn, results: entries.slice(0,6), highlights }); return; }

        const nth = parseNthQuery(q);
        if (nth) {
          if (nth <= entries.length) { const e = entries[nth-1]; const ord = ordinal(nth); leadIn = `Jumping to your ${ord} entry from ${fmtDate(e.createdAt)}.`; resolve({ leadIn, results: [e], highlights }); return; }
          const ord = ordinal(nth); leadIn = `You have ${entries.length} entries so far—no ${ord} yet.`; resolve({ leadIn, results: [], highlights }); return;
        }

        if ((q.includes("anthropic") && q.includes("valuation")) || q.includes("anthropic's valuation")) {
          const aiEntry = entries.find(e => e.title.toLowerCase() === "ai companies");
          if (aiEntry) {
            results = [aiEntry];
            const sentence = "Anthropic's latest valuation is around $18 billion";
            const idx = aiEntry.text.indexOf(sentence);
            if (idx !== -1) {
              const before = aiEntry.text.slice(0, idx);
              const after = aiEntry.text.slice(idx + sentence.length);
              highlights[aiEntry.id] = `${before}<mark class=\"bg-yellow-200 px-0.5 rounded\">${sentence}</mark>${after}`;
            }
            leadIn = "Found this in your 'AI Companies' entry.";
            resolve({ leadIn, results, highlights });
            return;
          }
        }

        // Smart search responses for demo - prioritize demo entries
        if (q.includes("pics") && (q.includes("dog") || q.includes("max"))) {
          // Find Max entries from demo entries first, fallback to all entries
          const allMaxEntries = [...demoEntries, ...entries].filter(e => 
            e.text.toLowerCase().includes("max") ||
            e.title.toLowerCase().includes("max")
          );
          
          if (allMaxEntries.length >= 2) {
            // Sort by date to get first and last chronologically
            const sortedEntries = allMaxEntries.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
            const firstEntry = sortedEntries[0]; // Getting Max (earliest)
            const lastEntry = sortedEntries[sortedEntries.length - 1]; // Walk with Max (latest)
            results = [firstEntry, lastEntry];
            const firstDate = fmtDate(firstEntry.createdAt);
            const lastDate = fmtDate(lastEntry.createdAt);
            leadIn = `You bought Max on ${firstDate} and you went on a long walk with him on 2nd of September.`;
            resolve({ leadIn, results, highlights });
            return;
          } else if (allMaxEntries.length === 1) {
            // If only one Max entry exists, show it
            results = allMaxEntries;
            leadIn = `Here's your memory with Max:`;
            resolve({ leadIn, results, highlights });
            return;
          }
        }
        
        if (q.includes("project x") || q.includes("project")) {
          // Find Project X related entries
          const allProjectEntries = [...demoEntries, ...entries].filter(e => 
            e.text.toLowerCase().includes("project x") ||
            e.text.toLowerCase().includes("ai") && e.text.toLowerCase().includes("product") ||
            e.text.toLowerCase().includes("investor") ||
            e.text.toLowerCase().includes("pitch deck") ||
            e.title.toLowerCase().includes("ai companies") ||
            e.title.toLowerCase().includes("investor")
          );
          
          if (allProjectEntries.length >= 1) {
            // Sort by date and take up to 3 entries
            const sortedEntries = allProjectEntries
              .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
              .slice(0, 3);
            results = sortedEntries;
            leadIn = `Here are your Project X memories: ${sortedEntries.length === 1 ? 'Initial idea' : sortedEntries.length === 2 ? 'Initial idea and development' : 'Initial idea, SF investor trip, and pitch deck development'}.`;
            resolve({ leadIn, results, highlights });
            return;
          }
        }

        const terms = q.split(/\s+/).filter(Boolean);
        const scored = entries.map((e) => ({
          e,
          score: terms.reduce((acc, t) => {
            const inText = e.text.toLowerCase().includes(t);
            const inTitle = e.title.toLowerCase().includes(t);
            const inUrls = e.attachments.some(a => a.kind === "url" && (a.url.toLowerCase().includes(t) || (a.domain?.toLowerCase().includes(t) ?? false)));
            return acc + (inText?1:0) + (inTitle?1:0) + (inUrls?1:0);
          }, 0)
        }))
        .filter(s => s.score > 0)
        .sort((a,b) => b.score - a.score)
        .map(s => s.e);
        results = scored.slice(0,6);
        if (results.length === 0) results = entries.slice(0,6);
        resolve({ leadIn, results, highlights });
      }, delayMs());
    });
  }, [entries, demoEntries]);

  const simulatedChatReply = useCallback((text: string, _attachment?: ChatAttachment): Promise<string> => {
    const t = text.trim().toLowerCase();
    // mark unused param as used to satisfy lint
    void _attachment;
    return new Promise((resolve) => {
      setTimeout(() => {
        const nth = parseNthQuery(t);
        if (nth) {
          if (nth <= entries.length) {
            const e = entries[nth-1];
            const ord = ordinal(nth);
            const snip = `${e.text.slice(0, 180)}${e.text.length>180?"…":""}`;
            return resolve(`Your ${ord} entry was on ${fmtDate(e.createdAt)}. A quick recall: ${snip}`);
          }
          return resolve(`You have ${entries.length} entries so far — no ${ordinal(nth)} yet.`);
        }
        if (/when is my dog'?s birthday\??/.test(t) || /when did i get max\??/.test(t) || /when did i get my dog\??/.test(t)) {
          const maxEntry = demoEntries.find(e => e.text.toLowerCase().includes('max') && e.text.toLowerCase().includes('bought'));
          if (maxEntry) {
            return resolve(`I remember that special day! You brought Max home on ${fmtDate(maxEntry.createdAt)}. That must be such a happy memory.`);
          }
          return resolve("You haven't written about getting Max yet, but I'm excited to hear about it!");
        }
        
        if (t.includes("pitch deck") || (t.includes("generate") && t.includes("project x"))) {
          return resolve("Of course! I can generate a pitch deck for Project X based on your journal entries. Let me work on that for you...");
        }
        
        if (t.includes("how is") && (t.includes("max") || t.includes("dog"))) {
          return resolve("Max seems to be doing great! How has he been adjusting? Did you get him any accessories or toys?");
        }
        
        if (t.includes("accessories") || t.includes("toys")) {
          return resolve("That's wonderful! Dogs love new toys and accessories. What did you get for Max?");
        }
        
        resolve("Of course. Ask me anything about your entries, or say 'create a pitch deck for Project X'.");
      }, delayMs());
    });
  }, [demoEntries, entries]);

  async function handleHeaderSearch() {
    const q = headerQuery.trim();
    if (!q) {
      setSearchActive(false);
      setSearchLoading(false);
      setSearchResults([]);
      setSearchLeadIn(undefined);
      setSearchHighlights({});
      return;
    }
    setSearchActive(true);
    setSearchLoading(true);
    setSearchResults([]);
    setSearchLeadIn(undefined);
    const resp = await simulatedSearch(q);
    setSearchLeadIn(resp.leadIn);
    setSearchResults(resp.results);
    setSearchHighlights(resp.highlights ?? {});
    setSearchLoading(false);
  }

  function handleEntryFilesChange(files: FileList | null) {
    const fs = files ? Array.from(files) : [];
    setEntryFiles(fs);
    const previews = fs.filter(f => f.type.startsWith("image")).map(f => URL.createObjectURL(f));
    setEntryPreviews(previews);
  }

  function addNewEntry() {
    if (!entryText.trim() && entryFiles.length === 0) return;
    setIsCreatingEntry(true);
    
    setTimeout(() => {
      const id = makeId("entry");
      const attachments: Attachment[] = [];
      if (detectedUrl) {
        try {
          const u = new URL(detectedUrl);
          attachments.push({ kind: "url", url: detectedUrl, domain: u.hostname.replace(/^www\./, ""), title: "Linked Article" });
        } catch {}
      }
      
      // Simulate image content extraction for flight tickets
      entryFiles.forEach(f => {
        if (f.type.startsWith("image")) {
          const imgUrl = URL.createObjectURL(f);
          let alt = f.name;
          
          // Simulate flight ticket detection
          if (demoStep === 2 && (f.name.toLowerCase().includes('ticket') || f.name.toLowerCase().includes('flight'))) {
            alt = "Flight ticket to San Francisco - Tomorrow";
          } else if (demoStep === 4 && f.name.toLowerCase().includes('max')) {
            alt = "Me with Max after SF trip";
          }
          
          attachments.push({ kind: "image", url: imgUrl, alt, name: f.name });
        } else {
          attachments.push({ kind: "file", name: f.name, mime: f.type });
        }
      });
      
      let title = "Untitled";
      const text = entryText.trim();
      
      // Generate smart titles based on demo flow
      if (demoStep === 0 && text.includes("Max")) {
        title = "Getting Max";
      } else if (demoStep === 1 && (text.includes("AI") || text.includes("product"))) {
        title = "AI Companies & Product Ideas";
      } else if (demoStep === 2 && (text.includes("investor") || text.includes("call"))) {
        title = "Investor Call & Flight Plans";
      } else if (demoStep === 3 && text.includes("pitch deck")) {
        title = "Pitch Deck Request";
      } else if (demoStep === 4 && text.includes("SF")) {
        title = "SF Trip & Walk with Max";
      } else {
        const words = text.split(" ").slice(0, 3).join(" ");
        title = words.length > 0 ? words + "..." : "Untitled";
      }
      
      const newEntry: Entry = { id, title, createdAt: entryDate.toISOString(), text, attachments };
      setEntries((p) => [newEntry, ...p]);
      setEntryText("");
      setEntryFiles([]);
      setEntryPreviews([]);
      setEntryUrl("");
      setIsCreatingEntry(false);
      // Store demo entries separately (same as newEntry)
      setDemoEntries((p) => [...p, newEntry]);
      // Increment the composer date by 1 day for the next note
      setEntryDate(prev => new Date(prev.getTime() + 24 * 60 * 60 * 1000));
      
      // Set proactive prompts based on demo flow - use current demoStep before incrementing
      const currentStep = demoStep;
      setDemoStep(prev => prev + 1);
      
      setTimeout(() => {
        if (currentStep === 0) {
          // Day 1: After user posts about Max (without saying "dog")
          setProactivePrompt("How is Max your dog doing? Should I plan accessories for him?");
        } else if (currentStep === 1) {
          // Day 2: After AI companies post
          setProactivePrompt("Did you build further on top of your Project X?");
        } else if (currentStep === 2) {
          // Day 3: After investor call post (system extracts SF from flight ticket)
          setProactivePrompt("As you are planning to go to SF tomorrow, did you create a checklist for your accessories?");
        } else if (currentStep === 3) {
          // Day 4: After pitch deck request
          setProactivePrompt("I can help generate a pitch deck for Project X if you'd like!");
        } else if (currentStep === 4) {
          // Day 5: After SF return post
          setProactivePrompt("It sounds like you had a great trip! How's Max adjusting to having you back?");
        }
      }, delayMs());
    }, delayMs());
  }

  // header-driven search only — removed legacy performSearch

  function handlePendingFileChange(file: File | null) { setPendingFile(file); }



  async function sendChat() {
    const text = chatInput.trim(); if (!text && !pendingFile) return;
    const attach: ChatAttachment | undefined = pendingFile ? { name: pendingFile.name, url: pendingFile.type.startsWith("image") ? URL.createObjectURL(pendingFile) : undefined, type: pendingFile.type.startsWith("image") ? "image" : "file" } : undefined;
    const userMsg: ChatMessage = { id: makeId("m"), role: "user", content: text || (attach ? (attach.type === "image" ? "[Image]" : `[File] ${attach.name}`) : ""), timestamp: new Date().toISOString(), attachment: attach };
    setMessages((p) => [...p, userMsg]); setChatInput(""); setPendingFile(null); setIsTyping(true);

    const wantsPitch = /pitch\s*deck/i.test(text) || /generate.*project\s*x/i.test(text) || (pitchPrimed && /^(yes|ok|sure|go ahead|please|create|generate)\b/i.test(text));
    if (wantsPitch) {
      setTimeout(() => {
        setMessages((p) => [...p, { id: makeId("m"), role: "ai", content: "Of course. Generating a pitch deck for Project X based on your journal entries...", timestamp: new Date().toISOString() }]);
      }, delayMs());
      
      const deckHtml = `
        <div class="space-y-4 p-4 bg-slate-50 rounded-lg">
          <div class="font-bold text-lg text-center">Here is a draft for your pitch deck based on your notes on "Project X."</div>
          <div class="text-sm text-slate-600 italic">Citation: Journal Entry, ${fmtDate(entries.find(e => e.title.includes("Project X"))?.createdAt || new Date().toISOString())}</div>
          
          <div class="space-y-3">
            <div class="font-semibold text-sky-800">Slide 1: Title</div>
            <div class="pl-4">Project X: The Ultimate Second Brain - RAG-Based Knowledge Assistant</div>
            
            <div class="font-semibold text-sky-800">Slide 2: The Problem</div>
            <div class="pl-4">
              • Information overload is overwhelming modern professionals and students.<br/>
              • People struggle to organize, retrieve, and connect their knowledge effectively.<br/>
              • Current note-taking apps lack intelligent context and personalized insights.
            </div>
            
            <div class="font-semibold text-sky-800">Slide 3: The Solution</div>
            <div class="pl-4">
              • Project X: A RAG-based app that acts as your second brain.<br/>
              • Intelligently organizes thoughts, memories, and knowledge with AI-powered connections.<br/>
              • Provides contextual insights and proactive suggestions based on your personal data.
            </div>
            
            <div class="font-semibold text-sky-800">Slide 4: Market Opportunity</div>
            <div class="pl-4">
              • The AI productivity tools market is exploding (Citation: Journal Entry, ${fmtDate(entries.find(e => e.title.includes("AI Companies"))?.createdAt || new Date().toISOString())}).<br/>
              • Personal knowledge management is a $2B+ growing market.<br/>
              • Perfect timing with advances in RAG technology and LLMs.
            </div>
            
            <div class="font-semibold text-sky-800">Slide 5: The Ask</div>
            <div class="pl-4">
              • Seeking $2M seed funding to build our MVP and acquire first 10K users.<br/>
              • Ready to revolutionize how people think, learn, and remember.
            </div>
          </div>
        </div>`;
      await new Promise((r)=>setTimeout(r, delayMs()));
      setIsTyping(false);
      setPitchPrimed(false);
      setMessages((p) => [...p, { id: makeId("m"), role: "ai", html: deckHtml, timestamp: new Date().toISOString() }]);
      return;
    }

    const reply = await simulatedChatReply(text, attach);
    setIsTyping(false); setMessages((p) => [...p, { id: makeId("m"), role: "ai", content: reply, timestamp: new Date().toISOString() }]);
  }

  useEffect(() => {
    setInsightsLoading(true);
    const timer = setTimeout(() => {
      const txt = generateInsights(entries);
      setInsightText(txt);
      setInsightsLoading(false);
    }, delayMs());
    return () => clearTimeout(timer);
  }, [entries]);

  // removed tab-based effect; chat is persistent and search is header-driven

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-slate-800">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Image src="/globe.svg" alt="Cortex" width={24} height={24} />
            <div>
              <div className="font-semibold tracking-tight">Cortex Journal</div>
              <div className="text-xs text-slate-500">🔒 Private — local demo only</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex md:w-[420px]">
            <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm ring-1 ring-transparent focus-within:ring-sky-300">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input value={headerQuery} onChange={(e)=>setHeaderQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key==="Enter") { void handleHeaderSearch(); } }} placeholder="Search your memories..." className="w-full bg-transparent outline-none text-sm" />
              <button onClick={()=>void handleHeaderSearch()} className="text-sm font-medium text-sky-700 hover:text-sky-800">Search</button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            {/* Intelligent Recommendations - Always shown */}
            <div className="bg-gradient-to-r from-violet-50 to-sky-50 border border-violet-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-xl text-violet-800 mb-2">
                    <strong>💡 Intelligent Suggestions</strong>
                  </div>
                  {proactivePrompt ? (
                    <>
                      <div className="text-lg text-violet-700 mb-3">
                        {proactivePrompt}
                      </div>
                      {proactivePrompt && proactivePrompt.includes("pitch deck") ? (
                        <button
                          onClick={() => {
                            setChatInput("Can you generate a pitch deck for Project X?");
                            setProactivePrompt(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 text-white text-xs font-medium hover:from-violet-700 hover:to-sky-700 transition-all"
                        >
                          Insert to Chat
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17l9.2-9.2M17 17V7H7"/>
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setChatInput(proactivePrompt);
                            setProactivePrompt(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 text-white text-xs font-medium hover:from-violet-700 hover:to-sky-700 transition-all"
                        >
                          Ask in Chat
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17l9.2-9.2M17 17V7H7"/>
                          </svg>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-lg text-violet-600">
                      Start writing about your day and I'll provide contextual suggestions...
                    </div>
                  )}
                </div>
                {proactivePrompt && (
                  <button
                    onClick={() => setProactivePrompt(null)}
                    className="text-violet-400 hover:text-violet-600 text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            
            {/* Notion-style Entry Creation */}
            <div className="bg-white">
              <div className="p-1">
                <div className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                      ✨
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 text-2xl font-semibold tracking-tight bg-gradient-to-r from-sky-700 to-violet-700 bg-clip-text text-transparent">
                        {entryDateLabel}
                      </div>
                      <textarea
                        value={entryText}
                        onChange={(e)=>setEntryText(e.target.value)}
                        rows={entryText ? Math.max(10, entryText.split('\n').length) : 5}
                        placeholder={`Start writing about your day — ${entryDateLabel}`}
                        className={cx(
                          "w-full resize-none border-none outline-none text-slate-900 placeholder-slate-400",
                          "text-lg leading-relaxed",
                          entryText ? "" : "text-base"
                        )}
                      />
                      
                      {/* File Upload Area */}
                      {(entryFiles.length > 0 || entryPreviews.length > 0) && (
                        <div className="mt-3 space-y-2">
                          {entryPreviews.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {entryPreviews.map((src, i) => (
                                <img key={i} src={src} alt={`Preview ${i+1}`} className="h-40 w-full object-cover rounded-lg border border-slate-200" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* URL Preview */}
                      {detectedUrl && (
                        <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="flex-shrink-0 w-10 h-10 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 13a5 5 0 0 0 7.54.54l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/>
                              <path d="M14 11a5 5 0 0 1-7.54-.54L3.63 7.63a5 5 0 0 1 7.07-7.07L13 2"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-500 truncate">
                              {detectedUrl.replace(/^https?:\/\//, '').split('/')[0]}
                            </div>
                            <a href={detectedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 hover:text-sky-900 font-medium truncate block">
                              {detectedUrl}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* URL Input */}
                      <div className="mt-3 flex items-center gap-2">
                        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/>
                          <path d="M14 11a5 5 0 0 1-7.54-.54L3.63 7.63a5 5 0 0 1 7.07-7.07L13 2"/>
                        </svg>
                        <input
                          type="url"
                          value={entryUrl}
                          onChange={(e) => setEntryUrl(e.target.value)}
                          placeholder="Add a URL..."
                          className="flex-1 text-sm border-none outline-none bg-transparent placeholder-slate-400"
                        />
                      </div>
                      
                      {/* Action Bar */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <path d="M9 9l6 6"/>
                              <path d="M9 15l6-6"/>
                            </svg>
                            Attach
                            <input type="file" multiple className="hidden" onChange={(e)=>handleEntryFilesChange(e.target.files)} />
                          </label>
                          <div className="text-xs text-slate-400">
                            {entryFiles.length > 0 ? `${entryFiles.length} file${entryFiles.length > 1 ? 's' : ''} attached` : 'Ready to save'}
                          </div>
                        </div>
                        <button
                          onClick={addNewEntry}
                          disabled={isCreatingEntry || (!entryText.trim() && entryFiles.length === 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {isCreatingEntry ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Adding Note...
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14"/>
                              </svg>
                              Add Note
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Suggestions Based on Current Text */}
            {!proactivePrompt && entryText && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l2.5 5L20 8.5l-5 2.5L12 22l-2.5-5L4 14.5l5-2.5L12 2z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-blue-800 mb-2">
                      <strong>✨ Live Suggestions</strong>
                    </div>
                    <div className="text-lg text-blue-700">
                      {entryText.toLowerCase().includes('max') || entryText.toLowerCase().includes('pet') ? 
                        'I sense you\'re writing about your pet! Dogs bring so much joy to our lives. 🐕' :
                        entryText.toLowerCase().includes('ai') || entryText.toLowerCase().includes('product') ?
                        'Interesting thoughts on AI! This could be the start of something innovative. 💡' :
                        entryText.toLowerCase().includes('sf') || entryText.toLowerCase().includes('investor') ?
                        'Big moves ahead! SF meetings can be life-changing. ✈️' :
                        'I\'m following your thoughts as you write. Keep going! ✍️'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-4 md:p-6">
              <h3 className="font-semibold mb-2">Insights For You</h3>
              {insightsLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 w-3/4 bg-slate-200 rounded" />
                  <div className="h-4 w-2/3 bg-slate-200 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded" />
                </div>
              ) : (
                <p className="text-slate-700 leading-6">{insightText}</p>
              )}
            </div>

            {searchActive ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Search Results</h3>
                {searchLoading && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({length:6}).map((_,i)=> (
                      <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 rounded-lg bg-slate-200"/>
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 bg-slate-200 rounded"/>
                            <div className="h-3 w-3/4 bg-slate-200 rounded"/>
                            <div className="h-3 w-2/3 bg-slate-200 rounded"/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!searchLoading && searchLeadIn && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">{searchLeadIn}</div>
                )}
                {!searchLoading && searchResults.length>0 && (
                  <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((e)=> {
                      const isOpen = !!expanded[e.id];
                      const images = e.attachments.filter(a=>a.kind==="image") as Array<{kind:"image";url:string;alt?:string;name?:string}>;
                      const urls = e.attachments.filter(a=>a.kind==="url") as Array<{kind:"url";url:string;title?:string;domain?:string}>;
                      const files = e.attachments.filter(a=>a.kind==="file") as Array<{kind:"file";name:string;url?:string;mime?:string}>;
                      const img = images[0];
                      const hasHL = !!searchHighlights[e.id];
                      return (
                        <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-start gap-3">
                            {img ? (
                              <img src={img.url} alt={img.alt || e.title} className="h-16 w-16 rounded-lg object-cover flex-none" />
                            ) : (
                              <div className="h-16 w-16 rounded-lg grid place-items-center flex-none bg-slate-100 border border-slate-200 text-slate-500">
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 17l5-5 4 4 5-6 3 3"/></svg>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">{fmtDate(e.createdAt)}</div>
                                <button onClick={()=>setExpanded(p=>({ ...p, [e.id]: !p[e.id] }))} className="text-xs text-sky-700 hover:text-sky-900">{isOpen?"Collapse":"Expand"}</button>
                              </div>
                              {hasHL ? (
                                isOpen ? (
                                  <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: searchHighlights[e.id] }} />
                                ) : (
                                  <p className="mt-1 text-sm text-slate-800 line-clamp-3" dangerouslySetInnerHTML={{ __html: searchHighlights[e.id] }} />
                                )
                              ) : (
                                <p className={cx("mt-1 text-sm text-slate-800", isOpen?"whitespace-pre-wrap":"line-clamp-3")}>{e.text}</p>
                              )}
                              {isOpen && (
                                <div className="mt-3 space-y-3">
                                  {images.length>0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                      {images.map((im,i)=> (
                                        <img key={i} src={im.url} alt={im.alt || im.name || `Image ${i+1}`} className="h-32 w-full object-cover rounded-lg" />
                                      ))}
                                    </div>
                                  )}
                                  {urls.length>0 && (
                                    <div className="space-y-2">
                                      {urls.map((u,i)=> (
                                        <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-slate-100">
                                          <div className="h-8 w-8 grid place-items-center rounded bg-white border border-slate-200 text-slate-500">
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/><path d="M14 11a5 5 0 0 1-7.54-.54L3.63 7.63a5 5 0 0 1 7.07-7.07L13 2"/></svg>
                                          </div>
                                          <div className="min-w-0">
                                            <div className="text-xs text-slate-500 truncate">{u.domain ?? u.url.replace(/^https?:\/\//,'').split('/')[0]}</div>
                                            <div className="text-sm text-sky-700 truncate">{u.title ?? u.url}</div>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  {files.length>0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {files.map((f,i)=> (
                                        <div key={i} className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                                          <span>{f.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!searchLoading && searchResults.length===0 && (
                  <div className="text-sm text-slate-500">No results. Try another memory phrase.</div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold">Recent Entries</h3>
                <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries.map((e)=> {
                    const isOpen = !!expanded[e.id];
                    const images = e.attachments.filter(a=>a.kind==="image") as Array<{kind:"image";url:string;alt?:string;name?:string}>;
                    const urls = e.attachments.filter(a=>a.kind==="url") as Array<{kind:"url";url:string;title?:string;domain?:string}>;
                    const files = e.attachments.filter(a=>a.kind==="file") as Array<{kind:"file";name:string;url?:string;mime?:string}>;
                    const img = images[0];
                    return (
                      <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          {img ? (
                            <img 
                              src={img.url} 
                              alt={img.alt || e.title} 
                              className="h-16 w-16 rounded-lg object-cover flex-none cursor-pointer hover:opacity-80 transition-opacity" 
                              onClick={() => setModalImage(img.url)}
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-lg grid place-items-center flex-none bg-slate-100 border border-slate-200 text-slate-500">
                              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 17l5-5 4 4 5-6 3 3"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500">{fmtDate(e.createdAt)}</div>
                              <button onClick={()=>setExpanded(p=>({ ...p, [e.id]: !p[e.id] }))} className="text-xs text-sky-700 hover:text-sky-900">{isOpen?"Collapse":"Expand"}</button>
                            </div>
                            <p className={cx("mt-1 text-sm text-slate-800", isOpen?"whitespace-pre-wrap":"line-clamp-3")}>{e.text}</p>
                            {isOpen && (
                              <div className="mt-3 space-y-3">
                                {images.length>0 && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {images.map((im,i)=> (
                                      <img 
                                        key={i} 
                                        src={im.url} 
                                        alt={im.alt || im.name || `Image ${i+1}`} 
                                        className="h-32 w-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" 
                                        onClick={() => setModalImage(im.url)}
                                      />
                                    ))}
                                  </div>
                                )}
                                {urls.length>0 && (
                                  <div className="space-y-2">
                                    {urls.map((u,i)=> (
                                      <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-slate-100">
                                        <div className="h-8 w-8 grid place-items-center rounded bg-white border border-slate-200 text-slate-500">
                                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/><path d="M14 11a5 5 0 0 1-7.54-.54L3.63 7.63a5 5 0 0 1 7.07-7.07L13 2"/></svg>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs text-slate-500 truncate">{u.domain ?? u.url.replace(/^https?:\/\//,'').split('/')[0]}</div>
                                          <div className="text-sm text-sky-700 truncate">{u.title ?? u.url}</div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {files.length>0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {files.map((f,i)=> (
                                      <div key={i} className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                                        <span>{f.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <aside className="lg:col-span-1">
            <section className="flex h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Quick actions:</span>
                  <button onClick={() => setChatInput("Can you generate a pitch deck for Project X?")} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700 hover:bg-sky-100">Generate Pitch Deck</button>
                  <button onClick={() => setChatInput("When did I get my dog?")} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700 hover:bg-sky-100">Ask about Max</button>
                </div>
                {messages.length===0 && (
                  <div className="text-sm text-slate-500">
                    <div className="mb-2 font-medium text-slate-600">Hi! I'm your personal AI assistant.</div>
                    <div className="space-y-1 text-xs">
                      <div>• Ask about your memories: "When did I get Max?"</div>
                      <div>• Request insights: "What was I excited about recently?"</div>
                      <div>• Generate content: "Create a pitch deck for Project X"</div>
                      <div>• Upload images or files for analysis</div>
                    </div>
                  </div>
                )}
                {messages.map((m)=> (
                  <div key={m.id} className={cx("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.role==="user"?"ml-auto bg-sky-600 text-white":"mr-auto bg-slate-100 text-slate-800")}
                  >
                    {m.attachment && (
                      m.attachment.type==="image" ? (
                        <img src={m.attachment.url} alt={m.attachment.name} className="mb-2 max-h-40 rounded-lg" />
                      ) : (
                        <div className={cx("mb-2 inline-flex items-center gap-2 rounded-full px-2 py-1", m.role==="user"?"bg-sky-700":"bg-slate-200 text-slate-700")}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                          <span className="text-xs truncate max-w-[160px]">{m.attachment.name}</span>
                        </div>
                      )
                    )}
                    {m.html ? (
                      <div dangerouslySetInnerHTML={{ __html: m.html }} />
                    ) : (
                      <div>{m.content}</div>
                    )}
                    <div className={cx("mt-1 text-[10px]", m.role==="user"?"text-sky-100":"text-slate-500")}>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="mr-auto max-w-[70%] rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-pulse"/>
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-pulse [animation-delay:150ms]"/>
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-pulse [animation-delay:300ms]"/>
                      <span className="text-xs ml-1">Cortex is typing…</span>
                    </div>
                  </div>
                )}
              </div>

              {pendingFile && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {pendingFile.type.startsWith("image") ? (
                      <img src={URL.createObjectURL(pendingFile)} alt={pendingFile.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-2 py-1">
                        <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        <span className="text-xs text-slate-700">{pendingFile.name}</span>
                      </div>
                    )}
                    <button onClick={()=>setPendingFile(null)} className="text-xs text-slate-500 hover:text-slate-700">Remove</button>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <label className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <input type="file" className="hidden" onChange={(e)=>handlePendingFileChange(e.target.files?.[0]||null)} />
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24L9.88 17.14a1 1 0 11-1.41-1.41l8.49-8.49"/></svg>
                  </label>
                  <input value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter" && !e.shiftKey && (e.preventDefault(), sendChat())} placeholder="Write a message..." className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300" />
                  <button onClick={sendChat} className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    Send
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
      
      {/* Image Modal */}
      {modalImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img 
              src={modalImage} 
              alt="Enlarged view" 
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setModalImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-lg font-bold transition-all"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
