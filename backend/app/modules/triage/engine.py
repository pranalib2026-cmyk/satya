"""Case Triage Engine for NyayaSetu.

Provides structured, deterministic assessment of legal intake data adhering to Indian
procedural law (CrPC/BNSS, CPC, NI Act, Consumer Protection Act 2019, NALSA Act 1987).
Designed with a modular architecture so advanced LLM-backed triage can be added behind
the BaseTriageEngine contract while keeping deterministic guarantees and preventing
hallucinated legal conclusions.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional


class BaseTriageEngine(ABC):
    """Abstract contract for case triage evaluators."""

    @abstractmethod
    def evaluate(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform legal assessment and return structured triage metadata."""
        pass


class DeterministicTriageEngine(BaseTriageEngine):
    """Deterministic, rule-based legal triage engine for Indian jurisprudence.

    Categorizes matters, checks evidentiary gaps, determines proper forum jurisdiction,
    computes urgency and complexity metrics, and recommends next actionable pathways:
    - SELF_HELP: E-filing, e-Daakhil, RTI, initial statutory notice
    - FREE_LEGAL_AID: Section 12 NALSA Act 1987 qualified citizens
    - ADVOCATE_CONSULTATION: Professional representation, litigation, complex drafting
    - URGENT_ASSISTANCE: Imminent arrest, police custody, stay against demolition/auction
    """

    # High-urgency indicators requiring emergency legal intervention
    CRITICAL_URGENCY_KEYWORDS = [
        "arrest",
        "custody",
        "police brutality",
        "demolition",
        "stay order",
        "auction",
        "remand",
        "warrant",
        "physical violence",
        "imminent threat",
        "assault",
        "suicide",
        "custodial",
        "dispossession",
    ]

    # Eligible indicators under Section 12 Legal Services Authorities Act, 1987
    LEGAL_AID_KEYWORDS = [
        "free legal aid",
        "legal aid",
        "nalsa",
        "dlsa",
        "slsa",
        "bpl",
        "below poverty line",
        "indigent",
        "cannot afford lawyer",
        "no money for lawyer",
        "domestic violence",
        "women shelter",
        "trafficking",
        "juvenile",
        "destitute",
        "widow",
    ]

    # Category normalization mappings
    CATEGORY_MAPPINGS = {
        "consumer": "Consumer Dispute",
        "criminal": "Criminal / Police Matters",
        "property": "Property & Real Estate",
        "family": "Family & Matrimonial",
        "matrimonial": "Family & Matrimonial",
        "cheque bounce": "Cheque Bounce (Sec 138 NI Act)",
        "cheque_bounce": "Cheque Bounce (Sec 138 NI Act)",
        "ni act": "Cheque Bounce (Sec 138 NI Act)",
        "labour": "Labour & Employment",
        "employment": "Labour & Employment",
        "corporate": "Corporate & Commercial",
        "commercial": "Corporate & Commercial",
        "cyber crime": "Cyber Crime & Online Fraud",
        "cyber_crime": "Cyber Crime & Online Fraud",
        "cyber": "Cyber Crime & Online Fraud",
        "constitutional": "Constitutional & Writs",
        "civil": "Civil Dispute",
    }

    def evaluate(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive deterministic triage analysis."""
        title = case_data.get("title", "").strip()
        description = case_data.get("problem_description", "").strip()
        raw_category = (case_data.get("legal_issue_category") or "General Dispute").strip()
        state = (case_data.get("state") or "").strip()
        district = (case_data.get("district") or "").strip()
        relevant_court = (case_data.get("relevant_court") or "").strip()
        incident_date = case_data.get("incident_date")
        urgency_input = (case_data.get("urgency") or "standard-30d").strip().lower()
        supporting_info = (case_data.get("supporting_info") or "").strip()
        adverse_parties = (case_data.get("adverse_parties") or "").strip()

        combined_text = f"{title} {description} {supporting_info}".lower()

        # 1. Normalized Category
        identified_category = self._normalize_category(raw_category, combined_text)

        # 2. Urgency Level
        urgency_level = self._compute_urgency(urgency_input, combined_text)

        # 3. Complexity Indicator
        complexity = self._compute_complexity(identified_category, combined_text)

        # 4. Missing Information Detection
        missing_information = self._detect_missing_information(
            identified_category=identified_category,
            incident_date=incident_date,
            state=state,
            district=district,
            supporting_info=supporting_info,
            combined_text=combined_text,
        )

        # 5. Suggested Jurisdiction
        possible_jurisdiction = self._resolve_jurisdiction(
            identified_category=identified_category,
            relevant_court=relevant_court,
            district=district,
            state=state,
        )

        # 6. Next-step category and entitlement flags
        suggested_next_step, advocate_appropriate, show_free_legal_aid = self._determine_next_step(
            urgency_level=urgency_level,
            complexity=complexity,
            identified_category=identified_category,
            combined_text=combined_text,
        )

        # 7. Summary of Facts
        summary_of_facts = self._synthesize_facts_summary(
            title=title,
            description=description,
            identified_category=identified_category,
            incident_date=incident_date,
            district=district,
            state=state,
            adverse_parties=adverse_parties,
            supporting_info=supporting_info,
        )

        return {
            "identified_category": identified_category,
            "summary_of_facts": summary_of_facts,
            "missing_information": missing_information,
            "possible_jurisdiction": possible_jurisdiction,
            "urgency_level": urgency_level,
            "complexity": complexity,
            "suggested_next_step": suggested_next_step,
            "advocate_assistance_appropriate": advocate_appropriate,
            "show_free_legal_aid": show_free_legal_aid,
            "assessed_at": datetime.now(timezone.utc).isoformat(),
        }

    def _normalize_category(self, raw_category: str, combined_text: str) -> str:
        raw_lower = raw_category.lower()
        for key, mapped in self.CATEGORY_MAPPINGS.items():
            if key in raw_lower:
                return mapped

        # Fallback text check
        if "cheque" in combined_text or "dishonour" in combined_text or "138" in combined_text:
            return "Cheque Bounce (Sec 138 NI Act)"
        if "consumer" in combined_text or "defect" in combined_text or "warranty" in combined_text:
            return "Consumer Dispute"
        if "divorce" in combined_text or "maintenance" in combined_text or "custody" in combined_text:
            return "Family & Matrimonial"
        if "fir" in combined_text or "police" in combined_text or "bail" in combined_text:
            return "Criminal / Police Matters"
        if "tenant" in combined_text or "landlord" in combined_text or "property" in combined_text or "land" in combined_text:
            return "Property & Real Estate"
        if "salary" in combined_text or "termination" in combined_text or "gratuity" in combined_text:
            return "Labour & Employment"

        return raw_category.title() if raw_category else "General Dispute"

    def _compute_urgency(self, urgency_input: str, combined_text: str) -> str:
        # Check critical emergency triggers first
        for keyword in self.CRITICAL_URGENCY_KEYWORDS:
            if re.search(r"\b" + re.escape(keyword) + r"\b", combined_text):
                return "EMERGENCY_24H"

        if "emergency" in urgency_input or "24h" in urgency_input:
            return "EMERGENCY_24H"
        if "urgent" in urgency_input or "48h" in urgency_input:
            return "URGENT_48H"
        if "exploratory" in urgency_input:
            return "EXPLORATORY"
        return "STANDARD_30D"

    def _compute_complexity(self, category: str, combined_text: str) -> str:
        # High complexity domains
        if category in ["Criminal / Police Matters", "Constitutional & Writs", "Corporate & Commercial"]:
            return "HIGH"
        if any(term in combined_text for term in ["arbitration", "insolvency", "quash", "habeas corpus", "anticipatory bail"]):
            return "HIGH"

        # Low complexity domains
        if category == "Consumer Dispute" and not any(term in combined_text for term in ["million", "crore", "death", "medical negligence"]):
            return "LOW"
        if any(term in combined_text for term in ["rti", "right to information", "e-daakhil", "simple refund", "name change"]):
            return "LOW"

        # Medium complexity is standard for civil disputes, cheque bounce, matrimonial
        return "MEDIUM"

    def _detect_missing_information(
        self,
        identified_category: str,
        incident_date: Optional[Any],
        state: str,
        district: str,
        supporting_info: str,
        combined_text: str,
    ) -> List[str]:
        missing: List[str] = []

        if not incident_date:
            missing.append("Exact date or timeframe when the incident or dispute first occurred.")

        if not district or not state:
            missing.append("Specific district and state location for jurisdictional determination.")

        # Category-specific evidentiary requirements under Indian law
        if identified_category == "Cheque Bounce (Sec 138 NI Act)":
            if "cheque number" not in combined_text and "cheque no" not in combined_text:
                missing.append("Cheque number, amount, and date of issuance.")
            if "memo" not in combined_text and "return" not in combined_text:
                missing.append("Bank return memo with exact dishonour reason (e.g., Funds Insufficient).")
            if "notice" not in combined_text and "demand" not in combined_text:
                missing.append("Proof and dispatch date of statutory 15-day legal demand notice sent to drawer.")

        elif identified_category == "Consumer Dispute":
            if "bill" not in combined_text and "invoice" not in combined_text and "receipt" not in combined_text:
                missing.append("Purchase tax invoice, receipt, or transaction order reference.")
            if "complaint" not in combined_text and "email" not in combined_text and "written" not in combined_text:
                missing.append("Prior written grievance communication or service ticket with the seller/provider.")

        elif identified_category == "Property & Real Estate":
            if "deed" not in combined_text and "agreement" not in combined_text and "registry" not in combined_text:
                missing.append("Title documents (Registered Sale Deed, Agreement for Sale, or Allotment Letter).")
            if "revenue" not in combined_text and "mutation" not in combined_text and "7/12" not in combined_text and "khata" not in combined_text:
                missing.append("Land revenue extract, mutation entry, or tax assessment records.")

        elif identified_category == "Family & Matrimonial":
            if "marriage" not in combined_text and "nikahnama" not in combined_text and "wedding" not in combined_text:
                missing.append("Date and place of solemnization of marriage.")
            if "child" in combined_text and "age" not in combined_text:
                missing.append("Ages and present custody arrangements of minor children.")

        elif identified_category == "Criminal / Police Matters":
            if "fir" not in combined_text and "station" not in combined_text and "complaint" not in combined_text:
                missing.append("Police Station jurisdiction, FIR number, or copy of police complaint / NCR.")

        elif identified_category == "Labour & Employment":
            if "appointment" not in combined_text and "contract" not in combined_text and "letter" not in combined_text:
                missing.append("Employment contract, offer/appointment letter, and last drawn salary slips.")

        if not supporting_info or len(supporting_info.split()) < 5:
            missing.append("Key supporting documents, witness names, or correspondence history.")

        return missing

    def _resolve_jurisdiction(
        self,
        identified_category: str,
        relevant_court: str,
        district: str,
        state: str,
    ) -> str:
        loc = f"{district}, {state}".strip(", ") if district or state else "Territorial District Court"

        if relevant_court:
            return f"{relevant_court} ({loc})" if loc not in relevant_court else relevant_court

        if identified_category == "Consumer Dispute":
            return f"District Consumer Disputes Redressal Commission (DCDRC), {loc}"
        if identified_category == "Cheque Bounce (Sec 138 NI Act)":
            return f"Court of Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, {loc}"
        if identified_category == "Criminal / Police Matters":
            return f"Sessions Court / Chief Judicial Magistrate (CJM), {loc}"
        if identified_category == "Property & Real Estate":
            return f"Civil Court (Senior Division) / Real Estate Regulatory Authority (RERA), {loc}"
        if identified_category == "Family & Matrimonial":
            return f"Family Court, {loc}"
        if identified_category == "Labour & Employment":
            return f"Labour Court / Industrial Tribunal, {loc}"
        if identified_category == "Corporate & Commercial":
            return f"Commercial Court / National Company Law Tribunal (NCLT Bench), {loc}"
        if identified_category == "Constitutional & Writs":
            return f"High Court of {state if state else 'Judicature'} (Article 226) / Supreme Court of India"
        if identified_category == "Cyber Crime & Online Fraud":
            return f"Cyber Crime Police Station / Adjudicating Officer (Information Technology Act), {loc}"

        return f"Civil Court / Competent District Court, {loc}"

    def _determine_next_step(
        self,
        urgency_level: str,
        complexity: str,
        identified_category: str,
        combined_text: str,
    ):
        # 1. Urgent assistance
        if urgency_level == "EMERGENCY_24H":
            return "URGENT_ASSISTANCE", True, False

        # 2. Check Free Legal Aid qualification under Section 12 NALSA Act 1987
        is_legal_aid_eligible = any(k in combined_text for k in self.LEGAL_AID_KEYWORDS)
        if is_legal_aid_eligible:
            return "FREE_LEGAL_AID", True, True

        # 3. Check Self-Help feasibility
        if complexity == "LOW":
            # Can proceed with e-Daakhil, RTI, or cyber grievance portal
            return "SELF_HELP", False, False

        # 4. Standard Advocate Consultation
        return "ADVOCATE_CONSULTATION", True, False

    def _synthesize_facts_summary(
        self,
        title: str,
        description: str,
        identified_category: str,
        incident_date: Optional[Any],
        district: str,
        state: str,
        adverse_parties: str,
        supporting_info: str,
    ) -> str:
        parts: List[str] = [
            f"Matter titled '{title}' categorized under {identified_category}."
        ]

        if incident_date:
            parts.append(f"Cause of action arose on or about {incident_date}.")
        if district or state:
            location_str = f"{district}, {state}".strip(", ")
            parts.append(f"Territorial nexus established in {location_str}.")
        if adverse_parties:
            parts.append(f"Adverse party/parties identified as: {adverse_parties}.")

        # Core narrative snippet
        clean_desc = re.sub(r"\s+", " ", description).strip()
        if len(clean_desc) > 300:
            clean_desc = clean_desc[:297] + "..."
        parts.append(f"Statement of grievance: \"{clean_desc}\"")

        if supporting_info:
            clean_supp = re.sub(r"\s+", " ", supporting_info).strip()
            if len(clean_supp) > 150:
                clean_supp = clean_supp[:147] + "..."
            parts.append(f"Disclosed collateral information: \"{clean_supp}\"")

        return " ".join(parts)


# Default singleton instance
_triage_engine_instance: Optional[BaseTriageEngine] = None


def get_triage_engine() -> BaseTriageEngine:
    """Return configured triage engine instance."""
    global _triage_engine_instance
    if _triage_engine_instance is None:
        _triage_engine_instance = DeterministicTriageEngine()
    return _triage_engine_instance
