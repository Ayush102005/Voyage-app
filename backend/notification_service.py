"""
Notification Service for Security Alerts
Supports SMS, WhatsApp, and Email notifications
"""

import os
from twilio.rest import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Send notifications via SMS, WhatsApp, and Email"""
    
    def __init__(self):
        # Twilio credentials for SMS and WhatsApp
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')  # For SMS
        self.twilio_whatsapp_number = os.getenv('TWILIO_WHATSAPP_NUMBER')  # For WhatsApp (format: whatsapp:+14155238886)
        
        # Email SMTP credentials
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_email = os.getenv('SMTP_EMAIL')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_email)
        self.from_name = os.getenv('FROM_NAME', 'Voyage Security Alerts')
        
        # Initialize Twilio client
        if self.twilio_account_sid and self.twilio_auth_token:
            self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
            logger.info("✅ Twilio client initialized")
        else:
            self.twilio_client = None
            logger.warning("⚠️ Twilio credentials not configured")
    
    def send_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """
        Send SMS notification via Twilio
        
        Args:
            phone_number: E.164 format (e.g., +919876543210)
            message: SMS message content
            
        Returns:
            Dict with success status and message_sid or error
        """
        if not self.twilio_client:
            return {
                'success': False,
                'error': 'Twilio not configured'
            }
        
        if not self.twilio_phone_number:
            return {
                'success': False,
                'error': 'Twilio phone number not configured'
            }
        
        try:
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_phone_number,
                to=phone_number
            )
            
            logger.info(f"✅ SMS sent to {phone_number}: {message_obj.sid}")
            return {
                'success': True,
                'message_sid': message_obj.sid,
                'status': message_obj.status
            }
            
        except Exception as e:
            logger.error(f"❌ SMS send failed to {phone_number}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_whatsapp(self, phone_number: str, message: str) -> Dict[str, Any]:
        """
        Send WhatsApp notification via Twilio WhatsApp Business API
        
        Args:
            phone_number: E.164 format (e.g., +919876543210)
            message: WhatsApp message content
            
        Returns:
            Dict with success status and message_sid or error
        """
        if not self.twilio_client:
            return {
                'success': False,
                'error': 'Twilio not configured'
            }
        
        if not self.twilio_whatsapp_number:
            return {
                'success': False,
                'error': 'Twilio WhatsApp number not configured'
            }
        
        try:
            # Twilio WhatsApp requires whatsapp: prefix for both from and to
            from_whatsapp = self.twilio_whatsapp_number
            to_whatsapp = f"whatsapp:{phone_number}"
            
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=from_whatsapp,
                to=to_whatsapp
            )
            
            logger.info(f"✅ WhatsApp sent to {phone_number}: {message_obj.sid}")
            return {
                'success': True,
                'message_sid': message_obj.sid,
                'status': message_obj.status
            }
            
        except Exception as e:
            logger.error(f"❌ WhatsApp send failed to {phone_number}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> Dict[str, Any]:
        """
        Send email notification via SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_body: HTML formatted email body
            text_body: Plain text fallback (optional)
            
        Returns:
            Dict with success status or error
        """
        if not self.smtp_email or not self.smtp_password:
            return {
                'success': False,
                'error': 'SMTP credentials not configured'
            }
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add plain text version
            if text_body:
                msg.attach(MIMEText(text_body, 'plain'))
            
            # Add HTML version
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_email, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email sent to {to_email}: {subject}")
            return {
                'success': True,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Email send failed to {to_email}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_security_alert(
        self,
        alert_data: Dict[str, Any],
        user_profile: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Send security alert via all enabled channels
        
        Args:
            alert_data: Safety alert information (severity, title, message, etc.)
            user_profile: User profile with contact info and notification preferences
            
        Returns:
            Dict with results for each channel
        """
        results = {
            'sms': [],
            'whatsapp': [],
            'email': []
        }
        
        # Get notification preferences
        notification_prefs = user_profile.get('notification_preferences', {})
        sms_enabled = notification_prefs.get('sms_enabled', True)
        whatsapp_enabled = notification_prefs.get('whatsapp_enabled', True)
        email_enabled = notification_prefs.get('email_enabled', True)
        
        # Format alert message
        severity = alert_data.get('severity', 'medium').upper()
        title = alert_data.get('title', 'Security Alert')
        message = alert_data.get('message', '')
        location = alert_data.get('location', '')
        action = alert_data.get('action_required', '')
        
        # SMS/WhatsApp message (short format)
        sms_message = f"🚨 {severity} ALERT: {title}\n\n{message}\n\nLocation: {location}"
        if action:
            sms_message += f"\n\nAction: {action}"
        sms_message += "\n\n- Voyage Security Team"
        
        # Send SMS
        if sms_enabled:
            phone_number = user_profile.get('phone_number')
            if phone_number:
                sms_result = self.send_sms(phone_number, sms_message)
                results['sms'].append({
                    'phone_number': phone_number,
                    **sms_result
                })
        
        # Send WhatsApp
        if whatsapp_enabled:
            # Can use same phone or separate WhatsApp number
            whatsapp_number = notification_prefs.get('whatsapp_number') or user_profile.get('phone_number')
            if whatsapp_number:
                whatsapp_result = self.send_whatsapp(whatsapp_number, sms_message)
                results['whatsapp'].append({
                    'phone_number': whatsapp_number,
                    **whatsapp_result
                })
        
        # Send Email
        if email_enabled:
            email = user_profile.get('email')
            if email:
                # HTML email template
                html_body = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                   color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                        .severity-{severity.lower()} {{ 
                            background-color: {'#dc2626' if severity == 'CRITICAL' else '#ea580c' if severity == 'HIGH' else '#f59e0b' if severity == 'MEDIUM' else '#3b82f6'};
                            color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; 
                            font-weight: bold; font-size: 14px;
                        }}
                        .content {{ background: #f9fafb; padding: 30px; }}
                        .alert-box {{ background: white; border-left: 4px solid #667eea; 
                                     padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                        .location {{ color: #6b7280; font-size: 14px; margin-top: 10px; }}
                        .action-box {{ background: #fef3c7; border-left: 4px solid #f59e0b; 
                                      padding: 15px; margin: 20px 0; border-radius: 5px; }}
                        .footer {{ background: #1f2937; color: #9ca3af; padding: 20px; 
                                  text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }}
                        h2 {{ margin-top: 0; color: #111827; }}
                        .cta-button {{ background: #667eea; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; 
                                      margin-top: 20px; font-weight: bold; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚨 Security Alert</h1>
                            <span class="severity-{severity.lower()}">{severity} PRIORITY</span>
                        </div>
                        <div class="content">
                            <div class="alert-box">
                                <h2>{title}</h2>
                                <p>{message}</p>
                                <div class="location">📍 Location: {location}</div>
                            </div>
                            
                            {f'<div class="action-box"><strong>⚠️ Action Required:</strong><br>{action}</div>' if action else ''}
                            
                            <p>Stay safe and keep your travel plans updated.</p>
                            
                            <a href="https://voyage-app.com/alerts" class="cta-button">View All Alerts</a>
                        </div>
                        <div class="footer">
                            <p>This is an automated security alert from Voyage.</p>
                            <p>You are receiving this because you have an active trip to {location}.</p>
                            <p>Manage your notification preferences in the app settings.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # Plain text fallback
                text_body = f"""
                🚨 SECURITY ALERT - {severity} PRIORITY
                
                {title}
                
                {message}
                
                Location: {location}
                {f'Action Required: {action}' if action else ''}
                
                Stay safe and keep your travel plans updated.
                
                ---
                Voyage Security Team
                You are receiving this because you have an active trip to {location}.
                """
                
                subject = f"🚨 {severity} Security Alert: {title}"
                email_result = self.send_email(email, subject, html_body, text_body)
                results['email'].append({
                    'email': email,
                    **email_result
                })
        
        return results


# Global notification service instance
notification_service = NotificationService()
