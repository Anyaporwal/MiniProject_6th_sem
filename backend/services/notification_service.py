"""
Mock / Console-based Notification Service.
Logs all notifications to stdout instead of sending real emails/SMS.
Swap SMTP_MOCK=false in .env to enable real email sending.
"""
import logging
from datetime import datetime, timezone

from config import get_settings

logger = logging.getLogger("saferoute.notifications")
settings = get_settings()


def _safe_print(text: str) -> None:
    """Print with fallback for Windows console encoding issues."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('ascii', errors='replace').decode('ascii'))


def send_sos_alert(
    user_name: str,
    latitude: float,
    longitude: float,
    contacts: list[dict],
) -> list[str]:
    """
    Send SOS alert to all emergency contacts.
    Returns list of contacts notified (names).
    """
    maps_link = f"https://maps.google.com/?q={latitude},{longitude}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    notified = []
    for contact in contacts:
        name = contact.get("name", "Unknown")
        phone = contact.get("phone", "N/A")

        message = (
            f"[!] EMERGENCY SOS ALERT\n"
            f"------------------------\n"
            f"From: {user_name}\n"
            f"Time: {timestamp}\n"
            f"Location: {latitude:.6f}, {longitude:.6f}\n"
            f"Maps: {maps_link}\n"
            f"------------------------\n"
            f"To: {name} ({phone})\n"
            f"Please check on {user_name} immediately.\n"
        )

        if settings.SMTP_MOCK:
            logger.warning(f"\n{'='*50}\n[SOS] MOCK SOS NOTIFICATION\n{message}{'='*50}")
            _safe_print(f"\n{'='*50}\n[SOS] MOCK SOS NOTIFICATION\n{message}{'='*50}")
        else:
            _send_email(
                to_address=phone,  # would be email in production
                subject=f"[SOS] Alert from {user_name}",
                body=message,
            )
        notified.append(name)

    return notified


def send_checkin_notification(
    user_name: str,
    latitude: float,
    longitude: float,
    message: str,
    contacts: list[dict],
) -> None:
    """Send 'I'm Safe' check-in to all emergency contacts."""
    maps_link = f"https://maps.google.com/?q={latitude},{longitude}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    for contact in contacts:
        name = contact.get("name", "Unknown")
        phone = contact.get("phone", "N/A")

        body = (
            f"[OK] CHECK-IN from {user_name}\n"
            f"------------------------\n"
            f"Message: {message}\n"
            f"Time: {timestamp}\n"
            f"Location: {maps_link}\n"
            f"------------------------\n"
            f"To: {name} ({phone})\n"
        )

        if settings.SMTP_MOCK:
            logger.info(f"\n{'='*50}\n[CHECKIN] MOCK CHECK-IN\n{body}{'='*50}")
            _safe_print(f"\n{'='*50}\n[CHECKIN] MOCK CHECK-IN\n{body}{'='*50}")
        else:
            _send_email(
                to_address=phone,
                subject=f"[OK] Check-in from {user_name}",
                body=body,
            )


def send_incident_confirmation(
    user_email: str,
    reference_number: str,
    crime_type: str,
) -> None:
    """Send incident submission confirmation."""
    body = (
        f"[REPORT] Incident Report Confirmation\n"
        f"----------------------------\n"
        f"Reference: {reference_number}\n"
        f"Type: {crime_type}\n"
        f"Status: Submitted -- under review\n"
        f"----------------------------\n"
        f"Thank you for helping keep Nagpur safe.\n"
    )

    if settings.SMTP_MOCK:
        logger.info(f"\n{'='*50}\n[REPORT] MOCK INCIDENT CONFIRMATION -> {user_email}\n{body}{'='*50}")
        _safe_print(f"\n{'='*50}\n[REPORT] MOCK INCIDENT CONFIRMATION -> {user_email}\n{body}{'='*50}")
    else:
        _send_email(to_address=user_email, subject=f"Incident {reference_number} Confirmed", body=body)


def _send_email(to_address: str, subject: str, body: str) -> None:
    """Real email sending via SMTP. Only used when SMTP_MOCK=false."""
    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg["To"] = to_address

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_address, msg.as_string())
        server.quit()
        logger.info(f"Email sent to {to_address}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_address}: {e}")
