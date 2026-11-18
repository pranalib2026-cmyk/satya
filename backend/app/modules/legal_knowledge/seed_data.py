"""Curated, verified statutory Indian legal sources for NyayaSetu RAG."""

from datetime import date
from typing import Any, Dict, List

CURATED_LEGAL_SOURCES: List[Dict[str, Any]] = [
    {
        "title": "The Negotiable Instruments Act, 1881",
        "source_type": "BARE_ACT",
        "short_code": "NI_ACT",
        "citation": "Act No. 26 of 1881",
        "act_or_judgment_identifier": "Act No. 26 of 1881",
        "jurisdiction": "Union of India",
        "court": None,
        "publication_date": date(1881, 12, 9),
        "last_verified_date": date(2026, 1, 1),
        "document_version": "2026.1",
        "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2189",
        "year": 1881,
        "chunks": [
            {
                "section_number": "Section 138",
                "clause_heading": "Dishonour of cheque for insufficiency, etc., of funds in the account",
                "chunk_text": (
                    "Where any cheque drawn by a person on an account maintained by him with a banker for payment "
                    "of any amount of money to another person from out of that account for the discharge, in whole or "
                    "in part, of any debt or other liability, is returned by the bank unpaid, either because of the "
                    "amount of money standing to the credit of that account is insufficient to honour the cheque or "
                    "that it exceeds the amount arranged to be paid from that account by an agreement made with that "
                    "bank, such person shall be deemed to have committed an offence and shall be punished with "
                    "imprisonment for a term which may be extended to two years, or with fine which may extend to twice "
                    "the amount of the cheque, or with both: Provided that nothing contained in this section shall apply "
                    "unless (a) the cheque has been presented to the bank within a period of three months from the date "
                    "on which it is drawn; (b) the payee or holder in due course makes a demand for the payment of the said "
                    "amount of money by giving a notice in writing to the drawer within thirty days of the receipt of information "
                    "from the bank regarding the return of the cheque as unpaid; and (c) the drawer of such cheque fails to "
                    "make the payment of the said amount of money to the payee or holder in due course within fifteen days of the "
                    "receipt of the said notice."
                ),
            },
            {
                "section_number": "Section 139",
                "clause_heading": "Presumption in favour of holder",
                "chunk_text": (
                    "It shall be presumed, unless the contrary is proved, that the holder of a cheque received the cheque of the "
                    "nature referred to in section 138 for the discharge, in whole or in part, of any debt or other liability."
                ),
            },
            {
                "section_number": "Section 141",
                "clause_heading": "Offences by companies",
                "chunk_text": (
                    "If the person committing an offence under section 138 is a company, every person who, at the time the offence "
                    "was committed, was in charge of, and was responsible to the company for the conduct of the business of the "
                    "company, as well as the company, shall be deemed to be guilty of the offence and shall be liable to be proceeded "
                    "against and punished accordingly."
                ),
            },
        ],
    },
    {
        "title": "The Consumer Protection Act, 2019",
        "source_type": "BARE_ACT",
        "short_code": "CPA_2019",
        "citation": "Act No. 35 of 2019",
        "act_or_judgment_identifier": "Act No. 35 of 2019",
        "jurisdiction": "Union of India",
        "court": None,
        "publication_date": date(2019, 8, 9),
        "last_verified_date": date(2026, 1, 1),
        "document_version": "2026.1",
        "official_source_url": "https://www.indiacode.nic.in/handle/123456789/15256",
        "year": 2019,
        "chunks": [
            {
                "section_number": "Section 2(7)",
                "clause_heading": "Definition of Consumer",
                "chunk_text": (
                    "Consumer means any person who buys any goods for a consideration which has been paid or promised or partly "
                    "paid and partly promised, or under any system of deferred payment and includes any user of such goods other "
                    "than the person who buys such goods for consideration, but does not include a person who obtains such goods "
                    "for resale or for any commercial purpose; or hires or avails of any service for a consideration."
                ),
            },
            {
                "section_number": "Section 35",
                "clause_heading": "Manner in which complaint shall be made",
                "chunk_text": (
                    "A complaint, in relation to any goods sold or delivered or agreed to be sold or delivered or any service "
                    "provided or agreed to be provided, may be filed with a District Commission by the consumer, recognized consumer "
                    "association, or Central Authority. A complaint may also be filed electronically through e-Daakhil in the District "
                    "Commission within the local limits of whose jurisdiction the complainant resides or personally works for gain, or "
                    "where the opposite party resides or carries on business."
                ),
            },
            {
                "section_number": "Section 47",
                "clause_heading": "Jurisdiction of State Commission",
                "chunk_text": (
                    "The State Commission shall have jurisdiction to entertain complaints where the value of the goods or services "
                    "paid as consideration exceeds rupees fifty lakhs but does not exceed rupees two crores, and appeals against "
                    "orders of any District Commission within the State."
                ),
            },
        ],
    },
    {
        "title": "The Legal Services Authorities Act, 1987",
        "source_type": "LEGAL_AID_SCHEME",
        "short_code": "NALSA_1987",
        "citation": "Act No. 39 of 1987",
        "act_or_judgment_identifier": "Act No. 39 of 1987",
        "jurisdiction": "Union of India",
        "court": None,
        "publication_date": date(1987, 10, 11),
        "last_verified_date": date(2026, 1, 1),
        "document_version": "2026.1",
        "official_source_url": "https://nalsa.gov.in/acts-rules",
        "year": 1987,
        "chunks": [
            {
                "section_number": "Section 12",
                "clause_heading": "Criteria for giving legal services (Free Legal Aid Entitlement)",
                "chunk_text": (
                    "Every person who has to file or defend a case shall be entitled to legal services under this Act if that person "
                    "is (a) a member of a Scheduled Caste or Scheduled Tribe; (b) a victim of trafficking in human beings or begar; "
                    "(c) a woman or a child; (d) a person with disability; (e) a person under circumstances of underserved want such "
                    "as being a victim of a mass disaster, ethnic violence, caste atrocity, flood, drought, earthquake or industrial "
                    "disaster; (f) an industrial workman; (g) in custody, including custody in a protective home or psychiatric hospital; "
                    "or (h) in receipt of annual income less than the amount prescribed by the State Government or Central Government."
                ),
            },
            {
                "section_number": "Section 19",
                "clause_heading": "Organization of Lok Adalats",
                "chunk_text": (
                    "Every State Authority or District Authority or Supreme Court Legal Services Committee or High Court Legal Services "
                    "Committee or Taluk Legal Services Committee may organize Lok Adalats at such intervals and places and for "
                    "exercising such jurisdiction and for such areas as it thinks fit. A Lok Adalat shall have jurisdiction to determine "
                    "and to arrive at a compromise or settlement between the parties to a dispute in respect of any case pending "
                    "before any court, or any matter which is falling within the jurisdiction of, and is not brought before, any court "
                    "for which the Lok Adalat is organized."
                ),
            },
        ],
    },
    {
        "title": "The Real Estate (Regulation and Development) Act, 2016",
        "source_type": "BARE_ACT",
        "short_code": "RERA_2016",
        "citation": "Act No. 16 of 2016",
        "act_or_judgment_identifier": "Act No. 16 of 2016",
        "jurisdiction": "Union of India",
        "court": None,
        "publication_date": date(2016, 3, 26),
        "last_verified_date": date(2026, 1, 1),
        "document_version": "2026.1",
        "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2158",
        "year": 2016,
        "chunks": [
            {
                "section_number": "Section 18",
                "clause_heading": "Return of amount and compensation for delay in possession",
                "chunk_text": (
                    "If the promoter fails to complete or is unable to give possession of an apartment, plot or building in "
                    "accordance with the terms of the agreement for sale or duly completed by the date specified therein, the promoter "
                    "shall be liable on demand to the allottees, in case the allottee wishes to withdraw from the project, to return "
                    "the amount received by him in respect of that apartment, plot, building, with interest at such rate as may be "
                    "prescribed in this behalf including compensation. If the allottee does not intend to withdraw from the project, he "
                    "shall be paid, by the promoter, interest for every month of delay, till the handing over of the possession."
                ),
            },
        ],
    },
    {
        "title": "The Bharatiya Nagarik Suraksha Sanhita, 2023",
        "source_type": "BARE_ACT",
        "short_code": "BNSS_2023",
        "citation": "Act No. 46 of 2023",
        "act_or_judgment_identifier": "Act No. 46 of 2023",
        "jurisdiction": "Union of India",
        "court": None,
        "publication_date": date(2023, 12, 25),
        "last_verified_date": date(2026, 1, 1),
        "document_version": "2026.1",
        "official_source_url": "https://www.mha.gov.in/en/acts",
        "year": 2023,
        "chunks": [
            {
                "section_number": "Section 479",
                "clause_heading": "Maximum period for which an undertrial prisoner can be detained",
                "chunk_text": (
                    "Where a person has, during the period of investigation, inquiry or trial under this Sanhita of an offence "
                    "under any law, undergone detention for a period extending up to one-half of the maximum period of imprisonment "
                    "specified for that offence under that law, he shall be released by the Court on bail: Provided that where such person "
                    "is a first-time offender who has never been convicted of any offence in the past, he shall be released on bail by "
                    "the Court if he has undergone detention for the period extending up to one-third of the maximum period of "
                    "imprisonment specified for such offence."
                ),
            },
            {
                "section_number": "Section 173",
                "clause_heading": "Information in cognizable cases (First Information Report)",
                "chunk_text": (
                    "Every information relating to the commission of a cognizable offence, if given orally to an officer in charge "
                    "of a police station, shall be reduced to writing by him or under his direction, and be read over to the informant; "
                    "and every such information, whether given in writing or reduced to writing as aforesaid, shall be signed by the person "
                    "giving it, and the substance thereof shall be entered in a book to be kept by such officer. Information may also be "
                    "given electronically and taken on record."
                ),
            },
        ],
    },
]
