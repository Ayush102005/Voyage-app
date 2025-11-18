"""
OTP Verification Service for Voyage
Handles OTP generation, storage, and verification using Fast2SMS
"""

import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict
import os
from dotenv import load_dotenv
import requests

load_dotenv()

# In-memory OTP storage (in production, use Redis or database)
otp_storage: Dict[str, Dict] = {}

# OTP Configuration
OTP_LENGTH = 6
OTP_VALIDITY_MINUTES = 10
MAX_ATTEMPTS = 3


# Module-level convenience functions for backward compatibility
def send_otp(phone_number: str) -> tuple[bool, str]:
    """Send OTP to phone number (module-level function)"""
    return OTPService.send_otp(phone_number)


def verify_otp_simple(phone_number: str, otp: str) -> tuple[bool, str]:
    """Verify OTP for phone number (module-level function)"""
    return OTPService.verify_otp_simple(phone_number, otp)


class OTPService:
    """Service for handling OTP operations"""
    
    @staticmethod
    def generate_otp() -> str:
        """Generate a random 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=OTP_LENGTH))
    
    
    @staticmethod
    def send_otp_via_fast2sms(phone_number: str, otp: str) -> bool:
        """Send OTP via Fast2SMS"""
        try:
            api_key = os.getenv('FAST2SMS_API_KEY')
            
            if not api_key:
                print("⚠️ FAST2SMS_API_KEY not configured")
                print(f"📱 Console OTP for {phone_number}: {otp}")
                print(f"⏰ Valid for {OTP_VALIDITY_MINUTES} minutes")
                return True  # Return True for development/testing
            
            # Format phone number (only digits, remove country code)
            clean_number = phone_number.replace('+91', '').replace('+', '').replace('-', '').replace(' ', '')
            
            # Validate phone number (should be 10 digits for India)
            if len(clean_number) != 10 or not clean_number.isdigit():
                print(f"⚠️ Invalid phone number format: {phone_number}")
                print(f"📱 Console OTP: {otp}")
                return True
            
            # Use Fast2SMS quick/promotional route (no sender ID needed)
            url = "https://www.fast2sms.com/dev/bulkV2"
            
            # Promotional route for quick SMS
            message = f"Your Voyage verification code is {otp}. Valid for {OTP_VALIDITY_MINUTES} minutes. Do not share."
            
            payload = {
                "route": "q",
                "message": message,
                "language": "english",
                "flash": 0,
                "numbers": clean_number,
            }
            
            headers = {
                "authorization": api_key
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('return'):
                    print(f"✅ OTP sent via Fast2SMS to +91{clean_number}")
                    print(f"   Message ID: {result.get('message_id', 'N/A')}")
                    return True
                else:
                    print(f"❌ Fast2SMS failed: {result.get('message', 'Unknown error')}")
            else:
                print(f"❌ Fast2SMS error: HTTP {response.status_code}")
            
            # Fallback to console
            print(f"📱 Console OTP for {phone_number}: {otp}")
            return True
                
        except Exception as e:
            print(f"❌ Fast2SMS error: {e}")
            print(f"📱 Console OTP for {phone_number}: {otp}")
            return True  # Return True so OTP is still stored locally
    
    @staticmethod
    def store_otp(identifier: str, otp: str, method: str = 'sms'):
        """Store OTP with expiry time"""
        otp_storage[identifier] = {
            'otp': otp,
            'method': method,
            'created_at': datetime.now(),
            'expires_at': datetime.now() + timedelta(minutes=OTP_VALIDITY_MINUTES),
            'attempts': 0,
            'verified': False
        }
        print(f"💾 OTP stored for {identifier} (expires in {OTP_VALIDITY_MINUTES} min)")

    
    @staticmethod
    def verify_otp(identifier: str, otp: str) -> Dict[str, any]:
        """
        Verify OTP for given identifier
        Returns: {success: bool, message: str}
        """
        if identifier not in otp_storage:
            return {
                'success': False,
                'message': 'No OTP found. Please request a new one.'
            }
        
        stored_data = otp_storage[identifier]
        
        # Check if already verified
        if stored_data['verified']:
            return {
                'success': False,
                'message': 'OTP already used. Please request a new one.'
            }
        
        # Check expiry
        if datetime.now() > stored_data['expires_at']:
            del otp_storage[identifier]
            return {
                'success': False,
                'message': 'OTP expired. Please request a new one.'
            }
        
        # Check max attempts
        if stored_data['attempts'] >= MAX_ATTEMPTS:
            del otp_storage[identifier]
            return {
                'success': False,
                'message': f'Maximum attempts ({MAX_ATTEMPTS}) exceeded. Please request a new OTP.'
            }
        
        # Verify OTP
        stored_data['attempts'] += 1
        
        if stored_data['otp'] == otp:
            stored_data['verified'] = True
            return {
                'success': True,
                'message': 'OTP verified successfully!'
            }
        else:
            attempts_left = MAX_ATTEMPTS - stored_data['attempts']
            return {
                'success': False,
                'message': f'Invalid OTP. {attempts_left} attempts remaining.'
            }
    
    @staticmethod
    def send_otp(phone_number: str) -> tuple[bool, str]:
        """
        Send OTP to phone number using Fast2SMS
        Returns: (success: bool, message: str)
        """
        try:
            print("\n" + "=" * 60)
            print("📱 SENDING OTP via Fast2SMS")
            print("=" * 60)
            
            # Generate OTP
            otp = OTPService.generate_otp()
            
            # Send via Fast2SMS
            sms_sent = OTPService.send_otp_via_fast2sms(phone_number, otp)
            
            # Store OTP locally for verification (always store for local verification)
            OTPService.store_otp(phone_number, otp, 'sms')
            
            if sms_sent:
                return (True, f'OTP sent to {phone_number}')
            else:
                return (True, f'OTP generated (check console): {otp}')
                
        except Exception as e:
            print(f"❌ Error in send_otp: {e}")
            import traceback
            traceback.print_exc()
            return (False, f'Error sending OTP: {str(e)}')
    
    @staticmethod
    def verify_otp_simple(phone_number: str, otp: str) -> tuple[bool, str]:
        """
        Verify OTP using local storage
        Returns: (success: bool, message: str)
        """
        try:
            print(f"\n🔐 Verifying OTP for {phone_number}")
            
            # Use local verification
            result = OTPService.verify_otp(phone_number, otp)
            
            if result['success']:
                print(f"✅ OTP verified successfully")
            else:
                print(f"❌ OTP verification failed: {result['message']}")
            
            return (result['success'], result['message'])
                
        except Exception as e:
            print(f"❌ Error verifying OTP: {e}")
            import traceback
            traceback.print_exc()
            return (False, f'Error verifying OTP: {str(e)}')
    
    
    @staticmethod
    def resend_otp(identifier: str, method: str = 'sms') -> Dict[str, any]:
        """Resend OTP to phone number"""
        # Simply call send_otp again
        success, message = OTPService.send_otp(identifier)
        return {
            'success': success,
            'message': message
        }

    
    @staticmethod
    def cleanup_expired_otps():
        """Remove expired OTPs from storage"""
        now = datetime.now()
        expired_keys = [
            key for key, data in otp_storage.items()
            if now > data['expires_at']
        ]
        for key in expired_keys:
            del otp_storage[key]
        
        if expired_keys:
            print(f"🧹 Cleaned up {len(expired_keys)} expired OTPs")
    
    @staticmethod
    def get_otp_status(identifier: str) -> Optional[Dict]:
        """Get OTP status for debugging"""
        if identifier in otp_storage:
            data = otp_storage[identifier]
            return {
                'exists': True,
                'method': data['method'],
                'attempts': data['attempts'],
                'verified': data['verified'],
                'expires_at': data['expires_at'].isoformat(),
                'time_remaining': str(data['expires_at'] - datetime.now())
            }
        return {'exists': False}


# Periodic cleanup task (call this from background scheduler)
def cleanup_task():
    """Background task to clean expired OTPs"""
    OTPService.cleanup_expired_otps()


# Singleton instance
_otp_service_instance = None

def get_otp_service() -> OTPService:
    """
    Get or create the OTP service singleton instance
    
    Returns:
        OTPService instance
    """
    global _otp_service_instance
    if _otp_service_instance is None:
        _otp_service_instance = OTPService()
    return _otp_service_instance
