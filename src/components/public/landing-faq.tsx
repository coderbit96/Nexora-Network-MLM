"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const questions = [
  { question: "Which compensation model is available?", answer: "Nexora currently supports direct-referral and configurable level commissions. Commission rules are stored and resolved on the server, with an immutable record created for every credited amount." },
  { question: "Can members view their network?", answer: "Yes. Members can access their direct referrals, team information, referral link, and genealogy within the permissions and depth limits configured for the platform." },
  { question: "How are balances protected?", answer: "Wallet balances are derived from an immutable ledger. Credits, debits, withdrawal reservations, reversals, and administrative adjustments are all recorded as separate transactions." },
  { question: "Is administration permission-based?", answer: "Yes. Firebase establishes identity, while Nexora resolves the application account, status, role, and permissions on the server for every protected operation." },
] as const;

export function LandingFaq() {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  return <div className="border-t border-black/15">{questions.map((item, index) => {
    const isOpen = openQuestion === index;
    return <article className="border-b border-black/15" key={item.question}><button aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-semibold sm:py-7 sm:text-xl" onClick={() => setOpenQuestion(isOpen ? null : index)} type="button"><span>{item.question}</span>{isOpen ? <Minus aria-hidden="true" className="size-5 shrink-0" /> : <Plus aria-hidden="true" className="size-5 shrink-0" />}</button><AnimatePresence initial={false}>{isOpen ? <motion.div animate={{ height: "auto", opacity: 1 }} className="overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}><p className="max-w-2xl pb-7 text-sm leading-6 text-muted-foreground sm:text-base">{item.answer}</p></motion.div> : null}</AnimatePresence></article>;
  })}</div>;
}
