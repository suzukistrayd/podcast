# AGENT ANNA 01 (AA01) // SELF-LEARNING LESSON LOG

## LESSON ENTRY [ID: 2026-11-06-01]
- **Trigger Event:** User greeted the agent ("Hello, how are you?").
- **Agent Error:** Agent injected unrequested live crypto telemetry (SOL, BTC, ETH, DOGE) into a general greeting response.
- **Learned Rule:** **CONDITIONAL TELEMETRY GATE.** Telemetry and market data must *never* be injected or spoken automatically on generic greetings or non-telemetry prompts. Data fetches and readouts must *only* execute under two strict conditions:
  1. The user explicitly requests market data or system status via voice/text query (e.g., "query market", "status report").
  2. The user clicks the dedicated **[FETCH TELEMETRY]** UI trigger button.
- **Action Required:** Keep telemetry variables in the background cache until explicitly called by intent or button action.