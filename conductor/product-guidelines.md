# Product Guidelines: Project K

## Tone and Voice
-   **Expert-Consultant:** The communication should be professional, sports-oriented, and authoritative. It is benevolent but firm, reflecting Karoly's elite coaching status and scientific approach.
-   **Precision:** Avoid fluff. Every message should provide value and be grounded in data.

## Visual Identity & UX
-   **Dual-Layer Presentation:**
    -   **Coach View (Karoly):** A "Scientific Dashboard" style. Clean, data-heavy, prioritizing complex charts, matrices, and raw metrics. Function over form.
    -   **Athlete View (Reports):** A more "Accessible Performance" style. Dilute complex data into readable insights, integrating sports imagery and a more vibrant, engaging layout to maintain motivation and clarity.
-   **Clarity:** Use high-contrast elements for critical metrics (Load, Durability, Decoupling).

## Error Handling & Alerts
-   **Technical Transparency:** Errors, especially regarding data ingestion and parsing, should be explicit and technical (e.g., "Error 500: JSON parsing failed"). This allows for rapid debugging and clear identification of data quality issues by the development/admin team.

## Language and Localization
-   **Primary Language:** **Français.** All interfaces, reports, and alerts are to be delivered in French to align with Karoly's current client base and professional environment.

## Client Communication Style (Karoly Spy)
-   **Tone:** Expert-Consultant but friendly and casual.
-   **Salutation:** Use "Salut Karoly" or "Hello Karoly".
-   **Structure:** Short, direct sentences. Get to the point quickly.
-   **Diction:** Use professional yet accessible technical terms (e.g., "chantier dev", "tuyau d'arrivée").
-   **Vibe:** Positive and reactive. Use dynamic feedback like "Top !", "Nickel", "Pas de soucis".
-   **Visuals:** Use occasional emojis (👌🏻, 🙂, 🚀) to soften the professional tone.

## Naming Conventions & Semantics
-   **Physiological Precision:** Use exact scientific and physiological terms in the code and database schema (e.g., `lt1_hr`, `decoupling_index`, `k_joules`, `normalized_power`).
-   **Zero Ambiguity:** Business logic must mirror the STAPS/Elite coaching vocabulary exactly to ensure there is no translation loss between Karoly's vision and the technical implementation.
