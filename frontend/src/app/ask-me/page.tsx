import { AskMeClient } from "@/components/ask-me/ask-me-client";

export const metadata = {
  title: "Ask Me · Grounded Legal Assistant",
  description:
    "Ask your legal problem via text or voice. Get verified Indian statutory sections, plain-language simplification, actionable solutions, and verified advocate contacts.",
};

export default function AskMePage() {
  return <AskMeClient />;
}
