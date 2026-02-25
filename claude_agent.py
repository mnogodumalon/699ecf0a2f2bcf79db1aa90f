"""
Claude Agent for Preview Mode - Makes changes but does NOT auto-deploy.
The user will review changes in live preview before deploying manually.
"""
import asyncio
import json
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, ToolUseBlock, TextBlock, ResultMessage, create_sdk_mcp_server, tool
import subprocess
import os


async def main():
    # In preview mode, we provide a dummy deploy tool that just informs the user
    @tool("deploy_to_github",
          "In Preview-Mode nicht verfügbar. Der User wird nach der Live-Preview manuell deployen.",
          {})
    async def deploy_to_github_disabled(args):
        """Disabled in preview mode - inform the agent"""
        return {
            "content": [{
                "type": "text", 
                "text": "⚠️ PREVIEW MODE: Deploy ist deaktiviert. Der User wird die Änderungen erst in der Live-Preview testen und dann manuell deployen. Deine Änderungen sind gespeichert."
            }]
        }

    deployment_server = create_sdk_mcp_server(
        name="deployment",
        version="1.0.0",
        tools=[deploy_to_github_disabled]
    )

    # Options - LIVE PREVIEW MODE: Accept edits automatically for instant writes!
    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": (
                "MANDATORY RULES (highest priority):\n"
                "- No design_brief.md — analyze data in 1-2 sentences, then implement directly\n"
                "- DashboardOverview.tsx: Call Read('src/pages/DashboardOverview.tsx') FIRST, then Write ONCE with complete content. Never read back after writing.\n"
                "- NEVER use Bash for file operations (no cat, echo, heredoc, >, >>). ALWAYS use Read/Write/Edit tools. If a tool fails, retry with the SAME tool — never fall back to Bash.\n"
                "- index.css: NEVER touch — pre-generated design system (font, colors, sidebar). Use existing tokens.\n"
                "- Layout.tsx: NEVER Write, only Edit (only change APP_TITLE/APP_SUBTITLE)\n"
                "- CRUD pages/dialogs: NEVER touch — complete with all logic\n"
                "- App.tsx, PageShell.tsx, StatCard.tsx, ConfirmDialog.tsx: NEVER touch\n"
                "- No Read-back after Write/Edit\n"
                "- No Read of files whose contents are in .scaffold_context\n"
                "- Read .scaffold_context FIRST to understand all generated files\n"
                "- useDashboardData.ts, enriched.ts, enrich.ts, formatters.ts, ai.ts, chat-context.ts, ChatWidget.tsx: NEVER touch — use as-is\n"
                "- src/config/ai-features.ts: MAY edit — set AI_PHOTO_SCAN['Entity'] = true to enable photo scan in dialogs\n"
                "- Dashboard is the PRIMARY WORKSPACE — build interactive domain-specific UI, not an info page\n"
                "- ALWAYS reuse pre-generated {Entity}Dialog from '@/components/dialogs/{Entity}Dialog' for create/edit forms in the dashboard — never build custom forms\n"
                "- NEVER use TodoWrite — no task lists, no planning, just implement directly"
            ),
        },
        setting_sources=["project"],
        mcp_servers={"deploy_tools": deployment_server},
        permission_mode="bypassPermissions",  # Bypass all checks - instant writes for live preview!
        allowed_tools=["Bash", "Write", "Read", "Edit", "Glob", "Grep", "Task"],
        cwd="/home/user/app",
        model="claude-sonnet-4-6"#"claude-opus-4-6",
    )

    # Session-Resume support
    resume_session_id = os.getenv('RESUME_SESSION_ID')
    if resume_session_id:
        options.resume = resume_session_id
        print(f"[LILO-PREVIEW] Resuming session: {resume_session_id}")

    # User Prompt - prefer file over env var (handles special chars better)
    user_prompt = None
    
    # First try reading from file (more reliable for special chars)
    prompt_file = "/home/user/app/.user_prompt"
    if os.path.exists(prompt_file):
        try:
            with open(prompt_file, 'r') as f:
                user_prompt = f.read().strip()
            if user_prompt:
                print(f"[LILO-PREVIEW] Prompt aus Datei gelesen: {len(user_prompt)} Zeichen")
        except Exception as e:
            print(f"[LILO-PREVIEW] Fehler beim Lesen der Prompt-Datei: {e}")
    
    # Fallback to env var
    if not user_prompt:
        user_prompt = os.getenv('USER_PROMPT')
        if user_prompt:
            print(f"[LILO-PREVIEW] Prompt aus ENV gelesen")
    
    if user_prompt:
        # Preview mode prompt - no deploy, incremental edits for live HMR!
        query = f"""🔴 LIVE PREVIEW MODE - Der User sieht deine Änderungen in Echtzeit!

User-Anfrage: "{user_prompt}"

⚡ WICHTIG: Der Vite Dev-Server läuft BEREITS! Der User sieht jede Dateiänderung SOFORT im Browser!

SCHRITTE (arbeite INKREMENTELL für Live-Updates):

1. LESEN: Lies src/pages/Dashboard.tsx um die aktuelle Struktur zu verstehen

2. ÄNDERN (SCHRITT FÜR SCHRITT!):
   - Mache EINE Änderung (z.B. Farbe ändern)
   - Die Datei wird sofort geschrieben → User sieht es LIVE! ⚡
   - Mache die NÄCHSTE Änderung
   - Wieder sofort sichtbar!
   
3. TESTEN: Am Ende 'npm run build' um sicherzustellen dass es kompiliert

⚠️ KRITISCH für Live-Preview:
- Arbeite SCHRITT FÜR SCHRITT, nicht alles auf einmal!
- Jede Dateiänderung = Live-Update im Browser!
- Rufe NICHT deploy_to_github auf!
- Der User testet die Änderungen in der Live-Preview

Das Dashboard existiert bereits. Mache NUR die angeforderten Änderungen.
Starte JETZT!"""
        print(f"[LILO-PREVIEW] User-Prompt: {user_prompt}")
    else:
        # Initial build in preview mode
        query = """🔍 PREVIEW MODE - Neues Dashboard ohne Auto-Deploy

Read .scaffold_context and app_metadata.json.
Analyze data, decide UI paradigm in 1-2 sentences, then implement directly.
Follow .claude/skills/frontend-impl/SKILL.md.
Use existing types and services from src/types/ and src/services/.

⚠️ WICHTIG:
- Rufe NICHT deploy_to_github auf!
- Der User wird das Dashboard erst in der Live-Preview testen
- Wenn 'npm run build' erfolgreich ist, bist du fertig"""
        print(f"[LILO-PREVIEW] Build-Mode: Neues Dashboard erstellen (Preview)")

    import time
    t_agent_total_start = time.time()
    print(f"[LILO-PREVIEW] Initialisiere Client")

    # Client lifecycle
    async with ClaudeSDKClient(options=options) as client:
        await client.query(query)

        t_last_step = t_agent_total_start
        
        async for message in client.receive_response():
            now = time.time()
            elapsed = round(now - t_agent_total_start, 1)
            dt = round(now - t_last_step, 1)
            t_last_step = now
            
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(json.dumps({"type": "think", "content": block.text, "t": elapsed, "dt": dt}), flush=True)
                    
                    elif isinstance(block, ToolUseBlock):
                        if block.name in ["Write", "Edit"]:
                            file_path = block.input.get('file_path', block.input.get('path', 'unknown'))
                            print(f"[LIVE] 📝 {block.name}: {file_path}", flush=True)
                        
                        print(json.dumps({"type": "tool", "tool": block.name, "input": str(block.input), "t": elapsed, "dt": dt}), flush=True)

            elif isinstance(message, ResultMessage):
                status = "success" if not message.is_error else "error"
                print(f"[LILO-PREVIEW] Session ID: {message.session_id}")
                
                if message.session_id:
                    try:
                        with open("/home/user/app/.claude_session_id", "w") as f:
                            f.write(message.session_id)
                        print(f"[LILO-PREVIEW] ✅ Session ID gespeichert")
                    except Exception as e:
                        print(f"[LILO-PREVIEW] ⚠️ Fehler: {e}")
                
                t_agent_total = time.time() - t_agent_total_start
                print(json.dumps({
                    "type": "result", 
                    "status": status, 
                    "cost": message.total_cost_usd,
                    "session_id": message.session_id,
                    "duration_s": round(t_agent_total, 1)
                }), flush=True)
                
                print(f"[LILO-PREVIEW] ✅ Änderungen abgeschlossen ({t_agent_total:.1f}s)")


if __name__ == "__main__":
    asyncio.run(main())


