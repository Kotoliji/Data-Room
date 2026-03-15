import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import current_app


def send_reset_email(to_email: str, reset_link: str) -> None:
    smtp_user = current_app.config.get("SMTP_USER", "")
    smtp_password = current_app.config.get("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        current_app.logger.warning(
            "SMTP not configured. Reset link for %s: %s", to_email, reset_link
        )
        return

    subject = "Password Reset \u2014 Acme Corp."

    html = f"""\
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <p style="margin: 30px 0;">
            <a href="{reset_link}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            This link expires in 30 minutes. If you didn't request this, ignore this email.
        </p>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())
        current_app.logger.warning("Reset email sent to %s", to_email)
    except Exception as e:
        current_app.logger.warning("Failed to send reset email to %s: %s", to_email, str(e))
