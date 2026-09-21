code
Markdown
# Engineering Specification: LLM-as-a-Verifier Plugin for OpenCode

## 1. Project Overview & Objective
You are acting as a Senior Systems Engineer building a production-ready OpenCode Server Plugin: `@opencode/plugin-verifier`.

The plugin implements the **"LLM-as-a-Verifier" (Test-time Scaling / Best-of-N Self-Verification)** pattern. It enhances code generation reliability through a hybrid verification architecture:
1. **L1 Deterministic Verification**: Executes real-world terminal checks (Linter, Unit Tests, Type checks) via shell execution.
2. **Parallel Candidate Generation**: Concurrently samples $N$ distinct solution candidates using a temperature ladder.
3. **L2 Semantic Evaluation & Ranking**: Utilizes LLM pairwise/tournament-style comparative reasoning to select the best candidate.

---

## 2. File & Directory Layout

You must scaffold and implement the following structure inside the current project root:

```text
.
├── package.json
├── tsconfig.json
├── src/
│   ├── types.ts          # Zod schemas, data interfaces, and configuration types
│   ├── l1-executor.ts    # L1 deterministic terminal runner (exit-code & stdio analysis)
│   ├── generator.ts      # Concurrent candidate generator with temperature variance
│   ├── l2-verifier.ts    # L2 comparative judge with structured JSON ranking output
│   └── index.ts          # Plugin entrypoint: custom tool registration, hook & anti-recursion lock
└── tests/
    ├── l1-executor.test.ts
    ├── generator.test.ts
    ├── l2-verifier.test.ts
    └── plugin.test.ts
3. Module Specifications & Interface Contracts
3.1 src/types.ts
Define VerifierConfigSchema using zod with the following configurable options:
numCandidates: integer, range [2, 5], default 3.
temperatures: array of numbers, default [0.2, 0.7, 1.0].
defaultL1Command: optional string (e.g., "bun test", "tsc --noEmit").
autoTriggerOnIdle: boolean, default false.
Define TypeScript interfaces:
CandidateSolution: { index: number; temperature: number; code: string; rawResponse?: string }
L1CheckResult: { passed: boolean; command: string; stdout: string; stderr: string; exitCode: number }
L2RankResult: { bestIndex: number; ranking: number[]; reasons: Record<number, string>; critique: string }
3.2 src/l1-executor.ts (L1 Deterministic Verification)
Role: Execute shell commands safely using the plugin context (ctx.$ or Bun.spawn).
Behavior:
Accept a custom command string and project workspace path.
Return clean L1CheckResult containing stdout, stderr, and passed status (exitCode === 0).
Gracefully catch process spawn failures without throwing unhandled exceptions.
3.3 src/generator.ts (Parallel Candidate Sampling)
Role: Concurrently generate 
N
N
 diverse code variations.
Behavior:
Must use Promise.all to launch concurrent generation requests rather than serial loops.
For each generation request, pass distinct temperature values from the config.
Implement a robust code extractor: Strip outer Markdown code blocks (ts ...) while preserving inner code indentation and formatting.
Gracefully handle partial failures (if 1 of 
N
N
 fails, fallback to the base code or keep surviving candidates).
3.4 src/l2-verifier.ts (Comparative Ranking Judge)
Role: Evaluate and rank the candidates.
Prompting Strategy:
Use Comparative / Tournament Ranking rather than independent absolute scores (to avoid score inflation).
Include L1 feedback in the prompt (e.g., whether unit tests passed or failed, including error stacks).
Define evaluation criteria: (1) Correctness & Edge-cases, (2) Time/Space Efficiency, (3) Readability & Type Safety.
Enforce JSON response format:
code
JSON
{
  "bestIndex": 1,
  "ranking": [1, 2, 3],
  "reasons": { "1": "Handles edge cases cleanly", "2": "Missing null check" },
  "critique": "Candidate 1 is structurally superior."
}
Implement resilient JSON parsing with regex extraction (/\{[\s\S]*\}/) to handle LLMs wrapping JSON in backticks. Provide safe fallback if parsing fails.
3.5 src/index.ts (Plugin Entry & Safety Controls)
Role: Integrate into OpenCode plugin lifecycle.
Invariants & Constraints:
Anti-Recursion State Lock: Maintain an in-memory Set<string> of active sessionIDs. Any tool invocation occurring within an active verification session must be rejected or bypassed to prevent infinite recursion.
Register Custom Tool verify_and_optimize:
Input Parameters:
task (string): Description of the feature or bug to solve.
code (string): Current implementation or baseline snippet.
testCommand (optional string): Command to run for L1 validation.
Execution Flow:
Acquire Lock 
→
→
 Run L1 Check 
→
→
 Generate N Candidates in Parallel 
→
→
 Run L2 Judge Ranking 
→
→
 Release Lock (in finally block) 
→
→
 Return Structured Result.
4. Engineering Constraints & Quality Invariants
No Infinite Loops: Never trigger recursive edits inside the tool or hook execution without lock guards.
Zero Flow Interruption: Do not inject blocking edits into standard single-step tool execution. Keep verification on-demand via the tool.
Async Concurrency: Generator sampling must run in parallel via Promise.all.
Resilient Type Safety: All inputs and outputs must pass strict TypeScript compilation (tsc --noEmit) without any abuse.
5. Step-by-Step Autonomous Execution Workflow
You must execute the following phases autonomously:
Phase 1: Environment & Project Setup
Initialize package.json with dependencies: @opencode-ai/plugin, zod, typescript, @types/bun.
Configure tsconfig.json with strict mode and bundler resolution.
Install packages via bun install.
Phase 2: Implementation
Write all source modules under src/ following the specifications above.
Ensure error handling and JSON cleaning logic are thoroughly covered.
Phase 3: Comprehensive Unit Testing
Write unit tests under tests/ covering:
L1 executor process handling (mocked success / failure).
Candidate generator Markdown code block extraction.
L2 verifier JSON response parsing and malformed string recovery.
Lock state behavior in plugin entrypoint.
Run bun test and ensure 100% tests pass. If any fail, inspect stderr and autonomously iterate until green.
Phase 4: Build Validation & Delivery
Run bun run build (or tsc --noEmit) to verify zero TypeScript errors.
Provide concise instructions on how to link this plugin in ~/.config/opencode/opencode.json.
6. Definition of Done (Agent Checklist)
Before concluding your task, you must verify and confirm:

bun install completed cleanly.

bun test passes all test suites.

bun run build exits with code 0.

Session Lock mechanism is verified in unit tests.

Clean summary of registered tools and configuration options is provided to the user.