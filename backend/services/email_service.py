import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os
import re
from dotenv import load_dotenv

load_dotenv()


class EmailService:
    @staticmethod
    def send_invoice(to_email, pdf_path, order_number):
        """Sends an invoice PDF via email."""
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("SENDER_EMAIL", "test@example.com")
        sender_password = os.getenv("SENDER_PASSWORD", "password")
        
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to_email
        msg['Subject'] = f"Invoice for Order #{order_number}"
        
        body = f"Dear Customer,\n\nPlease find attached the invoice for your order #{order_number}.\n\nThank you for dining with us!"
        msg.attach(MIMEText(body, 'plain'))
        
        with open(pdf_path, "rb") as f:
            part = MIMEApplication(f.read(), Name=os.path.basename(pdf_path))
        
        part['Content-Disposition'] = f'attachment; filename="{os.path.basename(pdf_path)}"'
        msg.attach(part)
        
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()
            
            print(f"Email sent to {to_email} with invoice {pdf_path}")
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False

    @staticmethod
    def send_daily_brief(to_email: str, brief_content: str, date: str, task_outputs: list = None) -> bool:
        """
        Sends the daily AI planning brief as a premium HTML email.
        """
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("SENDER_EMAIL")
        sender_password = os.getenv("SENDER_PASSWORD")
        
        if not sender_email or not sender_password:
            print("⚠️ Email credentials not configured. Skipping send.")
            print(f"--- DAILY BRIEF for {date} ---")
            print(brief_content)
            print("--- END BRIEF ---")
            return False
        
        # Build the premium HTML email
        html_brief = EmailService._markdown_to_html(brief_content)
        agent_sections = EmailService._build_agent_sections(task_outputs) if task_outputs else ""
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SujalPOS Daily Brief</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <!-- Outer wrapper -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0a0a0f;">
        <tr>
            <td align="center" style="padding: 24px 16px;">
                
                <!-- Main card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #111118; border-radius: 20px; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.15); box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
                    
                    <!-- Hero Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #4c1d95 70%, #6d28d9 100%); padding: 40px 32px 35px; text-align: center; border-bottom: 1px solid rgba(139, 92, 246, 0.2);">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <!-- Logo badge -->
                                        <div style="display: inline-block; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 12px 24px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.15);">
                                            <span style="font-size: 28px; vertical-align: middle;">🧠</span>
                                            <span style="color: white; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; vertical-align: middle; margin-left: 8px;">SujalPOS AI Co-Pilot</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-top: 8px;">
                                        <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Daily Planning Brief</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-top: 10px;">
                                        <span style="display: inline-block; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">
                                            📅 {date}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Agent Status Strip -->
                    <tr>
                        <td style="padding: 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(90deg, rgba(245, 158, 11, 0.08), rgba(34, 197, 94, 0.08), rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.08)); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <tr>
                                    <td width="25%" style="text-align: center; padding: 14px 8px; border-right: 1px solid rgba(255,255,255,0.05);">
                                        <span style="font-size: 18px;">📦</span><br>
                                        <span style="color: #f59e0b; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Inventory</span>
                                    </td>
                                    <td width="25%" style="text-align: center; padding: 14px 8px; border-right: 1px solid rgba(255,255,255,0.05);">
                                        <span style="font-size: 18px;">💰</span><br>
                                        <span style="color: #22c55e; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Sales</span>
                                    </td>
                                    <td width="25%" style="text-align: center; padding: 14px 8px; border-right: 1px solid rgba(255,255,255,0.05);">
                                        <span style="font-size: 18px;">🏷️</span><br>
                                        <span style="color: #6366f1; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Pricing</span>
                                    </td>
                                    <td width="25%" style="text-align: center; padding: 14px 8px;">
                                        <span style="font-size: 18px;">🧠</span><br>
                                        <span style="color: #ec4899; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Co-Pilot</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Main Brief Content -->
                    <tr>
                        <td style="padding: 32px 28px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05)); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 16px; padding: 24px;">
                                        <div style="color: #e2e8f0; line-height: 1.75; font-size: 14px;">
                                            {html_brief}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {agent_sections}

                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 0 28px 28px;" align="center">
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 14px 32px;">
                                        <a href="http://localhost:5173/agents" style="color: white; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
                                            📊 View Full Dashboard →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 28px;">
                            <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);"></div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 28px; text-align: center;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <p style="color: #6366f1; font-size: 13px; font-weight: 600; margin: 0 0 6px;">
                                            🤖 Powered by CrewAI Multi-Agent System
                                        </p>
                                        <p style="color: #4b5563; font-size: 11px; margin: 0 0 4px;">
                                            4 AI Agents analyzed your inventory, sales &amp; pricing data
                                        </p>
                                        <p style="color: #374151; font-size: 10px; margin: 8px 0 0; font-style: italic;">
                                            This report is AI-generated. Please review recommendations before implementing changes.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
                <!-- End main card -->

                <!-- Unsubscribe / branding -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px;">
                    <tr>
                        <td align="center" style="padding: 16px;">
                            <p style="color: #374151; font-size: 10px; margin: 0;">
                                SujalPOS • AI-Powered Restaurant Management • Auto-generated at 8:00 AM daily
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>"""
        
        msg = MIMEMultipart("alternative")
        msg['From'] = f"SujalPOS AI <{sender_email}>"
        msg['To'] = to_email
        msg['Subject'] = f"🧠 Daily Planning Brief — {date} | SujalPOS AI Co-Pilot"
        
        # Plain text fallback
        msg.attach(MIMEText(brief_content, 'plain'))
        # HTML version
        msg.attach(MIMEText(html_content, 'html'))
        
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()
            print(f"✅ Daily brief emailed to {to_email}")
            return True
        except Exception as e:
            print(f"❌ Failed to send daily brief: {e}")
            print(f"--- DAILY BRIEF for {date} ---")
            print(brief_content)
            return False

    @staticmethod
    def _build_agent_sections(task_outputs: list) -> str:
        """Build expanded agent detail sections for the email."""
        if not task_outputs:
            return ""
        
        agent_configs = [
            {"emoji": "📦", "name": "Inventory Analysis", "color": "#f59e0b", "bg": "rgba(245, 158, 11, 0.06)", "border": "rgba(245, 158, 11, 0.15)"},
            {"emoji": "💰", "name": "Sales Analysis", "color": "#22c55e", "bg": "rgba(34, 197, 94, 0.06)", "border": "rgba(34, 197, 94, 0.15)"},
            {"emoji": "🏷️", "name": "Pricing Analysis", "color": "#6366f1", "bg": "rgba(99, 102, 241, 0.06)", "border": "rgba(99, 102, 241, 0.15)"},
            {"emoji": "🧠", "name": "AI Co-Pilot Synthesis", "color": "#ec4899", "bg": "rgba(236, 72, 153, 0.06)", "border": "rgba(236, 72, 153, 0.15)"},
        ]
        
        sections_html = ""
        for i, task in enumerate(task_outputs[:4]):
            cfg = agent_configs[i] if i < len(agent_configs) else agent_configs[0]
            output_html = EmailService._markdown_to_html(task.get("output", "No output"))
            sections_html += f"""
                    <tr>
                        <td style="padding: 0 28px 16px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: {cfg['bg']}; border: 1px solid {cfg['border']}; border-radius: 14px; overflow: hidden;">
                                <tr>
                                    <td style="padding: 14px 18px 10px; border-bottom: 1px solid {cfg['border']};">
                                        <span style="font-size: 16px; vertical-align: middle;">{cfg['emoji']}</span>
                                        <span style="color: {cfg['color']}; font-size: 14px; font-weight: 700; vertical-align: middle; margin-left: 6px;">{cfg['name']}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 18px; color: #9ca3af; font-size: 12px; line-height: 1.7;">
                                        {output_html}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>"""
        
        return sections_html
    
    @staticmethod
    def _markdown_to_html(text: str) -> str:
        """Convert markdown-style text to email-safe HTML."""
        # Escape HTML chars
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        
        lines = text.split("\n")
        html_lines = []
        in_list = False
        list_type = "ul"
        
        for line in lines:
            stripped = line.strip()
            
            # Skip empty
            if not stripped:
                if in_list:
                    html_lines.append(f"</{list_type}>")
                    in_list = False
                html_lines.append("<br>")
                continue
            
            # Bold text converter
            def bold_convert(s):
                return re.sub(r'\*\*(.+?)\*\*', r'<strong style="color: #f1f5f9;">\1</strong>', s)
            
            # Section headers with emojis (🎯 📦 💰 🏷️ 📊 ⚠️ 🔮)
            if len(stripped) > 2 and any(stripped.startswith(e) for e in ['🎯', '📦', '💰', '🏷️', '📊', '⚠️', '🔮', '##', '# ']):
                if in_list:
                    html_lines.append(f"</{list_type}>")
                    in_list = False
                clean = stripped.lstrip('#').strip().strip('*').strip()
                # Determine section color based on emoji
                color = "#a78bfa"
                if '🎯' in stripped: color = "#f59e0b"
                elif '📦' in stripped: color = "#fb923c"
                elif '💰' in stripped: color = "#22c55e"
                elif '🏷️' in stripped: color = "#818cf8"
                elif '📊' in stripped: color = "#38bdf8"
                elif '⚠️' in stripped: color = "#ef4444"
                html_lines.append(f'<h3 style="color: {color}; margin: 18px 0 8px; font-size: 15px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">{bold_convert(clean)}</h3>')
                continue
            
            # Bold-only headers like **SECTION:**
            if stripped.startswith("**") and stripped.endswith("**"):
                if in_list:
                    html_lines.append(f"</{list_type}>")
                    in_list = False
                clean = stripped.strip("*").strip()
                html_lines.append(f'<h3 style="color: #a78bfa; margin: 16px 0 8px; font-size: 14px; font-weight: 700;">{clean}</h3>')
                continue
            
            # Numbered list items (1. or 1))
            if len(stripped) > 2 and stripped[0].isdigit() and (stripped[1] in '.)\u0020' or (len(stripped) > 2 and stripped[1].isdigit() and stripped[2] in '.)')):
                if not in_list or list_type != "ol":
                    if in_list:
                        html_lines.append(f"</{list_type}>")
                    html_lines.append('<ol style="padding-left: 20px; margin: 8px 0;">')
                    in_list = True
                    list_type = "ol"
                # Strip the number prefix
                content = re.sub(r'^\d+[\.\)]\s*', '', stripped)
                html_lines.append(f'<li style="margin-bottom: 8px; color: #d1d5db;">{bold_convert(content)}</li>')
                continue
            
            # Bullet list items
            if stripped.startswith("- ") or stripped.startswith("• ") or stripped.startswith("* "):
                if not in_list or list_type != "ul":
                    if in_list:
                        html_lines.append(f"</{list_type}>")
                    html_lines.append('<ul style="padding-left: 20px; margin: 8px 0; list-style-type: disc;">')
                    in_list = True
                    list_type = "ul"
                content = stripped[2:]
                html_lines.append(f'<li style="margin-bottom: 8px; color: #d1d5db;">{bold_convert(content)}</li>')
                continue
            
            # Regular paragraph
            if in_list:
                html_lines.append(f"</{list_type}>")
                in_list = False
            html_lines.append(f'<p style="margin: 6px 0; color: #d1d5db;">{bold_convert(stripped)}</p>')
        
        if in_list:
            html_lines.append(f"</{list_type}>")
        
        return "\n".join(html_lines)
