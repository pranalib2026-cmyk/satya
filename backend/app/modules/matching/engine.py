"""Advocate Matching Engine for NyayaSetu.

Implements multi-criteria objective matching based on Indian judicial practice domains,
territorial jurisdiction, linguistic alignment, and PostGIS/geodesic proximity.
Adheres strictly to Bar Council of India (BCI) Rule 36:
- Zero paid promotion or sponsored placement.
- Zero subjective popularity ratings or fabricated reviews.
- Factual, objective match explanations based strictly on verified credentials and territorial nexus.
"""

import math
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from app.core.config import settings
from app.core.logging import logger
from app.modules.advocates.models import AdvocateProfile
from app.modules.cases.models import LegalCase
from app.modules.matching.schemas import AdvocateMatchItem
from app.modules.users.models import User

# Standard reference coordinates for major Indian states and judicial centres (WGS84 lat, lon)
INDIAN_JURISDICTION_COORDINATES: Dict[str, Tuple[float, float]] = {
    # Capital and High Court Centers
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "central delhi": (28.6139, 77.2090),
    "south delhi": (28.5400, 77.2000),
    "mumbai": (19.0760, 72.8777),
    "mumbai city": (19.0760, 72.8777),
    "mumbai suburban": (19.1136, 72.8697),
    "pune": (18.5204, 73.8567),
    "maharashtra": (19.0760, 72.8777),
    "bengaluru": (12.9716, 77.5946),
    "bengaluru urban": (12.9716, 77.5946),
    "bengaluru rural": (13.0827, 77.5877),
    "karnataka": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "tamil nadu": (13.0827, 80.2707),
    "hyderabad": (17.3850, 78.4867),
    "telangana": (17.3850, 78.4867),
    "kolkata": (22.5726, 88.3639),
    "west bengal": (22.5726, 88.3639),
    "ahmedabad": (23.0225, 72.5714),
    "gujarat": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "rajasthan": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "allahabad": (25.4358, 81.8463),
    "prayagraj": (25.4358, 81.8463),
    "uttar pradesh": (26.8467, 80.9462),
    "patna": (25.5941, 85.1376),
    "bihar": (25.5941, 85.1376),
    "chandigarh": (30.7333, 76.7794),
    "punjab": (30.7333, 76.7794),
    "haryana": (30.7333, 76.7794),
    "bhopal": (23.2599, 77.4126),
    "madhya pradesh": (23.2599, 77.4126),
    "kochi": (9.9312, 76.2673),
    "ernakulam": (9.9312, 76.2673),
    "thiruvananthapuram": (8.5241, 76.9366),
    "kerala": (9.9312, 76.2673),
    "guwahati": (26.1445, 91.7362),
    "assam": (26.1445, 91.7362),
    "bhubaneswar": (20.2961, 85.8245),
    "odisha": (20.2961, 85.8245),
}

# Practice domain alias clusters
PRACTICE_SYNONYMS: Dict[str, List[str]] = {
    "trials & disputes": ["trials & disputes", "civil", "litigation", "disputes", "commercial disputes"],
    "civil dispute": ["civil", "civil dispute", "trials & disputes", "recovery", "injunction"],
    "consumer dispute": ["consumer dispute", "consumer protection", "consumer law", "trials & disputes"],
    "cheque bounce (sec 138 ni act)": ["cheque bounce", "sec 138 ni act", "ni act", "negotiable instruments", "criminal defense", "trials & disputes"],
    "property & real estate": ["property & real estate", "real estate", "property", "rera", "land acquisition", "tenancy"],
    "family & matrimonial": ["family & matrimonial", "matrimonial", "divorce", "family law", "custody", "maintenance"],
    "criminal / police matters": ["criminal defense", "criminal / police matters", "criminal law", "bail", "fir", "trials & disputes"],
    "labour & employment": ["labour & employment", "employment law", "industrial disputes", "service matters"],
    "corporate & commercial": ["corporate & commercial", "corporate & m&a", "nclt", "commercial", "arbitration"],
    "constitutional & writs": ["constitutional & writs", "constitutional law", "writs", "high court", "supreme court"],
    "cyber crime & online fraud": ["cyber crime & online fraud", "cyber law", "it act", "criminal defense"],
}

