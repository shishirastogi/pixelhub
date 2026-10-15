"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Button, Input } from "@/components/form";
import { OnboardingTutorialModal } from "@/components/onboarding-tutorial-modal";

export type FaqCategory =
  | "ALL"
  | "GETTING_STARTED"
  | "DELIVERABLES"
  | "WATCHER"
  | "VERSIONING"
  | "BRAND_QA"
  | "CLIENT_PORTAL";

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  ALL: "All Topics",
  GETTING_STARTED: "Getting Started & Roles",
  DELIVERABLES: "Deliverables & Brief",
  WATCHER: "Folder Watcher (CLI)",
  VERSIONING: "Branches & Versions",
  BRAND_QA: "Brand Kit & QA",
  CLIENT_PORTAL: "Client Reviews & Access",
};

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, "ALL">;
  question: string;
  answer: string;
  followUpPrompt: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "gs-1",
    category: "GETTING_STARTED",
    question: "What is the difference between a Designer account and a Client account?",
    answer:
      "When you sign up on PixelHub, you choose either a Designer or Client persona. Designer accounts can create studio workspaces, pair local folders with pixelhub-watch, manage branches/versions, and invite clients with granular permissions. Client accounts get a streamlined Client Review Portal to accept project invitations, request access by project slug, track live deliverable progress, drop spatial pins on artwork, and approve versions.",
    followUpPrompt: "How do client permissions and access requests work?",
  },
  {
    id: "gs-2",
    category: "GETTING_STARTED",
    question: "Can I switch a Client account into a Designer account later?",
    answer:
      "No — your account type (DESIGNER or CLIENT) is permanently bound when you register your account so workspace permissions and studio ownership boundaries remain secure. You can update your Full Name, Email Address, Company/Studio, Job Title, and Password anytime in Account Settings.",
    followUpPrompt: "How do I update my account settings and password?",
  },
  {
    id: "gs-3",
    category: "GETTING_STARTED",
    question: "How do I replay the introductory popup tutorial?",
    answer:
      "Click the 'Launch Interactive Tutorial ✦' button at the top of this Help & FAQ page (or in the top header bar). It will walk you step-by-step through every tab and feature tailored to your account type.",
    followUpPrompt: "What are the main tabs in a PixelHub project?",
  },
  {
    id: "del-1",
    category: "DELIVERABLES",
    question: "How does automatic deliverable tracking work?",
    answer:
      "On the Contracts & Brief tab, each requirement defines one or more deliverables with a glob file pattern (such as instagram_post_*.{png,jpg} or banner_*.png). Whenever you upload a file or save an export into your watched folder, PixelHub's deterministic glob matcher checks the filename. When it matches, the deliverable flips to SATISFIED (✓) and requirement coverage recomputes automatically.",
    followUpPrompt: "Which deliverables are still missing in this project?",
  },
  {
    id: "del-2",
    category: "DELIVERABLES",
    question: "How does AI requirement extraction from the brief work?",
    answer:
      "Paste your client brief on the Contracts & Brief tab, click 'Save brief', and then click 'Extract requirements'. PixelHub's AI proposal engine parses the brief into PENDING requirement cards with suggested quantities, priorities, and deliverable file patterns. Nothing is added to your active scope until you click 'Accept'.",
    followUpPrompt: "How do deliverable glob patterns work?",
  },
  {
    id: "del-3",
    category: "DELIVERABLES",
    question: "Can I manually link a file or toggle a deliverable status?",
    answer:
      "Yes! Expand any requirement card on the Contracts & Brief tab and click 'Link file' to pick an existing project file, or click a deliverable's status badge (✓ / ○) to toggle it between SATISFIED and OPEN manually.",
    followUpPrompt: "How do I generate tasks from a requirement?",
  },
  {
    id: "wat-1",
    category: "WATCHER",
    question: "How do I pair my local design folder with pixelhub-watch?",
    answer:
      "Open the Files or Settings tab in your project and click 'Pair this folder' to generate an 8-character pairing code. Then run `npx pixelhub-watch pair --server http://localhost:3000` inside your local folder and paste the code. The watcher hashes your files with SHA-256, syncs changes with a 2-second debounce, and sends heartbeats every 60 seconds.",
    followUpPrompt: "How do I pair the folder watcher?",
  },
  {
    id: "wat-2",
    category: "WATCHER",
    question: "What files does the folder watcher ignore by default?",
    answer:
      "By default, pixelhub-watch ignores `.git`, `node_modules`, `.pixelhub`, `*.tmp`, `~$*`, `.DS_Store`, and `Thumbs.db`. You can also add a `.pixelhubignore` file (using standard gitignore syntax) in your watched folder for custom rules.",
    followUpPrompt: "How does content-addressed SHA-256 deduplication work?",
  },
  {
    id: "ver-1",
    category: "VERSIONING",
    question: "How do Branches and Version Snapshots work for designers?",
    answer:
      "Branches are safe creative forks: Main (approved work), Concept (explore a direction), Revision (client feedback round), and Experimental. Forking copies the source branch's latest snapshot so branches never overwrite each other's files. Clicking 'Snapshot current state' freezes an immutable version (v1, v2, v3…) with a checksum that prevents duplicate empty snapshots.",
    followUpPrompt: "How do branches, versions, and Adopt into Main work?",
  },
  {
    id: "ver-2",
    category: "VERSIONING",
    question: "What does 'Adopt into Main' do?",
    answer:
      "When a Concept or Revision branch is approved, click 'Adopt into Main' on the Versions tab. A modal lists every file on that branch so you can select all or a subset to carry over into Main as a new merge version with full source-branch provenance.",
    followUpPrompt: "How do I compare two versions?",
  },
  {
    id: "ver-3",
    category: "VERSIONING",
    question: "How do I compare two versions to see what changed?",
    answer:
      "On the Versions tab, check any two version snapshots and click 'Compare selected (2)' (or open the Compare tab directly). You'll see Added, Removed, Modified, and Renamed files, dominant color palette shifts, detected fonts, and a designer-English summary.",
    followUpPrompt: "How do I restore an older version snapshot?",
  },
  {
    id: "bqa-1",
    category: "BRAND_QA",
    question: "How does Brand Kit QA and ΔE color checking work?",
    answer:
      "On the Brand Performance (Brand Kit) tab, add your approved hex colors along with a ΔE tolerance (e.g. 8), approved fonts, logos, and rules (like FORBIDDEN_COLOR). When you click 'Run brand check' (or upload a new export), PixelHub extracts dominant colors from your images via sharp, computes CIE76 ΔE color distance against your brand palette, and flags any off-brand drift.",
    followUpPrompt: "What is ΔE tolerance in the Brand Kit?",
  },
  {
    id: "cli-1",
    category: "CLIENT_PORTAL",
    question: "How does a Client get access to a project?",
    answer:
      "There are two ways: (1) The project Owner invites the client's email via 'Team & Permissions' (or 'Invite Client'), and the client clicks 'Accept & Open Access' on their Client Dashboard. (2) The client enters the exact Project Slug (e.g. acme-q4-campaign) on their Client Dashboard to send an access request, which the designer approves after choosing which permissions to grant.",
    followUpPrompt: "How do client permissions and access requests work?",
  },
  {
    id: "cli-2",
    category: "CLIENT_PORTAL",
    question: "How do spatial pinpoint comments on images work?",
    answer:
      "Click any artwork card on the Dashboard, Files gallery, or Version detail to open the Interactive Preview Lightbox. Click anywhere on the image canvas to drop a numbered pin (1, 2, 3) at that exact coordinate, type your feedback, and click Post. Designers see the pin on the image and in their Client Feedback inbox, and can reply, resolve, or convert the comment into a task with one click.",
    followUpPrompt: "What client comments are open on this project?",
  },
];

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function HelpCenterView({
  projectId,
  projectName,
  userAccountType,
  userName,
}: {
  projectId?: string | null;
  projectName?: string | null;
  userAccountType: "DESIGNER" | "CLIENT";
  userName?: string;
}) {
  const [category, setCategory] = useState<FaqCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(FAQ_ITEMS[0]!.id);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: projectName
        ? `Hi${userName ? ` ${userName.split(" ")[0]}` : ""}! I'm your **PixelHub Help & Project Assistant**. Ask me anything about how to use PixelHub or ask live questions about **${projectName}** (deliverables, files, versions, brand QA, or client reviews).`
        : `Hi${userName ? ` ${userName.split(" ")[0]}` : ""}! I'm your **PixelHub Help Assistant**. Ask me anything about how to use PixelHub, deliverables auto-tracking, folder watcher sync, client permissions, or account settings.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>(
    projectName
      ? [
          `What is the status of ${projectName}?`,
          "Which deliverables are still missing?",
          "What client comments are open on this project?",
          "How do I drop a spatial pin comment on an image?",
        ]
      : [
          "How do deliverable glob patterns work?",
          "How do I pair the folder watcher?",
          "How do client permissions and access requests work?",
          "How do I drop a spatial pin comment on an image?",
        ],
  );

  async function askQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || busy) return;

    setChatOpen(true);
    const nextHistory: ChatTurn[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextHistory);
    setInput("");
    setBusy(true);

    try {
      const res = await apiFetch<{
        reply: string;
        suggestedQuestions?: string[];
      }>("/help/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          projectId: projectId ?? null,
          history: messages.slice(-6),
        }),
      });
      setMessages([
        ...nextHistory,
        { role: "assistant", content: res.reply },
      ]);
      if (res.suggestedQuestions && res.suggestedQuestions.length > 0) {
        setSuggested(res.suggestedQuestions);
      }
    } catch (err) {
      setMessages([
        ...nextHistory,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `Sorry, I couldn't process that request: ${err.message}`
              : "Sorry, something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void askQuestion(input);
  }

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCat = category === "ALL" || item.category === category;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const CATEGORIES: FaqCategory[] = [
    "ALL",
    "GETTING_STARTED",
    "DELIVERABLES",
    "WATCHER",
    "VERSIONING",
    "BRAND_QA",
    "CLIENT_PORTAL",
  ];

  return (
    <div className="space-y-3.5">
      {/* Compact Top Interactive Tutorial Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-golden-hero px-5 py-3.5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="dark">
            {userAccountType === "CLIENT"
              ? "Client Help Center"
              : "Studio Help Center"}
          </Badge>
          <h2 className="font-serif text-2xl text-[#141413]">
            Help, FAQ &amp; Project Assistant
          </h2>
          {projectName ? (
            <Badge tone="lime">Project: {projectName}</Badge>
          ) : null}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setTutorialOpen(true)}
        >
          ✦ Launch Interactive Tutorial
        </Button>
      </div>

      {/* Full-Width Categorized Pre-Written FAQ Accordion */}
      <Card className="p-5 sm:p-6">
        <CardTitle
          hint={
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{filteredFaqs.length} answers</Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setChatOpen(true)}
              >
                💬 Open Help Chatbot
              </Button>
            </div>
          }
        >
          Frequently Asked Questions by Category
        </CardTitle>

        {/* Search & Category Filter Pills */}
        <div className="mb-4 space-y-2.5">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs (e.g. watcher, glob pattern, ΔE, client permissions, pin)…"
            className="py-2 text-xs"
          />

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  category === cat
                    ? "border-[#141413] bg-[#141413] text-white shadow-pill"
                    : "border-[#EBE7DF] bg-[#FAF8F4] text-[#57544E] hover:bg-[#F3F1EC]",
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        {filteredFaqs.length === 0 ? (
          <p className="rounded-2xl bg-[#FAF8F4] p-6 text-center text-xs text-[#6B6860]">
            No FAQ entries match your search — click the Help Chatbot button in
            the bottom-right corner for a tailored answer!
          </p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {filteredFaqs.map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="h-fit rounded-2xl border border-[#EBE7DF] bg-[#FAF8F4]/75 p-3.5 transition hover:bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="space-y-1">
                      <Badge tone="neutral">
                        {CATEGORY_LABELS[faq.category]}
                      </Badge>
                      <h4 className="text-xs font-semibold text-[#141413]">
                        {faq.question}
                      </h4>
                    </div>
                    <span className="mt-0.5 text-xs text-[#6B6860]">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="mt-2.5 space-y-2 border-t border-[#EFECE6] pt-2.5 text-xs leading-relaxed text-[#57544E]">
                      <p>{faq.answer}</p>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void askQuestion(faq.followUpPrompt)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[11px] font-semibold text-[#6D28D9] transition hover:bg-[#7C3AED] hover:text-white"
                        >
                          <span>Ask Chatbot: “{faq.followUpPrompt}”</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* FLOATING BOTTOM-RIGHT CHATBOT POPUP WINDOW */}
      {chatOpen ? (
        <div className="fixed bottom-20 right-6 z-40 flex w-[calc(100vw-3rem)] max-w-[390px] flex-col justify-between rounded-[26px] border border-sky-200/90 bg-ai-sky p-4 shadow-float">
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[#141413] text-xs font-bold text-white shadow-sm">
                  ✦
                </span>
                <div>
                  <h3 className="font-serif text-lg leading-none text-[#141413]">
                    PixelHub Help Chatbot
                  </h3>
                  {projectName ? (
                    <p className="mt-0.5 text-[10px] text-[#57544E]">
                      {projectName}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMessages((prev) => prev.slice(0, 1))}
                  className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-[#57544E] hover:bg-white hover:text-[#141413]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  aria-label="Close chatbot"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-xs font-bold text-[#141413] hover:bg-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Compact Chat Messages Container */}
            <div className="h-[220px] space-y-2 overflow-y-auto rounded-2xl border border-white/85 bg-white/70 p-3 backdrop-blur-md">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex flex-col",
                    msg.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                      msg.role === "user"
                        ? "bg-[#141413] text-white"
                        : "bg-white text-[#141413]",
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="w-fit rounded-xl bg-white px-3 py-1.5 text-xs text-[#6B6860] shadow-sm">
                  Thinking…
                </div>
              ) : null}
            </div>
          </div>

          {/* Suggested Prompts + Input Form */}
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              {suggested.slice(0, 2).map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void askQuestion(q)}
                  className="rounded-full border border-white/90 bg-white/85 px-2.5 py-1 text-left text-[10px] font-medium text-[#141413] shadow-pill transition hover:bg-white"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                className="bg-white py-1.5 text-xs"
              />
              <Button type="submit" size="sm" disabled={busy || !input.trim()}>
                Ask
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {/* BOTTOM-RIGHT CORNER CHATBOT LAUNCHER BUTTON */}
      <button
        type="button"
        onClick={() => setChatOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 rounded-full bg-[#141413] px-5 py-3 text-xs font-semibold text-white shadow-float transition hover:scale-105 hover:bg-[#2A2927]"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9FE830] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#9FE830]" />
        </span>
        <span>{chatOpen ? "Close Help Chatbot" : "✦ Ask Help Chatbot"}</span>
      </button>

      {/* Introductory Popup Tutorial Modal */}
      <OnboardingTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        accountType={userAccountType}
        userName={userName}
      />
    </div>
  );
}
