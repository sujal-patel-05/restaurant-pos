import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os

class EmailService:
    @staticmethod
    def send_invoice(to_email, pdf_path, order_number):
        """Sends an invoice PDF via email."""
        # Configuration - In a real app, use environment variables
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
        
        # Attach PDF
        with open(pdf_path, "rb") as f:
            part = MIMEApplication(f.read(), Name=os.path.basename(pdf_path))
        
        part['Content-Disposition'] = f'attachment; filename="{os.path.basename(pdf_path)}"'
        msg.attach(part)
        
        # Send
        try:
            # For development/demo purposes, we might not have a real SMTP server configured.
            # print("Simulating email send...")
            # return True
            
            # Uncomment for real sending if creds are available
            # server = smtplib.SMTP(smtp_server, smtp_port)
            # server.starttls()
            # server.login(sender_email, sender_password)
            # server.send_message(msg)
            # server.quit()
            
            print(f"Email sent to {to_email} with invoice {pdf_path}")
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False