# Language normalization (code -> English name / synonym)
LANGUAGE_NORMALIZATION: Dict[str, List[str]] = {
    "en": ["english", "en"],
    "english": ["english", "en"],
    "hi": ["hindi", "hi"],
    "hindi": ["hindi", "hi"],
    "mr": ["marathi", "mr"],
    "marathi": ["marathi", "mr"],
    "ta": ["tamil", "ta"],
    "tamil": ["tamil", "ta"],
    "te": ["telugu", "te"],
    "telugu": ["telugu", "te"],
    "kn": ["kannada", "kn"],
    "kannada": ["kannada", "kn"],
    "gu": ["gujarati", "gu"],
    "gujarati": ["gujarati", "gu"],
    "bn": ["bengali", "bn", "bangla"],
    "bengali": ["bengali", "bn", "bangla"],
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate geodesic distance between two coordinate pairs in kilometers using Haversine."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def parse_coordinates(location: Optional[Any]) -> Tuple[Optional[float], Optional[float]]:
    """Extract latitude and longitude from location (string, PostGIS geography, or tuple)."""
    if not location:
        return None, None
    if isinstance(location, str):
        match = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", location, re.IGNORECASE)
        if match:
            return float(match.group(2)), float(match.group(1))  # lat, lon
    try:
        from geoalchemy2.shape import to_shape
        shape = to_shape(location)
        return float(shape.y), float(shape.x)
    except Exception:
        pass
    return None, None


class AdvocateMatchingEngine:
    """Configurable multi-factor advocate matching engine."""

    def __init__(
        self,
        weight_practice: Optional[float] = None,
        weight_jurisdiction: Optional[float] = None,
        weight_language: Optional[float] = None,
        weight_proximity: Optional[float] = None,
        weight_availability: Optional[float] = None,
    ):
        self.w_practice = settings.MATCHING_WEIGHT_PRACTICE if weight_practice is None else weight_practice
        self.w_jurisdiction = settings.MATCHING_WEIGHT_JURISDICTION if weight_jurisdiction is None else weight_jurisdiction
        self.w_language = settings.MATCHING_WEIGHT_LANGUAGE if weight_language is None else weight_language
        self.w_proximity = settings.MATCHING_WEIGHT_PROXIMITY if weight_proximity is None else weight_proximity
        self.w_availability = settings.MATCHING_WEIGHT_AVAILABILITY if weight_availability is None else weight_availability

        # Ensure weights normalize to 1.0
        total_w = self.w_practice + self.w_jurisdiction + self.w_language + self.w_proximity + self.w_availability
        if abs(total_w - 1.0) > 0.001 and total_w > 0:
            self.w_practice /= total_w
            self.w_jurisdiction /= total_w
            self.w_language /= total_w
            self.w_proximity /= total_w
            self.w_availability /= total_w

    def resolve_case_coordinates(self, case: LegalCase) -> Tuple[Optional[float], Optional[float]]:
        """Determine reference coordinates from case district or state."""
        dist = (case.district or "").lower().strip()
        state = (case.state or "").lower().strip()

        if dist in INDIAN_JURISDICTION_COORDINATES:
            return INDIAN_JURISDICTION_COORDINATES[dist]
        if state in INDIAN_JURISDICTION_COORDINATES:
            return INDIAN_JURISDICTION_COORDINATES[state]
        return None, None

    def evaluate_candidate(
        self,
        case: LegalCase,
        advocate: AdvocateProfile,
        advocate_user: User,
        client_coords: Tuple[Optional[float], Optional[float]],
        max_budget_inr: Optional[float] = None,
        max_distance_km: Optional[float] = None,
        preferred_language: Optional[str] = None,
    ) -> Optional[AdvocateMatchItem]:
        """Evaluate a single verified advocate candidate against case requirements.
        
        Returns AdvocateMatchItem if candidate passes hard filters, otherwise None.
        """
        # ── HARD FILTER 1: Verification Status ──
        if advocate.platform_verification_status != "VERIFIED":
            return None

        # ── HARD FILTER 2: Practice Area Relevance ──
        case_category = (case.legal_issue_category or case.practice_group or "").strip()
        practice_score, relevant_practices = self._score_practice_relevance(case_category, advocate)
        if practice_score == 0.0:
            return None

        # ── HARD FILTER 3: Court & Jurisdiction Compatibility ──
        jurisdiction_score, relevant_courts = self._score_jurisdiction(case, advocate)
        if jurisdiction_score == 0.0:
            return None

        # ── HARD FILTER 4: Consultation Budget Filter (Optional User Constraint) ──
        if max_budget_inr is not None:
            # Check fixed consultation fee or hourly rate
            adv_fee = advocate.fixed_consultation_fee_inr or advocate.hourly_rate_inr
            if adv_fee is not None and float(adv_fee) > max_budget_inr:
                return None

        # ── Matching Factor: Language Compatibility ──
        target_lang = preferred_language or case.preferred_language or "en"
        language_score, matched_languages = self._score_language(target_lang, advocate)

        # ── Matching Factor: Geographic Proximity ──
        adv_lat, adv_lon = parse_coordinates(advocate.location)
        approx_distance_km: Optional[float] = None
        proximity_score = 0.5  # Neutral default

        client_lat, client_lon = client_coords
        if client_lat is not None and client_lon is not None and adv_lat is not None and adv_lon is not None:
            approx_distance_km = haversine_distance_km(client_lat, client_lon, adv_lat, adv_lon)
            if max_distance_km is not None and approx_distance_km > max_distance_km:
                return None  # Distance threshold filter

            # Distance scoring curve
            if approx_distance_km <= 10:
                proximity_score = 1.0
            elif approx_distance_km <= 25:
                proximity_score = 0.85
            elif approx_distance_km <= 50:
                proximity_score = 0.70
            elif approx_distance_km <= 100:
                proximity_score = 0.50
            else:
                proximity_score = 0.25
        else:
            # Fallback based on district / state name match
            if advocate.district and case.district and advocate.district.lower() == case.district.lower():
                proximity_score = 0.90
            elif advocate.state and case.state and advocate.state.lower() == case.state.lower():
                proximity_score = 0.75

        # ── Matching Factor: Availability ──
        # Advocate profile active on platform
        availability_score = 1.0 if advocate_user.is_active else 0.0
        if availability_score == 0.0:
            return None

        # ── Composite Compatibility Score Calculation ──
        composite_score = (
            (self.w_practice * practice_score)
            + (self.w_jurisdiction * jurisdiction_score)
            + (self.w_language * language_score)
            + (self.w_proximity * proximity_score)
            + (self.w_availability * availability_score)
        )
        match_score_pct = round(composite_score * 100.0, 1)

        # ── Factual Match Explanation Generation ──
        explanation = self._build_match_explanation(
            advocate=advocate,
            advocate_user=advocate_user,
            case=case,
            relevant_practices=relevant_practices,
            relevant_courts=relevant_courts,
            matched_languages=matched_languages,
            approx_distance_km=approx_distance_km,
        )

        return AdvocateMatchItem(
            advocate_id=advocate.id,
            user_id=advocate.user_id,
            full_name=advocate_user.full_name,
            bar_council_id=advocate.bar_council_id,
            bar_council_name=advocate.bar_council_name,
            verified_status="VERIFIED",
            years_of_experience=advocate.in_practice_years,
            primary_practice=advocate.primary_practice,
            relevant_practice_areas=relevant_practices,
            court_compatibility=relevant_courts,
            language_compatibility=matched_languages,
            city=advocate.city,
            district=advocate.district,
            state=advocate.state,
            approximate_distance_km=approx_distance_km,
            match_score_percentage=match_score_pct,
            match_factors={
                "practice_relevance": round(practice_score, 2),
                "jurisdiction_compatibility": round(jurisdiction_score, 2),
                "language_compatibility": round(language_score, 2),
                "geographic_proximity": round(proximity_score, 2),
                "availability": round(availability_score, 2),
            },
            match_explanation=explanation,
            consultation_request_availability=True,
            fixed_consultation_fee_inr=float(advocate.fixed_consultation_fee_inr) if advocate.fixed_consultation_fee_inr else None,
            hourly_rate_inr=float(advocate.hourly_rate_inr) if advocate.hourly_rate_inr else None,
        )

    def _score_practice_relevance(
        self,
        case_category: str,
        advocate: AdvocateProfile,
    ) -> Tuple[float, List[str]]:
        cat_lower = case_category.lower().strip()
        adv_primary = (advocate.primary_practice or "").lower().strip()
        adv_secondaries = [p.lower().strip() for p in (advocate.secondary_practices or [])]

        relevant: List[str] = []

        # Find synonym group for case category
        synonyms = [cat_lower]
        for key, syns in PRACTICE_SYNONYMS.items():
            if key in cat_lower or any(s in cat_lower for s in syns):
                synonyms = syns
                break

        # Check primary practice match
        if adv_primary in synonyms or any(s in adv_primary for s in synonyms):
            relevant.append(advocate.primary_practice)
            for s in (advocate.secondary_practices or []):
                if s.lower() in synonyms:
                    relevant.append(s)
            return 1.0, relevant

        # Check secondary practice match
        matched_secondaries = [
            s for s in (advocate.secondary_practices or [])
            if s.lower() in synonyms or any(syn in s.lower() for syn in synonyms)
        ]
        if matched_secondaries:
            relevant.extend(matched_secondaries)
            return 0.85, relevant

        # Check general dispute / litigation fallback
        if "trials & disputes" in adv_primary or any("trials & disputes" in s for s in adv_secondaries):
            relevant.append("Trials & Disputes")
            return 0.65, relevant

        return 0.0, []

    def _score_jurisdiction(
        self,
        case: LegalCase,
        advocate: AdvocateProfile,
    ) -> Tuple[float, List[str]]:
        case_state = (case.state or "").lower().strip()
        case_dist = (case.district or "").lower().strip()
        case_court = (case.relevant_court or case.court_forum or "").lower().strip()

        adv_state = (advocate.state or "").lower().strip()
        adv_dist = (advocate.district or "").lower().strip()
        adv_courts = [c.lower().strip() for c in (advocate.courts_of_practice or [])]

        matched_courts: List[str] = []

        # 1. Direct court match
        for court in (advocate.courts_of_practice or []):
            if case_court and (case_court in court.lower() or court.lower() in case_court):
                matched_courts.append(court)

        if matched_courts:
            return 1.0, matched_courts

        # 2. Same district and state
        if adv_dist and case_dist and adv_dist == case_dist and adv_state == case_state:
            # List courts practiced in district
            matched_courts = [c for c in (advocate.courts_of_practice or []) if case_dist in c.lower()]
            if not matched_courts and advocate.courts_of_practice:
                matched_courts = advocate.courts_of_practice[:2]
            return 0.90, matched_courts

        # 3. Same state
        if adv_state and case_state and adv_state == case_state:
            matched_courts = [c for c in (advocate.courts_of_practice or []) if adv_state in c.lower() or "high court" in c.lower()]
            if not matched_courts and advocate.courts_of_practice:
                matched_courts = advocate.courts_of_practice[:2]
            return 0.75, matched_courts

        # 4. Supreme Court or Pan-India tribunals
        national_courts = [
            c for c in (advocate.courts_of_practice or [])
            if any(term in c.lower() for term in ["supreme court", "nclat", "nclt", "delhi high court", "aptel", "tdsat"])
        ]
        if national_courts:
            return 0.70, national_courts

        return 0.0, []

    def _score_language(
        self,
        target_language: str,
        advocate: AdvocateProfile,
    ) -> Tuple[float, List[str]]:
        t_lang = target_language.lower().strip()
        adv_langs = [l.lower().strip() for l in (advocate.languages or [])]

        synonyms = LANGUAGE_NORMALIZATION.get(t_lang, [t_lang])

        matched: List[str] = []
        for l in (advocate.languages or []):
            if l.lower().strip() in synonyms:
                matched.append(l)

        if matched:
            return 1.0, matched

        # If English or Hindi is mutually supported
        shared_common = [l for l in (advocate.languages or []) if l.lower() in ["english", "hindi"]]
        if shared_common:
            return 0.60, shared_common

        return 0.20, (advocate.languages or ["English"])

    def _build_match_explanation(
        self,
        advocate: AdvocateProfile,
        advocate_user: User,
        case: LegalCase,
        relevant_practices: List[str],
        relevant_courts: List[str],
        matched_languages: List[str],
        approx_distance_km: Optional[float],
    ) -> str:
        parts: List[str] = []

        # Verification & Experience Statement
        parts.append(
            f"Verified advocate enrolled with {advocate.bar_council_name} ({advocate.bar_council_id}) "
            f"with {advocate.in_practice_years} years of professional standing."
        )

        # Practice alignment
        if relevant_practices:
            parts.append(f"Practices in {', '.join(relevant_practices)}, matching your matter category.")

        # Court & Location alignment
        loc_desc = f"{advocate.city}"
        if advocate.district and advocate.district != advocate.city:
            loc_desc += f", {advocate.district}"
        loc_desc += f", {advocate.state}"

        if relevant_courts:
            parts.append(f"Regularly appears before {', '.join(relevant_courts)} within {loc_desc}.")
        else:
            parts.append(f"Based in {loc_desc}.")

        # Distance
        if approx_distance_km is not None:
            parts.append(f"Approximate distance to your location: ~{approx_distance_km:.1f} km.")

        # Language
        if matched_languages:
            parts.append(f"Supports consultation in {', '.join(matched_languages)}.")

        return " ".join(parts)


# Default singleton instance
_matching_engine_instance: Optional[AdvocateMatchingEngine] = None


def get_matching_engine() -> AdvocateMatchingEngine:
    global _matching_engine_instance
    if _matching_engine_instance is None:
        _matching_engine_instance = AdvocateMatchingEngine()
    return _matching_engine_instance
