
# =========================
# Core Imports & App Setup
# =========================
import os
from typing import List, Optional, Union
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, Body, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# =========================
# AI & Service Imports
# =========================
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

# =========================
# Load Environment & Firebase
# =========================
load_dotenv()
from firebase_config import initialize_firebase
initialize_firebase()

# =========================
# Models
# =========================
class TokenRequest(BaseModel):
    token: str

# =========================
# FastAPI App Initialization
# =========================
app = FastAPI(
    title="Voyage Travel Planner API",
    description="AI-powered travel planning orchestrator with Firebase authentication",
    version="1.0.0"
)

# =========================
# CORS Configuration
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000", 
        "https://voyage-app-el2u.vercel.app",
        "https://voyage-app-1.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Database & Auth Imports
# =========================
from database import get_db
from sqlalchemy.orm import Session

# =========================
# Schemas & Service Imports
# =========================
from schemas import (
    TripRequest, TripResponse, TripDetails,
    SavedTripPlan, SaveDestinationRequest, UserProfile,
    DestinationComparisonRequest, DestinationComparisonResponse,
    OptimizeDayRequest, OptimizeDayResponse,
    UserDashboardResponse, UpcomingTrip, TripSummary, 
    PersonalizedSuggestion, DashboardStats,
    PreferenceQuestionnaireResponse,
    TrendingDestination, UpcomingEvent, TrendingSuggestionsResponse,
    CreateReviewRequest, VoyageVerifiedReview, ReviewSummary,
    ReviewsResponse, TasteGraphResponse, TasteGraphInsight,
    TripReview, ReviewRating, ReviewHighlight,
    BookingLinksRequest, BookingLinksResponse, BookingLink,
    FlightBookingParams, HotelBookingParams, TrainBookingParams, ActivityBookingParams,
    CreateVoyageBoardRequest, CreateVoyageBoardResponse, VoyageBoardResponse,
    AddCommentRequest, AddSuggestionRequest, VoteOnSuggestionRequest,
    ResolveSuggestionRequest, CreatePollRequest, VoteOnPollRequest, LikeCommentRequest,
    GoogleCalendarExportRequest, GoogleCalendarExportResponse, CalendarEvent,
    FindFreeWeekendRequest, FindFreeWeekendResponse, SmartScheduleRequest,
    SmartScheduleResponse, UserCalendarEvent,
    Expense, ExpenseCategory, ExpenseTrackerSummary, AddExpenseRequest,
    UpdateExpenseRequest, ExpenseAnalyticsRequest, ExpenseAnalyticsResponse,
    SplitExpenseRequest, BudgetAdjustmentRequest, ExportExpensesRequest,
    UserDashboard, TripSummaryCard, RecentActivity, BudgetInsight,
    OTPRequest, OTPVerifyRequest, OTPResponse
    , UpdatePreferencesRequest,
    TripFeedbackRequest, TripFeedbackResponse, FeedbackStatsResponse
)
from agent_logic import (
    RESEARCH_TOOLS,
    PLANNING_TOOLS,
    OPTIMIZATION_TOOLS,
    get_minimum_daily_budget,
    get_travel_advisory,
    get_travel_document_info,
    estimate_transport_cost,
    estimate_transport_fallback
)
from firebase_auth import get_current_user, get_optional_user, FirebaseUser
from firebase_admin import auth
from firestore_service import firestore_service
from calendar_service import get_event_discovery_engine
from taste_graph_service import get_taste_graph_builder
from booking_links_service import get_booking_links_generator
from voyage_board_service import get_voyage_board_service
from google_calendar_export_service import get_calendar_export_service
from google_calendar_import_service import get_calendar_import_service
from expense_tracker_service import get_expense_tracker_service
from dashboard_service import get_dashboard_service
from otp_service import get_otp_service
from feedback_service import get_feedback_service

# =========================
# Exception Handler
# =========================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"❌ Validation Error:")
    print(f"   URL: {request.url}")
    print(f"   Errors: {exc.errors()}")
    print(f"   Body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )
# =========================
# Login Endpoint


@app.post("/api/login")
async def login(request: TokenRequest):
    """
    Verifies the token, checks if user exists in Firestore. 
    Returns userId if found, else 404.
    """

    try:
        # Verify Firebase ID token
        decoded_token = auth.verify_id_token(request.token)
        uid = decoded_token.get('uid')
        name = decoded_token.get('name')

        if not uid:
            raise HTTPException(status_code=400, detail="UID missing in token")

        print(f"[LOGIN] Received token for uid: {uid}")

        # Pre-calculate relative dates for prompt examples (used elsewhere)
        today = datetime.now()
        next_week_date = (today + timedelta(days=7)).strftime('%Y-%m-%d')
        next_month_date = (today.replace(day=1) + timedelta(days=32)).replace(day=1).strftime('%Y-%m-%d')
        this_weekend_date = (today + timedelta(days=(5-today.weekday())%7)).strftime('%Y-%m-%d')

        # Ensure we have an email from the token if available
        email = decoded_token.get('email')

        # Try to get user profile from Firestore
        user_profile = firestore_service.get_user_profile(uid)
        if not user_profile:
            print(f"[LOGIN] User profile not found for uid: {uid}. Creating new profile.")
            # Try to supplement missing info from Firebase Auth
            try:
                firebase_user = auth.get_user(uid)
                if not email:
                    email = getattr(firebase_user, 'email', None)
                if not name:
                    name = getattr(firebase_user, 'display_name', None)
            except Exception as e:
                print(f"Could not get user info from firebase auth: {e}")

            if not email:
                email = f"{uid}@voyage.com"
                print(f"[LOGIN] Email not found, using placeholder: {email}")

            user_profile = firestore_service.create_user_profile(uid, email, name)
            print(f"[LOGIN] Created new user profile: {user_profile}")

        return {"userId": uid, "profile": user_profile}
    except Exception as e:
        import traceback
        print("[LOGIN] Token verification error:", repr(e))
        traceback.print_exc()
        if hasattr(e, 'message'):
            raise HTTPException(status_code=401, detail=str(e.message))
        else:
            raise HTTPException(status_code=401, detail=str(e))


@app.get("/api/dashboard", response_model=UserDashboardResponse)
async def get_dashboard(current_user: FirebaseUser = Depends(get_current_user)):
    """
    Fetches and returns all data for the main user dashboard.
    Requires authentication.
    """
    try:
        print(f"📊 Fetching dashboard for user: {current_user.uid}")
        
        # Get dashboard data from the service
        dashboard_service = get_dashboard_service(firestore_service.db, firestore_service)
        dashboard_data = dashboard_service.get_user_dashboard(current_user.uid, current_user.email)
        
        # The frontend expects a specific structure, so we'll adapt
        return UserDashboardResponse(
            success=True,
            message="Dashboard fetched successfully",
            user_info=getattr(dashboard_data, 'user_info', {}),
            upcoming_trip=getattr(dashboard_data, 'upcoming_trip', None),
            past_trips=getattr(dashboard_data, 'past_trips', []),
            saved_destinations=getattr(dashboard_data, 'saved_destinations', []),
            personalized_suggestions=getattr(dashboard_data, 'personalized_suggestions', []),
            quick_actions=getattr(dashboard_data, 'quick_actions', []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching dashboard data: {e}")

google_api_key = os.getenv("GOOGLE_API_KEY")
if not google_api_key:
    # Keep a minimal body here to avoid IndentationError
    # Features that require Google APIs will gracefully degrade if key is missing
    print("⚠️ GOOGLE_API_KEY not set. Some Google-powered features may be disabled.")

# ============================================================================
# ============================================================================

class TrendingCache:
    """
    In-memory cache for trending destinations and events
    Refreshes every 6 hours to balance freshness and API costs
    """
    def __init__(self):
        self.cache_timestamp = None
        self.cache_data = None
        self.cache_duration_hours = 6  # Refresh every 6 hours
    
    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if self.cache_data is None or self.cache_timestamp is None:
            return False
        
        elapsed = datetime.now() - self.cache_timestamp
        return elapsed.total_seconds() < (self.cache_duration_hours * 3600)
    
    def get_cache(self):
        """Get cached data if valid"""
        if self.is_cache_valid():
            return self.cache_data
        return None
    
    def set_cache(self, data):
        """Update cache with new data"""
        self.cache_data = data
        self.cache_timestamp = datetime.now()
        print(f"✅ Trending cache updated at {self.cache_timestamp}")

# Global trending cache instance
trending_cache = TrendingCache()

# ============================================================================
# HELPER FUNCTIONS FOR IMAGE URLS
# ============================================================================

def generate_unsplash_url(query: str, width: int = 800, height: int = 600) -> str:
    """
    Generate image URL using Lorem Picsum (reliable placeholder service).
    Note: Unsplash Source API was deprecated. Using Lorem Picsum instead.
    
    Args:
        query: Search query (for hash generation)
        width: Image width in pixels (default 800)
        height: Image height in pixels (default 600)
    
    Returns:
        Image URL from Lorem Picsum
    """
    # Use hash of query to get consistent random image
    import hashlib
    hash_val = int(hashlib.md5(query.encode()).hexdigest(), 16) % 1000
    return f"https://picsum.photos/id/{hash_val}/{width}/{height}"

def generate_destination_image_url(destination: str) -> str:
    """Generate image URL for a destination"""
    return generate_unsplash_url(f"{destination}-travel-destination")

def generate_event_image_url(event_name: str) -> str:
    """Generate image URL for an event/festival"""
    return generate_unsplash_url(f"{event_name}-festival-event")

def generate_food_image_url(dish_name: str) -> str:
    """Generate image URL for a food item"""
    return generate_unsplash_url(f"{dish_name}-indian-food")

# Simple research data cache (destination → research data)
# Cache lasts for 1 hour to avoid repeated API calls for same destination
research_cache = {}
research_cache_timestamps = {}
RESEARCH_CACHE_DURATION_SECONDS = 3600  # 1 hour

def extract_budget_breakdown(trip_plan: str, total_budget: float) -> dict:
    """
    Extract budget breakdown from the trip plan text.
    Looks for budget breakdown section and categorizes expenses.
    """
    import re
    
    budget_breakdown = {
        "Accommodation": 0,
        "Food & Dining": 0,
        "Transportation": 0,
        "Activities & Entertainment": 0,
        "Shopping": 0,
        "Emergency": 0,
        "Other": 0
    }
    
    try:
        # Look for budget breakdown section in the trip plan
        # Pattern: 💰 BUDGET BREAKDOWN or similar
        budget_section_match = re.search(
            r'💰.*?BUDGET.*?BREAKDOWN.*?\n(.*?)(?=\n[📋🎒✈️🏨]|$)', 
            trip_plan, 
            re.DOTALL | re.IGNORECASE
        )
        
        if budget_section_match:
            budget_text = budget_section_match.group(1)
            
            # Extract category amounts
            # Patterns like: "• Accommodation: ₹15,000" or "Accommodation: ₹15000"
            patterns = {
                "Accommodation": r'(?:Accommodation|Hotels?|Stays?).*?₹\s*([0-9,]+)',
                "Food & Dining": r'(?:Food|Dining|Meals?).*?₹\s*([0-9,]+)',
                "Transportation": r'(?:Transport|Travel|Flights?|Journey).*?₹\s*([0-9,]+)',
                "Activities & Entertainment": r'(?:Activities|Entertainment|Attractions|Sightseeing).*?₹\s*([0-9,]+)',
                "Shopping": r'(?:Shopping|Souvenirs).*?₹\s*([0-9,]+)',
                "Emergency": r'(?:Emergency|Contingency|Buffer).*?₹\s*([0-9,]+)'
            }
            
            for category, pattern in patterns.items():
                match = re.search(pattern, budget_text, re.IGNORECASE)
                if match:
                    amount_str = match.group(1).replace(',', '')
                    budget_breakdown[category] = float(amount_str)
        
        # If no budget section found or totals don't match, estimate based on percentages
        total_extracted = sum(budget_breakdown.values())
        if total_extracted == 0 or abs(total_extracted - total_budget) > total_budget * 0.3:
            # Use standard percentage allocation
            budget_breakdown = {
                "Accommodation": round(total_budget * 0.30),      # 30%
                "Food & Dining": round(total_budget * 0.25),      # 25%
                "Transportation": round(total_budget * 0.20),     # 20%
                "Activities & Entertainment": round(total_budget * 0.15),  # 15%
                "Shopping": round(total_budget * 0.05),           # 5%
                "Emergency": round(total_budget * 0.05),          # 5%
                "Other": 0
            }
    
    except Exception as e:
        print(f"⚠️ Error extracting budget breakdown: {e}")
        # Fallback to standard allocation
        budget_breakdown = {
            "Accommodation": round(total_budget * 0.30),
            "Food & Dining": round(total_budget * 0.25),
            "Transportation": round(total_budget * 0.20),
            "Activities & Entertainment": round(total_budget * 0.15),
            "Shopping": round(total_budget * 0.05),
            "Emergency": round(total_budget * 0.05),
            "Other": 0
        }
    
    return budget_breakdown

def get_cached_research(destination: str) -> dict | None:
    """Get cached research data if still valid"""
    if destination in research_cache:
        timestamp = research_cache_timestamps.get(destination)
        if timestamp:
            age = (datetime.now() - timestamp).total_seconds()
            if age < RESEARCH_CACHE_DURATION_SECONDS:
                print(f"📦 Using cached research data for {destination} (age: {int(age)}s)")
                return research_cache[destination]
    return None

def cache_research(destination: str, data: dict):
    """Cache research data for a destination"""
    research_cache[destination] = data
    research_cache_timestamps[destination] = datetime.now()
    print(f"💾 Cached research data for {destination}")


# ============================================================================
# MASTER PROMPT CREATORS
# ============================================================================

def create_standard_planning_prompt(trip_details: TripDetails, research_data: dict, budget_tier: str, tier_description: str, user_preferences: dict = None) -> str:
    """
    Creates the master prompt for STANDARD trip planning (budget is sufficient).
    This prompt contains detailed instructions for the ReAct agent.
    Includes budget tier classification and user preferences for personalized planning.
    """
    
    # Build personalization section if preferences exist
    personalization_section = ""
    if user_preferences:
        prefs = user_preferences.get("preferences", {})
        learned = user_preferences.get("learned_preferences", {})
        
        personalization_section = f"""
**USER PREFERENCES & PERSONALIZATION:**
This traveler has specific preferences that MUST be respected:
"""
        
        if prefs.get("travel_style"):
            personalization_section += f"\n- Travel Style: {', '.join(prefs['travel_style'])} - Tailor experiences to match this style"
        
        if prefs.get("interests"):
            personalization_section += f"\n- Core Interests: {', '.join(prefs['interests'])} - Prioritize activities matching these interests"
        
        if prefs.get("accommodation_type"):
            personalization_section += f"\n- Preferred Stays: {', '.join(prefs['accommodation_type'])} - ONLY recommend these types"
        
        if prefs.get("food_preferences"):
            food_prefs = prefs['food_preferences']
            dietary = food_prefs.get('dietary', 'no preference')
            priorities = food_prefs.get('priorities', [])
            personalization_section += f"\n- Food: {dietary} diet, Focus on: {', '.join(priorities) if priorities else 'local cuisine'}"
        
        if prefs.get("must_have_activities"):
            personalization_section += f"\n- Must Include: {', '.join(prefs['must_have_activities'])} - These are non-negotiable"
        
        if prefs.get("pace"):
            personalization_section += f"\n- Trip Pace: {prefs['pace']} - Adjust daily schedule accordingly"
        
        if prefs.get("transport_modes"):
            personalization_section += f"\n- Preferred Transport: {', '.join(prefs['transport_modes'])} - Prioritize these modes"
        
        if prefs.get("avoided_destinations"):
            personalization_section += f"\n- Avoid: {', '.join(prefs['avoided_destinations'])} - User wants to avoid these or already visited"
        
        # Add learned preferences if available
        if learned:
            if learned.get("recurring_interests"):
                personalization_section += f"\n- Based on History: This user loves {', '.join(learned['recurring_interests'])} - align recommendations with past preferences"
            
            if learned.get("spending_pattern"):
                personalization_section += f"\n- Spending Pattern: {learned['spending_pattern']} - User typically plans {learned.get('spending_pattern', 'moderate')} budget trips"
        
        personalization_section += "\n\n**CRITICAL**: These preferences are NOT optional suggestions - they represent the user's travel identity. Ignore them and the trip fails.\n"
    
    # Calculate budget targets outside f-string
    budget_min_target = int(trip_details.budget * 0.7)
    budget_max_target = int(trip_details.budget * 0.9)
    people_text = "person" if trip_details.num_people == 1 else "people"
    
    prompt = f"""
You are an expert travel AI assistant designed for Indian travelers exploring destinations worldwide. You have deep knowledge of global destinations, understand Indian traveler preferences, cultural context, and budget considerations. All pricing is in Indian Rupees (₹). Your role is to create personalized, practical trip itineraries that feel natural and conversational for Indian users.

**Trip Context:**
**🎯 YOUR TRIP DETAILS:**
From: {trip_details.origin_city} (India)
To: {trip_details.destination}
Duration: {trip_details.num_days} days
Start Date: {trip_details.start_date if trip_details.start_date else 'Not specified - use reasonable future date'}
Travelers: {trip_details.num_people} Indian {people_text}
Budget: ₹{trip_details.budget} TOTAL for the ENTIRE {trip_details.num_days}-day trip ({budget_tier} tier - {tier_description})
Interests: {trip_details.interests or 'General exploration'}
Language: {trip_details.preferred_language or 'English'}

⚠️⚠️⚠️ CRITICAL BUDGET INSTRUCTION ⚠️⚠️⚠️
The budget of ₹{trip_details.budget} is the TOTAL AMOUNT for the COMPLETE {trip_details.num_days}-day trip.
THIS IS NOT ₹{trip_details.budget} PER DAY!
THIS IS NOT ₹{trip_details.budget} PER PERSON PER DAY!
THIS IS ₹{trip_details.budget} FOR THE ENTIRE TRIP FOR ALL {trip_details.num_people} {people_text} ACROSS ALL {trip_details.num_days} DAYS!

Average daily budget available: ₹{trip_details.budget / trip_details.num_days:.0f} per day for all {trip_details.num_people} {people_text}
Per person per day: ₹{trip_details.budget / (trip_details.num_days * trip_details.num_people):.0f}
⚠️⚠️⚠️⚠️ ABSOLUTE BUDGET LIMIT ⚠️⚠️⚠️⚠️
**THE TOTAL COST OF YOUR PLAN MUST NOT EXCEED ₹{trip_details.budget}**
**MAXIMUM ALLOWED: ₹{trip_details.budget}**
**YOU CANNOT GO ABOVE THIS AMOUNT UNDER ANY CIRCUMSTANCES**

If you calculate costs and they exceed ₹{trip_details.budget}, you MUST:
1. Choose cheaper hotels
2. Reduce number of paid activities
3. Opt for budget dining options
4. Find free or low-cost alternatives

DO NOT present a plan that costs more than ₹{trip_details.budget}. This is NON-NEGOTIABLE.
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

**CRITICAL - Budget Validation:**
This trip has ALREADY been validated by our system. The budget of ₹{trip_details.budget} is SUFFICIENT for this {trip_details.num_days}-day trip. Your job is to plan within this budget, NOT to question whether it's enough. DO NOT add warnings about budget being insufficient or short - the system has already checked this.

**CRITICAL - Budget Utilization Strategy:**
The user has allocated ₹{trip_details.budget} as their TOTAL BUDGET for the ENTIRE {trip_details.num_days}-day trip (NOT per day, NOT per person per day - this is the COMPLETE trip budget for ALL {trip_details.num_people} {people_text}):
- Target utilization: 85-95% of budget (₹{int(trip_details.budget * 0.85)}-₹{int(trip_details.budget * 0.95)}) to maximize experience
- **HARD LIMIT: Your plan CANNOT exceed ₹{trip_details.budget}. Stay at or below this amount.**
- Use the FULL budget to create the BEST possible trip - don't leave money on the table
- Balance value and quality - upgrade hotels, add premium experiences, include special activities
- When showing budget breakdown, the TOTAL should be close to ₹{trip_details.budget} (aim for 90%+)
- If you're only using 60-70%, you're not utilizing the budget well - add better experiences!

Example: If total budget is ₹30,000 for 5 days, your plan should cost ₹27,000-₹28,500 (use almost the full budget for a great trip!).

═══════════════════════════════════════════════════════════════════════════════
🎯 RESPONSE QUALITY STANDARDS - FOLLOW STRICTLY 🎯
═══════════════════════════════════════════════════════════════════════════════

**MANDATORY OUTPUT REQUIREMENTS:**

1. ✅ COMPREHENSIVE & DETAILED
   - Every itinerary MUST be 3000-5000 words minimum
   - Include specific hotel names with exact pricing and booking links
   - Provide detailed activity descriptions with timings and insider tips
   - Explain WHY each recommendation was chosen (show your research)
   - Add local tips, cultural insights, and practical advice throughout

2. ✅ PROPER FORMATTING & STRUCTURE
   - Use clear headings (##) for each day
   - Use emojis for visual appeal (🏨 🍽️ 🎯 💡 ⚠️ etc.)
   - Include markdown links with actual URLs (not placeholders)
   - Add images using ![Alt](URL) format at key sections
   - Break content into readable paragraphs with bullet points

3. ✅ COMPLETE INFORMATION
   - Every hotel MUST have: Name, exact price, address, booking link, why chosen
   - Every restaurant MUST have: Name, signature dishes, price range, Zomato link
   - Every activity MUST have: Timing, entry fees, how to reach, why recommended
   - Transport MUST include: Exact mode (Ola/Uber/Metro), cost, duration
   - Budget breakdown MUST list all categories and sum correctly

4. ✅ ENGAGING WRITING STYLE
   - Write like a knowledgeable friend sharing insider secrets
   - Use conversational tone with personality and enthusiasm
   - Add "Pro Tips", "Insider Knowledge", "Why this over others" sections
   - Anticipate questions and address them proactively
   - Make the reader EXCITED about the trip

5. ✅ RESEARCH-BACKED DECISIONS
   - Show comparison: "Researched 5 hotels, chose X because..."
   - Provide reasoning: "Morning timing avoids crowds and heat"
   - Add local context: "Locals prefer this over the touristy option"
   - Include practical tips: "Ask for corner table for best ambiance"

═══════════════════════════════════════════════════════════════════════════════
📚 COMPLETE RESPONSE EXAMPLES - STUDY THESE CAREFULLY 📚
═══════════════════════════════════════════════════════════════════════════════

**❌ BAD RESPONSE EXAMPLE (TOO SHORT, NO DETAILS, GENERIC):**
```
## Day 1: Arrival in Goa

Morning:
- Arrive at airport
- Check into hotel
- Relax

Afternoon:
- Visit Baga Beach
- Entry: Free
- Transport: Take taxi

Evening:
- Dinner at restaurant
- Cost: ₹500

Hotel: Beach Resort - ₹3000/night
```

**✅ EXCELLENT RESPONSE EXAMPLE (DETAILED, ENGAGING, COMPLETE):**
```
## 📅 Day 1: Arrival & North Goa Beach Exploration

![Goa Beaches](https://source.unsplash.com/1600x900/?goa,beach,sunset)

### Morning: Smooth Arrival & Strategic Check-in (9:00 AM - 1:00 PM)

✈️ **Arrival at Goa International Airport (Dabolim)**
Your flight touches down around 9:00 AM. Exit through Arrivals (Terminal 1).

🚗 **Airport → Hotel Transfer**
**Transport**: Pre-booked Ola/Uber to Calangute (avoid airport taxis - overpriced)
**Cost**: ₹800-1000 for sedan (35 km, 50 minutes)
**💡 Pro Tip**: Book cab while still in airport WiFi zone for better rates

🏨 **Check-in: Seashell Suites & Villas** (Calangute Beach Road)
**Why I chose this property** (researched 6 hotels in your budget range):
- ❌ Rejected: Baga Beach Resort (₹4500 - over budget, noisy party area)
- ❌ Rejected: Candolim Inn (₹2500 - 3km from beach, poor reviews 2.9★)
- ❌ Rejected: Anjuna Hostel (₹1200 - too basic for your comfort level)
- ✅ **Selected: Seashell Suites** - ₹3200/night

**What makes it perfect**:
- Location: 400m walk to Calangute Beach (best beach in North Goa for families)
- Reviews: 4.4★ on Google (730 reviews), guests praise cleanliness
- Included: Complimentary breakfast (saves ₹400/day), pool access, beach towels
- Value analysis: Breakfast included means actual cost = ₹2800/night vs competitors

**📱 [Book Seashell Suites on MakeMyTrip](https://www.makemytrip.com/hotels/seashell_suites_villas-details-goa.html)**

**Check-in logistics**:
- Standard check-in: 2:00 PM (request early if available)
- Documents needed: ID proof, booking confirmation
- 💡 **Insider tip**: Ask for sea-facing room on 2nd floor (best view, same price)

**Quick Refresh & Lunch** (1:00 PM - 2:30 PM)

After check-in, quick shower and change for beach exploration.

🍽️ **Lunch: Pousada by the Beach** (5-min walk from hotel)
**Why here over other options**:
- Researched 8 restaurants in Calangute
- Pousada: Authentic Goan-Portuguese fusion, locals' favorite
- Compared to: Brittos (touristy, inflated prices), Souza Lobo (good but ₹800 more expensive)

**What to order** (tested & recommended):
- **Goan Fish Curry with Rice** (₹380) - Made with fresh kingfish, coconut-based gravy
- **Prawn Balchão** (₹420) - Spicy pickled prawns, Goan specialty
- **Bebinca for dessert** (₹180) - Traditional 7-layer pudding
- Fresh lime soda (₹80)
**Total for 2**: ₹1,060 including taxes

**📱 [View on Zomato](https://www.google.com/search?q=Pousada+by+the+Beach+Calangute+zomato)**

**💡 Pro Tips**:
- Request table on covered patio (ocean breeze without direct sun)
- Order dishes medium-spicy first (Goan spice levels are REAL)
- Try their house special - Sorpotel if adventurous (pork dish)

![Goan Seafood](https://source.unsplash.com/1600x900/?goan,seafood,curry)

### Afternoon: Calangute Beach Experience (3:00 PM - 6:30 PM)

**Beach Time Logistics**:
- Distance from lunch spot: 300m (5-min walk)
- Beach access: Public, free entry
- Best spot: Northern end (less crowded than central shacks area)

**Activities & Experiences**:

🏖️ **Beach Relaxation** (3:00 PM - 4:30 PM)
- Rent beach sunbeds: ₹200 for 2 beds + umbrella (from shack owners)
- **Vendor tip**: Say "just sitting, will order drinks later" to avoid pushy sales
- Swimming: Safe in marked zones (lifeguards on duty till 6 PM)

🚤 **Water Sports** (4:30 PM - 5:30 PM) - Optional but recommended
- **Parasailing**: ₹1,200 per person (8-min flight, 100m height)
- **Jet Ski**: ₹900 for 15 minutes (double rider)
- **Banana Boat**: ₹400 per person (group of 6)

**My recommendation**: Skip jet ski (crowded, rushed), do parasailing
**Why**: Aerial view of entire North Goa coastline is once-in-lifetime photo op

**📱 [Pre-book Water Sports](https://www.makemytrip.com/activities/goa-water-sports-booking.html)**

**💡 Safety Note**: Mandatory life jackets provided. Avoid water sports after 5:30 PM (rougher tides).

☕ **Sunset Refreshments** (5:30 PM - 6:30 PM)
- Stay on beach, order from any shack
- **Recommended**: Fresh coconut water (₹60) + Goan cashew feni tasting (₹200)
- Watch sunset (around 6:15 PM in November)

### Evening: Authentic Goan Dinner & Night Market (7:00 PM - 10:30 PM)

🚗 **Transport to Baga** (6:45 PM)
- Hotel → Baga: Ola/Uber auto (₹120, 10 mins)
- **Why Baga for dinner**: Better restaurant options than Calangute after dark

🍽️ **Dinner: Sublime** (7:30 PM) - North Goan Cuisine Specialist
**Selection process**:
- Shortlisted 12 Baga restaurants
- Eliminated: Tito's (nightclub food, average quality), Britto's (tourist trap pricing)
- **Sublime won because**: Chef Malvika sources ingredients from local farms, menu changes based on daily catch

**Recommended dishes**:
- **Crab Xec Xec** (₹580) - Spicy crab curry, Goan delicacy
- **Kingfish Recheado** (₹490) - Red masala stuffed fish, grilled
- **Mushroom Xacuti** (₹320) - For vegetarian option
- **Sannas** (₹80) - Steamed rice cakes (pair perfectly with curry)
- **Sol Kadi** (₹100) - Kokum drink (digestive, refreshing)

**Total**: ₹1,570 for 2 people

**📱 [View on Zomato](https://www.google.com/search?q=Sublime+Restaurant+Baga+Goa+zomato)**

**💡 Insider secrets**:
- Book window table (call ahead: +91-XXXXXXXXXX)
- Ask for "fisherman's catch of the day" (not on menu, best value)
- Try their house-made Goan liqueur (complimentary shot after meal)

**Post-Dinner**: Walk along Baga Beach Road (5 mins), browse night market stalls
- Souvenirs: Handmade jewelry (₹500-800), Goan spice packets (₹200)
- **Bargaining tip**: Start at 50% of quoted price

🚗 **Return to Hotel** (10:00 PM)
- Baga → Hotel: Uber (₹140, 10 mins)

### 💰 Day 1 Total Costs:
- Airport transfer: ₹900
- Hotel: ₹3,200 (breakfast included tomorrow)
- Lunch: ₹1,060
- Beach sunbeds: ₹200
- Water sports: ₹2,400 (₹1,200 × 2 for parasailing)
- Evening transport: ₹260 (₹120 + ₹140)
- Sunset drinks: ₹200
- Dinner: ₹1,570
- Shopping: ₹500

**Day 1 Grand Total: ₹10,290**

**💡 Money-saving alternatives if over budget**:
- Skip water sports: Save ₹2,400
- Lunch at beach shack instead: Save ₹400
- Share meals (portions are large): Save ₹500

---

[Continue with Day 2, Day 3, etc. with similar level of detail]
```

**🎯 KEY DIFFERENCES BETWEEN BAD & GOOD**:
- ❌ Bad: "Visit beach" → ✅ Good: Specific beach name, exact location, timing, activities, costs
- ❌ Bad: "Dinner at restaurant" → ✅ Good: Restaurant name, why chosen, menu items, prices, booking link
- ❌ Bad: "₹500" → ✅ Good: "₹1,570 (₹580 crab + ₹490 fish + ₹320 mushroom + ₹180 sides)"
- ❌ Bad: 50 words → ✅ Good: 500+ words per day with reasoning and tips

═══════════════════════════════════════════════════════════════════════════════

**Budget Tier Context:**
{tier_description}

{personalization_section}

**Destination Intelligence:**
{research_data.get('minimum_budget', '')}

{research_data.get('weather', '')}

{research_data.get('travel_advisory', '')}

{research_data.get('document_info', '')}

**CRITICAL - Safety Assessment:**
The travel advisory above includes a SAFETY VERDICT. You MUST:
- Start your response by clearly stating if it's safe to travel (repeat the verdict)
- If the verdict is "EXERCISE EXTREME CAUTION" or contains severe warnings, strongly advise reconsidering the trip
- If "SAFE WITH PRECAUTIONS", mention the precautions needed in your recommendations
- If "SAFE TO TRAVEL", reassure the traveler but still mention any minor advisories
- Include specific safety tips based on the alerts (e.g., avoid flood-prone areas, carry rain gear, check weather daily)

**CRITICAL - Use Real-Time Weather Data:**
The weather information above is REAL-TIME and CURRENT. Use it to:
- Recommend appropriate activities for the weather conditions
- Adjust the packing list based on actual forecast
- Warn about rain/storms if predicted
- Suggest indoor alternatives if bad weather expected
- Mention best times to visit outdoor attractions

**Response Language:**
Generate the ENTIRE response in {trip_details.preferred_language or 'English'}. If using Hindi, Tamil, Telugu, Bengali, Marathi, or other Indian languages, translate all descriptions and explanations while keeping proper nouns (place names, hotel names) in their original form.

═══════════════════════════════════════════════════════════════════════════════
🚨 MANDATORY REQUIREMENTS - YOUR RESPONSE WILL BE REJECTED WITHOUT THESE 🚨
═══════════════════════════════════════════════════════════════════════════════

1. ✈️ JOURNEY FROM HOME CITY ({trip_details.origin_city}) MUST BE INCLUDED
   - Research flight/train options FROM {trip_details.origin_city} TO {trip_details.destination}
   - Include actual costs (₹X per person × {trip_details.num_people} people)
   - Provide booking links (MakeMyTrip for flights, IRCTC for trains)
   - Include return journey details and costs
   - Add journey costs to budget breakdown as separate line item
   - Missing journey details = REJECTED PLAN

2. 🔗 BOOKING LINKS SECTION MUST BE PRESENT
   - Every hotel needs a real booking URL (use get_booking_link tool)
   - Flights need MakeMyTrip or Google Flights URLs with actual origin city
   - Trains need IRCTC or booking platform links
   - Missing booking links = REJECTED PLAN

3. 🚕 LOCAL TRANSPORT FOR EVERY DAY
   - Airport/station to hotel transport with cost
   - Between each attraction with specific mode and cost
   - Return to hotel in evening with cost
   - No generic "take taxi" - specify Ola/Uber/Metro with ₹ amount

4. � PERMITS & DOCUMENTATION MUST BE CHECKED
   - Research if destination requires special permits (Leh-Ladakh, Sikkim, Andaman, etc.)
   - Include permit details: cost, processing time, application link
   - Provide official website URLs for permit applications
   - If no permits needed, explicitly state "No special permits required"
   - Use get_travel_document_info tool to verify requirements

5. �💰 BUDGET BREAKDOWN SHOWS TOTAL COSTS
   - All costs are TOTAL for entire trip, not per day
   - Must include Journey Costs as first line item
   - Must sum to 70-90% of total budget
   - Show per-person breakdown if multiple travelers

═══════════════════════════════════════════════════════════════════════════════

**Your Approach:**
Think like a friend who's planning this trip - be warm, confident, and insightful. Don't overwhelm with options; instead, make smart, justified recommendations. Your goal is to inspire confidence while being realistic about logistics and costs.

**🧠 ENHANCED INTELLIGENCE PROTOCOL:**

1. **DECISION-MAKING EXCELLENCE**
   Before recommending ANYTHING (hotel, restaurant, activity):
   ✓ Research at LEAST 3-5 options using your tools
   ✓ Compare: price, reviews, location, authenticity, value-for-money
   ✓ EXPLAIN your choice: "I chose X over Y because [specific reason]"
   ✓ Show your reasoning process, don't just list the winner
   
   Example of SMART recommendation:
   "🏨 Recommended: Sea Breeze Hotel (₹3,500/night)
   Why this over others: Researched 4 properties. Marina Inn was ₹1,000 cheaper but 8km from beach (₹400 daily taxi = no savings). Luxury Resort was ₹8,000 (exceeds budget tier). Beach Shack had poor reviews (2.8/5). Sea Breeze offers best value: walking distance to beach, 4.3/5 rating, includes breakfast."

2. **RESEARCH DEPTH REQUIREMENTS**
   Never settle for surface-level information:
   ✓ If first search yields generic results → Try different search terms
   ✓ Cross-verify prices from multiple sources when possible
   ✓ Check seasonal factors (monsoon, festivals, peak season pricing)
   ✓ Validate business hours and current operational status
   ✓ Look for recent reviews/updates (avoid recommending closed places)
   
   Research iteration example:
   - First search: "best restaurants in Goa" → Generic tourist spots
   - Better search: "authentic Goan local eateries locals eat" → Find hidden gems
   - Verify: Check if recommended place still operates, recent reviews

3. **CONTEXT AWARENESS & ANTICIPATION**
   Read between the lines and anticipate needs:
   ✓ Budget tier → Luxury seekers want premium experiences, budget travelers want authentic local
   ✓ Weather → Monsoon season? Add indoor backup options, mention rain gear
   ✓ Group composition → Families need kid-friendly, couples want romantic, solo needs social
   ✓ Travel dates → Festival season? Mention events. Off-season? Highlight deals
   ✓ Origin city → Long travel? Suggest rest on Day 1. Short trip? Pack more activities
   
   Smart anticipation examples:
   - "Note: November is wedding season in Rajasthan - book hotels 2 months ahead"
   - "Since you're traveling with kids, I've kept activity durations under 2 hours"
   - "Your 6am flight means early start - Day 1 is relaxed to avoid exhaustion"

4. **QUALITY FILTERS**
   Apply strict quality checks:
   ✓ Hotels: Minimum 3.5★ rating (unless budget-constrained)
   ✓ Restaurants: Prioritize 4.0★+ or established local favorites
   ✓ Activities: Verify operational status, avoid permanent closures
   ✓ Transport: Check current pricing, mention surge pricing risks
   ✓ Authenticity: Prefer local-frequented places over tourist traps

5. **VALUE OPTIMIZATION**
   Maximize value at every price point:
   ✓ Luxury tier (₹50k+): Don't suggest budget options "to save money" - they WANT premium
   ✓ Budget tier (₹15k-): Find authentic, quality experiences that don't break bank
   ✓ Look for bundled value: Hotel with breakfast > cheaper hotel + breakfast cost
   ✓ Time value: ₹500 taxi saving isn't worth 2-hour metro journey on vacation
   
6. **REASONING TRANSPARENCY**
   For EVERY major decision, show your thinking:
   ✓ Hotel choice: "Why this neighborhood over others"
   ✓ Activity sequence: "Morning temple visit to avoid afternoon heat"
   ✓ Restaurant selection: "Locals rate this 4.6★, serves authentic Hyderabadi biryani"
   ✓ Budget allocation: "Saved ₹2k on transport to splurge on sunset cruise"

7. **PRACTICAL INTELLIGENCE**
   Think logistically:
   ✓ Cluster nearby attractions on same day (minimize transit time/cost)
   ✓ Sequence activities logically (morning temple → lunch → afternoon museum)
   ✓ Account for travel time between locations (don't pack impossibly tight schedule)
   ✓ Consider fatigue (lighter Day 1 after journey, rest breaks in itinerary)
   ✓ Weather-appropriate timing (outdoor activities in pleasant hours)

8. **ITERATIVE IMPROVEMENT**
   If something doesn't add up:
   ✓ Budget too tight? Re-research cheaper alternatives
   ✓ Too much travel time? Reorganize day sequence
   ✓ Low-quality options? Search harder for better choices
   ✓ Missing information? Use tools again with better queries

**CRITICAL - Budget Utilization Strategy:**
The user has allocated ₹{trip_details.budget} as the COMPLETE TOTAL BUDGET for this ENTIRE {trip_details.num_days}-day trip for ALL {trip_details.num_people} {people_text}.
⚠️ THIS IS NOT A DAILY BUDGET - THIS IS THE TOTAL AMOUNT FOR THE WHOLE TRIP! ⚠️

Your goal is to MAXIMIZE VALUE within this TOTAL budget:
- **Target: Use 70-90% of the TOTAL budget** (₹{trip_details.budget * 0.7:.0f} - ₹{trip_details.budget * 0.9:.0f} for the ENTIRE {trip_details.num_days}-day trip)
- If budget tier is LUXURY: Recommend 4-5 star hotels, fine dining, private transport, premium experiences
- If budget tier is MODERATE: Balance comfort and value, 3-4 star hotels, good restaurants, mix of transport
- If budget tier is BUDGET: Smart spending, clean accommodations, authentic local food, public transport
- Don't create a "bare minimum" plan when the user can afford upgrades
- Allocate remaining funds to: better accommodation, unique experiences, quality meals, or emergency buffer

**EXAMPLE TO BE ABSOLUTELY CLEAR:**
If the total budget is ₹50,000 for a 5-day trip:
- This means ₹50,000 is for ALL 5 days combined (NOT ₹50,000 per day!)
- Aim to use ₹35,000-45,000 across all 5 days
- Daily spending should average ₹7,000-9,000 per day (₹50,000 ÷ 5 days)

**Planning Philosophy:**
1. **Quality over quantity** - Recommend the BEST option, not 10 mediocre ones
2. **Real insights** - Use actual research tools to get current prices
3. **Local authenticity** - Prioritize experiences where locals go, not tourist traps
4. **Practical details** - Include specific names, timings, and booking info
5. **Budget transparency** - Account for every rupee spent
6. **VALUE MAXIMIZATION** - Match recommendations to the user's budget tier. A ₹80,000 budget deserves better hotels than a ₹20,000 budget.

**Available Research Tools:**
Use these strategically for maximum intelligence:

- **find_travel_and_lodging_options**: Search hotels and transport
  💡 Smart usage: Search with specific criteria like "4-star hotels near beach" NOT just "hotels"
  💡 If results poor: Try different search terms, vary location radius
  
- **get_estimated_price**: Get real-time pricing
  💡 Always verify prices before recommending
  💡 Check multiple items to compare value
  
- **get_booking_link**: Generate booking URLs
  💡 Call this for EVERY hotel you recommend
  💡 Verify the link matches the property name
  
- **find_authentic_local_food**: Discover genuine local eateries
  💡 Use specific queries: "authentic kerala appam near fort kochi" NOT "food in kerala"
  💡 Look for places with "locals eat here" indicators
  💡 If results are tourist traps, refine search with "locals favorite" or "authentic"
  
- **get_realtime_weather**: Get current weather and 7-day forecast (ALREADY CALLED - data provided above)
  💡 Use forecast to adjust activity timing
  💡 Suggest rain alternatives if monsoon predicted
  
- **get_travel_advisory**: Get safety alerts and warnings (ALREADY CALLED - data provided above)
  💡 Mention relevant advisories in your plan
  💡 Add safety tips based on advisory info

**🎯 TOOL USAGE INTELLIGENCE:**
Don't just call tools once and accept results - iterate:
1. First search: Broad query to get landscape
2. Analyze results: Are these good options?
3. Refined search: Narrow down with better terms if needed
4. Verify: Cross-check prices, ratings, availability
5. Final selection: Choose best option with clear reasoning

Example of smart tool iteration:
- Call find_travel_and_lodging_options("hotels in Manali") → Get generic list
- Analyze: "These are all expensive resort chains, need local character"
- Call find_travel_and_lodging_options("authentic guesthouses old manali budget") → Better results
- Call get_estimated_price for top 3 options → Compare value
- Choose best one with reasoning: "Himalayan Homestay ₹2,500: Best value, 4.5★ reviews, local family-run"

**Price Research Protocol:**
Always research prices before recommending:
✓ Hotels: Check current rates for your recommended property
✓ Flights/Trains: Look up actual ticket costs
✓ Activities: Verify entrance fees and costs
✓ Meals: Confirm restaurant/street food prices
✓ Local transport: Check auto/metro/taxi rates

**💎 EXCELLENCE EXAMPLES - Study These:**

**Example 1: Hotel Selection with Smart Reasoning**
❌ BAD: "Stay at Beach Resort. ₹5,000/night."
✅ EXCELLENT: "🏨 Recommended: Seaside Cottage (₹4,200/night)

My research process:
- Searched 6 properties in Varkala beach area
- Eliminated: Palm Resort (₹2,800 but 3km from beach, ₹300 daily auto = false economy)
- Eliminated: Luxury Haven (₹9,000 - exceeds your moderate budget tier)
- Eliminated: Backpacker Inn (₹1,200 but 2.9★ rating, noise complaints)
- Shortlisted: Beach Shack (₹3,500), Seaside Cottage (₹4,200), Ocean View (₹4,800)
- Final choice: Seaside Cottage
  ✓ Best value: Only ₹700 more than Beach Shack but includes breakfast (saves ₹600/day)
  ✓ Location: 2-min walk to main beach (vs 15-min for Ocean View)
  ✓ Quality: 4.4★ with 320+ reviews praising cleanliness, friendly staff
  ✓ Net cost: ₹4,200 - ₹600 breakfast = ₹3,600 effective (cheaper than Beach Shack!)

📱 [Book Seaside Cottage](actual-booking-url)"

**Example 2: Activity Selection with Context Awareness**
❌ BAD: "Visit Amber Fort. ₹500 entry."
✅ EXCELLENT: "🏰 Amber Fort Tour (9:00 AM - 12:00 PM) - ₹500 entry + ₹200 audio guide

Why morning timing: 
- Temperatures hit 38°C by noon in May → Morning visit avoids heat exhaustion
- Fort opens 8am, arriving at 9am means smaller crowds (tour groups come 11am+)
- Morning light is best for photography (east-facing ramparts)

Why audio guide recommended:
- Fort history spans 400 years → Self-exploration misses stories
- Audio guide (₹200) cheaper than human guide (₹800) for your group
- Allows flexible pacing vs rushed group tours

Smart logistics:
- Located 11km from your hotel in old city
- 🚗 Take Ola/Uber: ₹180 one-way, 25 mins (vs ₹50 bus but 1.5 hours with changes)
- Time value: Extra ₹260 (₹130 per person) saves 2 hours → Use for lunch at heritage restaurant

Post-visit:
- Return to city for lunch (12:30 PM) at nearby Peacock Rooftop (5-min from fort)
- Afternoon: Rest at hotel during peak heat (1-4 PM), resume sightseeing post-4 PM when cool"

**Example 3: Food Recommendation with Local Intelligence**
❌ BAD: "Lunch at Karim's Restaurant. ₹600."
✅ EXCELLENT: "🍽️ Lunch: Al Jawahar (1:00 PM) - ₹650 for 2

Why this choice over famous Karim's:
- Researched 5 Old Delhi food institutions
- Karim's: More touristy now, long waits (45+ min), reviews mention quality declined
- Al Jawahar: Next door to Karim's, same legacy (est. 1948), locals prefer it
- What locals say: 'Old-timers know Al Jawahar's mutton burra is unmatched'

What to order:
✓ Mutton Burra (₹280) - Signature dish, slow-cooked for 4 hours
✓ Chicken Jahangiri (₹220) - Mughlai specialty with 15-spice blend
✓ Roomali Roti (₹40) - Paper-thin, fresh from tandoor
✓ Total: ₹540 + ₹110 tip/taxes = ₹650

Insider tips:
- Ask for corner table on 1st floor (best ambiance, avoid ground floor crowd)
- Order food slightly less spicy (default is very spicy for tourist palates)
- Skip desserts here (heavy meal), get kulfi from nearby Kuremal later

📱 [View on Zomato](https://www.google.com/search?q=Al+Jawahar+Old+Delhi+zomato)"

**Example 4: Day Planning with Logical Flow**
❌ BAD: "Morning: Beach. Afternoon: Fort. Evening: Market."
✅ EXCELLENT: "📅 Day 3: Coastal Exploration & History

My planning logic for this day:
- Clustered south coast attractions (minimize travel time)
- Sequenced by: weather timing → lunch proximity → sunset spot
- Built in rest break (you're on Day 3, fatigue sets in)

Morning (8:00 AM - 12:00 PM): Lighthouse Point
🚗 Hotel → Lighthouse: Ola (₹140, 15 min)
🗼 Lighthouse climb - ₹50, stunning 360° views
⏰ Why early: Opens 8am, best light for photos, cool breeze, empty (crowds post-10am)
📸 Photography tip: South side has dramatic cliff formations

Midday (12:30 PM): Strategic lunch near afternoon activity
🍽️ Cliff Edge Cafe (walking distance from lighthouse - 800m, 10-min walk)
Why this location: Next activity (fort) is 2km south → Lunch here = no backtracking

Afternoon (2:00 PM - 4:00 PM): Coastal Fort
🚗 Cafe → Fort: Share auto (₹30 per person, 5 min)
🏰 Fort entry ₹100, self-guided (small fort, no guide needed)
⏰ Why afternoon: Fort faces west → Shaded during midday heat, golden light by 4pm

Rest Break (4:00 PM - 5:30 PM): Back to hotel
Why essential: 3 days of sightseeing + heat = fatigue management
🚗 Fort → Hotel: Ola (₹160, 20 min)
💡 Use this time: Shower, rest, recharge for evening market visit

Evening (5:30 PM - 9:00 PM): Sunset Market
🚗 Hotel → Market: Auto (₹80, 10 min)
🌅 Timing rationale: Market opens 5pm, sunset at 6:30pm → Perfect transition from shopping to waterfront dining
🛍️ Budget: ₹1,500 for handicrafts/souvenirs

Dinner (8:00 PM): Market area seafood shacks
🦞 Fresh catch pricing: ₹800 for 2 (tiger prawns + fish + rice)

Day 3 total: ₹3,400 (transport ₹460 + activities ₹200 + food ₹1,450 + shopping ₹1,500 - accommodation separate)"

**🎯 KEY TAKEAWAY:**
Your plans should read like a knowledgeable friend sharing insider tips, NOT a robotic itinerary generator. Show your research, explain your choices, anticipate problems, maximize value.

**CRITICAL - Booking Links Requirement:**
🔗 **MANDATORY: You MUST include a "🔗 BOOKING LINKS" section with actual URLs**

For EVERY hotel/accommodation you recommend:
✓ Use the get_booking_link tool to get the official booking website
✓ Format: [Hotel Name](booking URL) - Brief description

For flights:
✓ Provide MakeMyTrip URLs with pre-filled search using ACTUAL trip dates
✓ Format: https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DESTINATION-DD/MM/YYYY&tripType=O&paxType=A-X_C-0_I-0&intl=false&cabinClass=E&lang=eng
✓ **CRITICAL**: Use the trip start date ({trip_details.start_date if trip_details.start_date else 'calculate from today + 30 days'}) for outbound flight
✓ **CRITICAL**: Calculate return date by adding {trip_details.num_days} days to start date for return flight
✓ Date format: DD/MM/YYYY (e.g., 15/12/2025 for Dec 15, 2025)
✓ Update paxType based on travelers: A-{trip_details.num_people}_C-0_I-0 for {trip_details.num_people} adults
✓ Example: If trip starts 2025-12-15, use https://www.makemytrip.com/flight/search?itinerary=BOM-GOI-15/12/2025&tripType=O&paxType=A-{trip_details.num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng
✓ **DO NOT use placeholder dates like 06/11/2025 - use ACTUAL trip dates!**

For trains:
✓ Provide IRCTC booking links
✓ Format: https://www.irctc.co.in/nget/train-search

For activities/attractions:
✓ Include booking URLs where available (BookMyShow, official attraction websites)
✓ If no direct booking: Provide official website or contact info

**The plan will be REJECTED if the 🔗 BOOKING LINKS section is missing or empty!**

**CRITICAL - Local Travel Coverage:**
You MUST include detailed local transportation for EVERY day:
✓ How to get from airport/station to hotel (taxi/metro/auto with costs)
✓ Travel between attractions within each day (auto/cab/metro with routes and costs)
✓ Evening return to hotel transport (include costs)
✓ Mention specific transport apps (Uber, Ola, Metro apps)
✓ Include walking distances where relevant
✓ Provide estimated costs for each local trip
Example: "Morning: Take Ola/Uber from hotel to Gateway of India (₹150, 20 mins)"

**Food Discovery:**
For every meal, use your food finder to recommend:
- Specific establishments (not generic "any restaurant")
- Places locals frequent (not tourist hotspots)
- Signature dishes and why they're special
- Exact locations and price ranges

**Itinerary Structure:**
```
� CRITICAL: ALL BOOKING LINKS MUST BE ACTUAL WORKING URLS - NO PLACEHOLDERS!
- Hotels: CALL get_booking_link tool and insert real URL
- Flights: Use https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DESTINATION-DD/MM/YYYY&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E&lang=eng
- Restaurants: Use https://www.google.com/search?q=RESTAURANT+NAME+CITY+zomato (replace spaces with +)
- Images: Use https://source.unsplash.com/1600x900/?keyword1,keyword2 for destination photos
- See examples below for exact format

📸 VISUAL EXPERIENCE REQUIREMENT:
**MANDATORY: Include images throughout the itinerary to make it visually engaging**

**Image Format:**
![Alt Text](https://source.unsplash.com/1600x900/?keyword1,keyword2)

**Where to Add Images:**
1. **After TRIP OVERVIEW**: 2-3 destination hero images
   - Example: ![Delhi Skyline](https://source.unsplash.com/1600x900/?delhi,skyline)
   - Example: ![Goa Beaches](https://source.unsplash.com/1600x900/?goa,beach)

2. **Each Day Section**: 1-2 images of main activities/attractions
   - Example: ![Taj Mahal](https://source.unsplash.com/1600x900/?taj-mahal)
   - Example: ![Goan Cuisine](https://source.unsplash.com/1600x900/?goan,food)

3. **Food Section**: 1-2 local cuisine images
   - Example: ![Delhi Street Food](https://source.unsplash.com/1600x900/?delhi,street-food)

4. **Hotel Section**: 1 hotel/accommodation image
   - Example: ![Luxury Hotel Delhi](https://source.unsplash.com/1600x900/?hotel,delhi)

**Image Keyword Tips:**
- Use specific landmark names: taj-mahal, gateway-of-india, red-fort
- Combine with city: delhi+monument, goa+beach, kerala+backwaters
- Activity-based: trekking+himalayas, scuba+andaman, temple+kerala
- Food: indian+cuisine, biryani, masala-dosa, goan+seafood

�🗺️ {trip_details.num_days}-DAY {trip_details.destination} ITINERARY

📋 TRIP OVERVIEW
[Write a compelling 2-3 sentence overview of what makes this trip special]

🚨 LINKING FORMAT REMINDER - EVERY LINK MUST LOOK LIKE THIS:
**📱 [Link Text](actual-working-url)**
Example: **📱 [Book Flight](https://www.makemytrip.com/flight/search?itinerary=DEL-BLR-15/12/2025&tripType=O&paxType=A-2_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
NO plain text, NO placeholders - ONLY clickable markdown links with URLs in parentheses!

🚨 DATE FORMAT CRITICAL INSTRUCTION:
The trip start date is: {trip_details.start_date if trip_details.start_date else '(not specified - use today + 30 days)'}
**MANDATORY DATE CONVERSION FOR FLIGHT LINKS:**
1. If start_date is in YYYY-MM-DD format (e.g., "2025-12-15"), convert to DD/MM/YYYY (e.g., "15/12/2025")
2. For return flight: Add {trip_details.num_days} days to start date, then convert to DD/MM/YYYY
3. Example: Start 2025-12-15, 5-day trip → Return 2025-12-20 → Use "20/12/2025" in flight URL
4. **DO NOT use example dates like 06/11/2025 - ALWAYS use actual calculated trip dates!**

✈️ JOURNEY TO {trip_details.destination.upper()}
**CRITICAL: You MUST research and include the journey FROM {trip_details.origin_city} TO {trip_details.destination}**
**FORMAT: EVERY booking link MUST be a clickable markdown link with ACTUAL URL inside parentheses**
**WRONG: **📱 Book Flight on MakeMyTrip** (missing link brackets and URL)**
**CORRECT: **📱 [Book Flight on MakeMyTrip](https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DEST-DD/MM/YYYY&tripType=O&paxType=A-{trip_details.num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)****
**Remember: Replace ORIGIN, DEST, and DD/MM/YYYY with actual airport codes and calculated dates!**

**Getting There:**
• Flight Option: [Flight details from {trip_details.origin_city} to {trip_details.destination}]
  - Airline recommendations (IndiGo, Air India, SpiceJet, etc.)
  - Typical flight duration
  - Estimated cost: ₹[X] per person × {trip_details.num_people} = ₹[Total]
  - **COPY THIS EXACT FORMAT WITH SQUARE BRACKETS AND PARENTHESES:**
  - **📱 [Book Flight on MakeMyTrip](https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DEST-DD/MM/YYYY&tripType=O&paxType=A-{trip_details.num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
  - Replace ORIGIN with {trip_details.origin_city} airport code, DEST with destination airport code
  - Replace DD/MM/YYYY with actual travel START DATE converted to DD/MM/YYYY format
  - Airport codes: BOM=Mumbai, DEL=Delhi, BLR=Bengaluru, COK=Kochi, MAA=Chennai, GOI=Goa, HYD=Hyderabad, CCU=Kolkata

OR

• Train Option (if available): [Train details from {trip_details.origin_city} to {trip_details.destination}]
  - Train name/number recommendations
  - Typical journey duration
  - Class recommendations (3AC, 2AC, 1AC based on budget tier)
  - Estimated cost: ₹[X] per person × {trip_details.num_people} = ₹[Total]
  - **📱 [Book on IRCTC](https://www.irctc.co.in/nget/train-search)**

**Return Journey:**
• Include similar details for return trip on Day {trip_details.num_days}
• Cost: ₹[X] per person × {trip_details.num_people} = ₹[Total]
• **MANDATORY FORMAT - COPY EXACTLY WITH SQUARE BRACKETS [ ] AND PARENTHESES ( ):**
• **📱 [Book Return Flight](https://www.makemytrip.com/flight/search?itinerary=DEST-ORIGIN-DD/MM/YYYY&tripType=O&paxType=A-{trip_details.num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
• Replace DEST with destination airport, ORIGIN with {trip_details.origin_city} code
• Replace DD/MM/YYYY with return date (start_date + {trip_details.num_days} days, converted to DD/MM/YYYY)

📅 DAY-BY-DAY PLAN

Day 1: Arrival & [Descriptive Title]

✈️ Arrival:
• Land at {trip_details.destination} Airport/Station [Estimated time]
• Airport/Station to Hotel: [Specific transport - Ola/Uber/Prepaid Taxi] (₹[Cost], [Duration])
  Tip: Book [Ola/Uber] in advance for convenience

Morning/Afternoon (After Check-in):
• 🚗 Hotel to [Activity Location]: [Mode like Ola/Uber/Metro] (₹[Cost])
• [Activity Name] - ₹[Cost]
  Why: [Brief, compelling reason this is included]
  **📱 IF BOOKABLE ONLINE, ADD LINK:** [Book This Activity](https://bookmyshow.com/... or official-website)
  
Afternoon (12:00 PM - 6:00 PM):
• 🚗 [Location A] to [Location B]: [Mode] (₹[Cost])
• [Activity Name] - ₹[Cost]
  Why: [What makes this special]
  **📱 IF BOOKABLE, ADD LINK:** [Book Tickets](booking-url)
  
Evening (6:00 PM onwards):
• 🚗 [Location] to [Evening spot]: [Mode] (₹[Cost])
• [Activity Name] - ₹[Cost]
  Why: [How this completes the day]
  **📱 IF BOOKABLE, ADD LINK:** [Reserve/Book](booking-url)
• 🚗 Return to hotel: [Mode] (₹[Cost])

🍽️ Food: 
• Breakfast: [Specific place] - [Signature dish] (₹[Price])
  **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
  Replace spaces with +, format: google.com/search?q=RESTAURANT+NAME+CITY+zomato
• Lunch: [Specific place] - [Must-try item] (₹[Price])
  **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
• Dinner: [Specific place] - [Local specialty] (₹[Price])
  **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**

🏨 Accommodation: [Specific hotel name] - ₹[Price/night]
   Why this choice: [Brief explanation of why this property suits their budget tier]
   **📱 MANDATORY FORMAT - USE SQUARE BRACKETS [ ] AND PARENTHESES ( ) WITH get_booking_link TOOL:**
   **WRONG FORMAT: **📱 Book This Hotel** or **📱 [Book Hotel](use-tool)****
   **CORRECT FORMAT: **📱 [Book This Hotel](https://www.makemytrip.com/hotels/tea-county-munnar-details.html)****
   CALL get_booking_link("hotel_name_here", "city_name_here") tool and copy the returned URL into parentheses!

[Repeat for each day]

📋 PERMITS & DOCUMENTATION (If Required)

**CRITICAL: Check if destination requires special permits/passes**

For destinations like Leh-Ladakh, Sikkim, Andaman, Protected Areas, Wildlife Sanctuaries, etc.:

🎫 Required Permits:
• **[Permit Type]**: Required for [specific areas/activities]
  - **Who needs it**: [Indian citizens/foreigners/all visitors]
  - **Cost**: ₹[X] per person
  - **Validity**: [number] days
  - **Processing time**: [timeframe]
  - **Documents needed**: [ID proof/photos/forms]
  - **📱 [Apply Online Here](official-permit-website-url)**
  - **💡 Tip**: [Important advice about permit - apply X days in advance, etc.]

• **[Another Permit if applicable]**: [Details]
  - **📱 [Apply Here](permit-url)**

📄 Other Documents to Carry:
• Valid Photo ID (Aadhaar/Passport/Driving License)
• [Destination-specific requirements]
• Permit copies (physical + digital backup)

⚠️ **Important**: If no special permits are required for {trip_details.destination}, simply state "No special permits required for {trip_details.destination}. Just carry a valid government ID."

🎒 ESSENTIALS

📦 Packing Checklist:
[Smart, weather and activity-appropriate items]

🚗 Transportation Overview:

✈️ Inter-City Travel:
• [Origin] to [Destination]: [Flight/Train details, cost, booking info]
• [Destination] to [Origin]: [Return travel details, cost]

🚕 Local Transportation (Within Cities):
• Recommended apps: Ola, Uber, [City-specific metro app]
• Average auto/cab costs: [Daily estimate]
• Metro routes (if applicable): [Key routes with costs]
• Walking distances: [Between nearby attractions]
• Total local transport budget: ₹[X] for all {trip_details.num_days} days

💳 Budget Breakdown (TOTAL for entire {trip_details.num_days}-day trip):
⚠️ These are TOTAL costs for the ENTIRE trip, NOT per day costs ⚠️

🚀 Journey Costs ({trip_details.origin_city} ↔️ {trip_details.destination}):
• Outbound ({trip_details.origin_city} → {trip_details.destination}): ₹[X] × {trip_details.num_people} person(s) = ₹[Total]
• Return ({trip_details.destination} → {trip_details.origin_city}): ₹[X] × {trip_details.num_people} person(s) = ₹[Total]
**Subtotal Journey: ₹[X]**

🏨 Accommodation: ₹[X] (sum of all {trip_details.num_days} nights)
🚕 Local Transport: ₹[X] (cabs/metro/autos within cities for all days)
🍽️ Food: ₹[X] (sum of all meals across all {trip_details.num_days} days)
🎫 Activities: ₹[X] (sum of all attractions for entire trip)
🛍️ Miscellaneous: ₹[X] (buffer & extras)
────────────────
GRAND TOTAL: ₹[X] out of ₹{trip_details.budget} total budget
REMAINING: ₹[{trip_details.budget} - X]

✅ This plan uses [X]% of your TOTAL budget

**� NOTE: All booking links are embedded directly with each hotel, flight, activity, and restaurant throughout the itinerary above. Simply click on the 📱 icons next to each item to book!**

💡 PRO TIPS:
• [Cultural insight or practical advice]
• [Local custom or etiquette]
• [Money-saving trick]
• [Safety or health tip]
```

**CRITICAL INSTRUCTION - EMBED BOOKING LINKS:**
- Do NOT create a separate "Booking Links" section at the end
- INSTEAD: Place ACTUAL WORKING DIRECT LINKS with each item:
  
  **HOTELS - MANDATORY FORMAT:**
  * ALWAYS call get_booking_link tool for EVERY hotel
  * Example: get_booking_link("Tea County Munnar", "Munnar")
  * Insert the ACTUAL returned URL: **📱 [Book This Hotel](https://www.makemytrip.com/hotels/tea-county-details.html)**
  * NO placeholders like "use-get_booking_link-tool" - ACTUAL URLs ONLY
  
  **FLIGHTS - MANDATORY FORMAT:**
  * Create ACTUAL MakeMyTrip URLs with real airport codes and ACTUAL TRIP DATES
  * Format: https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DESTINATION-DD/MM/YYYY&tripType=O&paxType=A-X_C-0_I-0&intl=false&cabinClass=E&lang=eng
  * **CRITICAL**: Use the actual trip start date ({trip_details.start_date if trip_details.start_date else 'calculate as today + 30 days'}) converted to DD/MM/YYYY format
  * **CRITICAL**: For return flight, add {trip_details.num_days} days to start date
  * Common codes: BOM=Mumbai, DEL=Delhi, BLR=Bengaluru, MAA=Chennai, COK=Kochi, GOI=Goa, HYD=Hyderabad, CCU=Kolkata
  * Date format: DD/MM/YYYY (convert YYYY-MM-DD to DD/MM/YYYY - e.g., 2025-12-15 becomes 15/12/2025)
  * Update paxType: A-{trip_details.num_people}_C-0_I-0 for {trip_details.num_people} adults
  * **DO NOT use example dates like 06/11/2025 - calculate from actual trip start date!**
  * ALWAYS include return flight link with reversed origin-destination and calculated return date
  
  **RESTAURANTS - MANDATORY FORMAT:**
  * Create ACTUAL Zomato URLs with city and restaurant name
  * Format: https://www.zomato.com/munnar/annapoorna-restaurant
  * Replace spaces with hyphens, lowercase
  * Example: **📱 [View on Zomato](https://www.zomato.com/munnar/annapoorna-restaurant)**
  
  **TRAINS - MANDATORY FORMAT:**
  * Use direct IRCTC link: https://www.irctc.co.in/nget/train-search
  * Example: **📱 [Book on IRCTC](https://www.irctc.co.in/nget/train-search)**

- This makes it easier for users to book while reading each section
- EVERY hotel, flight, and major restaurant MUST have a clickable link
- NO EXCEPTIONS - links are MANDATORY

**Tone & Style:**
- Be conversational but professional
- Show enthusiasm without being overly casual
- Provide context for recommendations (the "why")
- Be honest about tradeoffs and alternatives
- Use emojis sparingly for visual organization
- Write like you're genuinely excited to share local knowledge

**Quality Checks:**
Before finalizing - YOUR PLAN WILL BE REJECTED if any of these are missing:
✓ **✈️ JOURNEY FROM {trip_details.origin_city} TO {trip_details.destination} is included at the start**
✓ **Flight/train details with actual costs** (₹X per person × {trip_details.num_people})
✓ **Return journey details included** with booking links
✓ **Journey costs included in budget breakdown** as separate line item
✓ **� PERMITS section included** - check if destination requires special permits and provide details + links
✓ **�🔗 BOOKING LINKS embedded directly with each item** (no separate section at end)
✓ **Every hotel has booking link** via get_booking_link tool embedded after hotel name
✓ **Every major activity has booking link** embedded after activity name (if bookable online)
✓ **Permit application links** included if permits are required for destination
✓ **Flight booking links** use MakeMyTrip/Google Flights starting from {trip_details.origin_city}
✓ Every price researched using tools
✓ All accommodations match the budget tier
✓ Food recommendations are specific establishments with Zomato links where possible
✓ Transport options are practical and clearly explained
✓ Activities align with stated interests
✓ Total cost is within budget (70-90%)
✓ Response is in the correct language
✓ **LOCAL TRANSPORT covered for EVERY day** (airport transfer, between attractions, return to hotel)
✓ **Local transport costs included** in budget breakdown and daily totals

Start planning now. Research thoroughly, recommend confidently, embed all booking links inline, check for permit requirements, and create an itinerary they'll actually want to follow.

🚨 FINAL CRITICAL REMINDERS - LINKS MUST BE REAL:
1. Hotels: CALL get_booking_link("Hotel Name", "City") and use the ACTUAL returned URL
2. Flights: Use ACTUAL trip dates converted to DD/MM/YYYY format in https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DEST-DD/MM/YYYY&tripType=O&paxType=A-{trip_details.num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng
3. Restaurants: https://www.zomato.com/city/restaurant-name-with-hyphens
4. If you write "[Book Hotel](use-get_booking_link-tool)" you FAILED - must be REAL URL only!
5. **DO NOT use placeholder dates - calculate from trip start date: {trip_details.start_date if trip_details.start_date else 'today + 30 days'}**

🍽️ Where You'll Eat:
- Breakfast: [ONE specific place] (₹X) - 🌟 Locals love it because: [reason]
- Lunch: [ONE specific place] (₹X) - 🌟 You gotta try: [dish name]
- Dinner: [ONE specific place] (₹X) - 🌟 Famous for: [specialty]

[Continue for all days...]

🏨 WHERE YOU'LL STAY (My Top Picks)
**[City Name]:** [ONE specific hotel] (₹X/night)
✨ WHY THIS ONE: [Clear reason - location/value/ratings/vibes]
🔗 Book here: [link]

🍽️ AUTHENTIC LOCAL FOOD GUIDE
[Research using find_authentic_local_food tool]

**Day 1 Meals:**
- **Breakfast:** [Specific stall/eatery] at [location] (₹X)
  🌟 Must-Try: [dish name]
  💬 Why: [Why locals swear by this place]

- **Lunch:** [Restaurant name] at [location] (₹X)
  🌟 Signature: [dish]
  💬 Why: [Local secret]

- **Dinner:** [Place name] at [location] (₹X)
  🌟 Specialty: [dish]
  💬 Why: [Authentic reason]

[Repeat for all days]

🚆 GETTING AROUND (Smart Routes)
**Getting there:** [Specific train/flight number] (₹X)
✨ WHY: [fastest/cheapest/most scenic]

**Local transport:** [Recommendation] (₹X/day)  
✨ WHY: [most convenient/authentic]

💰 YOUR COMPLETE BUDGET BREAKDOWN

**🏨 Where You're Staying:**
- [Hotel 1]: ₹X × Y nights = ₹Z
- [Hotel 2 if multiple cities]: ₹X × Y nights = ₹Z
**Subtotal: ₹X**

**🚆 Travel Costs:**
- [Origin] → [Destination] ([Train/Flight number]): ₹X per person × {trip_details.num_people} = ₹Z
- Local transport in [City 1]: ₹X per day × Y days = ₹Z
- [City 1] → [City 2] (if applicable): ₹X per person × {trip_details.num_people} = ₹Z
**Subtotal Transportation: ₹X**

**🎫 Activities & Entrance Fees:**
- Day 1: [Activity 1]: ₹X per person × {trip_details.num_people} = ₹Z
- Day 1: [Activity 2]: ₹X per person × {trip_details.num_people} = ₹Z
- Day 2: [Activity 1]: ₹X per person × {trip_details.num_people} = ₹Z
[List ALL activities with individual costs]
**Subtotal Activities: ₹X**

**🍽️ Meals Costs:**
- Breakfasts: ₹X per meal × {trip_details.num_people} people × {trip_details.num_days} days = ₹Z
- Lunches: ₹X per meal × {trip_details.num_people} people × {trip_details.num_days} days = ₹Z
- Dinners: ₹X per meal × {trip_details.num_people} people × {trip_details.num_days} days = ₹Z
**Subtotal Meals: ₹X**

**🛍️ Miscellaneous:**
- Shopping/Souvenirs: ₹X
- Tips & Service charges: ₹X
- Emergency buffer: ₹X
**Subtotal Miscellaneous: ₹X**

**═══════════════════════════════════════**
**💎 GRAND TOTAL: ₹X**
**Budget Utilization: ₹X / ₹{trip_details.budget} = [X%]**
**Remaining from budget: ₹{trip_details.budget} - ₹X = ₹Y**
**═══════════════════════════════════════**

**CRITICAL - Budget Status & Utilization:**
- Target: Use 70-90% of the allocated budget (₹{trip_details.budget}) to maximize trip quality
- If your plan uses less than 60% of budget: Consider upgrading hotels, adding premium experiences, or including special activities
- If Y (remaining) is POSITIVE → The trip FITS WITHIN BUDGET. DO NOT say budget is short/insufficient.
- If Y (remaining) is NEGATIVE → The trip is over budget. Clearly state by how much.
- NEVER contradict your own calculation. If you show ₹47,620 remaining, DO NOT say the budget is short.
- The user WANTS to use their budget for a great trip, not to minimize spending.

🎒 PERSONALIZED PACKING LIST

**📋 Essential Documents:**
- Passport/Aadhaar Card/Voter ID
- [Specific permits if needed based on research data]
- Travel insurance documents
- Hotel booking confirmations
- Train/flight tickets

**👕 Clothing (Based on Weather & Activities):**
[Generate based on destination weather from research data]
- [If cold destination]: Warm layers, thermal wear, jacket, gloves, woolen cap
- [If hot destination]: Light cotton clothes, sunhat, sunglasses
- [If monsoon season]: Raincoat, waterproof shoes, umbrella
- [Activity-specific]: Trekking shoes for hiking, modest clothing for temples, swimwear for beaches

**💊 Health & Hygiene:**
- Basic first aid kit
- Prescribed medications
- Hand sanitizer & wet wipes
- Sunscreen (SPF 50+)
- Insect repellent
- Water purification tablets

**🔌 Electronics & Gadgets:**
- Phone & charger
- Power bank
- Camera (optional)
- Universal adapter
- Earphones

**💰 Money & Cards:**
- Cash in INR (₹5,000-10,000 for emergencies)
- Debit/Credit cards
- UPI apps activated

**🎯 Activity-Specific Items:**
[Based on planned activities]
- [If trekking/adventure]: Daypack, water bottle, energy bars
- [If religious sites]: Scarf/shawl for covering head
- [If beaches]: Beach towel, flip-flops
- [If winter sports]: Appropriate gear

**🛡️ Safety & Comfort:**
- Photocopy of important documents
- Emergency contact list
- Small lock for bags
- Reusable water bottle
- Snacks for journey

📝 TRAVEL TIPS
[Important tips based on research data]

🔗 BOOKING RESOURCES
[Direct links to book the specific recommended hotels and transport]
```

Begin planning now!
"""
    return prompt


def create_replanning_prompt(trip_details: TripDetails, research_data: dict, shortfall: float) -> str:
    """
    Creates the master prompt for RE-PLANNING (budget is insufficient).
    This prompt guides the agent to proactively adjust the plan with encouragement.
    """
    people_text = "person" if trip_details.num_people == 1 else "people"
    
    prompt = f"""
Hey friend! 👋 I've looked at your travel plans, and I've got some good news and even better news!

**About Your Trip Idea:**
- Starting from: {trip_details.origin_city} (India)
- Dream destination: {trip_details.destination}
- Trip length: {trip_details.num_days} days
- Travel crew: {trip_details.num_people} Indian {people_text}
- Your TOTAL budget (for entire trip): ₹{trip_details.budget}
- Budget gap: ₹{shortfall}
- What you love: {trip_details.interests or 'Exploring new places'}
- Language preference: {trip_details.preferred_language or 'English'}

**The Good News:**
Your destination choice is AMAZING! {trip_details.destination} is incredible!

**The Even Better News:**
While your TOTAL budget of ₹{trip_details.budget} for the entire trip is about ₹{shortfall} short for the original {trip_details.num_days}-day plan, I'm going to help you make this trip happen!

**🚨 CRITICAL INSTRUCTION - READ CAREFULLY:**
The user's original destination was **{trip_details.destination}** but their budget was insufficient by ₹{shortfall}.

**IF THE USER NOW MENTIONS THEY CAN INCREASE THEIR BUDGET:**
1. **FIRST** check if the new increased budget is now sufficient for **{trip_details.destination}** (their original choice)
2. Calculate: Does (new budget) >= (original estimated cost)?
3. **IF YES**: Generate a FULL detailed plan for **{trip_details.destination}** (NOT alternate destinations!)
4. **IF NO**: Then proceed with alternate destination suggestions below

**IF THE USER DOES NOT MENTION BUDGET INCREASE:**
Proceed with the options below.

**IMPORTANT LANGUAGE INSTRUCTION:**
Generate the ENTIRE adjusted plan response in {trip_details.preferred_language or 'English'}. If the language is Hindi, Tamil, Telugu, Bengali, Marathi, or any other Indian language, translate ALL headings, descriptions, and explanations into that language.

**RESEARCH DATA:**
{research_data.get('minimum_budget', 'Not available')}

{research_data.get('travel_advisory', 'Not available')}

**YOUR MISSION:**
Provide the user with THREE clear options to make their trip work:

**OPTION 1: INCREASE BUDGET (RECOMMENDED)**
Show them exactly what they'd get with the recommended budget (current + shortfall):
- Keep the full {trip_details.num_days}-day experience
- Comfortable mid-range accommodations
- All desired activities included
- Peace of mind with buffer

**OPTION 2: MODIFY DESTINATION**
Suggest 3-4 alternative destinations that offer similar experiences but fit within ₹{trip_details.budget} for {trip_details.num_days} days:
- Research actual budget-friendly destinations suitable for Indian travelers
- Show full {trip_details.num_days}-day itineraries for each
- Include real pricing to prove it fits their budget (in ₹)
- Explain why each alternative is worth considering

**OPTION 3: ULTRA-BUDGET VERSION (LAST RESORT)**
Only if explicitly requested, show a heavily stripped-down version:
- Keep {trip_details.num_days} days but cut amenities drastically
- Dormitories/basic accommodations only
- Mostly free activities
- Local transport only
- Street food meals

**CRITICAL: "BEST-ONLY" DECISIVE RECOMMENDATIONS**
For each option, provide clear, confident choices:
- Recommend ONE best hotel/hostel per location with WHY it's the best value
- Choose ONE optimal transport option that balances cost and comfort
- Select ONE best activity per time slot with justification
- No overwhelming lists - give travelers clear, confident direction

**REQUIREMENTS:**
1. **Clear Communication**: Explain why the original budget is insufficient considering destination costs
2. **Positive Tone**: Frame the adjusted plan as an opportunity for authentic, value-focused travel
3. **Specific Recommendations**: Provide concrete alternatives with transport, food, and accommodation options
4. **Authentic Experiences**: Use find_authentic_local_food tool to find budget-friendly local eateries
5. **Budget Breakdown in INR**: Show exactly how the new plan fits the budget in Indian Rupees (₹)
6. **Day-by-Day Plan**: Still provide a detailed itinerary
7. **Money-Saving Tips**: Include destination-specific tips for Indian travelers (best time to book, local transport, etc.)

**TOOLS AVAILABLE:**
- find_travel_and_lodging_options: Find BUDGET hotels and accommodation options
- find_authentic_local_food: Find AUTHENTIC local eateries and street food (perfect for budget travel!)
- get_estimated_price: Get price estimates in INR
- get_booking_link: Get booking links for accommodation

**CRITICAL: "PLAN, THEN COST" METHODOLOGY - REAL-TIME PRICING REQUIRED**
Even for budget travel, research EVERY price in real-time:
1. Use find_travel_and_lodging_options to find actual budget hotel prices
2. Use get_estimated_price for EVERY flight/train ticket, meal, activity, transport
3. Include researched prices in ₹, NOT guesstimates
This ensures the adjusted plan truly fits within ₹{trip_details.budget}

**OUTPUT FORMAT:**
```
💡 YOUR {trip_details.destination} TRIP - BUDGET OPTIONS

⚠️ BUDGET REALITY CHECK
Your requested budget of ₹{trip_details.budget} for {trip_details.num_days} days is approximately ₹{shortfall} short of what's typically needed for {trip_details.destination}.

**🎯 REMEMBER: The user's FIRST CHOICE was {trip_details.destination}!**

**If they say they can increase their budget:** 
→ Calculate if new budget is sufficient for {trip_details.destination}
→ If YES: Create full plan for {trip_details.destination} (don't suggest alternatives!)
→ If NO: Then suggest alternatives

But don't worry! Here are THREE great options to make your trip happen:

═══════════════════════════════════════
🌟 OPTION 1: INCREASE BUDGET TO ₹{trip_details.budget + shortfall} (RECOMMENDED FOR {trip_details.destination.upper()})
═══════════════════════════════════════
**This lets you enjoy {trip_details.destination} properly!**

With ₹{trip_details.budget + shortfall} total budget, you can have:

**Recommended Total Budget: ₹{trip_details.budget + shortfall}**
(Your current: ₹{trip_details.budget} + Additional needed: ₹{shortfall})

**Why This Works Best:**
✅ Full {trip_details.num_days}-day experience as originally planned
✅ Comfortable mid-range accommodations
✅ All major attractions included
✅ Stress-free travel with buffer for emergencies
✅ Better food options and flexibility

**What You'll Get:**
[Provide brief overview of the full {trip_details.num_days}-day itinerary with this budget]

💰 **Quick Budget Breakdown:**
- Accommodation: ₹X ({trip_details.num_days} nights)
- Transport: ₹X
- Activities: ₹X
- Meals: ₹X
- Miscellaneous & Buffer: ₹X
**Total: ₹{trip_details.budget + shortfall}**

═══════════════════════════════════════
🎯 OPTION 2: ALTERNATIVE DESTINATIONS (SAME BUDGET, SAME {trip_details.num_days} DAYS)
═══════════════════════════════════════

Here are destinations offering similar experiences that fit your ₹{trip_details.budget} budget for the full {trip_details.num_days} days:

**Alternative 1: [Destination Name]**
**Why Consider:** [Similar landscape/culture/activities to {trip_details.destination} but more affordable]
**Budget Fit:** Total estimated cost: ₹X (within your ₹{trip_details.budget})
**Highlights:**
- [Key attraction 1]
- [Key attraction 2]
- [Key attraction 3]
**Quick {trip_details.num_days}-Day Overview:**
Day 1: [Brief overview]
Day 2: [Brief overview]
Day 3: [Brief overview]
[Continue for all days]

**Alternative 2: [Destination Name]**
[Same format as Alternative 1]

**Alternative 3: [Destination Name]**
[Same format as Alternative 1]

═══════════════════════════════════════
💪 OPTION 3: ULTRA-BUDGET {trip_details.destination} ({trip_details.num_days} DAYS)
═══════════════════════════════════════

**Warning:** This is a very basic, backpacker-style trip with minimal amenities.

**What to Expect:**
- Dormitory accommodations or basic guesthouses
- Local buses and shared transport only
- Mostly free attractions and walking tours
- Street food and budget meals only
- Limited flexibility and comfort

**Estimated Cost: ₹{trip_details.budget}**

**Day-by-Day Ultra-Budget Plan:**
[Provide detailed itinerary with all the cost-cutting measures]

💰 **Detailed Budget Breakdown:**
[Show exact breakdown proving it fits ₹{trip_details.budget}]

═══════════════════════════════════════
� OUR RECOMMENDATION
═══════════════════════════════════════

We strongly recommend **OPTION 1** (increasing budget to ₹{trip_details.budget + shortfall}) or **OPTION 2** (choosing an alternative destination). Option 3 exists but may compromise your travel experience significantly.

Which option interests you most? Let me know and I can provide a full detailed itinerary!
```

**📋 Essential Documents:**
- ID proof (Aadhaar/Passport)
- Permits if needed
- Booking confirmations (saved on phone to save printing costs)

**👕 Clothing (Weather-Appropriate):**
[Based on destination weather & budget travel needs]
- Comfortable walking clothes
- Weather-specific items (warm/cool/rain gear)
- Modest clothing for temples/religious sites
- Quick-dry fabrics (useful for budget hostels with limited laundry)

**💊 Health Essentials:**
- Basic medicines (paracetamol, ORS)
- Hand sanitizer
- Personal hygiene items

**🔌 Minimal Electronics:**
- Phone & charger
- Power bank (essential for budget travel)

**💰 Money:**
- Cash in small denominations for street food/local transport
- UPI apps activated

**🎯 Budget Travel Specific:**
- Reusable water bottle (save on buying bottled water)
- Snacks for long bus/train journeys
- Small towel (some budget hostels don't provide)
- Padlock for hostel lockers
- Wet wipes (budget places may have limited facilities)

✨ WHY THIS PLAN WORKS
[Explain the benefits of the adjusted approach and why alternative destinations might offer better value]

💰 MONEY-SAVING INDIA TIPS
[Include bargaining tips, advance booking discounts, local SIM cards, off-season travel]

🔗 BOOKING RESOURCES
[Links to budget accommodations]
```

Begin re-planning now!
"""
    return prompt


# ============================================================================
# MAIN ORCHESTRATOR ENDPOINT
# ============================================================================

@app.post("/api/plan-trip-from-prompt", response_model=TripResponse)
async def plan_trip_from_prompt(
    request: TripRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Intelligent conversational endpoint that can:
    1. Handle trip planning requests
    2. Answer questions about destinations
    3. Provide travel advice
    4. Handle clarifications and follow-ups
    5. Have natural conversations
    
    Authentication is REQUIRED.
    """
    try:
        print(f"📝 Received request from user: {current_user.email}")
        print(f"📝 Prompt: {request.prompt}")
        
        # ====================================================================
        # STEP 0: DETERMINE INTENT (Trip Planning vs Conversation)
        # ====================================================================
        intent_llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0.3,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        intent_check_prompt = f"""
Analyze this user message and determine what they want:

User message: "{request.prompt}"

Classify as ONE of these:
- "TRIP_PLANNING" if provides trip details (destination + any of: days/budget/origin) OR clearly wants an itinerary
- "MODIFICATION_REQUEST" if asking to modify a plan (e.g., "use whole budget", "upgrade", "more activities") WITHOUT complete trip details
- "DESTINATION_INQUIRY" if asking about a place but might want to plan a trip (e.g., "tell me about Kashmir", "what's good in Goa")
- "RECOMMENDATION" if asking for suggestions (e.g., "where should I go?", "suggest a beach destination", "best hill stations")
- "ADVICE" if asking travel advice (e.g., "what to pack", "best time to visit", "safety tips")
- "GREETING" if simple greeting, thanks, or social message
- "OTHER" if cannot determine or very generic question

**Examples:**
- "5 day Goa trip" → TRIP_PLANNING
- "Plan Kashmir trip from Delhi 50000 budget" → TRIP_PLANNING
- "Use whole budget make it luxury" → MODIFICATION_REQUEST
- "Tell me about Kerala" → DESTINATION_INQUIRY
- "What are the best beaches in India?" → RECOMMENDATION
- "Where should I go for adventure?" → RECOMMENDATION
- "Best time to visit Ladakh?" → ADVICE
- "What to pack for Manali?" → ADVICE
- "Hello" / "Thanks" → GREETING

Respond with ONLY ONE WORD: TRIP_PLANNING, MODIFICATION_REQUEST, DESTINATION_INQUIRY, RECOMMENDATION, ADVICE, GREETING, or OTHER
"""
        
        intent_response = intent_llm.invoke(intent_check_prompt)
        intent = intent_response.content.strip().upper()
        
        print(f"🎯 Intent detected: {intent}")
        
        # ====================================================================
        # HANDLE ANY TYPE OF PROMPT WITH SMART RESPONSES
        # ====================================================================
        
        # Initialize conversational LLM for flexible responses
        smart_llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0.7,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # ====================================================================
        # HANDLE GREETINGS
        # ====================================================================
        if intent == "GREETING":
            greeting_response = smart_llm.invoke(f"""
User said: "{request.prompt}"

Respond warmly and briefly, then invite them to plan a trip.

Example responses:
- "Hello" → "Hi there! 👋 I'm your AI travel assistant. Ready to plan an amazing trip? Just tell me where you want to go, how many days, your budget, and I'll create the perfect itinerary!"
- "Thanks" → "You're welcome! 😊 Need help planning another trip? I'm here whenever you need!"
- "Hey" → "Hey! 🌍 Where would you like to travel? Share your destination, dates, and budget, and I'll plan something incredible!"

Keep it under 2 sentences, warm tone, end with trip planning invitation.
""")
            
            return TripResponse(
                success=True,
                message="Greeting",
                trip_plan=greeting_response.content.strip(),
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # HANDLE DESTINATION INQUIRIES
        # ====================================================================
        if intent == "DESTINATION_INQUIRY":
            destination_response = smart_llm.invoke(f"""
User asked: "{request.prompt}"

You're a knowledgeable India travel expert. Provide a helpful, engaging 3-4 sentence answer about the destination they're asking about. Include:
- Key highlights (beaches, mountains, culture, food, etc.)
- Best time to visit (briefly)
- Who it's perfect for (families, couples, adventure seekers, etc.)

Then ALWAYS end with: "Want me to plan a trip there? Just share: your origin city, number of days, group size, and total budget!"

Keep the tone enthusiastic and informative. Make them excited about the place!
""")
            
            return TripResponse(
                success=True,
                message="Destination information",
                trip_plan=destination_response.content.strip(),
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # HANDLE RECOMMENDATIONS
        # ====================================================================
        if intent == "RECOMMENDATION":
            recommendation_response = smart_llm.invoke(f"""
User asked: "{request.prompt}"

Provide 3-4 excellent destination recommendations that match their request. For EACH destination, include:
- **Destination Name:** Brief 1-sentence description
- Why it's great for their request
- Best for: (season/duration/budget)

Format like this:
**Top Recommendations:**

**1. [Destination]** - [One sentence description]
• Perfect for: [Why it matches their request]
• Best time: [Season]
• Ideal duration: [Days]

[Repeat for 2-3 more destinations]

**Ready to plan?** Pick a destination and tell me: your origin city, number of days, travelers, and budget!

Be enthusiastic, specific, and helpful!
""")
            
            return TripResponse(
                success=True,
                message="Travel recommendations",
                trip_plan=recommendation_response.content.strip(),
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # HANDLE TRAVEL ADVICE
        # ====================================================================
        if intent == "ADVICE":
            advice_response = smart_llm.invoke(f"""
User asked: "{request.prompt}"

Provide practical, helpful travel advice. Be concise (4-5 bullet points), specific, and actionable.

Format like this:
**[Topic - e.g., "Packing for Manali" or "Best Time to Visit Ladakh"]:**

• [Advice point 1]
• [Advice point 2]
• [Advice point 3]
• [Advice point 4]

💡 **Pro tip:** [One insider tip]

Then end with: "Planning a trip? Share your destination, dates, origin city, and budget - I'll create the perfect itinerary!"

Be practical and genuinely helpful!
""")
            
            return TripResponse(
                success=True,
                message="Travel advice",
                trip_plan=advice_response.content.strip(),
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # HANDLE OTHER/UNKNOWN PROMPTS
        # ====================================================================
        if intent == "OTHER":
            other_response = smart_llm.invoke(f"""
User said: "{request.prompt}"

This is unclear or doesn't fit typical trip planning queries. Respond helpfully:

1. If it seems travel-related but vague: Gently ask for clarification
2. If completely off-topic: Politely redirect to trip planning
3. If it's a complex question: Break it down and answer what you can

Always end with: "I'm here to help you plan amazing trips across India! Just tell me your destination, origin city, dates, travelers, and budget."

Be friendly, not robotic. Show you're trying to understand.
""")
            
            return TripResponse(
                success=True,
                message="General response",
                trip_plan=other_response.content.strip(),
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # HANDLE MODIFICATION REQUESTS (without complete trip details)
        # ====================================================================
        if intent == "MODIFICATION_REQUEST":
            return TripResponse(
                success=False,
                message="Cannot modify plan without context",
                trip_plan="""I understand you want to modify or upgrade your trip plan, but I need the complete trip details to help you properly.

Since each message is independent, please provide the full details again with your modification request:

**Please include:**
• Origin city
• Destination  
• Number of days
• Number of travelers
• Total budget (including your request like "use full 80000 budget")
• Interests/preferences

**Example:** "7 day trip to Kerala from Mumbai for 2 people with 80000 budget - use the entire budget for luxury experience"

This way I can create an upgraded plan that fully utilizes your budget! 💎""",
                trip_id=None,
                extracted_details=None
            )
        
        # ====================================================================
        # STEP 1: EXTRACT TRIP DETAILS (for TRIP_PLANNING intent)
        # ====================================================================
        print("🔍 STEP 1: Extracting trip details from prompt...")
        
        # Check if we have previous extraction context
        previous_details = None
        context_text = ""
        if request.previous_extraction:
            previous_details = request.previous_extraction
            print(f"📋 Found previous extraction: {previous_details}")
            context_text = f"""

**IMPORTANT - CONVERSATION CONTINUITY:**
The user previously provided some trip information but it was incomplete. Here's what we already know:
- Origin: {previous_details.get('origin_city', 'Not specified')}
- Destination: {previous_details.get('destination', 'Not specified')}
- Days: {previous_details.get('num_days', 0)}
- People: {previous_details.get('num_people', 1)}
- Budget: ₹{previous_details.get('budget', 0)}
- Interests: {previous_details.get('interests', 'None specified')}

The user's new message "{request.prompt}" is providing ADDITIONAL information. You should:
1. Extract any NEW details from this message
2. Keep the EXISTING details that were already provided
3. Only update fields that are explicitly mentioned in the new message

For example, if the user already said destination is "Paris" but now says "from Mumbai", keep destination="Paris" and update origin_city="Mumbai".
"""
        
        extractor_llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        ).with_structured_output(TripDetails)
        
        extraction_prompt = f"""
You are a friendly travel assistant helping someone plan their trip. Extract trip details from their message:

USER MESSAGE: "{request.prompt}"
{context_text}

**CRITICAL - CONVERSATION CONTEXT AWARENESS:**
{f"This is a FOLLOW-UP message. The user is providing MISSING information that we asked for." if request.previous_extraction else "This is a NEW trip planning request."}

**EXTRACTION GUIDELINES:**
Be smart and conversational in understanding:

{"**SPECIAL RULE FOR FOLLOW-UP MESSAGES:**" if request.previous_extraction else ""}
{"If the user's message is SHORT (1-5 words) or provides ONLY ONE piece of information (like 'from Mumbai', '5 days', '50000 rupees'), it means they are ANSWERING a specific question we asked. In this case:" if request.previous_extraction else ""}
{"- Extract ONLY the new information provided" if request.previous_extraction else ""}
{"- Keep ALL existing values unchanged" if request.previous_extraction else ""}
{"- DO NOT set anything to 'Not specified' or 0 if it was already provided" if request.previous_extraction else ""}
{"- Example: User already said 'Goa trip' (destination=Goa), now says 'from Mumbai' → Keep destination='Goa', update origin_city='Mumbai'" if request.previous_extraction else ""}
{""  if request.previous_extraction else ""}

1. **Origin City**: Where they're traveling FROM
   - Look for: "from [city]", "leaving from", "starting in", "I'm in [city]"
   - If not mentioned: Use "Not specified" (we'll ask them)

2. **Destination**: Where they want to GO
   - Look for: "to [place]", "visit [place]", "trip to", "go to", "[place] trip"
   - Examples: "Goa trip" → destination is "Goa", "visiting Kerala" → "Kerala"
   - If vague like "hill station near Bengaluru", you can suggest specific: "Coorg or Ooty"

3. **Duration (num_days)**: How long the trip is
   - Look for: "X days", "weekend" (2-3 days), "week" (7 days), "X nights" (add 1 for days)
   - "weekend trip" → 2 or 3 days
   - "quick trip" → 2-3 days
   - If not mentioned: Use 0 (we'll ask)

4. **Number of People (num_people)**: Who's traveling
   - Look for: "family of X", "X people", "couple" (2), "solo" (1), "me and my friend" (2)
   - "family of 4" → 4 people
   - "my family" → 4 (assume typical family)
   - If not mentioned: Use 1

5. **Budget**: Total trip budget in ₹
   - Look for: "₹X", "X rupees", "cheap" (₹15,000-25,000), "budget" (₹20,000-40,000), "luxury" (₹80,000+)
   - "cheap" → estimate ₹20,000 for weekend, ₹40,000 for week
   - "budget-friendly" → similar to cheap
   - "comfortable" → ₹50,000-70,000
   - If not mentioned: Use 0 (we'll ask)

6. **Start Date (start_date)**: When the trip starts
   - Look for: specific dates ("December 15", "15th Dec", "15/12/2025"), relative dates ("next week", "next month", "this weekend")
   - "next week" → calculate date for next week (add 7 days from today)
   - "next month" → first week of next month
   - "this weekend" → upcoming Saturday
   - "December" → first week of December (if year not mentioned, use 2025)
    - TODAY'S DATE for reference: {__import__('datetime').datetime.now().strftime('%Y-%m-%d')} ({__import__('datetime').datetime.now().strftime('%B %d, %Y')})
   - Format output as: YYYY-MM-DD (e.g., "2025-12-15")
   - If not mentioned: Use None

7. **Interests**: What they want to do/see
   - Look for: "adventure", "beaches", "culture", "food", "religious", "nature", "shopping", "party"
   - Extract any mentioned preferences

8. **Language**: What language did they write in?
   - Detect: English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, etc.
   - Default: English

**HUMAN-FRIENDLY UNDERSTANDING (English):**
- "a cheap weekend trip for my family of 4 to a hill station near Bengaluru next month"
  → origin: "Bengaluru", destination: "Coorg or Ooty", days: 2-3, people: 4, budget: ₹25000, start_date: "2025-12-07", interests: "hill station, nature"

- "5 day Goa trip from Mumbai starting December 20"
  → origin: "Mumbai", destination: "Goa", days: 5, people: 1, budget: 0, start_date: "2025-12-20", interests: None

- "I want to visit Kerala for a week with my wife next week, we love beaches and food"
    → origin: "Not specified", destination: "Kerala", days: 7, people: 2, budget: 0, start_date: "next week", interests: "beaches, food"

**HINDI LANGUAGE UNDERSTANDING:**
- "mujhe delhi ghumne jana hai mumbai se 5 din ke liye budget 60000 hai aur 2 log hai agla mahina"
  → origin: "Mumbai" (mumbai se = from Mumbai)
  → destination: "Delhi" (delhi ghumne = to visit Delhi)
  → days: 5 (5 din = 5 days)
  → people: 2 (2 log = 2 people)
  → budget: 60000 (budget 60000 hai)
  → start_date: "2025-12-07" (agla mahina = next month)
  → language: "Hindi"

- "goa jaana hai 3 din ke liye 15 december se, budget 30000"
  → origin: "Not specified"
  → destination: "Goa" (goa jaana hai = want to go to Goa)
  → days: 3 (3 din = 3 days)
  → budget: 30000
  → start_date: "2025-12-15" (15 december se = from 15th December)
  → language: "Hindi"

**KEY HINDI PHRASES TO RECOGNIZE:**
- "ghumne jana" / "jaana hai" = want to go/visit
- "[city] se" = from [city]
- "X din ke liye" = for X days
- "X log" = X people
- "budget X hai" = budget is X

Now extract from the user's message above. Fill in what you can infer, use sensible defaults, and mark unknowns appropriately.
"""
        
        try:
            trip_details = extractor_llm.invoke(extraction_prompt)
            print(f"✅ Extracted: {trip_details}")
        except Exception as e:
            # Log and return a friendly response to avoid 500 errors
            import traceback
            print(f"⚠️ Extraction LLM failed: {e}")
            traceback.print_exc()
            return TripResponse(
                success=False,
                message="Extraction failed",
                trip_plan="Sorry — I couldn't understand that. Could you rephrase or provide origin, destination, days, people and budget?",
                trip_id=None,
                extracted_details=None
            )
        
        # Merge with previous extraction if available
        if request.previous_extraction:
            print("🔄 Merging with previous extraction...")
            print(f"   New extraction: {trip_details}")
            
            # Only update fields that are NOT "Not specified" or 0 in new extraction
            if trip_details.origin_city.lower() in ["not specified", "unknown", "n/a", ""] and request.previous_extraction.get('origin_city'):
                trip_details.origin_city = request.previous_extraction.get('origin_city')
                print(f"  ✓ Kept origin_city: {trip_details.origin_city}")
            else:
                print(f"  ✓ Updated/kept origin_city: {trip_details.origin_city}")
            
            if trip_details.destination.lower() in ["not specified", "unknown", "n/a", ""] and request.previous_extraction.get('destination'):
                trip_details.destination = request.previous_extraction.get('destination')
                print(f"  ✓ Kept destination: {trip_details.destination}")
            else:
                print(f"  ✓ Updated/kept destination: {trip_details.destination}")
            
            if (not trip_details.num_days or trip_details.num_days <= 0) and request.previous_extraction.get('num_days'):
                trip_details.num_days = request.previous_extraction.get('num_days')
                print(f"  ✓ Kept num_days: {trip_details.num_days}")
            else:
                print(f"  ✓ Updated/kept num_days: {trip_details.num_days}")
            
            if (not trip_details.num_people or trip_details.num_people <= 0) and request.previous_extraction.get('num_people'):
                trip_details.num_people = request.previous_extraction.get('num_people')
                print(f"  ✓ Kept num_people: {trip_details.num_people}")
            else:
                print(f"  ✓ Updated/kept num_people: {trip_details.num_people}")
            
            if (not trip_details.budget or trip_details.budget <= 0) and request.previous_extraction.get('budget'):
                # OLD budget from previous extraction
                old_budget = request.previous_extraction.get('budget')
                trip_details.budget = old_budget
                print(f"  ✓ Kept budget: {trip_details.budget}")
            elif trip_details.budget and trip_details.budget > 0 and request.previous_extraction.get('budget'):
                # NEW budget provided - this is a budget UPDATE scenario
                old_budget = request.previous_extraction.get('budget')
                new_budget = trip_details.budget
                if new_budget > old_budget:
                    print(f"  💰 BUDGET INCREASED: {old_budget} → {new_budget}")
                    print(f"  🔄 Will re-check if new budget is sufficient for ORIGINAL destination")
                    
                    # Check if there's an original_destination stored (from insufficient budget scenario)
                    if request.previous_extraction.get('original_destination'):
                        original_dest = request.previous_extraction.get('original_destination')
                        print(f"  🎯 RESTORING ORIGINAL DESTINATION: {original_dest}")
                        print(f"     (Previous suggested alternative was: {trip_details.destination})")
                        trip_details.destination = original_dest
                    
                    # Budget increased - we'll use the new budget and re-validate
                else:
                    print(f"  💰 Budget changed: {old_budget} → {new_budget}")
            else:
                print(f"  ✓ Updated/kept budget: {trip_details.budget}")
            
            if not trip_details.interests and request.previous_extraction.get('interests'):
                trip_details.interests = request.previous_extraction.get('interests')
                print(f"  ✓ Kept interests: {trip_details.interests}")
            else:
                print(f"  ✓ Updated/kept interests: {trip_details.interests}")
            
            if not trip_details.start_date and request.previous_extraction.get('start_date'):
                trip_details.start_date = request.previous_extraction.get('start_date')
                print(f"  ✓ Kept start_date: {trip_details.start_date}")
            else:
                print(f"  ✓ Updated/kept start_date: {trip_details.start_date}")
            
            print(f"🔄 After merge: {trip_details}")
        
        # ====================================================================
        # VALIDATE REQUIRED FIELDS - BE CONVERSATIONAL!
        # ====================================================================
        missing_fields = []
        follow_up_questions = []
        
        # Check origin
        print(f"🔍 DEBUG: origin_city = '{trip_details.origin_city}'")
        print(f"🔍 DEBUG: origin_city.lower() = '{trip_details.origin_city.lower() if trip_details.origin_city else 'None'}'")
        print(f"🔍 DEBUG: Is in list? {trip_details.origin_city.lower() in ['not specified', 'unknown', 'n/a', '', 'anywhere'] if trip_details.origin_city else False}")
        
        if not trip_details.origin_city or trip_details.origin_city.lower() in ["not specified", "unknown", "n/a", "", "anywhere"]:
            missing_fields.append("origin city")
            follow_up_questions.append("**Where are you traveling from?** (e.g., Delhi, Mumbai, Bangalore)")
            print("🔍 DEBUG: Added 'origin city' to missing_fields")
        
        # Check destination
        if not trip_details.destination or trip_details.destination.lower() in ["not specified", "unknown", "n/a", "", "anywhere"]:
            missing_fields.append("destination")
            follow_up_questions.append("**Where would you like to go?** (e.g., Goa, Kashmir, Kerala)")
            print("🔍 DEBUG: Added 'destination' to missing_fields")
        
        # Check number of days
        if not trip_details.num_days or trip_details.num_days <= 0:
            missing_fields.append("duration")
            follow_up_questions.append("**How many days?** (e.g., weekend trip, 5 days, a week)")
            print("🔍 DEBUG: Added 'duration' to missing_fields")
        
        # Check budget
        if not trip_details.budget or trip_details.budget <= 0:
            missing_fields.append("budget")
            follow_up_questions.append("**What's your total budget?** (e.g., ₹50,000, budget-friendly, comfortable)")
            print("🔍 DEBUG: Added 'budget' to missing_fields")
        
        # Check start date (optional but helpful)
        if not trip_details.start_date:
            missing_fields.append("start date")
            follow_up_questions.append("**When do you want to start your trip?** (e.g., December 25, next week, 15/12/2025)")
            print("🔍 DEBUG: Added 'start date' to missing_fields")
        
        print(f"🔍 DEBUG: Total missing_fields = {missing_fields}")
        
        # If any required fields are missing, respond conversationally
        if missing_fields:
            print(f"🚨 VALIDATION FAILED: Returning 'Need more information' response")
            # Create a friendly response
            current_info = []
            if trip_details.origin_city and trip_details.origin_city.lower() not in ["not specified", "unknown", "n/a"]:
                current_info.append(f"✓ From: {trip_details.origin_city}")
            if trip_details.destination and trip_details.destination.lower() not in ["not specified", "unknown", "n/a"]:
                current_info.append(f"✓ To: {trip_details.destination}")
            if trip_details.num_days and trip_details.num_days > 0:
                current_info.append(f"✓ Duration: {trip_details.num_days} days")
            if trip_details.num_people and trip_details.num_people > 0:
                current_info.append(f"✓ Travelers: {trip_details.num_people} people")
            if trip_details.budget and trip_details.budget > 0:
                current_info.append(f"✓ Budget: ₹{trip_details.budget}")
            if trip_details.start_date:
                current_info.append(f"✓ Start Date: {trip_details.start_date}")
            
            response_text = "Great! I'm getting a sense of your trip. Let me gather a few more details:\n\n"
            
            if current_info:
                response_text += "**What I know so far:**\n" + "\n".join(current_info) + "\n\n"
            
            response_text += "**I still need:**\n" + "\n".join(follow_up_questions)
            response_text += "\n\n💡 *You can answer all at once or one by one - whatever's easier for you!*"
            
            return TripResponse(
                success=False,
                message="Need more information",
                trip_plan=response_text,
                extracted_details=trip_details.model_dump()
            )
        
        # ====================================================================
        # STEP 2: RESEARCH PHASE - Get Real-Time Data (CACHED + PARALLEL)
        # ====================================================================
        print("\n🔬 STEP 2: Conducting destination research with real-time data...")
        
        # Check cache first
        cached_research = get_cached_research(trip_details.destination)
        
        if cached_research:
            research_data = cached_research
        else:
            # Import the weather tool
            from agent_logic import get_realtime_weather
            import asyncio
            from concurrent.futures import ThreadPoolExecutor
            
            # Run research calls in parallel for faster response
            def run_research_parallel():
                with ThreadPoolExecutor(max_workers=4) as executor:
                    future_budget = executor.submit(get_minimum_daily_budget.invoke, {"city": trip_details.destination})
                    future_advisory = executor.submit(get_travel_advisory.invoke, {"city": trip_details.destination})
                    future_weather = executor.submit(get_realtime_weather.invoke, {"city": trip_details.destination})
                    future_docs = executor.submit(get_travel_document_info.invoke, {"destination": trip_details.destination})
                    
                    return {
                        "minimum_budget": future_budget.result(),
                        "travel_advisory": future_advisory.result(),
                        "weather": future_weather.result(),
                        "document_info": future_docs.result()
                    }
            
            research_data = run_research_parallel()
            cache_research(trip_details.destination, research_data)
            print("✅ Research completed with real-time weather and alerts (parallel execution)")
        
        
        # ====================================================================
        # STEP 3: VALIDATE BUDGET & CLASSIFY TIER (Dynamic Feasibility Check)
        # ====================================================================
        print("\n💰 STEP 3: Dynamic Feasibility Check - Validating budget sufficiency...")
        
        # Check if this is a budget update scenario
        budget_was_increased = False
        if request.previous_extraction and request.previous_extraction.get('budget'):
            old_budget = request.previous_extraction.get('budget')
            if trip_details.budget > old_budget:
                budget_was_increased = True
                print(f"\n💰 BUDGET UPDATE DETECTED!")
                print(f"   Old budget: ₹{old_budget}")
                print(f"   New budget: ₹{trip_details.budget}")
                print(f"   Increase: ₹{trip_details.budget - old_budget}")
                print(f"   🎯 Re-validating for ORIGINAL destination: {trip_details.destination}")
        
        # Extract minimum daily budget from research data using the enhanced tool output
        try:
            estimated_min_daily = 2500  # Default fallback for India
            
            # The get_minimum_daily_budget tool now returns text with "EXTRACTED MINIMUM: ₹{amount}"
            budget_info = research_data.get('minimum_budget', '')
            if budget_info:
                import re
                # Look for the extracted minimum pattern
                extracted_match = re.search(r'EXTRACTED MINIMUM:\s*₹\s*(\d+)', budget_info)
                if extracted_match:
                    estimated_min_daily = int(extracted_match.group(1))
                    print(f"✅ Extracted minimum daily budget from AI analysis: ₹{estimated_min_daily}")
                else:
                    # Fallback: Try to parse any rupee amounts found
                    rupee_matches = re.findall(r'[₹Rs\.]\s*(\d{1,5})', budget_info)
                    dollar_matches = re.findall(r'\$\s*(\d{1,4})', budget_info)
                    
                    if rupee_matches:
                        amounts = [int(m) for m in rupee_matches if 1000 <= int(m) <= 15000]
                        if amounts:
                            estimated_min_daily = min(amounts)  # Use minimum amount found
                            print(f"📊 Extracted minimum daily budget from search results: ₹{estimated_min_daily}")
                    elif dollar_matches:
                        amounts = [int(m) * 83 for m in dollar_matches if 10 <= int(m) <= 200]
                        if amounts:
                            estimated_min_daily = min(amounts)
                            print(f"📊 Extracted minimum daily budget: ₹{estimated_min_daily} (converted from USD)")
            
            if estimated_min_daily == 2500:
                print(f"📊 Using default minimum daily budget: ₹{estimated_min_daily}")
            
            # === ESTIMATE ROUND-TRIP TRANSPORTATION COST ===
            # This is crucial - budget check must include journey to/from destination!
            from agent_logic import estimate_transport_cost
            try:
                transport_cost_total = estimate_transport_cost(
                    origin=trip_details.origin_city,
                    destination=trip_details.destination,
                    num_people=trip_details.num_people
                )
                print(f"✈️ Estimated round-trip transport cost ({trip_details.origin_city} ↔️ {trip_details.destination}): ₹{transport_cost_total}")
            except Exception as e:
                # Fallback estimate based on distance categories
                print(f"⚠️ Could not estimate exact transport cost: {e}")
                print(f"   Using category-based estimate...")
                transport_cost_total = estimate_transport_fallback(
                    trip_details.origin_city, 
                    trip_details.destination,
                    trip_details.num_people
                )
                print(f"✈️ Estimated round-trip transport cost (fallback): ₹{transport_cost_total}")
            
            # === CRITICAL: Pure Python Calculation (No AI) ===
            # Calculate user's daily per person budget
            user_daily_per_person = trip_details.budget / trip_details.num_people / trip_details.num_days
            
            # Calculate total minimum required with 20% buffer
            # INCLUDES: (daily costs × days × people) + round-trip transport
            estimated_min_total = (estimated_min_daily * trip_details.num_days * trip_details.num_people * 1.2) + transport_cost_total
            
            # Simple if statement comparison
            is_budget_sufficient = trip_details.budget >= estimated_min_total
            shortfall = estimated_min_total - trip_details.budget if not is_budget_sufficient else 0
            
            print(f"\n📊 Dynamic Feasibility Check Results:")
            print(f"   🔍 Researched minimum (per person/day): ₹{estimated_min_daily}")
            print(f"   ✈️ Round-trip transport cost: ₹{transport_cost_total}")
            print(f"   👤 User's budget (per person/day): ₹{user_daily_per_person:.0f}")
            print(f"   📅 Trip duration: {trip_details.num_days} days")
            print(f"   👥 Number of travelers: {trip_details.num_people}")
            print(f"   💵 Total user budget: ₹{trip_details.budget}")
            print(f"   📊 Minimum required (daily + transport + 20% buffer): ₹{estimated_min_total:.0f}")
            print(f"   ✅ Budget sufficient: {is_budget_sufficient}")
            
            if not is_budget_sufficient:
                print(f"   ⚠️ Shortfall: ₹{shortfall:.0f}")
                print(f"   💡 User needs ₹{user_daily_per_person:.0f}/person/day but minimum is ₹{estimated_min_daily}")
            else:
                surplus = trip_details.budget - estimated_min_total
                print(f"   ✅ Surplus: ₹{surplus:.0f}")
                print(f"   💰 User has ₹{user_daily_per_person:.0f}/person/day vs minimum ₹{estimated_min_daily}")
            
            # Determine budget tier based on how much above minimum the user is
            daily_per_person = user_daily_per_person
            
            # Dynamic tier classification based on minimum budget
            if daily_per_person < estimated_min_daily * 1.3:
                budget_tier = "budget-friendly"
                tier_description = "Budget backpacker style - hostels, street food, public transport"
            elif daily_per_person < estimated_min_daily * 2.5:
                budget_tier = "moderate"
                tier_description = "Comfortable mid-range - 3-star hotels, good restaurants, mix of transport"
            else:
                budget_tier = "luxury"
                tier_description = "Premium experience - 4-5 star hotels, fine dining, private transport"
            
            print(f"\n� Budget Tier Classification:")
            print(f"   Tier: {budget_tier.upper()}")
            print(f"   Description: {tier_description}")
            print(f"   Ratio to minimum: {daily_per_person / estimated_min_daily:.1f}x")

            
        except Exception as e:
            print(f"⚠️ Budget validation error: {e}, proceeding with standard plan")
            is_budget_sufficient = True
            shortfall = 0
            budget_tier = "moderate"
            tier_description = "Standard comfortable experience"
        
        # ====================================================================
        # STEP 4: ASSIGN MISSION
        # ====================================================================
        print("\n📋 STEP 4: Assigning mission to planning agent...")
        
        # Fetch user preferences for personalization
        user_preferences = None
        try:
            if firestore_service.db is not None:
                profile = firestore_service.get_user_profile(user_id=current_user.uid)
                if profile and (profile.get("preferences") or profile.get("learned_preferences")):
                    user_preferences = profile
                    print(f"✅ Loaded user preferences for personalization")
                    if profile.get("preferences"):
                        prefs = profile["preferences"]
                        if prefs.get("interests"):
                            print(f"   - Interests: {', '.join(prefs['interests'])}")
                        if prefs.get("travel_style"):
                            print(f"   - Style: {', '.join(prefs['travel_style'])}")
                    if profile.get("learned_preferences"):
                        learned = profile["learned_preferences"]
                        if learned.get("spending_pattern"):
                            print(f"   - Learned Pattern: {learned['spending_pattern']}")
            else:
                print("⚠️  Firestore not available - skipping preference loading")
        except Exception as e:
            print(f"⚠️ Could not load preferences (will use defaults): {str(e)}")
        
        if is_budget_sufficient:
            print(f"✅ Budget is sufficient - Using STANDARD planning prompt ({budget_tier.upper()} tier)")
            master_prompt = create_standard_planning_prompt(
                trip_details, 
                research_data, 
                budget_tier, 
                tier_description,
                user_preferences
            )
        else:
            print(f"⚠️ Budget insufficient by ₹{shortfall} - Using RE-PLANNING prompt")
            master_prompt = create_replanning_prompt(trip_details, research_data, shortfall)
        
        # ====================================================================
        # STEP 5: EXECUTE WITH REACT AGENT (OPTIMIZED)
        # ====================================================================
        print("\n🤖 STEP 5: Executing planning with ReAct agent (optimized)...")
        
        # Create ReAct agent with planning tools - OPTIMIZED FOR SPEED
        llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.0-flash-exp",  # Faster model
            temperature=0.9,  # Higher creativity for engaging responses
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            max_output_tokens=8192,  # Increased for comprehensive detailed plans
            timeout=90  # Increased timeout for thorough planning
        )
        
        # Create LangGraph React agent (without state_modifier - not supported in newer versions)
        agent_executor = create_react_agent(
            llm,
            PLANNING_TOOLS
        )
        
        # Execute agent with master prompt and recursion limit
        print("⚡ Generating plan (fast mode)...")
        result = agent_executor.invoke(
            {"messages": [("user", master_prompt)]},
            {"recursion_limit": 20}  # Increased for thorough research and planning
        )
        
        # Extract the final message content
        if result.get("messages"):
            last_message = result["messages"][-1]
            # Handle different content formats
            if isinstance(last_message.content, str):
                final_plan = last_message.content
            elif isinstance(last_message.content, list):
                # Extract text from content blocks
                text_parts = []
                for block in last_message.content:
                    if isinstance(block, dict) and block.get('type') == 'text':
                        text_parts.append(block.get('text', ''))
                    elif isinstance(block, str):
                        text_parts.append(block)
                final_plan = '\n'.join(text_parts)
            else:
                final_plan = str(last_message.content)
        else:
            final_plan = "Unable to generate plan"
        
        print("\n✅ Planning completed successfully!")
        
        # ====================================================================
        # SAVE TO FIRESTORE (user is authenticated)
        # ====================================================================
        trip_id = None
        try:
            if firestore_service.db is None:
                print("⚠️  Firestore not available - skipping trip save")
                print("   Please configure firebase-credentials.json to enable trip saving")
            else:
                print(f"\n💾 Saving trip plan to Firestore for user: {current_user.email}")
                
                # Calculate trip dates
                from datetime import datetime, timedelta
                if trip_details.start_date:
                    try:
                        start_date = datetime.fromisoformat(trip_details.start_date) if isinstance(trip_details.start_date, str) else trip_details.start_date
                    except:
                        start_date = datetime.now()
                else:
                    start_date = datetime.now()
                
                end_date = start_date + timedelta(days=trip_details.num_days)
                
                # Extract budget breakdown from the trip plan
                budget_breakdown = extract_budget_breakdown(final_plan, trip_details.budget)
                
                trip_id = firestore_service.save_trip_plan(
                    user_id=current_user.uid,
                    trip_data={
                        "title": f"{trip_details.num_days}-Day Trip to {trip_details.destination}",
                        "origin_city": trip_details.origin_city,
                        "destination": trip_details.destination,
                        "num_days": trip_details.num_days,
                        "end_date": end_date,
                        "interests": trip_details.interests,
                        "itinerary": final_plan,
                        "chat_history": None,  # Will be updated when user saves manually
                        "is_budget_sufficient": is_budget_sufficient,
                        "estimated_cost": estimated_min_total if 'estimated_min_total' in locals() else None,
                        "budget_breakdown": budget_breakdown
                    }
                )
                print(f"✅ Trip saved with ID: {trip_id}")
                print(f"   Budget: ₹{trip_details.budget}, Duration: {trip_details.num_days} days")
                print(f"   Dates: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
                print(f"   Budget Breakdown: {budget_breakdown}")
        except Exception as e:
            print(f"⚠️ Failed to save trip to Firestore: {e}")
            # Don't fail the request if saving fails
        
        # ====================================================================
        # RETURN RESPONSE
        # ====================================================================
        return TripResponse(
            success=True,
            message="Trip plan generated successfully and saved!",
            trip_plan=final_plan,
            trip_id=trip_id,
            extracted_details={
                **trip_details.model_dump(),
                # Store original destination if budget was insufficient
                'original_destination': trip_details.destination if not is_budget_sufficient else None,
                'was_budget_insufficient': not is_budget_sufficient
            },
            research_data=research_data
        )
        
    except Exception as e:
        print(f"\n❌ Error in orchestrator: {str(e)}")
        import traceback
        print(f"❌ Full traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Planning failed: {str(e)}")


# ============================================================================
# FIREBASE-PROTECTED ENDPOINTS (Require Authentication)
# ============================================================================

@app.post("/api/trip-plans")
async def create_trip_plan(
    trip_data: dict,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Manually save a trip plan with chat history.
    """
    try:
        # Check if trip already exists (by checking if it's an update)
        trip_id = trip_data.get('trip_id')
        
        if trip_id:
            # Update existing trip
            success = firestore_service.update_trip_plan(
                trip_id=trip_id,
                user_id=current_user.uid,
                updates={
                    'itinerary': trip_data.get('itinerary'),
                    'chat_history': trip_data.get('chat_history'),
                    'updated_at': datetime.utcnow()
                }
            )
            if not success:
                raise HTTPException(status_code=404, detail="Trip not found or unauthorized")
            return {"success": True, "trip_id": trip_id}
        else:
            # Create new trip
            trip_id = firestore_service.save_trip_plan(
                user_id=current_user.uid,
                trip_data={
                    "title": trip_data.get('destination', 'Trip Plan'),
                    "destination": trip_data.get('destination', 'Unknown'),
                    "origin_city": trip_data.get('origin_city', 'Unknown'),
                    "num_days": trip_data.get('num_days', 1),
                    "itinerary": trip_data.get('itinerary', ''),
                    "chat_history": trip_data.get('chat_history'),
                    "status": trip_data.get('status', 'planned')
                }
            )
            return {"success": True, "trip_id": trip_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

@app.get("/api/trip-plans", response_model=List[dict])
async def get_user_trip_plans(
    current_user: FirebaseUser = Depends(get_current_user),
    limit: int = 20
):
    """
    Get all saved trip plans for the authenticated user.
    """
    try:
        trips = firestore_service.get_user_trip_plans(
            user_id=current_user.uid,
            limit=limit
        )
        # Transform itinerary field to trip_plan for frontend compatibility
        for trip in trips:
            if 'itinerary' in trip:
                trip['trip_plan'] = trip['itinerary']
        return trips
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trip plans: {str(e)}")


@app.get("/api/trip-plans/share/{trip_id}", response_model=dict)
async def get_shared_trip_plan(
    trip_id: str,
    current_user: Optional[FirebaseUser] = Depends(get_optional_user)
):
    """
    Get a trip plan via share link.
    Anyone with the link can view the trip - this is a share endpoint.
    """
    try:
        # Try to get the trip plan
        trip_ref = firestore_service.db.collection('trip_plans').document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            raise HTTPException(status_code=404, detail="Trip plan not found")
        
        trip = trip_doc.to_dict()
        trip['id'] = trip_id
        
        # Share links are public - anyone with the link can view
        # No need to check is_public or ownership for share endpoint
        
        # Transform itinerary field to trip_plan for frontend compatibility
        if 'itinerary' in trip:
            trip['trip_plan'] = trip['itinerary']
        
        return trip
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching shared trip: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trip plan: {str(e)}")


@app.get("/api/trip-plans/{trip_id}", response_model=dict)
async def get_trip_plan(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get a specific trip plan by ID.
    """
    try:
        trip = firestore_service.get_trip_plan_by_id(
            trip_id=trip_id,
            user_id=current_user.uid
        )
        
        if not trip:
            raise HTTPException(status_code=404, detail="Trip plan not found or unauthorized")
        
        # Transform itinerary field to trip_plan for frontend compatibility
        if 'itinerary' in trip:
            trip['trip_plan'] = trip['itinerary']
        
        return trip
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trip plan: {str(e)}")


@app.delete("/api/trip-plans/{trip_id}")
async def delete_trip_plan(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Delete a specific trip plan.
    """
    try:
        success = firestore_service.delete_trip_plan(
            trip_id=trip_id,
            user_id=current_user.uid
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Trip plan not found or unauthorized")
        
        return {"success": True, "message": "Trip plan deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete trip plan: {str(e)}")


@app.patch("/api/trip-plans/{trip_id}/status")
async def update_trip_status(
    trip_id: str,
    status: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Update the status of a trip (planned/started/completed).
    """
    try:
        # Validate status
        valid_statuses = ["planned", "started", "completed"]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        success = firestore_service.update_trip_status(
            trip_id=trip_id,
            user_id=current_user.uid,
            status=status
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Trip plan not found or unauthorized")
        
        return {"success": True, "message": f"Trip status updated to {status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update trip status: {str(e)}")


@app.post("/api/replan", response_model=TripResponse)
async def replan_trip(
    trip_id: str,
    user_feedback: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    🔄 PROACTIVE RE-PLANNING - Feature #4
    
    AI regenerates the trip plan based on user feedback.
    Examples: "make it cheaper", "add more adventure activities", "less crowded places"
    """
    try:
        print(f"\n🔄 REPLAN REQUEST from user {current_user.uid}")
        print(f"Trip ID: {trip_id}")
        print(f"Feedback: {user_feedback}")
        
        # Get original trip
        original_trip = firestore_service.get_trip_plan_by_id(trip_id, current_user.uid)
        if not original_trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        # Extract original details
        original_prompt = original_trip.get('original_prompt', '')
        original_plan = original_trip.get('trip_plan', '') or original_trip.get('itinerary', '')
        destination = original_trip.get('destination', '')
        duration = original_trip.get('duration', 3)
        num_people = original_trip.get('num_people', 1)
        budget = original_trip.get('budget', 0)
        start_date = original_trip.get('start_date', '')
        
        # Initialize LLM
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", api_key=google_api_key)
        
        # STEP 1: Intelligently interpret the user's feedback
        print("🧠 Analyzing user feedback...")
        interpretation_prompt = f"""You are analyzing user feedback for trip replanning.

ORIGINAL TRIP DETAILS:
- Destination: {destination}
- Duration: {duration} days
- People: {num_people}
- Budget: ₹{budget}

USER'S FEEDBACK: "{user_feedback}"

ORIGINAL PLAN EXCERPT:
{original_plan[:500]}...

Analyze the feedback and determine:
1. What specific changes does the user want?
2. What should be adjusted? (budget, activities, pace, accommodation style, food, etc.)
3. What constraints should be maintained? (dates, destination, number of people)
4. Any specific preferences mentioned? (adventure, relaxation, culture, food, shopping, etc.)

Provide your analysis in a structured way."""
        
        feedback_analysis = llm.invoke(interpretation_prompt).content
        print(f"📝 Feedback Analysis:\n{feedback_analysis}\n")
        
        # STEP 2: Budget Impact Analysis
        print("💰 Analyzing budget impact of requested changes...")
        budget_check_prompt = f"""Analyze if the user's requested changes are feasible within their budget.

ORIGINAL TRIP:
- Destination: {destination}
- Duration: {duration} days
- People: {num_people}
- Current Budget: ₹{budget}

USER'S FEEDBACK: "{user_feedback}"

FEEDBACK ANALYSIS: {feedback_analysis}

Determine:
1. Does the feedback request MORE expensive options? (luxury, 5-star, premium, fine dining, etc.)
2. Does the feedback request LESS expensive options? (budget, cheap, economical, etc.)
3. Estimate the new total cost based on the requested changes
4. Is it feasible within the budget of ₹{budget}?

Respond in this format:
CHANGE_TYPE: [UPGRADE/DOWNGRADE/SAME_LEVEL]
ESTIMATED_NEW_COST: ₹[amount]
FEASIBLE: [YES/NO]
REASON: [Brief explanation]
RECOMMENDATION: [What should be done - proceed, suggest budget increase, or alternative]"""

        budget_analysis = llm.invoke(budget_check_prompt).content
        print(f"💵 Budget Impact Analysis:\n{budget_analysis}\n")
        
        # Extract feasibility from analysis
        is_feasible = "FEASIBLE: YES" in budget_analysis.upper() or "FEASIBLE:YES" in budget_analysis.upper()
        needs_budget_increase = "FEASIBLE: NO" in budget_analysis.upper() or "FEASIBLE:NO" in budget_analysis.upper()
        
        # Create replanning-specific agent with enhanced understanding
        agent = create_react_agent(
            llm,
            tools=RESEARCH_TOOLS + PLANNING_TOOLS,
            state_modifier=f"""You are Anya, an expert AI travel planner from Voyage.

CRITICAL: You MUST carefully read and understand the user's feedback before replanning.

ORIGINAL TRIP DETAILS:
- Destination: {destination}
- Duration: {duration} days
- People: {num_people}
- Budget: ₹{budget}
- Start Date: {start_date}

ORIGINAL PLAN SUMMARY:
{original_plan[:1000]}...

USER'S FEEDBACK: "{user_feedback}"

FEEDBACK ANALYSIS:
{feedback_analysis}

BUDGET IMPACT ANALYSIS:
{budget_analysis}

⚠️ BUDGET CONSTRAINT: The user's TOTAL budget is ₹{budget} for the ENTIRE trip.
{"🚨 CRITICAL: Budget analysis shows the requested changes MAY EXCEED the budget! You MUST either:" if needs_budget_increase else "✅ Budget should be sufficient for requested changes."}
{"   1. Find creative ways to accommodate changes within ₹" + str(budget) if needs_budget_increase else ""}
{"   2. Clearly explain the budget shortfall and suggest increasing budget" if needs_budget_increase else ""}
{"   3. Offer a hybrid approach (some upgrades + some budget options)" if needs_budget_increase else ""}

YOUR MISSION:
1. **UNDERSTAND THE FEEDBACK**: Read what the user wants carefully. Common requests:
   - "cheaper"/"budget" → Find budget hotels, local transport, free activities
   - "luxury"/"premium" → Upgrade hotels, private transport, fine dining
   - "adventure" → Add trekking, water sports, adventure activities
   - "relaxing"/"peaceful" → Spa, nature, slow pace, avoid crowds
   - "cultural"/"authentic" → Local experiences, heritage sites, traditional food
   - "romantic" → Couple activities, scenic spots, candlelight dinners
   - "family-friendly" → Kid activities, safe places, family restaurants
   - "food-focused" → More restaurants, food tours, cooking classes
   - "faster pace" → Pack more activities per day
   - "slower pace" → Reduce activities, add relaxation time

2. **RESEARCH WITH THE FEEDBACK IN MIND**: Use your tools to find options that match the feedback

3. **CREATE A COMPLETELY NEW PLAN** that directly addresses the feedback

4. **EXPLAIN YOUR CHANGES**: Show what you changed and why it addresses their concern

5. **CRITICAL FORMATTING RULES:**
   - Use proper markdown with ## for main headings, ### for subheadings
   - Use **bold** for emphasis and important information
   - Use bullet points (- or •) consistently with proper indentation
   - ALL links must be in format: **📱 [Link Text](actual-url)** - NO plain text URLs!
   - Use emojis consistently (🏨 🍽️ 🚗 ✈️ 💰 📱 etc.)
   - Add line breaks between sections for readability
   - Use tables with proper | formatting for budget breakdown
   - Each day must have clear time sections: Morning/Afternoon/Evening
   - Every restaurant MUST have Zomato link: **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
   - Every hotel MUST have booking link: **📱 [Book Hotel Name](actual-url-from-tool)**
   - Flight links MUST use MakeMyTrip format with actual dates

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

## 🔄 What I Changed Based on Your Feedback

**Understanding Your Request:**
- [Point 1 about what they wanted]
- [Point 2 about specific changes]
- [Point 3 about their concerns]

**Changes Made:**
- ✅ [Change 1 with specifics]
- ✅ [Change 2 with specifics]
- ✅ [Change 3 with specifics]

{"⚠️ **BUDGET NOTICE:** The changes you requested (luxury/5-star/premium options) typically cost more than your current budget of ₹" + str(budget) + ". I've created options for you below." if needs_budget_increase else ""}

---

{"## 💰 BUDGET REALITY CHECK" if needs_budget_increase else ""}
{"" if not needs_budget_increase else f"""

**Current Situation:**
- Your requested changes: ₹[ESTIMATED_COST]
- Your current budget: ₹{budget}
- Additional needed: ₹[DIFFERENCE]

**I'm giving you THREE OPTIONS:**

### 🎯 Option 1: Stay Within Budget (₹{budget})

**What You Get:**
- [Specific accommodation option]
- [Specific food/dining option]
- [Specific activities included]

**Trade-offs:**
- ❌ [What you won't get compared to luxury]
- ✅ [What you still get that's good]

---

### 🌟 Option 2: Increase Budget to ₹[RECOMMENDED_AMOUNT]

**Full Luxury Experience:**
- [Luxury accommodation details]
- [Fine dining options]
- [Premium activities]

**Why It's Worth It:**
- [Benefit 1]
- [Benefit 2]

---

### ⚖️ Option 3: Hybrid Approach (₹[MIDDLE_AMOUNT])

**Best of Both Worlds:**
- [Mix of luxury and standard]
- [Strategic splurges]
- [Where we save, where we splurge]

---

**Which option would you prefer?** Just let me know and I'll create the detailed itinerary!

---"""}

## 🔗 BOOKING LINKS

### ✈️ Flights

**Outbound:**
- **📱 [Book Flight: [Origin] → {destination}](https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DESTINATION-DD/MM/YYYY&tripType=O&paxType=A-{num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
- Departure: [Date]
- Estimated: ₹[amount] per person

**Return:**
- **📱 [Book Return Flight: {destination} → [Origin]](https://www.makemytrip.com/flight/search?itinerary=DESTINATION-ORIGIN-DD/MM/YYYY&tripType=O&paxType=A-{num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
- Departure: [Date]
- Estimated: ₹[amount] per person

### 🏨 Hotels

**📱 [Book [Hotel Name]](actual_booking_link_from_get_booking_link_tool)**
- Location: [Area name]
- {duration} nights
- Total: ₹[amount]

---

## 📋 Your Replanned {duration}-Day Itinerary for {destination}

### 📅 Day 1: [Descriptive Title]

**Morning (8:00 AM - 12:00 PM)**

**Activities:**
- 🏛️ [Activity name with specific details]
- 📸 [Photo spot or viewpoint]
- ⏰ Duration: [X hours]

**Transport:**
- 🚗 Mode: [Ola/Uber/Metro/Auto]
- 💰 Cost: ₹[amount]
- ⏱️ Time: [X minutes]
- **💡 Tip:** [Practical advice]

---

**Afternoon (12:00 PM - 5:00 PM)**

**Lunch:**
- 🍽️ **Restaurant:** [Full Restaurant Name]
- **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
- **Cuisine:** [Type]
- **Recommended Dishes:**
  • [Dish 1] - ₹[price]
  • [Dish 2] - ₹[price]
  • [Dish 3] - ₹[price]
- **Total:** ₹[amount] for {num_people} person(s)
- **💡 Insider Tip:** [Reservation advice, best time, special note]

**Activities:**
- [Afternoon activity details]
- 💰 Entry: ₹[amount]

---

**Evening (5:00 PM - 10:00 PM)**

**Dinner:**
- 🍽️ **Restaurant:** [Full Restaurant Name]
- **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
- **Cuisine:** [Type]
- **Specialties:**
  • [Signature dish 1] - ₹[price]
  • [Signature dish 2] - ₹[price]
- **Total:** ₹[amount]
- **💡 Pro Tip:** [Best time to visit, reservation needed, etc.]

---

**🏨 Accommodation: [Hotel Name]**

**Details:**
- **📱 [Book Now](actual_booking_url_from_get_booking_link_tool)**
- ⭐ Rating: [X.X/5]
- 📍 Location: [Specific area]
- 💰 Cost: ₹[amount]/night

**Why This Hotel:**
- ✅ [Reason 1]
- ✅ [Reason 2]
- ✅ [Reason 3]

---

### 📅 Day 2: [Title]

[Same detailed format as Day 1]

---

## 💰 Updated Budget Breakdown

**Grand Total: ₹[TOTAL] out of ₹{budget} budget**

| Category | Item Details | Cost (₹) |
|----------|--------------|----------|
| ✈️ **Flights** | Round-trip tickets × {num_people} person(s) | [amount] |
| 🏨 **Accommodation** | [Hotel] × {duration} nights | [amount] |
| 🍽️ **Food** | Breakfast + Lunch + Dinner × {duration} days | [amount] |
| 🎫 **Activities** | Entry fees + Tours + Experiences | [amount] |
| 🚗 **Local Transport** | Cabs + Autos + Metro | [amount] |
| 🛍️ **Shopping** | Souvenirs + Tips + Extras | [amount] |
| **TOTAL** | | **₹[amount]** |
| **REMAINING** | | **₹[{budget} - amount]** |

---

## 🚗 Getting Around {destination}

**Best Transportation Options:**

**For Short Distances (< 5 km):**
- 🚶 Walking (free, healthy!)
- 🛺 Auto-rickshaw: ₹[amount] average
- 🚗 Ola/Uber: ₹[amount] average

**For Medium Distances (5-15 km):**
- 🚗 Ola/Uber: ₹[amount] average
- 🚇 Metro (if available): ₹[amount]

**For Long Distances (> 15 km):**
- 🚗 Ola/Uber: ₹[amount] average
- 🚕 Pre-book cab for better rates

**📱 Download These Apps:**
- **Ola Cabs:** [iOS](https://apps.apple.com/app/ola-cabs) | [Android](https://play.google.com/store/apps/details?id=com.olacabs.customer)
- **Uber:** [iOS](https://apps.apple.com/app/uber) | [Android](https://play.google.com/store/apps/details?id=com.ubercab)

**💡 Pro Tips:**
- 📱 Book cabs 10-15 minutes in advance
- 💵 Keep ₹500-1000 cash as backup
- 📍 Share live location with family
- ⏰ Peak hours (8-10 AM, 6-8 PM) = surge pricing

---

## 🍽️ Food Recommendations Summary

**Must-Try Restaurants in {destination}:**

**1. [Restaurant Name 1]**
- **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
- 🍴 Cuisine: [Type]
- ⭐ Rating: [X.X/5]
- 💰 Budget: ₹[amount] for 2
- 🌟 Signature Dish: [Dish name]
- 💡 Best Time: [Lunch/Dinner]

**2. [Restaurant Name 2]**
- **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
- 🍴 Cuisine: [Type]
- ⭐ Rating: [X.X/5]
- 💰 Budget: ₹[amount] for 2
- 🌟 Must-Order: [Dish name]
- 💡 Tip: [Special advice]

[Continue for 3-5 key restaurants]

---

## ✅ Why This New Plan Works Better

**Key Improvements Over Original:**

**1. [Main Change Category - e.g., Accommodation]**
- **Before:** [What it was]
- **Now:** [What it is]
- **Impact:** [How this addresses their feedback]

**2. [Second Category - e.g., Dining]**
- **Before:** [Original approach]
- **Now:** [New approach]
- **Impact:** [Benefit to user]

**3. [Third Category - e.g., Activities]**
- **Before:** [Old plan]
- **Now:** [Improved plan]
- **Impact:** [Why it's better]

**How This Addresses Your Feedback:**

"{user_feedback}"

✅ [Direct response to point 1]
✅ [Direct response to point 2]
✅ [Direct response to point 3]

---

💡 **Ready to book?** Your updated itinerary is complete with all links! Just click and book each component, or let me know if you'd like any adjustments.

CRITICAL REMINDERS:
- Every link MUST be clickable markdown format: **📱 [Text](url)**
- NO plain text URLs anywhere
- Use bullet points with proper indentation
- Add emojis for visual appeal
- Keep consistent formatting throughout
- Make it easy to scan and read

## 🔄 What I Changed Based on Your Feedback

[Clearly explain what you understood from "{user_feedback}" and what specific changes you made]

{"⚠️ **BUDGET NOTICE:** The changes you requested (luxury/5-star/premium options) typically cost more than your current budget of ₹" + str(budget) + ". I've created two options for you:" if needs_budget_increase else ""}

---

{"## 💰 BUDGET REALITY CHECK" if needs_budget_increase else ""}
{"" if not needs_budget_increase else f"""
Your requested changes would typically cost: ₹[ESTIMATED_COST]
Your current budget: ₹{budget}
Shortfall: ₹[DIFFERENCE]

**I'm giving you THREE OPTIONS:**

### Option 1: Stay Within Budget (₹{budget})
[Create a plan that incorporates SOME of their requests but keeps it within budget]
- Example: Instead of 5-star throughout, mix one night at 5-star with other nights at 4-star
- Example: Fine dining for 1-2 meals, regular restaurants for others

### Option 2: Increase Budget to ₹[RECOMMENDED_AMOUNT]
[Show what they get with the increased budget - full luxury experience as requested]

### Option 3: Hybrid Approach
[Mix of luxury and regular - strategic splurges]

**Which option would you prefer?** Just let me know!

---"""}

## 🔗 BOOKING LINKS

### ✈️ Flights
**📱 [Book Outbound Flight: {destination} → Return](https://www.makemytrip.com/flight/search?itinerary=ORIGIN-DESTINATION-DD/MM/YYYY&tripType=R&paxType=A-{num_people}_C-0_I-0&intl=false&cabinClass=E&lang=eng)**
- Use actual origin city airport code
- Use actual dates from trip
- Estimated: ₹[amount] per person

### 🏨 Hotels
**📱 [Book {hotel_name}](actual_booking_link_from_get_booking_link_tool)**
- Call get_booking_link tool for each hotel
- {duration} nights total

---

## 📋 Your Replanned {duration}-Day Itinerary for {destination}

### 📅 Day 1: [Title]

**Morning (8:00 AM - 12:00 PM)**
- [Activity details with timing]
- 🚗 Transport: [Mode and cost]
  - **💡 Tip:** Download Ola/Uber app for easy bookings
- 💰 Cost: ₹[amount]

**Afternoon (12:00 PM - 5:00 PM)**
- [Activity details]
- 🍽️ Lunch: [Restaurant Name] - [Signature Dish]
  - **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
  - Price: ₹[amount] for {num_people}
  - 💡 What to order: [Specific dishes with brief description]
- 💰 Cost: ₹[amount]

**Evening (5:00 PM - 10:00 PM)**
- [Activity details]
- 🍽️ Dinner: [Restaurant Name] - [Specialty]
  - **📱 [View on Zomato](https://www.google.com/search?q=Restaurant+Name+City+zomato)**
  - Price: ₹[amount]
  - 💡 Insider tip: [Reservation advice, best time, signature dish]
- 💰 Cost: ₹[amount]

**🏨 Accommodation:** [Hotel Name](booking_link)
- Why chosen: [Brief explanation]
- **📱 [Book Now](actual_booking_url_from_tool)**
- Cost: ₹[amount]/night

---

### 📅 Day 2: [Title]

[Same detailed format as Day 1]

---

[Continue for all days]

---

## 💰 Updated Budget Breakdown

**Total Trip Cost: ₹[GRAND_TOTAL]**

| Category | Details | Cost (₹) |
|----------|---------|----------|
| ✈️ Flights | Round-trip for {num_people} person(s) | [amount] |
| 🏨 Accommodation | [Hotel Name] × {duration} nights | [amount] |
| 🍽️ Food | All meals ({duration} days × 3 meals) | [amount] |
| 🎫 Activities | Entry fees, tours, experiences | [amount] |
| 🚗 Local Transport | Cabs, autos, metros, rentals | [amount] |
| 🛍️ Shopping & Misc | Souvenirs, tips, extras | [amount] |
| **GRAND TOTAL** | | **₹[amount]** |

---

## 🚗 Transportation Tips

**Getting Around {destination}:**
- **✅ Best Option:** [Ola/Uber/Metro/Auto - based on destination]
- **💰 Average Costs:** 
  - Short distance (< 5km): ₹[amount]
  - Medium distance (5-15km): ₹[amount]
  - Long distance (> 15km): ₹[amount]
- **📱 Recommended Apps:**
  - Ola Cabs (Download: [iOS](https://apps.apple.com/app/ola-cabs) | [Android](https://play.google.com/store/apps/details?id=com.olacabs.customer))
  - Uber (Download: [iOS](https://apps.apple.com/app/uber) | [Android](https://play.google.com/store/apps/details?id=com.ubercab))
  - [City-specific app if applicable]
- **💡 Pro Tips:**
  - Book cabs 10-15 minutes before you need them
  - Keep cash handy as backup
  - Share your ride details with family/friends

---

## 🍽️ Food Recommendations Summary

**Must-Try Restaurants:**
1. **[Restaurant 1]** - [Cuisine Type]
   - 📱 [View on Zomato](google_search_link)
   - Best for: [Breakfast/Lunch/Dinner]
   - Signature: [Dish name]
   
2. **[Restaurant 2]** - [Cuisine Type]
   - 📱 [View on Zomato](google_search_link)
   - Best for: [Meal type]
   - Must-order: [Dish name]

[List 3-5 key restaurants from the itinerary]

---

## ✅ Why This New Plan Works Better

**Key Improvements:**
- ✓ [Improvement 1 directly addressing feedback]
- ✓ [Improvement 2 directly addressing feedback]
- ✓ [Improvement 3 directly addressing feedback]

**What Changed:**
- **Before:** [What it was like]
- **Now:** [How it's better based on feedback]

[Explain in detail how this addresses "{user_feedback}"]

---

💡 **Ready to start?** Your updated itinerary is all set! Let me know if you'd like any more adjustments.

IMPORTANT: Make SUBSTANTIAL changes that directly address "{user_feedback}". Don't just tweak minor details!"""
        )
        
        print("🤖 Replanning agent created, starting execution...")
        
        # Run agent
        result = agent.invoke({
            "messages": [("user", f"Replan the trip to {destination} based on this feedback: {user_feedback}")]
        })
        
        final_output = result['messages'][-1].content
        
        print("✅ Replanning complete!")
        
        # Update the trip in database
        firestore_service.update_trip_plan(
            trip_id=trip_id,
            user_id=current_user.uid,
            updates={
                'trip_plan': final_output,
                'itinerary': final_output,
                'last_modified_feedback': user_feedback,
                'updated_at': datetime.utcnow()
            }
        )
        
        return TripResponse(
            success=True,
            trip_id=trip_id,
            trip_plan=final_output,
            message="✅ Trip successfully replanned based on your feedback!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Replan error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to replan trip: {str(e)}")


@app.post("/api/saved-destinations")
async def save_destination(
    request: SaveDestinationRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Save a destination to user's favorites.
    """
    try:
        dest_id = firestore_service.save_destination(
            user_id=current_user.uid,
            destination_name=request.destination_name,
            notes=request.notes
        )
        return {"success": True, "destination_id": dest_id, "message": "Destination saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save destination: {str(e)}")


@app.get("/api/saved-destinations", response_model=List[dict])
async def get_saved_destinations(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get all saved destinations for the authenticated user.
    """
    try:
        destinations = firestore_service.get_user_saved_destinations(
            user_id=current_user.uid
        )
        return destinations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch saved destinations: {str(e)}")


@app.post("/api/optimize-day", response_model=OptimizeDayResponse)
async def optimize_day(
    request: OptimizeDayRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    🚨 DYNAMIC ITINERARY OPTIMIZER - "Panic Button"
    
    When a user's plan is disrupted, this generates a NEW optimized plan for the rest of the day.
    
    Uses:
    - Current GPS location
    - Current time
    - Remaining budget from expense tracker
    - User preferences
    - Original trip details
    
    Returns a contextual, actionable plan for immediate use.
    """
    try:
        from datetime import datetime
        import pytz
        from agent_logic import OPTIMIZATION_TOOLS
        
        print(f"\n🔄 OPTIMIZE DAY REQUEST from user {current_user.uid}")
        print(f"📍 Location: ({request.current_latitude}, {request.current_longitude})")
        
        # ====================================================================
        # STEP 1: GET TRIP DETAILS
        # ====================================================================
        trip = firestore_service.get_trip_plan_by_id(request.trip_id, current_user.uid)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        if trip.get('user_id') != current_user.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access to trip")
        
        trip_status = trip.get('trip_status', 'planned')
        if trip_status != 'started':
            raise HTTPException(
                status_code=400, 
                detail="Trip must be started to use day optimizer. Please start your trip first."
            )
        
        # ====================================================================
        # STEP 2: GET CURRENT TIME
        # ====================================================================
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        current_time_str = current_time.strftime("%I:%M %p")
        current_date_str = current_time.strftime("%A, %B %d, %Y")
        hours_remaining = 24 - current_time.hour
        
        print(f"⏰ Current time: {current_time_str} ({hours_remaining} hours left in day)")
        
        # ====================================================================
        # STEP 3: GET REMAINING BUDGET FROM EXPENSE TRACKER
        # ====================================================================
        expense_service = get_expense_tracker_service(firestore_service.db)
        expense_summary = expense_service.get_expense_tracker(request.trip_id, include_deleted=False)
        
        remaining_budget = expense_summary.total_remaining
        daily_budget_suggestion = remaining_budget / max(expense_summary.days_remaining, 1)
        
        print(f"💰 Remaining budget: ₹{remaining_budget:.0f} (Suggested daily: ₹{daily_budget_suggestion:.0f})")
        
        # ====================================================================
        # STEP 4: GET USER PREFERENCES
        # ====================================================================
        user_profile = firestore_service.get_user_profile(user_id=current_user.uid)
        # Handle case where user_profile might be None
        if user_profile and user_profile.get('preferences'):
            profile_interests = user_profile.get('preferences', {}).get('interests', '')
        else:
            profile_interests = ''
        
        user_interests = trip.get('interests', '') or profile_interests or 'sightseeing, food, culture'
        
        print(f"🎯 User interests: {user_interests}")
        
        # ====================================================================
        # STEP 5: BUILD OPTIMIZATION PROMPT
        # ====================================================================
        location_name = request.current_location_name or f"GPS coordinates {request.current_latitude}, {request.current_longitude}"
        disruption_context = f"\n\n**DISRUPTION REASON:** {request.disruption_reason}" if request.disruption_reason else ""
        
        optimization_prompt = f"""
🚨 **URGENT: DYNAMIC ITINERARY OPTIMIZATION NEEDED**

The user's plan has been disrupted and they need immediate help. Create a NEW, OPTIMAL plan for the REST OF TODAY.

**CURRENT SITUATION:**
- **Date & Time:** {current_date_str}, {current_time_str}
- **Hours Left Today:** {hours_remaining} hours
- **Current Location:** {location_name}
- **GPS Coordinates:** {request.current_latitude}, {request.current_longitude}
- **City:** {trip.get('destination', 'Unknown')}
{disruption_context}

**TRIP CONTEXT:**
- **Original Trip:** {trip.get('num_days', 0)} days to {trip.get('destination')}
- **Total Budget:** ₹{trip.get('budget', 0):,.0f}
- **Money Already Spent:** ₹{expense_summary.total_spent:,.0f}
- **Remaining Budget:** ₹{remaining_budget:,.0f}
- **Suggested Budget for Today:** ₹{daily_budget_suggestion:,.0f}
- **User Interests:** {user_interests}

**MISSION:**
Create an IMMEDIATE, ACTIONABLE plan for the rest of today that:

1. **STARTS NOW** - User is at {location_name}, ready to go
2. **Uses GPS coordinates** to find NEARBY attractions (within 5-10km radius)
3. **Respects remaining budget** - Keep today's expenses around ₹{daily_budget_suggestion:.0f}
4. **Maximizes remaining time** - {hours_remaining} hours to work with
5. **Matches interests** - Focus on {user_interests}
6. **Is PRACTICAL** - Include transport, timing, costs

**FORMAT YOUR RESPONSE AS:**

⏰ **OPTIMIZED PLAN FOR TODAY ({current_time_str} onwards)**

**Right Now ({current_time_str}):**
[What to do immediately from current location]

**Next 2-3 Hours:**
[Activity 1 with location, cost, transport]

**Afternoon/Evening:**
[Activity 2 with location, cost, transport]

**Dinner & Evening:**
[Food recommendations and wind-down activity]

**💰 ESTIMATED COST FOR TODAY:** ₹[X,XXX]
- Transport: ₹[XXX]
- Activities: ₹[XXX]
- Food: ₹[XXX]

**🚗 GETTING STARTED:**
[Exact instructions: "Take an auto-rickshaw from {location_name} to [next destination], costs ₹XX, 15 min"]

**⚡ QUICK TIPS:**
- [Time-saving tip]
- [Budget-saving tip]
- [Local insider tip]

Use the tools to research nearby attractions, transport options, food spots, and current conditions.
Make this plan IMMEDIATELY USABLE - the user should be able to start following it right now!
"""
        
        print(f"\n🤖 Creating optimized plan with AI agent...")
        
        # ====================================================================
        # STEP 6: CREATE AI AGENT FOR OPTIMIZATION
        # ====================================================================
        model = ChatGoogleGenerativeAI(
            model="models/gemini-2.0-flash-exp",
            temperature=0.7,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # Create agent with optimization tools (returns executable agent)
        agent_executor = create_react_agent(model, OPTIMIZATION_TOOLS)
        
        # Execute agent
        result = agent_executor.invoke({"messages": [("user", optimization_prompt)]})
        # Extract the last message content
        if result and 'messages' in result:
            optimized_plan = result['messages'][-1].content if result['messages'] else ''
        else:
            optimized_plan = str(result)
        
        print(f"\n✅ Optimized plan generated ({len(optimized_plan)} characters)")
        
        # ====================================================================
        # STEP 7: RETURN RESPONSE
        # ====================================================================
        context_used = {
            "current_time": current_time_str,
            "current_date": current_date_str,
            "location": location_name,
            "coordinates": f"{request.current_latitude}, {request.current_longitude}",
            "remaining_budget": f"₹{remaining_budget:,.0f}",
            "suggested_daily_budget": f"₹{daily_budget_suggestion:,.0f}",
            "hours_remaining": hours_remaining,
            "interests": user_interests,
            "disruption_reason": request.disruption_reason or "Not specified"
        }
        
        return OptimizeDayResponse(
            success=True,
            message="Day optimized successfully! Here's your new plan.",
            optimized_plan=optimized_plan,
            context_used=context_used
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Error optimizing day: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to optimize day: {str(e)}")


@app.get("/api/check-optimization-needed/{trip_id}")
async def check_optimization_needed(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Auto-check if day optimization is needed based on:
    - Time (morning start, after lunch, evening)
    - Budget alerts (overspending detected)
    - Location changes (if GPS available)
    - Trip status (must be started)
    
    Returns suggestion to optimize with reason
    """
    try:
        from datetime import datetime
        import pytz
        
        user_id = current_user.uid
        
        # Get trip
        trip = firestore_service.get_trip_plan_by_id(trip_id, user_id)
        if not trip or trip.get('user_id') != user_id:
            return {"should_optimize": False, "reason": "Trip not found"}
        
        if trip.get('trip_status') != 'started':
            return {"should_optimize": False, "reason": "Trip not started"}
        
        # Get current time
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        current_hour = current_time.hour
        
        # Get expense tracker
        expense_service = get_expense_tracker_service(firestore_service.db)
        expense_summary = expense_service.get_expense_tracker(trip_id, include_deleted=False)
        
        # Check conditions for auto-optimization
        reasons = []
        
        # 1. Morning optimization (7-9 AM) - Plan the day
        if 7 <= current_hour <= 9:
            last_optimization = trip.get('last_optimization_time')
            if not last_optimization or (datetime.now() - datetime.fromisoformat(last_optimization)).days >= 1:
                reasons.append("🌅 Good morning! Let's plan your day ahead.")
        
        # 2. Budget alert - Overspending detected
        if expense_summary.total_spent > 0:
            budget_used_percent = (expense_summary.total_spent / trip.get('budget', 1)) * 100
            if budget_used_percent > 90:
                reasons.append(f"💰 Budget alert: {budget_used_percent:.0f}% used. Let's optimize remaining days.")
            elif expense_summary.total_remaining < 0:
                reasons.append("🚨 Budget exceeded! Need to adjust your remaining itinerary.")
        
        # 3. Mid-day check (12-2 PM) - Afternoon plans
        if 12 <= current_hour <= 14:
            reasons.append("☀️ Afternoon plans: Let's optimize the rest of your day.")
        
        # 4. Evening planning (5-6 PM) - Dinner and night activities
        if 17 <= current_hour <= 18:
            reasons.append("🌆 Evening ahead: Let me suggest dinner spots and night activities.")
        
        should_optimize = len(reasons) > 0
        
        return {
            "should_optimize": should_optimize,
            "reasons": reasons,
            "trip_id": trip_id,
            "current_time": current_time.strftime("%I:%M %p"),
            "remaining_budget": float(expense_summary.total_remaining),
            "days_remaining": expense_summary.days_remaining
        }
        
    except Exception as e:
        print(f"❌ Error checking optimization: {str(e)}")
        return {"should_optimize": False, "reason": "Error checking conditions"}


# ============================================================================
# SAFETY ALERTS ENDPOINTS
# ============================================================================

@app.get("/api/safety-alerts")
async def get_safety_alerts(
    current_user: FirebaseUser = Depends(get_current_user),
    active_only: bool = True
):
    """
    Get all safety alerts for user's active trips
    Returns real-time safety alerts (weather, security, health warnings)
    """
    try:
        from datetime import datetime
        
        user_id = current_user.uid
        
        # Get all user's trips
        all_trips = firestore_service.get_user_trip_plans(user_id=user_id)
        
        # Get alerts for each trip
        all_alerts = []
        
        # Also get destination-based alerts
        destinations = set()
        for trip in all_trips:
            if trip.get('trip_status') == 'started' or not active_only:
                dest = trip.get('destination', '')
                if dest:
                    destinations.add(dest.lower())
        
        # Query Firestore for alerts
        db = firestore_service.db
        alerts_ref = db.collection('safety_alerts')
        
        # Get all alerts and filter
        alerts_query = alerts_ref.order_by('created_at', direction='DESCENDING').limit(50)
        alerts_docs = alerts_query.stream()
        
        current_time = datetime.utcnow()
        
        for doc in alerts_docs:
            alert_data = doc.to_dict()
            alert_data['id'] = doc.id
            
            # Check if alert is expired
            expires_at = alert_data.get('expires_at')
            if expires_at and isinstance(expires_at, str):
                from datetime import datetime
                try:
                    expire_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if expire_time < current_time:
                        continue  # Skip expired alerts
                except:
                    pass
            
            # Filter by location if available
            alert_location = alert_data.get('location', '').lower()
            if alert_location:
                # Check if alert location matches any destination
                if any(dest in alert_location or alert_location in dest for dest in destinations):
                    all_alerts.append(alert_data)
            else:
                # General alerts (no location specified)
                all_alerts.append(alert_data)
        
        # Sort by severity and time
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        all_alerts.sort(key=lambda x: (
            severity_order.get(x.get('severity', 'low'), 4),
            x.get('created_at', '')
        ), reverse=True)
        
        return {
            "success": True,
            "alerts": all_alerts[:20],  # Limit to 20 most relevant
            "count": len(all_alerts)
        }
        
    except Exception as e:
        print(f"❌ Error fetching safety alerts: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")


@app.patch("/api/safety-alerts/{alert_id}/read")
async def mark_alert_as_read(
    alert_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Mark a safety alert as read for the current user
    """
    try:
        db = firestore_service.db
        alert_ref = db.collection('safety_alerts').document(alert_id)
        
        # Update the alert
        alert_ref.update({
            'is_read': True,
            'read_by': firestore_service.firestore.ArrayUnion([current_user.uid]),
            'read_at': firestore_service.firestore.SERVER_TIMESTAMP
        })
        
        return {
            "success": True,
            "message": "Alert marked as read"
        }
        
    except Exception as e:
        print(f"❌ Error marking alert as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark alert as read: {str(e)}")


@app.post("/api/safety-alerts")
async def create_safety_alert(
    alert_data: dict,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Create a new safety alert (admin/system use)
    Sends notifications to affected users
    """
    try:
        from datetime import datetime
        
        # Create alert document
        db = firestore_service.db
        alerts_ref = db.collection('safety_alerts')
        
        alert_doc = {
            'severity': alert_data.get('severity', 'medium'),
            'category': alert_data.get('category', 'advisory'),
            'title': alert_data.get('title', 'Safety Alert'),
            'message': alert_data.get('message', ''),
            'location': alert_data.get('location'),
            'source': alert_data.get('source', 'Voyage System'),
            'action_required': alert_data.get('action_required'),
            'expires_at': alert_data.get('expires_at'),
            'created_at': datetime.utcnow().isoformat(),
            'created_by': current_user.uid
        }
        
        # Save to Firestore
        doc_ref = alerts_ref.add(alert_doc)
        alert_id = doc_ref[1].id
        
        print(f"✅ Safety alert created: {alert_id}")
        
        # TODO: Send notifications to affected users
        # This would integrate with notification_service.py
        
        return {
            "success": True,
            "alert_id": alert_id,
            "message": "Safety alert created successfully"
        }
        
    except Exception as e:
        print(f"❌ Error creating safety alert: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create alert: {str(e)}")


@app.get("/api/profile", response_model=dict)
async def get_profile(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get user profile information.
    """
    try:
        profile = firestore_service.get_user_profile(user_id=current_user.uid)
        
        if not profile:
            # Return minimal info indicating no profile exists
            return {
                "exists": False,
                "profileComplete": False,
                "email": current_user.email,
                "display_name": current_user.name,
                "preferences": {}
            }
        
        # Add profileComplete flag
        profile["exists"] = True
        profile["profileComplete"] = profile.get("preferences", {}).get("completed", False)
        
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@app.get("/api/profile/status", response_model=dict)
async def get_profile_status(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Check user profile status (phone verification, profile completion, etc.)
    """
    try:
        profile = firestore_service.get_user_profile(user_id=current_user.uid)
        
        # Check phone verification
        has_phone = False
        phone_verified = False
        
        if profile:
            has_phone = bool(profile.get("phone_number"))
            phone_verified = profile.get("phone_verified", False)
        
        # Check profile completion
        profile_complete = False
        if profile and profile.get("preferences"):
            preferences = profile.get("preferences", {})
            # Profile is complete if it has preferences and completed flag
            profile_complete = preferences.get("completed", False) or bool(
                preferences.get("travel_style") or 
                preferences.get("interests")
            )
        
        return {
            "has_phone_number": has_phone,
            "phone_verified": phone_verified,
            "profile_complete": profile_complete,
            "profile_exists": profile is not None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile status: {str(e)}")


@app.put("/api/profile")
async def update_profile(
    profile: UserProfile,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Update user profile information.
    """
    try:
        success = firestore_service.create_or_update_user_profile(
            user_id=current_user.uid,
            profile_data=profile.model_dump()
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile")
        
        return {"success": True, "message": "Profile updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


# ============================================================================
# OTP VERIFICATION ENDPOINTS
# ============================================================================

@app.post("/api/auth/send-otp", response_model=OTPResponse)
async def send_otp(
    request: OTPRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Send OTP to user's phone number for verification.
    User must be authenticated to request OTP.
    """
    try:
        otp_service = get_otp_service()
        
        # Generate and send OTP
        success, message = otp_service.send_otp(request.phone_number)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        print(f"\n📱 OTP sent to {request.phone_number} for user {current_user.email}")
        
        return OTPResponse(
            success=True,
            message="OTP sent successfully",
            expires_in=300  # 5 minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error sending OTP: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@app.post("/api/auth/verify-otp", response_model=OTPResponse)
async def verify_otp(
    request: OTPVerifyRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Verify OTP code sent to user's phone number.
    On successful verification, updates user profile with verified phone number.
    """
    try:
        otp_service = get_otp_service()
        
        # Verify OTP
        success, message = otp_service.verify_otp_simple(request.phone_number, request.otp)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        # Update user profile with verified phone number
        profile = firestore_service.get_user_profile(user_id=current_user.uid)
        
        if not profile:
            profile = {
                "email": current_user.email,
                "display_name": current_user.name,
                "preferences": {}
            }
        
        profile["phone_number"] = request.phone_number
        profile["phone_verified"] = True
        profile["phone_verified_at"] = datetime.utcnow().isoformat()
        
        firestore_service.create_or_update_user_profile(
            user_id=current_user.uid,
            profile_data=profile
        )
        
        print(f"\n✅ Phone verified for {current_user.email}: {request.phone_number}")
        
        return OTPResponse(
            success=True,
            message="Phone number verified successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verifying OTP: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to verify OTP: {str(e)}")


@app.put("/api/preferences")
async def update_preferences(
    request: UpdatePreferencesRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Update user's travel preferences for personalized planning.
    """
    try:
        # Get existing profile
        profile = firestore_service.get_user_profile(user_id=current_user.uid)
        
        if not profile:
            profile = {
                "email": current_user.email,
                "display_name": current_user.name,
                "preferences": {},
                "onboarding_completed": False
            }
        
        # Update preferences
        profile["preferences"] = request.preferences.model_dump(exclude_none=True)
        profile["onboarding_completed"] = True
        
        # Calculate profile completeness
        prefs = request.preferences.model_dump(exclude_none=True)
        total_fields = 15  # Number of preference fields
        filled_fields = len([v for v in prefs.values() if v])
        profile["profile_completeness"] = int((filled_fields / total_fields) * 100)
        
        # Save to Firestore
        success = firestore_service.create_or_update_user_profile(
            user_id=current_user.uid,
            profile_data=profile
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update preferences")
        
        print(f"\n✅ Updated preferences for {current_user.email}")
        print(f"   Profile completeness: {profile['profile_completeness']}%")
        
        return {
            "success": True,
            "message": "Preferences updated successfully",
            "profile_completeness": profile["profile_completeness"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating preferences: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")


@app.post("/api/preferences/learn")
async def learn_preferences(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Analyze user's trip history and automatically learn their preferences.
    This endpoint is called periodically or after significant activity.
    """
    try:
        user_id = current_user.uid
        
        # Fetch all user trips
        all_trips = firestore_service.get_user_trips(user_id=user_id)
        
        if not all_trips or len(all_trips) < 2:
            return {
                "success": True,
                "message": "Not enough trip history to learn preferences yet",
                "learned_preferences": None
            }
        
        print(f"\n{'='*60}")
        print(f"🧠 LEARNING PREFERENCES for {current_user.email}")
        print(f"   Analyzing {len(all_trips)} trips...")
        print(f"{'='*60}\n")
        
        # Analyze trip history
        destinations = [trip.get("destination", "").lower() for trip in all_trips]
        budgets = [trip.get("budget", 0) for trip in all_trips]
        durations = [trip.get("num_days", 0) for trip in all_trips]
        interests_list = [trip.get("interests", "") for trip in all_trips if trip.get("interests")]
        
        # Calculate learned preferences
        from collections import Counter
        import statistics
        
        # Most visited destinations (unique count)
        dest_counter = Counter(destinations)
        most_visited = [dest for dest, count in dest_counter.most_common(5)]
        
        # Average budget and classification
        avg_budget = statistics.mean(budgets) if budgets else 0
        avg_duration = statistics.mean(durations) if durations else 0
        daily_budget = avg_budget / avg_duration if avg_duration > 0 else 0
        
        if daily_budget < 2500:
            spending_pattern = "conservative"
            fav_budget_range = "₹20,000 - ₹40,000 per trip"
        elif daily_budget < 6000:
            spending_pattern = "moderate"
            fav_budget_range = "₹40,000 - ₹80,000 per trip"
        else:
            spending_pattern = "generous"
            fav_budget_range = "₹80,000+ per trip"
        
        # Extract recurring interests
        all_interests = []
        for interest_str in interests_list:
            all_interests.extend([i.strip().lower() for i in interest_str.split(",")])
        interest_counter = Counter(all_interests)
        recurring_interests = [interest for interest, count in interest_counter.most_common(5) if count > 1]
        
        # Build learned preferences
        learned_prefs = {
            "most_visited_destinations": most_visited[:5],
            "favorite_budget_range": fav_budget_range,
            "average_trip_duration": int(avg_duration),
            "recurring_interests": recurring_interests,
            "spending_pattern": spending_pattern,
            "last_analyzed": datetime.now()
        }
        
        # Update profile with learned preferences
        profile = firestore_service.get_user_profile(user_id=user_id)
        if not profile:
            profile = {
                "email": current_user.email,
                "display_name": current_user.name,
                "preferences": {}
            }
        
        profile["learned_preferences"] = learned_prefs
        
        success = firestore_service.create_or_update_user_profile(
            user_id=user_id,
            profile_data=profile
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save learned preferences")
        
        print(f"✅ Learned preferences:")
        print(f"   Spending: {spending_pattern} ({fav_budget_range})")
        print(f"   Avg Duration: {int(avg_duration)} days")
        print(f"   Interests: {', '.join(recurring_interests)}")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "message": "Preferences learned successfully",
            "learned_preferences": learned_prefs
        }
        
    except Exception as e:
        print(f"❌ Error learning preferences: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to learn preferences: {str(e)}")


@app.get("/api/preferences/questionnaire")
async def get_preference_questionnaire():
    """
    Get a structured questionnaire for new users to fill their preferences.
    Returns questions with multiple choice options.
    """
    return {
        "success": True,
        "questionnaire": {
            "budget_tier": {
                "question": "What's your typical travel budget style?",
                "options": [
                    {"value": "budget-friendly", "label": "Budget-Friendly (₹20,000 - ₹40,000 per trip)", "description": "Hostels, public transport, street food"},
                    {"value": "moderate", "label": "Moderate (₹40,000 - ₹80,000 per trip)", "description": "Mid-range hotels, mix of transport, local restaurants"},
                    {"value": "luxury", "label": "Luxury (₹80,000+ per trip)", "description": "Premium hotels, private transport, fine dining"}
                ]
            },
            "travel_style": {
                "question": "How do you like to travel? (Select all that apply)",
                "type": "multiple",
                "options": [
                    {"value": "adventure", "label": "🏔️ Adventure", "description": "Trekking, sports, thrills"},
                    {"value": "relaxation", "label": "🧘 Relaxation", "description": "Beaches, spas, slow pace"},
                    {"value": "cultural", "label": "🏛️ Cultural", "description": "Museums, heritage, local experiences"},
                    {"value": "luxury", "label": "✨ Luxury", "description": "Premium experiences, comfort"},
                    {"value": "backpacking", "label": "🎒 Backpacking", "description": "Budget travel, flexibility"},
                    {"value": "photography", "label": "📸 Photography", "description": "Scenic spots, golden hours"},
                    {"value": "spiritual", "label": "🙏 Spiritual", "description": "Temples, meditation, yoga"}
                ]
            },
            "interests": {
                "question": "What are your main travel interests? (Select up to 5)",
                "type": "multiple",
                "max_selections": 5,
                "options": [
                    {"value": "history", "label": "🏛️ History & Heritage"},
                    {"value": "food", "label": "🍜 Food & Cuisine"},
                    {"value": "photography", "label": "📸 Photography"},
                    {"value": "trekking", "label": "🥾 Trekking & Hiking"},
                    {"value": "wildlife", "label": "🦁 Wildlife & Nature"},
                    {"value": "beaches", "label": "🏖️ Beaches & Water Sports"},
                    {"value": "mountains", "label": "⛰️ Mountains & Hills"},
                    {"value": "art", "label": "🎨 Art & Museums"},
                    {"value": "shopping", "label": "🛍️ Shopping & Markets"},
                    {"value": "nightlife", "label": "🌙 Nightlife & Entertainment"},
                    {"value": "architecture", "label": "🏰 Architecture"},
                    {"value": "local_culture", "label": "👥 Local Culture & People"}
                ]
            },
            "accommodation_type": {
                "question": "Where do you prefer to stay? (Select all that apply)",
                "type": "multiple",
                "options": [
                    {"value": "hotels", "label": "🏨 Hotels", "description": "Standard or luxury hotels"},
                    {"value": "homestays", "label": "🏡 Homestays", "description": "Local family experiences"},
                    {"value": "hostels", "label": "🛏️ Hostels", "description": "Budget-friendly, social"},
                    {"value": "resorts", "label": "🏖️ Resorts", "description": "All-inclusive, premium"},
                    {"value": "camps", "label": "⛺ Camps", "description": "Adventure, outdoors"},
                    {"value": "airbnb", "label": "🏠 Airbnb/Apartments", "description": "Private, flexible"}
                ]
            },
            "food_preferences": {
                "question": "Tell us about your food preferences",
                "type": "composite",
                "fields": {
                    "dietary": {
                        "question": "Dietary preference?",
                        "options": [
                            {"value": "vegetarian", "label": "🥗 Vegetarian"},
                            {"value": "non-vegetarian", "label": "🍗 Non-Vegetarian"},
                            {"value": "vegan", "label": "🌱 Vegan"},
                            {"value": "no-preference", "label": "✨ No Preference"}
                        ]
                    },
                    "priorities": {
                        "question": "Food priorities? (Select all that apply)",
                        "type": "multiple",
                        "options": [
                            {"value": "street_food", "label": "🍢 Street Food"},
                            {"value": "local_cuisine", "label": "🍛 Local Authentic Cuisine"},
                            {"value": "fine_dining", "label": "🍽️ Fine Dining"},
                            {"value": "cafes", "label": "☕ Cafes & Coffee Shops"},
                            {"value": "food_tours", "label": "🚶 Food Tours"}
                        ]
                    }
                }
            },
            "preferred_destinations": {
                "question": "What types of destinations attract you? (Select all that apply)",
                "type": "multiple",
                "options": [
                    {"value": "mountains", "label": "⛰️ Mountains & Hills"},
                    {"value": "beaches", "label": "🏖️ Beaches & Islands"},
                    {"value": "cities", "label": "🏙️ Cities & Urban"},
                    {"value": "countryside", "label": "🌾 Countryside & Villages"},
                    {"value": "deserts", "label": "🏜️ Deserts"},
                    {"value": "forests", "label": "🌲 Forests & Wildlife"},
                    {"value": "historical", "label": "🏛️ Historical Sites"},
                    {"value": "spiritual", "label": "🙏 Spiritual Places"}
                ]
            },
            "travel_companions": {
                "question": "Who do you usually travel with?",
                "options": [
                    {"value": "solo", "label": "🧍 Solo", "description": "I travel alone"},
                    {"value": "partner", "label": "💑 Partner/Spouse", "description": "Just the two of us"},
                    {"value": "family", "label": "👨‍👩‍👧‍👦 Family", "description": "With kids or extended family"},
                    {"value": "friends", "label": "👥 Friends", "description": "Group of friends"}
                ]
            },
            "typical_trip_duration": {
                "question": "How long are your typical trips?",
                "options": [
                    {"value": "weekend", "label": "🗓️ Weekend (2-3 days)", "description": "Quick getaways"},
                    {"value": "week", "label": "📅 Week (5-7 days)", "description": "Standard vacations"},
                    {"value": "extended", "label": "🌍 Extended (10+ days)", "description": "Long explorations"}
                ]
            }
        }
    }


@app.post("/api/compare-destinations", response_model=DestinationComparisonResponse)
async def compare_destinations(
    request: DestinationComparisonRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Compare two destinations and provide data-driven analysis.
    Example: "Coorg vs Ooty for a family trip"
    """
    try:
        destination_a = request.destination_a
        destination_b = request.destination_b
        context = request.trip_context or "general travel"
        
        # Create comparison prompt for Gemini
        comparison_prompt = f"""You are an expert travel advisor specializing in Indian destinations. 
        
A user wants to compare two destinations:
- **Destination A**: {destination_a}
- **Destination B**: {destination_b}
- **Trip Context**: {context}

Your task is to provide a comprehensive, data-driven comparison to help them decide.

**RESEARCH REQUIREMENTS**:
1. Use get_minimum_daily_budget for BOTH destinations to get real budget data
2. Use get_travel_advisory for BOTH destinations to check safety, permits, weather
3. Use find_authentic_local_food for BOTH destinations to discover local cuisine
4. Research current activities, attractions, and best times to visit

**COMPARISON STRUCTURE** (use this exact format):

## 🏆 Quick Verdict
[One clear sentence: Which destination wins for this specific trip context and why]

---

## 💰 Budget Comparison

### {destination_a}
- **Daily Budget Range**: [from research]
- **Budget Tier**: [Budget-friendly/Moderate/Luxury based on ₹/day]
- **Cost Highlights**: [Key expenses - accommodation, transport, food, activities]

### {destination_b}
- **Daily Budget Range**: [from research]
- **Budget Tier**: [Budget-friendly/Moderate/Luxury based on ₹/day]
- **Cost Highlights**: [Key expenses - accommodation, transport, food, activities]

**Winner**: [Which is more budget-friendly? By how much?]

---

## 🎯 Best For

### {destination_a}
[Who is this destination perfect for? Families? Couples? Solo? Adventure seekers?]

### {destination_b}
[Who is this destination perfect for?]

**Winner**: [Which better matches the trip context: "{context}"?]

---

## 🏞️ Activities & Attractions

### {destination_a}
- Top 3-5 must-do activities
- Unique experiences

### {destination_b}
- Top 3-5 must-do activities
- Unique experiences

**Winner**: [Which offers better activities for "{context}"?]

---

## 🍽️ Food & Cuisine

### {destination_a}
- **Signature Dishes**: [from find_authentic_local_food]
- **Local Food Scene**: [street stalls, hidden gems]
- **Foodie Rating**: [Rate 1-5 stars]

### {destination_b}
- **Signature Dishes**: [from find_authentic_local_food]
- **Local Food Scene**: [street stalls, hidden gems]
- **Foodie Rating**: [Rate 1-5 stars]

**Winner**: [Which has better authentic food experiences?]

---

## 🌤️ Weather & Best Time

### {destination_a}
- **Best Months**: [Peak season]
- **Weather Now**: [Current conditions if researched]
- **Crowd Level**: [Peak/Moderate/Low]

### {destination_b}
- **Best Months**: [Peak season]
- **Weather Now**: [Current conditions if researched]
- **Crowd Level**: [Peak/Moderate/Low]

**Winner**: [Which is better right now or for planned dates?]

---

## 🛡️ Safety & Accessibility

### {destination_a}
- **Safety Level**: [from travel advisory]
- **Permits Needed**: [Yes/No - what permits]
- **Accessibility**: [How easy to reach - nearest airport/station]

### {destination_b}
- **Safety Level**: [from travel advisory]
- **Permits Needed**: [Yes/No - what permits]
- **Accessibility**: [How easy to reach]

**Winner**: [Which is easier/safer to visit?]

---

## ✅ Final Recommendation

**For "{context}", we recommend: [{destination_a} or {destination_b}]**

**Why**: [2-3 sentences explaining the decisive factors - budget, activities, food, timing, safety, etc. Be specific with data points.]

**Runner-Up Note**: [1 sentence on when the other destination might be better]

---

**CRITICAL RULES**:
1. You MUST use research tools - no generic advice
2. Every comparison section MUST have a clear "Winner" 
3. Use real data (₹ amounts, specific dishes, actual safety info)
4. Be decisive but fair
5. Final recommendation must be crystal clear - ONE destination wins
6. Format output in clean Markdown with emojis as shown above
"""

        # Use Gemini with research tools to generate comparison
        llm = ChatGoogleGenerativeAI(
            model="models/gemini-2.5-flash",
            temperature=0.7,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # Create agent for comparison
        comparison_agent = create_react_agent(llm, RESEARCH_TOOLS)
        
        # Run comparison
        print(f"\n{'='*60}")
        print(f"🔍 COMPARING: {destination_a} vs {destination_b}")
        print(f"📝 Context: {context}")
        print(f"{'='*60}\n")
        
        result = comparison_agent.invoke({
            "messages": [{"role": "user", "content": comparison_prompt}]
        })
        
        # Extract final response
        final_message = result["messages"][-1]
        comparison_analysis = final_message.content
        
        print(f"\n{'='*60}")
        print(f"✅ COMPARISON COMPLETE")
        print(f"{'='*60}\n")
        
        return DestinationComparisonResponse(
            success=True,
            message=f"Successfully compared {destination_a} and {destination_b}",
            comparison_analysis=comparison_analysis
        )
        
    except Exception as e:
        print(f"❌ Comparison error: {str(e)}")
        import traceback
        traceback.print_exc()
        return DestinationComparisonResponse(
            success=False,
            message=f"Failed to compare destinations: {str(e)}",
            comparison_analysis=None
        )


@app.get("/api/for-you", response_model=dict)
async def get_for_you_suggestions(
    current_user: FirebaseUser = Depends(get_current_user),
    refresh: bool = True,  # Changed default to True to always get fresh suggestions
    _: str = None  # Cache buster parameter
):
    """
    Get personalized 'For You' destination suggestions based on user's preferences,
    trip history, and current events/seasons.
    
    Parameters:
    - refresh: If True, regenerate suggestions (default: True for fresh results)
    - _: Cache buster parameter (ignored, just prevents caching)
    
    Returns 4 categories:
    1. Perfect Match - Ideal destination based on preferences
    2. Trending Now - Current events/festivals/seasonal attractions
    3. Hidden Gem - Off-beat discovery matching their style
    4. Seasonal Special - Perfect for current month/season with time-sensitive appeal
    """
    try:
        user_id = current_user.uid
        print(f"\n{'='*60}")
        print(f"🔄 NEW REQUEST: Generating suggestions for user {user_id}")
        print(f"{'='*60}")
        
        # Get user's data
        user_prefs = firestore_service.get_user_profile(user_id=user_id)
        all_trips = firestore_service.get_user_trip_plans(user_id=user_id)
        
        # Get learned preferences from trip history
        learned_prefs = {}
        destinations_visited = []
        saved_destinations = []
        saved_dest_names = []
        interests_list = []
        
        if all_trips:
            for trip in all_trips:
                if trip.get("destination"):
                    destinations_visited.append(trip.get("destination"))
                if trip.get("interests"):
                    interests_list.extend(trip.get("interests") if isinstance(trip.get("interests"), list) else [trip.get("interests")])
        
        # Get user preferences for interests
        if user_prefs and user_prefs.get("preferences"):
            prefs = user_prefs.get("preferences", {})
            if prefs.get("interests"):
                interests_list.extend(prefs.get("interests"))
        
        # Remove duplicates
        interests_list = list(set(interests_list))
        destinations_visited = list(set(destinations_visited))
        if all_trips:
            for trip in all_trips[:3]:
                if trip.get("interests"):
                    interests_list.append(trip.get("interests"))
        
        total_budget = sum(trip.get("budget", 0) for trip in all_trips) if all_trips else 0
        avg_budget = (total_budget / len(all_trips)) if all_trips else 50000
        avg_days = (sum(trip.get("num_days", 0) for trip in all_trips) / len(all_trips)) if all_trips else 5
        
        # Use profile budget preference to set realistic baseline
        if user_prefs and user_prefs.get("preferences", {}).get("budget_preference"):
            budget_pref = user_prefs["preferences"]["budget_preference"].lower()
            if budget_pref == "budget" or budget_pref == "low":
                avg_budget = max(avg_budget, 30000)  # Minimum ₹30k for budget trips
            elif budget_pref == "moderate" or budget_pref == "medium":
                avg_budget = max(avg_budget, 50000)  # Minimum ₹50k for moderate
            elif budget_pref == "luxury" or budget_pref == "high":
                avg_budget = max(avg_budget, 80000)  # Minimum ₹80k for luxury
        
        # Ensure minimum realistic budget per day (₹5000/day minimum)
        min_trip_budget = avg_days * 5000
        avg_budget = max(avg_budget, min_trip_budget)
        
        # Calculate budget range for suggestions (will be used by AI and validation)
        budget_lower = int(avg_budget * 0.8)
        budget_upper = int(avg_budget * 1.4)
        
        print(f"💰 Budget range for suggestions: ₹{budget_lower:,} - ₹{budget_upper:,}")
        
        # Build preference context
        preference_context = ""
        if user_prefs:
            prefs = user_prefs.get("preferences", {})
            if prefs.get("interests"):
                preference_context += f"\n- Saved Interests: {', '.join(prefs['interests'])}"
            if prefs.get("travel_style"):
                travel_style = prefs.get("travel_style")
                if isinstance(travel_style, str):
                    preference_context += f"\n- Travel Style: {travel_style}"
                elif isinstance(travel_style, list):
                    preference_context += f"\n- Travel Style: {', '.join(travel_style)}"
            if prefs.get("budget_preference"):
                preference_context += f"\n- Budget: {prefs.get('budget_preference')}"
            if user_prefs.get("preferred_destinations"):
                preference_context += f"\n- Loves: {', '.join(user_prefs['preferred_destinations'])}"
        
        if learned_prefs:
            if learned_prefs.get("recurring_interests"):
                preference_context += f"\n- Proven Loves: {', '.join(learned_prefs['recurring_interests'])} (from history)"
            if learned_prefs.get("spending_pattern"):
                preference_context += f"\n- Spending: {learned_prefs['spending_pattern']}"
        
        current_month = datetime.now().strftime("%B")
        current_year = datetime.now().year
        
        # Generate suggestions using Tavily for real-time discovery
        suggestions = []
        
        # Build search context for Tavily
        interests_str = ', '.join(interests_list[:3]) if interests_list else 'travel'
        travel_style = user_prefs.get("preferences", {}).get("travel_style", "adventure") if user_prefs else "adventure"
        
        try:
            # Use Tavily to search for real destinations
            from langchain_community.tools.tavily_search import TavilySearchResults
            
            tavily_api_key = os.getenv("TAVILY_API_KEY")
            if not tavily_api_key:
                print("⚠️ TAVILY_API_KEY not found, using AI-only suggestions")
                raise Exception("Tavily not configured")
            
            tavily_search = TavilySearchResults(
                max_results=5,
                api_key=tavily_api_key
            )
            
            # Search for trending destinations
            search_query = f"best {travel_style} destinations in India {current_month} {current_year} festivals events {interests_str}"
            print(f"🔍 Searching Tavily: {search_query}")
            
            search_results = tavily_search.invoke(search_query)
            
            # Extract destination insights from Tavily results
            tavily_context = "\n".join([
                f"- {result.get('content', '')[:200]}..." 
                for result in search_results[:3]
            ])
            
            # Now use AI with Tavily's real-time data
            suggestion_prompt = f"""You are an expert Indian travel advisor. Create 4 HIGHLY PERSONALIZED "For You" destination suggestions using REAL-TIME information.

**USER PROFILE**:
- Past Trips: {', '.join(destinations_visited) if destinations_visited else 'First-time traveler'}
- History: {len(all_trips)} trips  
- Interests: {', '.join(interests_list) if interests_list else 'General'}
- Budget: ₹{avg_budget:,.0f} avg
- Duration: {avg_days:.0f} days avg
{preference_context}

**CURRENT DATE**: {current_month} {current_year}

**REAL-TIME TRAVEL INSIGHTS** (from web search):
{tavily_context}

**CREATE 4 SUGGESTIONS** (exactly one from each category):

1. **PERFECT MATCH**: The IDEAL next destination based on their proven preferences
2. **TRENDING NOW**: Current festival/event/destination trending RIGHT NOW (use Tavily data)
3. **HIDDEN GEM**: Off-beat place matching their style but not mainstream
4. **SEASONAL SPECIAL**: Perfect for current month/season with time-sensitive appeal

**BUDGET GUIDELINES** (be REALISTIC - assuming 5-day trip):
- User's budget range: ₹{budget_lower:,} - ₹{budget_upper:,} (calculated from their profile)
- Island destinations (Andaman, Lakshadweep): **MINIMUM ₹50,000-80,000** (flights ₹15k-25k + hotels ₹8k-15k + food ₹5k-8k)
- Hill stations (Manali, Shimla, Rishikesh, Coorg): **MINIMUM ₹30,000-50,000** (transport ₹8k-12k + stay ₹7k-10k + activities ₹5k-8k)
- Metro cities (Delhi, Mumbai, Bangalore): **MINIMUM ₹30,000-60,000** (hotels ₹10k-15k + food ₹6k-10k + local ₹4k-6k)
- Tier-2 cities (Jaipur, Udaipur, Kochi): **MINIMUM ₹25,000-45,000** (transport ₹6k-10k + stay ₹5k-8k + food ₹4k-6k)
- Remote areas (Ladakh, Spiti, Northeast): **MINIMUM ₹40,000-70,000** (permits + difficult access + high costs)
- **CRITICAL**: Use user's calculated range ₹{budget_lower:,} - ₹{budget_upper:,} as baseline
- **NEVER** quote below ₹25,000 for any destination
- Adjust for destination type, but stay within or above user's range

**COST BREAKDOWN REALITY CHECK**:
- Budget accommodation: ₹1,500-2,500/night = ₹7,500-12,500 for 5 nights
- Mid-range hotels: ₹3,000-5,000/night = ₹15,000-25,000 for 5 nights  
- Food (3 meals): ₹800-1,500/day = ₹4,000-7,500 for 5 days
- Local transport: ₹500-1,000/day = ₹2,500-5,000 for 5 days
- Activities/entry fees: ₹3,000-8,000 total
- Travel to/from destination: ₹5,000-20,000 depending on distance
- **TOTAL REALISTIC 5-DAY TRIP: ₹25,000-50,000 MINIMUM**

**REQUIREMENTS**:
- Use "You/Your" language
- Reference SPECIFIC user data
- Use REAL events/festivals from Tavily search results
- Include TIMELY elements (what's happening NOW or next 1-2 months)
- Make it PERSONAL and compelling
- All destinations must be in INDIA
- **BUDGET MUST BE REALISTIC** - consider flights, hotels, activities, food

JSON format (ONLY valid JSON, no markdown):
[
  {{
    "destination": "Place Name, State",
    "title": "Personal title using 'You/Your'",
    "description": "Why this destination matches their interests perfectly",
    "reason": "Specific reason based on their profile + current events",
    "estimated_budget": "₹X,XXX - ₹Y,XXX",
    "best_time": "Current month or next 1-2 months",
    "category": "perfect_match|trending_now|hidden_gem|seasonal_special",
    "urgency": "Time-sensitive reason or null",
    "tags": ["tag1", "tag2", "tag3"],
    "events": [
      {{
        "name": "Event/Festival name",
        "date": "Month Year or specific date",
        "link": "URL to event info (if available) or null"
      }}
    ],
    "foods": [
      {{
        "name": "Local specialty dish name",
        "emoji": "🍽️",
        "recipeLink": "URL to recipe or restaurant info (if available) or null"
      }}
    ]
  }}
]

**IMPORTANT**: 
- Include at least 1-2 events (festivals, concerts, exhibitions happening NOW or soon)
- Include at least 2-3 local food specialties
- Use Tavily search results to find REAL current events
- Events should be time-relevant (happening in next 1-3 months)

Return ONLY the JSON array, no other text.
"""
            
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                temperature=0.9,  # Higher temperature for more variation
                google_api_key=os.getenv("GOOGLE_API_KEY")
            )
            
            print(f"🎯 Generating AI-powered 'For You' suggestions with Tavily data")
            print(f"📊 User budget baseline: ₹{avg_budget:,.0f} for {avg_days:.0f} days")
            response = llm.invoke(suggestion_prompt)
            suggestions_text = response.content.strip()
            
            import json
            import re
            
            # Clean up markdown formatting
            if "```json" in suggestions_text:
                suggestions_text = suggestions_text.split("```json")[1].split("```")[0].strip()
            elif "```" in suggestions_text:
                suggestions_text = suggestions_text.split("```")[1].split("```")[0].strip()
            
            # Parse JSON
            suggestions_data = json.loads(suggestions_text)
            suggestions = suggestions_data[:4]
            
            # Validate and fix unrealistic budgets
            for suggestion in suggestions:
                if 'estimated_budget' in suggestion:
                    # Remove .0 from decimals and ensure proper comma formatting
                    budget_str = str(suggestion['estimated_budget'])
                    budget_str = re.sub(r'(\d),(\d{3})\.0', r'\1,\2', budget_str)
                    budget_str = re.sub(r'(\d)\.0', r'\1', budget_str)
                    
                    # Extract numbers from budget string (remove ₹ and commas)
                    numbers = re.findall(r'[\d,]+', budget_str.replace('₹', ''))
                    if len(numbers) >= 2:
                        try:
                            lower = int(numbers[0].replace(',', ''))
                            upper = int(numbers[1].replace(',', ''))
                            
                            # ABSOLUTE MINIMUM ENFORCEMENT
                            absolute_minimum = 25000  # No trip under 25k
                            
                            # Validate based on destination type with STRICT minimums
                            destination = suggestion.get('destination', '').lower()
                            min_budget = 30000  # Default minimum raised to 30k
                            
                            # Island destinations need higher budget
                            if any(x in destination for x in ['andaman', 'lakshadweep', 'island']):
                                min_budget = 55000
                            # Remote/adventure destinations
                            elif any(x in destination for x in ['ladakh', 'spiti', 'kashmir', 'arunachal', 'sikkim']):
                                min_budget = 45000
                            # Major metros and popular tourist spots
                            elif any(x in destination for x in ['mumbai', 'delhi', 'bangalore', 'goa', 'rishikesh', 'manali', 'shimla', 'mussoorie', 'nainital']):
                                min_budget = 32000
                            # Hill stations
                            elif any(x in destination for x in ['darjeeling', 'ooty', 'kodaikanal', 'coorg', 'munnar']):
                                min_budget = 28000
                            
                            # FORCE OVERRIDE if budget is too low
                            if upper < absolute_minimum:
                                # Budget is completely unrealistic, use defaults
                                lower = budget_lower
                                upper = budget_upper
                                print(f"🚨 CRITICAL: Budget too low for {destination} - forcing to ₹{lower:,} - ₹{upper:,}")
                            elif upper < min_budget:
                                # Below minimum for destination type
                                lower = min_budget
                                upper = int(min_budget * 1.5)
                                print(f"⚠️ Adjusted {destination}: was ₹{numbers[1]}, now ₹{upper:,}")
                            elif lower < min_budget * 0.75:
                                # Lower bound too low
                                lower = int(min_budget * 0.85)
                                upper = max(upper, int(min_budget * 1.4))
                                print(f"⚠️ Raised lower bound for {destination}: ₹{lower:,} - ₹{upper:,}")
                            
                            suggestion['estimated_budget'] = f"₹{lower:,} - ₹{upper:,}"
                        except Exception as ex:
                            print(f"⚠️ Budget parsing error: {ex}, using calculated range")
                            suggestion['estimated_budget'] = f"₹{budget_lower:,} - ₹{budget_upper:,}"
                    else:
                        # If can't parse, use calculated range
                        print(f"⚠️ Could not parse budget, using ₹{budget_lower:,} - ₹{budget_upper:,}")
                        suggestion['estimated_budget'] = f"₹{budget_lower:,} - ₹{budget_upper:,}"
            
            print(f"✅ Generated {len(suggestions)} personalized suggestions with Tavily data")
            
            # Add image URLs to each suggestion
            for suggestion in suggestions:
                suggestion['image_url'] = generate_destination_image_url(suggestion['destination'])
            
        except Exception as e:
            print(f"⚠️ Tavily/AI generation failed: {e}, using fallback")
            # Fallback suggestions
            suggestions = [
                {
                    "destination": "Coorg, Karnataka",
                    "title": "Your Perfect Nature Escape",
                    "description": "Coffee plantations and misty hills await",
                    "reason": f"Matches your ₹{avg_budget:,.0f} budget and love for nature",
                    "estimated_budget": f"₹{int(avg_budget * 0.8):,} - ₹{int(avg_budget * 1.2):,}",
                    "best_time": f"{current_month} is ideal",
                    "category": "perfect_match",
                    "urgency": None,
                    "tags": ["nature", "relaxation", "coffee"],
                    "image_url": generate_destination_image_url("Coorg"),
                    "events": [
                        {"name": "Coffee Blossom Festival", "date": "November 2025", "link": None},
                        {"name": "Coorg Adventure Festival", "date": "December 2025", "link": None}
                    ],
                    "foods": [
                        {"name": "Pandi Curry (Pork Curry)", "emoji": "🍛", "recipeLink": None},
                        {"name": "Kadambuttu (Rice Dumplings)", "emoji": "🍚", "recipeLink": None},
                        {"name": "Bamboo Shoot Curry", "emoji": "🥘", "recipeLink": None}
                    ]
                }
            ]
        
        # If no suggestions, provide default
        if not suggestions:
            suggestions = [
                {
                    "destination": "Kerala",
                    "title": "Start Your Journey Here",
                    "description": "God's Own Country welcomes you",
                    "reason": "Perfect for first-time travelers",
                    "estimated_budget": "₹40,000 - ₹70,000",
                    "best_time": f"{current_month} - Great weather",
                    "category": "perfect_match",
                    "urgency": None,
                    "tags": ["nature", "backwaters", "culture"],
                    "image_url": generate_destination_image_url("Kerala"),
                    "events": [
                        {"name": "Nehru Trophy Boat Race", "date": "November 2025", "link": None},
                        {"name": "International Film Festival", "date": "December 2025", "link": None}
                    ],
                    "foods": [
                        {"name": "Appam with Stew", "emoji": "🥞", "recipeLink": None},
                        {"name": "Kerala Sadya", "emoji": "🍛", "recipeLink": None},
                        {"name": "Puttu and Kadala", "emoji": "🍚", "recipeLink": None}
                    ]
                }
            ]
        
        # Print final budgets for debugging
        print(f"\n📊 FINAL SUGGESTIONS:")
        for i, sug in enumerate(suggestions, 1):
            print(f"   {i}. {sug.get('destination')}: {sug.get('estimated_budget')}")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "message": "For You suggestions generated",
            "suggestions": suggestions,
            "personalization_score": min(100, (len(all_trips) * 10) + (20 if user_prefs else 0) + (20 if learned_prefs else 0)),
            "user_context": {
                "trips_count": len(all_trips),
                "has_preferences": bool(user_prefs),
                "has_learned_patterns": bool(learned_prefs),
                "saved_destinations_count": len(saved_destinations)
            },
            "generated_at": datetime.now().isoformat()  # Add timestamp to break cache
        }
        
    except Exception as e:
        print(f"❌ For You error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


# ============================================================================
# TRENDING SUGGESTIONS ENDPOINT (PUBLIC, NO AUTH REQUIRED)
# ============================================================================

@app.get("/api/trending", response_model=TrendingSuggestionsResponse)
async def get_trending_suggestions():
    """
    Get trending destinations and upcoming events for all users.
    """
    try:
        # Fast-safe fallback implementation for trending suggestions to avoid heavy LLM calls
        cached = trending_cache.get_cache()
        if cached:
            print("📦 Returning cached trending data")
            return cached

        now = datetime.now()
        response_data = TrendingSuggestionsResponse(
            success=True,
            message="Trending suggestions (fallback)",
            trending_destinations=[],
            upcoming_events=[],
            cache_timestamp=now,
            valid_until=now + timedelta(hours=trending_cache.cache_duration_hours)
        )

        trending_cache.set_cache(response_data)
        return response_data
    except Exception as e:
        print(f"❌ Trending generation error (fallback): {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint to clear trending cache (for testing/debugging)
@app.post("/api/trending/clear-cache")
async def clear_trending_cache():
    """Clear the trending suggestions cache to force regeneration"""
    global trending_cache
    trending_cache.cached_data = None
    trending_cache.cache_timestamp = None
    return {
        "success": True,
        "message": "Trending cache cleared. Next request will generate fresh data."
    }


# ============================================================================
# HOME PAGE DATA ENDPOINT (PUBLIC)
# ============================================================================

@app.get("/api/home-data")
async def get_home_data():
    """
    Get home page data including trending destinations and popular foods.
    This endpoint is PUBLIC and provides curated content for the landing page.
    """
    try:
        # Trending destinations for home page
        destinations = [
            {
                "id": 1,
                "name": "Goa",
                "description": "Beaches, nightlife, and Portuguese heritage",
                "estimatedBudget": "₹15,000 - ₹40,000",
                "idealDuration": "3-5 days",
                "bestTime": "Nov - Feb",
                "highlights": ["Beaches", "Water Sports", "Nightlife", "Seafood"],
                "imageUrl": generate_destination_image_url("Goa")
            },
            {
                "id": 2,
                "name": "Manali",
                "description": "Himalayan adventure and snow-capped mountains",
                "estimatedBudget": "₹20,000 - ₹50,000",
                "idealDuration": "4-6 days",
                "bestTime": "Oct - Jun",
                "highlights": ["Trekking", "Skiing", "Temples", "Adventure"],
                "imageUrl": generate_destination_image_url("Manali")
            },
            {
                "id": 3,
                "name": "Jaipur",
                "description": "Royal palaces and vibrant culture",
                "estimatedBudget": "₹18,000 - ₹45,000",
                "idealDuration": "3-4 days",
                "bestTime": "Oct - Mar",
                "highlights": ["Forts", "Palaces", "Shopping", "Heritage"],
                "imageUrl": generate_destination_image_url("Jaipur")
            },
            {
                "id": 4,
                "name": "Kerala",
                "description": "Backwaters, beaches, and lush greenery",
                "estimatedBudget": "₹25,000 - ₹60,000",
                "idealDuration": "5-7 days",
                "bestTime": "Sep - Mar",
                "highlights": ["Houseboats", "Beaches", "Wildlife", "Ayurveda"],
                "imageUrl": generate_destination_image_url("Kerala")
            },
            {
                "id": 5,
                "name": "Rishikesh",
                "description": "Yoga capital and adventure hub",
                "estimatedBudget": "₹12,000 - ₹30,000",
                "idealDuration": "3-4 days",
                "bestTime": "Sep - Nov, Mar - May",
                "highlights": ["Yoga", "Rafting", "Temples", "Camping"],
                "imageUrl": generate_destination_image_url("Rishikesh")
            },
            {
                "id": 6,
                "name": "Ladakh",
                "description": "High-altitude desert and pristine lakes",
                "estimatedBudget": "₹40,000 - ₹80,000",
                "idealDuration": "6-8 days",
                "bestTime": "Jun - Sep",
                "highlights": ["Monasteries", "Pangong Lake", "Biking", "Mountains"],
                "imageUrl": generate_destination_image_url("Ladakh")
            },
            {
                "id": 7,
                "name": "Udaipur",
                "description": "City of Lakes and royal heritage",
                "estimatedBudget": "₹22,000 - ₹50,000",
                "idealDuration": "3-4 days",
                "bestTime": "Oct - Mar",
                "highlights": ["Palaces", "Lakes", "Culture", "Boat Rides"],
                "imageUrl": generate_destination_image_url("Udaipur")
            },
            {
                "id": 8,
                "name": "Coorg",
                "description": "Coffee plantations and misty hills",
                "estimatedBudget": "₹18,000 - ₹35,000",
                "idealDuration": "3-4 days",
                "bestTime": "Oct - Mar",
                "highlights": ["Coffee", "Waterfalls", "Trekking", "Nature"],
                "imageUrl": generate_destination_image_url("Coorg")
            }
        ]
        
        # Popular Indian foods
        foods = [
            {
                "id": 1,
                "dish": "Gajar Ka Halwa",
                "location": "All across India",
                "description": "Traditional carrot dessert with nuts and khoya",
                "cuisine": "North Indian",
                "priceRange": "₹100 - ₹300",
                "season": "Winter",
                "imageUrl": generate_food_image_url("Gajar Ka Halwa")
            },
            {
                "id": 2,
                "dish": "Hyderabadi Biryani",
                "location": "Hyderabad, Telangana",
                "description": "Aromatic rice with tender meat and spices",
                "cuisine": "Hyderabadi",
                "priceRange": "₹200 - ₹500",
                "imageUrl": generate_food_image_url("Hyderabadi Biryani")
            },
            {
                "id": 3,
                "dish": "Modak",
                "location": "Maharashtra",
                "description": "Sweet dumpling filled with coconut and jaggery",
                "cuisine": "Maharashtrian",
                "priceRange": "₹50 - ₹150",
                "specialOccasion": "Ganesh Chaturthi",
                "imageUrl": generate_food_image_url("Modak")
            },
            {
                "id": 4,
                "dish": "Mango Lassi",
                "location": "Punjab",
                "description": "Refreshing yogurt drink with mango pulp",
                "cuisine": "Punjabi",
                "priceRange": "₹80 - ₹200",
                "season": "Summer",
                "imageUrl": generate_food_image_url("Mango Lassi")
            },
            {
                "id": 5,
                "dish": "Ghevar",
                "location": "Rajasthan",
                "description": "Disc-shaped sweet soaked in sugar syrup",
                "cuisine": "Rajasthani",
                "priceRange": "₹150 - ₹400",
                "specialOccasion": "Teej Festival",
                "imageUrl": generate_food_image_url("Ghevar")
            },
            {
                "id": 6,
                "dish": "Kashmiri Kahwa",
                "location": "Kashmir",
                "description": "Traditional green tea with saffron and spices",
                "cuisine": "Kashmiri",
                "priceRange": "₹100 - ₹250",
                "season": "Winter",
                "imageUrl": generate_food_image_url("Kashmiri Kahwa")
            }
        ]
        
        return {
            "success": True,
            "message": "Home page data loaded successfully",
            "destinations": destinations,
            "foods": foods
        }
    
    except Exception as e:
        print(f"❌ Home data error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DASHBOARD SUGGESTIONS ENDPOINT (AUTHENTICATED)
# ============================================================================

@app.get("/api/dashboard-suggestions")
async def get_dashboard_suggestions(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get dashboard 'For You' suggestions with destinations, events, and foods.
    This provides the data for the PersonalizedSuggestions component.
    """
    try:
        # Mock personalized destinations based on user
        destinations = [
            {
                "id": 1,
                "destination": "Coorg, Karnataka",
                "reason": "Perfect for nature lovers like you! Similar to your Kerala trip.",
                "matchScore": 95,
                "estimatedBudget": "₹18,000 - ₹35,000",
                "idealDuration": "3-4 days",
                "highlights": ["Coffee Plantations", "Waterfalls", "Trekking", "Wildlife"],
                "bestTime": "Oct - Mar",
                "imageUrl": generate_destination_image_url("Coorg Karnataka")
            },
            {
                "id": 2,
                "destination": "Udaipur, Rajasthan",
                "reason": "Based on your love for heritage sites. Matches your Jaipur preferences.",
                "matchScore": 92,
                "estimatedBudget": "₹22,000 - ₹50,000",
                "idealDuration": "3-4 days",
                "highlights": ["Palaces", "Lakes", "Royal Culture", "Boat Rides"],
                "bestTime": "Sep - Mar",
                "imageUrl": generate_destination_image_url("Udaipur Rajasthan")
            },
            {
                "id": 3,
                "destination": "Spiti Valley, HP",
                "reason": "For the adventurer in you! Perfect for your next big trip.",
                "matchScore": 88,
                "estimatedBudget": "₹30,000 - ₹55,000",
                "idealDuration": "6-8 days",
                "highlights": ["Mountains", "Monasteries", "High Altitude", "Stargazing"],
                "bestTime": "May - Oct",
                "imageUrl": generate_destination_image_url("Spiti Valley")
            },
            {
                "id": 4,
                "destination": "Andaman Islands",
                "reason": "Trending now! Beach paradise within your usual budget range.",
                "matchScore": 85,
                "estimatedBudget": "₹35,000 - ₹70,000",
                "idealDuration": "5-7 days",
                "highlights": ["Beaches", "Scuba Diving", "Water Sports", "Marine Life"],
                "bestTime": "Oct - May",
                "imageUrl": generate_destination_image_url("Andaman Islands")
            },
            {
                "id": 5,
                "destination": "Hampi, Karnataka",
                "reason": "Ancient ruins and heritage. Matches your cultural interests.",
                "matchScore": 90,
                "estimatedBudget": "₹15,000 - ₹30,000",
                "idealDuration": "2-3 days",
                "highlights": ["UNESCO Site", "Temples", "Bouldering", "History"],
                "bestTime": "Oct - Feb",
                "imageUrl": generate_destination_image_url("Hampi Karnataka")
            },
            {
                "id": 6,
                "destination": "Munnar, Kerala",
                "reason": "Tea gardens and cool climate. Perfect weekend getaway.",
                "matchScore": 87,
                "estimatedBudget": "₹20,000 - ₹40,000",
                "idealDuration": "3-4 days",
                "highlights": ["Tea Plantations", "Hills", "Wildlife", "Waterfalls"],
                "bestTime": "Sep - May",
                "imageUrl": generate_destination_image_url("Munnar Kerala")
            },
            {
                "id": 7,
                "destination": "Pondicherry",
                "reason": "French charm and beaches. Great for relaxation.",
                "matchScore": 84,
                "estimatedBudget": "₹18,000 - ₹38,000",
                "idealDuration": "3-4 days",
                "highlights": ["Beaches", "French Quarter", "Auroville", "Cafes"],
                "bestTime": "Oct - Mar",
                "imageUrl": generate_destination_image_url("Pondicherry")
            },
            {
                "id": 8,
                "destination": "Darjeeling",
                "reason": "Tea gardens and Himalayan views. Perfect hill station.",
                "matchScore": 89,
                "estimatedBudget": "₹25,000 - ₹45,000",
                "idealDuration": "4-5 days",
                "highlights": ["Tea Gardens", "Toy Train", "Kanchenjunga", "Monasteries"],
                "bestTime": "Mar - May, Oct - Dec",
                "imageUrl": generate_destination_image_url("Darjeeling")
            }
        ]
        
        # Events
        events = [
            {
                "id": 1,
                "name": "Diwali Celebrations",
                "location": "Varanasi, UP",
                "date": "Oct - Nov 2025",
                "type": "Festival",
                "description": "Experience the grandeur of Diwali in the spiritual capital",
                "imageUrl": generate_event_image_url("Diwali Celebrations")
            },
            {
                "id": 2,
                "name": "Pushkar Camel Fair",
                "location": "Pushkar, Rajasthan",
                "date": "November 2025",
                "type": "Cultural",
                "description": "World's largest camel fair with vibrant cultural events",
                "imageUrl": generate_event_image_url("Pushkar Camel Fair")
            },
            {
                "id": 3,
                "name": "Goa Carnival",
                "location": "Goa",
                "date": "February 2026",
                "type": "Festival",
                "description": "Colorful parades, music, and dance across Goa",
                "imageUrl": generate_event_image_url("Goa Carnival")
            },
            {
                "id": 4,
                "name": "Hornbill Festival",
                "location": "Kohima, Nagaland",
                "date": "December 2025",
                "type": "Cultural",
                "description": "Festival of festivals showcasing Naga culture",
                "imageUrl": generate_event_image_url("Hornbill Festival")
            },
            {
                "id": 5,
                "name": "Holi Festival",
                "location": "Mathura-Vrindavan, UP",
                "date": "March 2026",
                "type": "Festival",
                "description": "Celebrate colors in the birthplace of Lord Krishna",
                "imageUrl": generate_event_image_url("Holi Festival")
            },
            {
                "id": 6,
                "name": "Hemis Festival",
                "location": "Leh, Ladakh",
                "date": "June-July 2026",
                "type": "Cultural",
                "description": "Tibetan Buddhist festival at Hemis Monastery",
                "imageUrl": generate_event_image_url("Hemis Festival")
            }
        ]
        
        # Foods
        foods = [
            {
                "id": 1,
                "dish": "Hyderabadi Biryani",
                "location": "Paradise Restaurant, Hyderabad",
                "cuisine": "Hyderabadi",
                "priceRange": "₹300 - ₹600",
                "mustTry": "Dum Biryani at Paradise",
                "season": "Year-round",
                "imageUrl": generate_food_image_url("Hyderabadi Biryani")
            },
            {
                "id": 2,
                "dish": "Masala Dosa",
                "location": "MTR, Bangalore",
                "cuisine": "South Indian",
                "priceRange": "₹80 - ₹200",
                "mustTry": "Crispy dosa with potato filling",
                "imageUrl": generate_food_image_url("Masala Dosa")
            },
            {
                "id": 3,
                "dish": "Gajar Ka Halwa",
                "location": "Old Delhi",
                "cuisine": "North Indian",
                "priceRange": "₹100 - ₹300",
                "mustTry": "Winter special with khoya",
                "season": "Winter",
                "imageUrl": generate_food_image_url("Gajar Ka Halwa")
            },
            {
                "id": 4,
                "dish": "Modak",
                "location": "Mumbai",
                "cuisine": "Maharashtrian",
                "priceRange": "₹50 - ₹150",
                "mustTry": "Steamed modak",
                "specialOccasion": "Ganesh Chaturthi",
                "imageUrl": generate_food_image_url("Modak")
            },
            {
                "id": 5,
                "dish": "Mango Lassi",
                "location": "Amritsar",
                "cuisine": "Punjabi",
                "priceRange": "₹80 - ₹200",
                "mustTry": "Fresh mango lassi",
                "season": "Summer",
                "imageUrl": generate_food_image_url("Mango Lassi")
            },
            {
                "id": 6,
                "dish": "Litti Chokha",
                "location": "Patna, Bihar",
                "cuisine": "Bihari",
                "priceRange": "₹60 - ₹150",
                "mustTry": "Traditional wood-fired litti",
                "imageUrl": generate_food_image_url("Litti Chokha")
            },
            {
                "id": 7,
                "dish": "Dhokla",
                "location": "Ahmedabad, Gujarat",
                "cuisine": "Gujarati",
                "priceRange": "₹50 - ₹120",
                "mustTry": "Soft and fluffy khaman dhokla",
                "imageUrl": generate_food_image_url("Dhokla")
            },
            {
                "id": 8,
                "dish": "Pani Puri",
                "location": "Street stalls, Mumbai",
                "cuisine": "Street Food",
                "priceRange": "₹30 - ₹80",
                "mustTry": "Spicy tamarind water",
                "imageUrl": generate_food_image_url("Pani Puri")
            },
            {
                "id": 9,
                "dish": "Rogan Josh",
                "location": "Srinagar, Kashmir",
                "cuisine": "Kashmiri",
                "priceRange": "₹300 - ₹700",
                "mustTry": "Slow-cooked lamb curry",
                "season": "Winter",
                "imageUrl": generate_food_image_url("Rogan Josh")
            },
            {
                "id": 10,
                "dish": "Fish Curry",
                "location": "Coastal Bengal",
                "cuisine": "Bengali",
                "priceRange": "₹200 - ₹500",
                "mustTry": "Mustard-based curry",
                "imageUrl": generate_food_image_url("Bengali Fish Curry")
            },
            {
                "id": 11,
                "dish": "Vada Pav",
                "location": "Mumbai",
                "cuisine": "Street Food",
                "priceRange": "₹20 - ₹50",
                "mustTry": "Spicy potato fritter in bun",
                "imageUrl": generate_food_image_url("Vada Pav")
            },
            {
                "id": 12,
                "dish": "Rasgulla",
                "location": "Kolkata",
                "cuisine": "Bengali",
                "priceRange": "₹40 - ₹100",
                "mustTry": "Spongy cheese balls in syrup",
                "imageUrl": generate_food_image_url("Rasgulla")
            }
        ]
        
        return {
            "success": True,
            "message": "Dashboard suggestions loaded successfully",
            "destinations": destinations,
            "events": events,
            "foods": foods
        }
    
    except Exception as e:
        print(f"❌ Dashboard suggestions error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Voyage Travel Planner API",
        "version": "1.0.0",
        "features": {
            "ai_planning": True,
            "firebase_auth": True,
            "trip_history": True
        }
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    firebase_status = False
    try:
        from firebase_config import get_firestore_client
        db = get_firestore_client()
        firebase_status = db is not None
    except:
        pass
    
    return {
        "status": "healthy",
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "tavily_configured": bool(os.getenv("TAVILY_API_KEY")),
        "firebase_configured": firebase_status,
        "endpoints": {
            "public": ["/", "/health", "/api/plan-trip-from-prompt"],
            "protected": [
                "/api/trip-plans",
                "/api/saved-destinations",
                "/api/profile",
                "/api/reviews",
                "/api/taste-graph",
                "/api/booking-links"
            ]
        }
    }


# ============================================================================
# VOYAGE VERIFIED REVIEWS ENDPOINTS
# ============================================================================

@app.post("/api/reviews", response_model=VoyageVerifiedReview)
async def create_review(
    review_request: CreateReviewRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Create a new Voyage Verified review for a completed trip.
    This is the first-party data that powers the taste graph!
    """
    try:
        print(f"\n📝 Creating review for trip {review_request.trip_id}")
        print(f"   User: {current_user.email}")
        
        # Verify the trip belongs to the user
        trip = firestore_service.get_trip_plan(review_request.trip_id, current_user.uid)
        if not trip:
            raise HTTPException(
                status_code=404,
                detail="Trip not found or doesn't belong to you"
            )
        
        # Create review object
        review_id = firestore_service.generate_id()
        
        trip_review = TripReview(
            trip_id=review_request.trip_id,
            ratings=review_request.ratings,
            overall_experience=review_request.overall_experience,
            what_worked_well=review_request.what_worked_well,
            what_could_improve=review_request.what_could_improve,
            highlights=review_request.highlights,
            lowlights=review_request.lowlights,
            unexpected_discoveries=review_request.unexpected_discoveries,
            hidden_gems=review_request.hidden_gems,
            actual_spent=review_request.actual_spent,
            budget_breakdown=review_request.budget_breakdown,
            cost_surprises=review_request.cost_surprises,
            photo_urls=review_request.photo_urls,
            verified_visited=False,  # TODO: Add location verification
            travel_dates=review_request.travel_dates,
            travel_companions=review_request.travel_companions
        )
        
        verified_review = VoyageVerifiedReview(
            id=review_id,
            user_id=current_user.uid,
            trip_id=review_request.trip_id,
            review=trip_review,
            taste_graph_updated=False,
            created_at=datetime.now(),
            is_public=True,
            helpful_count=0
        )
        
        # Save to Firestore
        firestore_service.save_review(verified_review)
        
        print(f"✅ Review created: {review_id}")
        print(f"   Overall Rating: {review_request.ratings.overall}/5")
        print(f"   Highlights: {len(review_request.highlights)}")
        
        # Trigger taste graph update (async)
        try:
            taste_graph_builder = get_taste_graph_builder()
            
            # Get existing taste graph
            existing_graph = firestore_service.get_taste_graph(current_user.uid)
            
            if existing_graph:
                # Incremental update
                updated_graph = taste_graph_builder.update_taste_graph_incremental(
                    existing_graph,
                    verified_review
                )
            else:
                # Build from scratch (this review + any others)
                all_reviews = firestore_service.get_user_reviews(current_user.uid)
                updated_graph = taste_graph_builder.build_taste_graph(
                    current_user.uid,
                    all_reviews
                )
            
            # Save updated taste graph
            firestore_service.save_taste_graph(updated_graph)
            
            # Mark review as processed
            verified_review.taste_graph_updated = True
            firestore_service.update_review(review_id, {"taste_graph_updated": True})
            
            print(f"✅ Taste graph updated for user {current_user.email}")
            
        except Exception as e:
            print(f"⚠️ Taste graph update failed (non-critical): {str(e)}")
            # Don't fail the request - taste graph update is async
        
        return verified_review
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating review: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reviews", response_model=ReviewsResponse)
async def get_user_reviews(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get all reviews written by the current user
    """
    try:
        print(f"\n📚 Fetching reviews for user: {current_user.email}")
        
        reviews = firestore_service.get_user_reviews(current_user.uid)
        
        # Create summaries
        summaries = []
        total_rating = 0
        
        for review in reviews:
            # Get trip details for destination
            trip = firestore_service.get_trip_plan(review.trip_id, current_user.uid)
            destination = trip.destination if trip else "Unknown"
            
            summary = ReviewSummary(
                id=review.id,
                trip_id=review.trip_id,
                destination=destination,
                overall_rating=review.review.ratings.overall,
                overall_experience=review.review.overall_experience[:200] + "..." if len(review.review.overall_experience) > 200 else review.review.overall_experience,
                highlights_count=len(review.review.highlights),
                created_at=review.created_at,
                verified_visited=review.review.verified_visited
            )
            summaries.append(summary)
            total_rating += review.review.ratings.overall
        
        avg_rating = total_rating / len(reviews) if reviews else 0
        
        print(f"✅ Found {len(reviews)} reviews (avg rating: {avg_rating:.1f}/5)")
        
        return ReviewsResponse(
            success=True,
            message=f"Found {len(reviews)} reviews",
            reviews=summaries,
            total_reviews=len(reviews),
            average_overall_rating=avg_rating
        )
        
    except Exception as e:
        print(f"❌ Error fetching reviews: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reviews/{review_id}", response_model=VoyageVerifiedReview)
async def get_review(
    review_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get a specific review by ID
    """
    try:
        review = firestore_service.get_review(review_id, current_user.uid)
        
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        
        return review
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching review: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TASTE GRAPH ENDPOINTS
# ============================================================================

@app.get("/api/taste-graph", response_model=TasteGraphResponse)
async def get_taste_graph(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get the user's taste graph with AI-generated insights and recommendations.
    This is the personalization engine powered by reviews!
    """
    try:
        print(f"\n🧠 Fetching taste graph for user: {current_user.email}")
        
        # Get taste graph from Firestore
        taste_graph = firestore_service.get_taste_graph(current_user.uid)
        
        if not taste_graph:
            # Build taste graph from reviews
            print("   Building taste graph from reviews...")
            reviews = firestore_service.get_user_reviews(current_user.uid)
            
            if not reviews:
                print("   No reviews yet - returning empty taste graph")
                taste_graph_builder = get_taste_graph_builder()
                taste_graph = taste_graph_builder._create_empty_taste_graph(current_user.uid)
            else:
                taste_graph_builder = get_taste_graph_builder()
                taste_graph = taste_graph_builder.build_taste_graph(
                    current_user.uid,
                    reviews
                )
                # Save for future
                firestore_service.save_taste_graph(taste_graph)
        
        print(f"✅ Taste graph loaded:")
        print(f"   Total Reviews: {taste_graph.total_reviews}")
        print(f"   Total Trips: {taste_graph.total_trips}")
        print(f"   Confidence: {taste_graph.confidence_score:.2f}")
        print(f"   Destinations: {len(taste_graph.destinations)}")
        print(f"   Foods: {len(taste_graph.foods)}")
        print(f"   Activities: {len(taste_graph.activities)}")
        
        # Generate insights
        taste_graph_builder = get_taste_graph_builder()
        insights = taste_graph_builder.generate_insights(taste_graph)
        
        print(f"   Generated {len(insights)} insights")
        
        # Generate recommendations based on taste graph
        recommendations = []
        
        if taste_graph.top_preferences:
            recommendations.append(
                f"Based on your love for {taste_graph.top_preferences[0]}, "
                f"you might enjoy similar experiences in new destinations."
            )
        
        if taste_graph.preferred_trip_types:
            trip_type = taste_graph.preferred_trip_types[0]
            recommendations.append(
                f"Your {trip_type} travel style suggests destinations like "
                f"{'Ladakh, Spiti Valley' if trip_type == 'adventure' else 'Goa, Kerala' if trip_type == 'relaxation' else 'Rajasthan, Varanasi'}."
            )
        
        if taste_graph.seasonality.get('preferred_seasons'):
            season = taste_graph.seasonality['preferred_seasons'][0]
            recommendations.append(
                f"You love traveling in {season}. Perfect time for "
                f"{'Kashmir, Shimla' if season == 'winter' else 'Ladakh, Valley of Flowers' if season == 'monsoon' else 'Goa, Rajasthan'}!"
            )
        
        return TasteGraphResponse(
            success=True,
            message="Taste graph loaded successfully",
            taste_graph=taste_graph,
            insights=insights,
            recommendations=recommendations
        )
        
    except Exception as e:
        print(f"❌ Error fetching taste graph: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/taste-graph/rebuild")
async def rebuild_taste_graph(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Force rebuild the taste graph from all reviews (admin/debug)
    """
    try:
        print(f"\n🔄 Rebuilding taste graph for user: {current_user.email}")
        
        reviews = firestore_service.get_user_reviews(current_user.uid)
        
        if not reviews:
            raise HTTPException(
                status_code=400,
                detail="No reviews found. Complete trips and write reviews first!"
            )
        
        taste_graph_builder = get_taste_graph_builder()
        taste_graph = taste_graph_builder.build_taste_graph(
            current_user.uid,
            reviews
        )
        
        firestore_service.save_taste_graph(taste_graph)
        
        print(f"✅ Taste graph rebuilt successfully")
        print(f"   Processed {len(reviews)} reviews")
        print(f"   Confidence: {taste_graph.confidence_score:.2f}")
        
        return {
            "success": True,
            "message": f"Taste graph rebuilt from {len(reviews)} reviews",
            "confidence_score": taste_graph.confidence_score
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error rebuilding taste graph: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Feature 18: Direct Booking Links
# ============================================================================

@app.post("/api/booking-links", response_model=BookingLinksResponse)
async def generate_booking_links(
    request: BookingLinksRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Generate deep links to booking platforms for a trip plan.
    
    This endpoint takes a trip ID and generates pre-filled booking links for:
    - Flights (MakeMyTrip, Cleartrip, Goibibo, Skyscanner)
    - Hotels (MakeMyTrip, Booking.com, Agoda, OYO, Airbnb)
    - Trains (IRCTC, ConfirmTkt, RailYatri)
    - Buses (RedBus, AbhiBus)
    - Activities (Thrillophilia, GetYourGuide, Viator)
    """
    try:
        print(f"\n🔗 Generating booking links for trip: {request.trip_id}")
        print(f"   User: {current_user.email}")
        
        # Get trip plan
        trip_plan = firestore_service.get_trip_plan(request.trip_id, current_user.uid)
        
        if not trip_plan:
            raise HTTPException(
                status_code=404,
                detail=f"Trip plan {request.trip_id} not found or access denied"
            )
        
        # Extract trip details
        trip_details = trip_plan.trip_details
        
        # Initialize booking links generator
        generator = get_booking_links_generator()
        
        # Store all generated links
        all_booking_links: dict[str, list[BookingLink]] = {}
        
        # Determine which categories to generate
        categories_to_generate = request.categories if request.categories else [
            "flight", "hotel", "train", "bus", "activity"
        ]
        
        print(f"   Generating links for categories: {categories_to_generate}")
        
        # Generate flight links
        if "flight" in categories_to_generate:
            try:
                # Calculate dates (assume trip starts in 1 month)
                start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
                end_date = (datetime.now() + timedelta(days=30 + trip_details.num_days)).strftime("%Y-%m-%d")
                
                flight_params = FlightBookingParams(
                    origin=trip_details.origin_city,
                    destination=trip_details.destination,
                    departure_date=start_date,
                    return_date=end_date,
                    adults=trip_details.num_people,
                    children=0,
                    cabin_class="economy"
                )
                
                flight_links = generator.generate_flight_links(flight_params)
                all_booking_links["flight"] = flight_links
                print(f"   ✈️  Generated {len(flight_links)} flight links")
                
            except Exception as e:
                print(f"   ⚠️  Error generating flight links: {str(e)}")
                all_booking_links["flight"] = []
        
        # Generate hotel links
        if "hotel" in categories_to_generate:
            try:
                start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
                end_date = (datetime.now() + timedelta(days=30 + trip_details.num_days)).strftime("%Y-%m-%d")
                
                hotel_params = HotelBookingParams(
                    destination=trip_details.destination,
                    checkin_date=start_date,
                    checkout_date=end_date,
                    adults=trip_details.num_people,
                    children=0,
                    rooms=1 if trip_details.num_people <= 2 else 2
                )
                
                hotel_links = generator.generate_hotel_links(hotel_params)
                all_booking_links["hotel"] = hotel_links
                print(f"   🏨 Generated {len(hotel_links)} hotel links")
                
            except Exception as e:
                print(f"   ⚠️  Error generating hotel links: {str(e)}")
                all_booking_links["hotel"] = []
        
        # Generate train links
        if "train" in categories_to_generate:
            try:
                journey_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
                
                train_params = TrainBookingParams(
                    origin=trip_details.origin_city,
                    destination=trip_details.destination,
                    journey_date=journey_date,
                    quota="GN",
                    class_type="3A",
                    passengers=trip_details.num_people
                )
                
                train_links = generator.generate_train_links(train_params)
                all_booking_links["train"] = train_links
                print(f"   🚆 Generated {len(train_links)} train links")
                
            except Exception as e:
                print(f"   ⚠️  Error generating train links: {str(e)}")
                all_booking_links["train"] = []
        
        # Generate bus links
        if "bus" in categories_to_generate:
            try:
                journey_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
                
                bus_links = generator.generate_bus_links(
                    trip_details.origin_city,
                    trip_details.destination,
                    journey_date
                )
                all_booking_links["bus"] = bus_links
                print(f"   🚌 Generated {len(bus_links)} bus links")
                
            except Exception as e:
                print(f"   ⚠️  Error generating bus links: {str(e)}")
                all_booking_links["bus"] = []
        
        # Generate activity links
        if "activity" in categories_to_generate:
            try:
                activity_params = ActivityBookingParams(
                    destination=trip_details.destination,
                    date=None,  # Let user choose
                    participants=trip_details.num_people
                )
                
                activity_links = generator.generate_activity_links(activity_params)
                all_booking_links["activity"] = activity_links
                print(f"   🎯 Generated {len(activity_links)} activity links")
                
            except Exception as e:
                print(f"   ⚠️  Error generating activity links: {str(e)}")
                all_booking_links["activity"] = []
        
        # =====================================================================
        # Feature 19: Personalization & Price Estimation
        # =====================================================================
        
        print(f"\n🎨 Applying personalization and price estimation...")
        
        # Get user's taste graph for personalization
        taste_graph = None
        try:
            taste_graph = firestore_service.get_taste_graph(current_user.uid)
            if taste_graph:
                print(f"   ✅ Loaded taste graph (avg budget: ₹{taste_graph.budget_patterns.get('average_per_trip', 0):.0f})")
        except Exception as e:
            print(f"   ⚠️  Could not load taste graph: {str(e)}")
        
        # Prepare trip details for price estimation
        trip_info = {
            "origin": trip_details.origin_city,
            "destination": trip_details.destination,
            "num_days": trip_details.num_days,
            "num_people": trip_details.num_people,
            "budget": trip_details.budget
        }
        
        # Apply personalization and price estimation to each category
        for category, links in all_booking_links.items():
            if not links:
                continue
            
            # Add price estimates
            try:
                links = generator.estimate_prices(links, trip_info)
                print(f"   💰 Added price estimates to {len(links)} {category} links")
            except Exception as e:
                print(f"   ⚠️  Error estimating prices for {category}: {str(e)}")
            
            # Personalize based on taste graph
            try:
                links = generator.personalize_booking_links(links, taste_graph)
                print(f"   🎯 Personalized {len(links)} {category} links")
            except Exception as e:
                print(f"   ⚠️  Error personalizing {category} links: {str(e)}")
            
            # Update the links list
            all_booking_links[category] = links
            
            # Show best deal
            try:
                best_deal = generator.get_best_deal(links)
                if best_deal:
                    print(f"   🏆 Best {category} deal: {best_deal.platform} at ₹{best_deal.estimated_price:.0f}")
            except Exception as e:
                pass
        
        # Calculate total links
        total_links = sum(len(links) for links in all_booking_links.values())
        
        print(f"\n✅ Generated {total_links} personalized booking links with price estimates")
        
        return BookingLinksResponse(
            success=True,
            message=f"Generated {total_links} personalized booking links for your trip",
            trip_id=request.trip_id,
            booking_links=all_booking_links,
            total_links=total_links,
            generated_at=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating booking links: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/booking-links/{trip_id}", response_model=BookingLinksResponse)
async def get_booking_links_by_trip_id(
    trip_id: str,
    categories: Optional[str] = None,  # Comma-separated: "flight,hotel,train"
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get booking links for a specific trip (convenience GET endpoint).
    
    Query Parameters:
    - categories: Optional comma-separated list (e.g., "flight,hotel")
    """
    category_list = categories.split(",") if categories else None
    
    request = BookingLinksRequest(
        trip_id=trip_id,
        categories=category_list
    )
    
    return await generate_booking_links(request, current_user)


# ============================================================================
# Feature 20: Voyage Board (Collaborative Planning)
# ============================================================================

@app.post("/api/voyage-board", response_model=CreateVoyageBoardResponse)
async def create_voyage_board(
    request: CreateVoyageBoardRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Create a new Voyage Board for collaborative trip planning.
    
    This generates a shareable link that allows multiple users to:
    - View the itinerary
    - Add comments
    - Make suggestions
    - Vote on changes
    """
    try:
        print(f"\n🎨 Creating Voyage Board: {request.board_name}")
        print(f"   User: {current_user.email}")
        print(f"   Trip: {request.trip_id}")
        
        # Verify trip exists and user owns it
        trip_plan = firestore_service.get_trip_plan_by_id(request.trip_id, current_user.uid)
        
        if not trip_plan:
            raise HTTPException(
                status_code=404,
                detail=f"Trip plan {request.trip_id} not found or access denied"
            )
        
        # Initialize Voyage Board service
        board_service = get_voyage_board_service(firestore_service)
        
        # Create the board
        board = board_service.create_board(
            trip_id=request.trip_id,
            owner_id=current_user.uid,
            owner_email=current_user.email,
            owner_name=current_user.name,
            board_name=request.board_name,
            description=request.description,
            is_public=request.is_public,
            access_code=request.access_code
        )
        
        # Add initial members if provided
        if request.initial_members:
            for email in request.initial_members:
                # In production, you'd send email invites here
                print(f"   📧 Would send invite to: {email}")
        
        print(f"✅ Created board: {board.board_id}")
        print(f"   Share link: {board.share_link}")
        if board.access_code:
            print(f"   Access code: {board.access_code}")
        
        return CreateVoyageBoardResponse(
            success=True,
            message=f"Voyage Board '{board.board_name}' created successfully!",
            board=board,
            share_link=board.share_link
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating Voyage Board: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voyage-board/{board_id}", response_model=VoyageBoardResponse)
async def get_voyage_board(
    board_id: str,
    access_code: Optional[str] = None,
    current_user: Optional[FirebaseUser] = Depends(get_optional_user)
):
    """
    Get a Voyage Board by ID.
    
    Public boards: No authentication required
    Private boards: Requires access code or membership
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check access
        if not board.is_public:
            # Check if user is a member
            is_member = False
            if current_user:
                is_member = any(m.user_id == current_user.uid for m in board.members)
            
            # If not a member, require access code
            if not is_member:
                if not access_code or access_code != board.access_code:
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied. Valid access code required for private boards."
                    )
        
        # Increment view count
        board_service.increment_view_count(board_id)
        
        # Update user's online status if authenticated
        if current_user:
            board_service.update_member_status(board_id, current_user.uid, is_online=True)
        
        return {
            "success": True,
            "message": "Board retrieved successfully",
            "board": board
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error retrieving board: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/join", response_model=VoyageBoardResponse)
async def join_voyage_board(
    board_id: str,
    access_code: Optional[str] = None,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Join a Voyage Board as a member.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check access for private boards
        if not board.is_public:
            if not access_code or access_code != board.access_code:
                raise HTTPException(status_code=403, detail="Invalid access code")
        
        # Add member
        board = board_service.add_member(
            board_id=board_id,
            user_id=current_user.uid,
            email=current_user.email,
            name=current_user.name or current_user.email.split('@')[0],
            role="viewer"  # Default role
        )
        
        return VoyageBoardResponse(
            success=True,
            message=f"Successfully joined '{board.board_name}'",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error joining board: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/comment", response_model=VoyageBoardResponse)
async def add_comment_to_board(
    board_id: str,
    request: AddCommentRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Add a comment to a Voyage Board.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        
        # Get board
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to comment")
        
        # Add comment
        comment = board_service.add_comment(
            board_id=board_id,
            user_id=current_user.uid,
            user_name=current_user.name or current_user.email.split('@')[0],
            content=request.content,
            day_number=request.day_number,
            activity_index=request.activity_index,
            reply_to=request.reply_to
        )
        
        if not comment:
            raise HTTPException(status_code=400, detail="Could not add comment")
        
        # Get updated board
        board = board_service.get_board(board_id)
        
        return VoyageBoardResponse(
            success=True,
            message="Comment added successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding comment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/comment/like", response_model=VoyageBoardResponse)
async def like_comment_on_board(
    board_id: str,
    request: LikeCommentRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Like/unlike a comment on a Voyage Board.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        
        # Get board
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to like comments")
        
        # Toggle like
        board = board_service.like_comment(
            board_id=board_id,
            comment_id=request.comment_id,
            user_id=current_user.uid
        )
        
        if not board:
            raise HTTPException(status_code=400, detail="Could not like comment")
        
        return VoyageBoardResponse(
            success=True,
            message="Comment liked successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error liking comment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/suggestion", response_model=VoyageBoardResponse)
async def add_suggestion_to_board(
    board_id: str,
    request: AddSuggestionRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Add a suggestion to a Voyage Board.
    """
    try:
        print(f"📝 Received suggestion request:")
        print(f"   Board ID: {board_id}")
        print(f"   Suggestion Type: {request.suggestion_type}")
        print(f"   Suggested Value: {request.suggested_value}")
        print(f"   Reason: {request.reason}")
        
        board_service = get_voyage_board_service(firestore_service)
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to suggest changes")
        
        # Add suggestion
        suggestion = board_service.add_suggestion(
            board_id=board_id,
            user_id=current_user.uid,
            user_name=current_user.name or current_user.email.split('@')[0],
            suggestion_type=request.suggestion_type,
            suggested_value=request.suggested_value,
            day_number=request.day_number,
            activity_index=request.activity_index,
            current_value=request.current_value,
            reason=request.reason
        )
        
        if not suggestion:
            raise HTTPException(status_code=400, detail="Could not add suggestion")
        
        # Get updated board
        board = board_service.get_board(board_id)
        
        return {
            "success": True,
            "message": "Suggestion added successfully",
            "board": board
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding suggestion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/vote", response_model=VoyageBoardResponse)
async def vote_on_suggestion(
    board_id: str,
    request: VoteOnSuggestionRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Vote on a suggestion (upvote, downvote, or neutral).
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to vote")
        
        # Vote
        board = board_service.vote_on_suggestion(
            board_id=board_id,
            suggestion_id=request.suggestion_id,
            user_id=current_user.uid,
            vote=request.vote
        )
        
        if not board:
            raise HTTPException(status_code=400, detail="Could not register vote")
        
        return VoyageBoardResponse(
            success=True,
            message="Vote registered successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error voting: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/resolve", response_model=VoyageBoardResponse)
async def resolve_suggestion(
    board_id: str,
    request: ResolveSuggestionRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Accept or reject a suggestion (owner only).
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is the owner
        if board.owner_id != current_user.uid:
            raise HTTPException(
                status_code=403,
                detail="Only the board owner can resolve suggestions"
            )
        
        # Resolve suggestion
        board = board_service.resolve_suggestion(
            board_id=board_id,
            suggestion_id=request.suggestion_id,
            user_id=current_user.uid,
            action=request.action
        )
        
        if not board:
            raise HTTPException(status_code=400, detail="Could not resolve suggestion")
        
        # If accepted and apply_to_itinerary is True, update the actual trip plan
        if request.action == "accept" and request.apply_to_itinerary:
            # TODO: Implement itinerary update logic
            print(f"   🔄 Would apply suggestion to trip plan: {request.suggestion_id}")
        
        return VoyageBoardResponse(
            success=True,
            message=f"Suggestion {request.action}ed successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error resolving suggestion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/my-boards", response_model=dict)
async def get_my_boards(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get all Voyage Boards where the current user is a member.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        boards = board_service.get_user_boards(current_user.uid)
        
        # Get stats for each board
        boards_with_stats = []
        for board in boards:
            stats = board_service.get_board_stats(board)
            boards_with_stats.append({
                "board": board,
                "stats": stats
            })
        
        return {
            "success": True,
            "message": f"Found {len(boards)} boards",
            "boards": boards_with_stats,
            "total": len(boards)
        }
        
    except Exception as e:
        print(f"❌ Error retrieving boards: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/poll", response_model=VoyageBoardResponse)
async def create_poll(
    board_id: str,
    request: CreatePollRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Create a new poll on a Voyage Board.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        
        # Get board
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to create polls")
        
        # Create poll
        poll = board_service.create_poll(
            board_id=board_id,
            user_id=current_user.uid,
            user_name=current_user.name or current_user.email.split('@')[0],
            question=request.question,
            options=request.options,
            allow_multiple=request.allow_multiple
        )
        
        if not poll:
            raise HTTPException(status_code=400, detail="Could not create poll")
        
        # Get updated board
        board = board_service.get_board(board_id)
        
        return VoyageBoardResponse(
            success=True,
            message="Poll created successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating poll: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voyage-board/{board_id}/poll/vote", response_model=VoyageBoardResponse)
async def vote_on_poll(
    board_id: str,
    request: VoteOnPollRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Vote on a poll option.
    """
    try:
        board_service = get_voyage_board_service(firestore_service)
        
        # Get board
        board = board_service.get_board(board_id)
        
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Check if user is a member
        if not any(m.user_id == current_user.uid for m in board.members):
            raise HTTPException(status_code=403, detail="You must be a member to vote")
        
        # Vote on poll
        board = board_service.vote_on_poll(
            board_id=board_id,
            poll_id=request.poll_id,
            option_index=request.option_index,
            user_id=current_user.uid
        )
        
        if not board:
            raise HTTPException(status_code=400, detail="Could not vote on poll")
        
        return VoyageBoardResponse(
            success=True,
            message="Vote recorded successfully",
            board=board
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error voting on poll: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GOOGLE CALENDAR EXPORT ENDPOINTS (Feature 21)
# ============================================================================

@app.post("/api/calendar/export", response_model=GoogleCalendarExportResponse)
@app.post("/api/export-to-calendar", response_model=GoogleCalendarExportResponse)
async def export_trip_to_calendar(
    request: GoogleCalendarExportRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Export trip itinerary to Google Calendar.
    Returns Google Calendar URL and ICS file content for one-click import.
    
    The user must provide trip_start_date to schedule events correctly.
    """
    try:
        # Get calendar export service (pass raw Firestore client)
        calendar_service = get_calendar_export_service(firestore_service.db)
        
        # Verify trip ownership using FirestoreService method
        trip_data = firestore_service.get_trip_plan_by_id(request.trip_id, current_user.uid)
        
        if not trip_data:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        # Parse trip start date from request or trip data
        trip_start_date = None
        if hasattr(request, 'trip_start_date') and request.trip_start_date:
            trip_start_date = request.trip_start_date
        elif hasattr(request, 'start_date') and request.start_date:
            # Handle alternative start_date format from frontend
            trip_start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
        elif 'trip_start_date' in trip_data:
            trip_start_date = trip_data['trip_start_date']
            if isinstance(trip_start_date, str):
                trip_start_date = datetime.fromisoformat(trip_start_date.replace('Z', '+00:00'))
        elif 'start_date' in trip_data:
            trip_start_date = trip_data['start_date']
            if isinstance(trip_start_date, str):
                trip_start_date = datetime.fromisoformat(trip_start_date.replace('Z', '+00:00'))
        else:
            # Default to tomorrow if no date provided
            trip_start_date = datetime.now() + timedelta(days=1)
        
        # Export trip to calendar
        events, calendar_url = calendar_service.export_trip_to_calendar(
            trip_id=request.trip_id,
            trip_start_date=trip_start_date,
            timezone=request.timezone,
            include_flights=request.include_flights,
            include_hotels=request.include_hotels,
            include_activities=request.include_activities,
            include_transport=request.include_transport
        )
        
        # Generate ICS file content
        trip_title = trip_data.get('title', f"Trip to {trip_data.get('destination', 'Unknown')}")
        ics_content = calendar_service.generate_ics_file(events, trip_title)
        
        # Create a downloadable ICS file URL endpoint
        # Store ICS content temporarily with trip_id as key
        # In production, upload to Firebase Storage
        ics_file_url = f"/api/download-calendar/{request.trip_id}.ics"
        
        # Store ICS content in memory cache for download
        # (In production, use Redis or Firebase Storage)
        if not hasattr(app.state, 'ics_cache'):
            app.state.ics_cache = {}
        app.state.ics_cache[request.trip_id] = ics_content
        
        return GoogleCalendarExportResponse(
            success=True,
            message=f"⚠️ Important: Google Calendar URL only adds the first event. To add all {len(events)} events, please download and import the ICS file.",
            calendar_url=calendar_url,
            ics_file_url=ics_file_url,
            events_count=len(events),
            events=events
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error exporting to calendar: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download-calendar/{trip_id}.ics")
async def download_calendar_ics(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Download ICS file for importing all trip events into calendar.
    This file contains ALL events and can be imported into Google Calendar,
    Outlook, Apple Calendar, or any other calendar application.
    """
    try:
        # Verify trip ownership
        trip_data = firestore_service.get_trip_plan_by_id(trip_id, current_user.uid)
        
        if not trip_data:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        # Check if ICS content is cached
        if hasattr(app.state, 'ics_cache') and trip_id in app.state.ics_cache:
            ics_content = app.state.ics_cache[trip_id]
        else:
            # Regenerate ICS if not cached
            calendar_service = get_calendar_export_service(firestore_service.db)
            
            # Get trip start date
            trip_start_date = trip_data.get('trip_start_date')
            if trip_start_date:
                if isinstance(trip_start_date, str):
                    trip_start_date = datetime.fromisoformat(trip_start_date)
            else:
                trip_start_date = datetime.now() + timedelta(days=1)
            
            # Generate events
            events, _ = calendar_service.export_trip_to_calendar(
                trip_id=trip_id,
                trip_start_date=trip_start_date,
                timezone="Asia/Kolkata"
            )
            
            # Generate ICS
            trip_title = trip_data.get('title', f"Trip to {trip_data.get('destination', 'Unknown')}")
            ics_content = calendar_service.generate_ics_file(events, trip_title)
        
        # Return ICS file for download
        from fastapi.responses import Response
        return Response(
            content=ics_content,
            media_type="text/calendar",
            headers={
                "Content-Disposition": f'attachment; filename="voyage-trip-{trip_id}.ics"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error downloading calendar: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/trip/{trip_id}/calendar-preview", response_model=dict)
async def preview_calendar_export(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user),
    trip_start_date: Optional[str] = None
):
    """
    Preview what events would be exported to calendar without actually exporting.
    Useful for showing users what will be added to their calendar.
    """
    try:
        # Get calendar export service (pass raw Firestore client)
        calendar_service = get_calendar_export_service(firestore_service.db)
        
        # Verify trip ownership using FirestoreService method
        trip_data = firestore_service.get_trip_plan_by_id(trip_id, current_user.uid)
        
        if not trip_data:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        # Parse trip start date
        if trip_start_date:
            start_date = datetime.fromisoformat(trip_start_date)
        elif 'trip_start_date' in trip_data:
            start_date = trip_data['trip_start_date']
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date)
        else:
            start_date = datetime.now() + timedelta(days=1)
        
        # Generate events preview
        events, _ = calendar_service.export_trip_to_calendar(
            trip_id=trip_id,
            trip_start_date=start_date,
            timezone="Asia/Kolkata",
            include_flights=True,
            include_hotels=True,
            include_activities=True,
            include_transport=True
        )
        
        # Group events by day
        events_by_day = {}
        for event in events:
            day_key = event.start_time.strftime('%Y-%m-%d')
            if day_key not in events_by_day:
                events_by_day[day_key] = []
            events_by_day[day_key].append({
                "title": event.title,
                "time": event.start_time.strftime('%I:%M %p'),
                "duration": str(event.end_time - event.start_time),
                "type": event.event_type,
                "description": event.description[:100] + "..." if len(event.description) > 100 else event.description
            })
        
        return {
            "success": True,
            "message": "Calendar preview generated",
            "trip_title": trip_data.get('title', f"Trip to {trip_data.get('destination')}"),
            "trip_start_date": start_date.isoformat(),
            "total_events": len(events),
            "events_by_day": events_by_day,
            "event_types": {
                "flights": len([e for e in events if e.event_type == "flight"]),
                "hotels": len([e for e in events if e.event_type == "hotel"]),
                "activities": len([e for e in events if e.event_type == "activity"]),
                "transport": len([e for e in events if e.event_type == "transport"])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating preview: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trip/{trip_id}/download-ics")
async def download_ics_file(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user),
    trip_start_date: Optional[str] = None
):
    """
    Download ICS file for importing into any calendar application.
    Returns the ICS file content as a downloadable file.
    """
    try:
        from fastapi.responses import Response
        
        # Get calendar export service (pass raw Firestore client)
        calendar_service = get_calendar_export_service(firestore_service.db)
        
        # Verify trip ownership using FirestoreService method
        trip_data = firestore_service.get_trip_plan_by_id(trip_id, current_user.uid)
        
        if not trip_data:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        # Parse trip start date
        if trip_start_date:
            start_date = datetime.fromisoformat(trip_start_date)
        elif 'trip_start_date' in trip_data:
            start_date = trip_data['trip_start_date']
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date)
        else:
            start_date = datetime.now() + timedelta(days=1)
        
        # Generate events
        events, _ = calendar_service.export_trip_to_calendar(
            trip_id=trip_id,
            trip_start_date=start_date,
            timezone="Asia/Kolkata",
            include_flights=True,
            include_hotels=True,
            include_activities=True,
            include_transport=True
        )
        
        # Generate ICS content
        trip_title = trip_data.get('title', f"Trip to {trip_data.get('destination', 'Unknown')}")
        ics_content = calendar_service.generate_ics_file(events, trip_title)
        
        # Create safe filename
        safe_title = "".join(c for c in trip_title if c.isalnum() or c in (' ', '-', '_')).strip()
        filename = f"{safe_title}.ics"
        
        # Return as downloadable file
        return Response(
            content=ics_content,
            media_type="text/calendar",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating ICS file: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GOOGLE CALENDAR IMPORT & SMART SCHEDULING ENDPOINTS (Feature 22)
# ============================================================================

@app.post("/api/calendar/find-free-weekends", response_model=FindFreeWeekendResponse)
async def find_free_weekends(
    request: FindFreeWeekendRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Find free weekends in user's Google Calendar.
    Requires OAuth access token from frontend.
    
    The frontend must handle Google OAuth flow and pass the access token.
    """
    try:
        calendar_service = get_calendar_import_service()
        
        # Find free weekends
        free_weekends, recommendations = calendar_service.find_free_weekends(
            access_token=request.calendar_access_token,
            trip_duration_days=request.trip_duration_days,
            months_ahead=request.months_ahead,
            include_long_weekends=request.include_long_weekends,
            working_hours_only=request.working_hours_only
        )
        
        return FindFreeWeekendResponse(
            success=True,
            message=f"Found {len(free_weekends)} free weekend(s)",
            free_weekends=free_weekends,
            recommendations=recommendations,
            total_free_weekends=len(free_weekends)
        )
        
    except Exception as e:
        print(f"❌ Error finding free weekends: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500 if "401" not in str(e) else 401,
            detail=str(e)
        )


@app.post("/api/calendar/smart-schedule", response_model=SmartScheduleResponse)
async def smart_schedule_trip(
    request: SmartScheduleRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Schedule trip around user's existing calendar events.
    Analyzes conflicts and suggests best dates.
    """
    try:
        calendar_service = get_calendar_import_service()
        
        # Get trip details
        trip_doc = firestore_service.collection('trips').document(request.trip_id).get()
        
        if not trip_doc.exists:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get('user_id') != current_user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Determine trip start date
        if request.preferred_dates and len(request.preferred_dates) > 0:
            trip_start = datetime.fromisoformat(request.preferred_dates[0])
        else:
            # Default to next weekend
            today = datetime.now()
            days_until_saturday = (5 - today.weekday()) % 7
            if days_until_saturday == 0:
                days_until_saturday = 7
            trip_start = today + timedelta(days=days_until_saturday)
        
        trip_duration = trip_data.get('num_days', 3)
        
        # Analyze calendar and suggest best date
        suggested_date, conflicts, warnings = calendar_service.smart_schedule_trip(
            access_token=request.calendar_access_token,
            trip_start_date=trip_start,
            trip_duration_days=trip_duration,
            avoid_work_hours=request.avoid_work_hours,
            buffer_hours=request.buffer_hours
        )
        
        return SmartScheduleResponse(
            success=True,
            message="Calendar analysis complete",
            suggested_start_date=suggested_date,
            conflicts=conflicts,
            adjusted_itinerary=None,  # TODO: Implement itinerary adjustment
            warnings=warnings
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in smart scheduling: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/daily-schedule", response_model=dict)
async def get_daily_schedule(
    access_token: str,
    start_date: str,
    end_date: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get busy/free hours breakdown for each day.
    Useful for planning activities around existing schedule.
    
    Query params:
    - access_token: Google OAuth access token
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    """
    try:
        calendar_service = get_calendar_import_service()
        
        # Parse dates
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        # Get daily schedule
        daily_schedule = calendar_service.get_busy_free_hours_by_day(
            access_token=access_token,
            start_date=start_dt,
            end_date=end_dt
        )
        
        return {
            "success": True,
            "message": "Daily schedule retrieved",
            "days_analyzed": len(daily_schedule),
            "schedule": daily_schedule
        }
        
    except Exception as e:
        print(f"❌ Error getting daily schedule: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calendar/check-conflicts", response_model=dict)
async def check_calendar_conflicts(
    trip_id: str,
    access_token: str,
    start_date: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Check for calendar conflicts for a specific trip date.
    Returns conflicts and warnings.
    """
    try:
        calendar_service = get_calendar_import_service()
        
        # Get trip details
        trip_doc = firestore_service.collection('trips').document(trip_id).get()
        
        if not trip_doc.exists:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get('user_id') != current_user.uid:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        trip_start = datetime.fromisoformat(start_date)
        trip_duration = trip_data.get('num_days', 3)
        
        # Check for conflicts
        suggested_date, conflicts, warnings = calendar_service.smart_schedule_trip(
            access_token=access_token,
            trip_start_date=trip_start,
            trip_duration_days=trip_duration,
            avoid_work_hours=True,
            buffer_hours=2
        )
        
        # Classify conflicts
        high_severity = [c for c in conflicts if c['severity'] == 'high']
        medium_severity = [c for c in conflicts if c['severity'] == 'medium']
        low_severity = [c for c in conflicts if c['severity'] == 'low']
        
        return {
            "success": True,
            "message": f"Found {len(conflicts)} conflict(s)",
            "has_conflicts": len(conflicts) > 0,
            "conflicts": {
                "high": high_severity,
                "medium": medium_severity,
                "low": low_severity
            },
            "total_conflicts": len(conflicts),
            "suggested_alternative_date": suggested_date.isoformat() if suggested_date != trip_start else None,
            "warnings": warnings,
            "can_proceed": len(high_severity) == 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error checking conflicts: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FEATURE 23: ON-TRIP EXPENSE TRACKER
# Live expense tracking during trips with budget management
# ============================================================================

@app.post("/api/expenses/add", response_model=Expense)
async def add_expense(
    request: AddExpenseRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Add a new expense to a trip
    
    Allows users to log expenses in real-time during their trip.
    Automatically checks budget alerts and updates spending totals.
    """
    try:
        user_id = current_user.uid
        print(f"📝 Adding expense for user {user_id}, trip {request.trip_id}")
        print(f"   Category: {request.category}, Amount: ₹{request.amount}")
        
        # Verify user owns this trip
        trip = firestore_service.get_trip_plan_by_id(request.trip_id, user_id)
        if not trip:
            print(f"❌ Trip {request.trip_id} not found")
            raise HTTPException(status_code=404, detail="Trip not found")
        
        print(f"✅ Trip found, owner: {trip.get('user_id')}")
        
        if trip.get('user_id') != user_id:
            print(f"❌ Permission denied: trip owner {trip.get('user_id')} != current user {user_id}")
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to add expenses to this trip"
            )
        
        # Add expense
        print(f"💾 Creating expense entry...")
        expense_service = get_expense_tracker_service(firestore_service.db)
        expense = expense_service.add_expense(
            trip_id=request.trip_id,
            user_id=user_id,
            category=request.category,
            amount=request.amount,
            description=request.description,
            date=request.date,
            location=request.location,
            payment_method=request.payment_method,
            notes=request.notes,
            is_shared=request.is_shared,
            split_with=request.split_with
        )
        
        print(f"✅ Expense created successfully: {expense.expense_id}")
        return expense
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding expense: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/expenses/update", response_model=Expense)
async def update_expense(
    request: UpdateExpenseRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Update an existing expense
    
    Allows users to edit expense details like amount, category, or description.
    """
    try:
        user_id = current_user.uid
        
        # Get expense and verify ownership
        expense_service = get_expense_tracker_service(firestore_service.db)
        expense_ref = firestore_service.db.collection('expenses').document(request.expense_id)
        expense_doc = expense_ref.get()
        
        if not expense_doc.exists:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        expense_data = expense_doc.to_dict()
        if expense_data.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to update this expense"
            )
        
        # Prepare updates
        updates = {}
        if request.category is not None:
            updates['category'] = request.category
        if request.amount is not None:
            updates['amount'] = request.amount
        if request.description is not None:
            updates['description'] = request.description
        if request.date is not None:
            updates['date'] = request.date
        if request.location is not None:
            updates['location'] = request.location
        if request.payment_method is not None:
            updates['payment_method'] = request.payment_method
        if request.notes is not None:
            updates['notes'] = request.notes
        
        # Update expense
        updated_expense = expense_service.update_expense(request.expense_id, updates)
        return updated_expense
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating expense: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Delete an expense
    
    Soft deletes the expense (marks as deleted but doesn't remove from DB).
    """
    try:
        user_id = current_user.uid
        
        # Verify ownership
        expense_ref = firestore_service.db.collection('expenses').document(expense_id)
        expense_doc = expense_ref.get()
        
        if not expense_doc.exists:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        expense_data = expense_doc.to_dict()
        if expense_data.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this expense"
            )
        
        # Delete expense
        expense_service = get_expense_tracker_service(firestore_service.db)
        success = expense_service.delete_expense(expense_id, soft_delete=True)
        
        return {"success": success, "message": "Expense deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/expenses/tracker/{trip_id}", response_model=ExpenseTrackerSummary)
async def get_expense_tracker(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get complete expense tracking summary for a trip
    
    Returns:
    - Total budget vs spent
    - Category-wise breakdown
    - Recent expenses
    - Budget warnings and recommendations
    - Daily spending average
    - Projected total spend
    """
    try:
        user_id = current_user.uid
        
        # Verify user owns this trip
        print(f"🔍 Fetching trip {trip_id} for user {user_id}")
        trip = firestore_service.get_trip_plan_by_id(trip_id, user_id)
        if not trip:
            print(f"❌ Trip {trip_id} not found for user {user_id}")
            raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")
        
        print(f"✅ Found trip {trip_id}, checking ownership...")
        if trip.get('user_id') != user_id:
            print(f"⛔ User {user_id} doesn't own trip {trip_id} (owner: {trip.get('user_id')})")
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this trip's expenses"
            )
        
        # Get expense tracker summary
        expense_service = get_expense_tracker_service(firestore_service.db)
        summary = expense_service.get_expense_tracker(trip_id, include_deleted=False)
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting expense tracker: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Alias endpoint for frontend compatibility
@app.get("/api/expense-tracker/{trip_id}", response_model=ExpenseTrackerSummary)
async def get_expense_tracker_alias(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """Alias for /api/expenses/tracker/{trip_id} - for frontend compatibility"""
    return await get_expense_tracker(trip_id, current_user)


@app.post("/api/expenses/replan-trip/{trip_id}")
async def replan_trip_with_budget(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Automatically replan remaining trip days based on overspending.
    
    Triggered when user exceeds budget thresholds:
    - Budget 100% exhausted
    - 90%+ used with days remaining
    - Projected to exceed by >20%
    - Multiple categories overspent
    
    Returns revised itinerary for remaining days with strict budget constraints.
    """
    try:
        user_id = current_user.uid
        
        print(f"🔄 Replanning request for trip {trip_id} by user {user_id}")
        
        # Verify user owns this trip
        trip = firestore_service.get_trip_plan_by_id(trip_id, user_id)
        if not trip:
            raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")
        
        if trip.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to replan this trip"
            )
        
        # Check if replanning is needed
        expense_service = get_expense_tracker_service(firestore_service.db)
        replan_check = expense_service.should_trigger_replan(trip_id)
        
        if not replan_check['should_replan']:
            print(f"ℹ️ Replanning not triggered for trip {trip_id}")
            return {
                "success": False,
                "message": "Replanning not needed at this time",
                "reasons": [],
                "should_replan": False
            }
        
        print(f"✅ Replanning triggered. Reasons: {', '.join(replan_check['reasons'])}")
        
        # Get current expense summary
        summary = expense_service.get_expense_tracker(trip_id, include_deleted=False)
        
        # Build category status for prompt
        category_status = "\n".join([
            f"- {cat.name}: Budgeted ₹{cat.budgeted_amount:,.0f} | Spent ₹{cat.spent_amount:,.0f} | "
            f"{'⚠️ OVERSPENT' if cat.percentage_used >= 100 else f'{cat.percentage_used:.0f}% used'}"
            for cat in summary.categories
        ])
        
        # Create replanning prompt
        replan_prompt = f"""
🚨 URGENT TRIP REPLANNING REQUIRED 🚨

Original Trip Details:
- Destination: {trip.get('destination', 'Unknown')}
- Total Duration: {trip.get('num_days', 0)} days
- Original Budget: ₹{trip.get('budget', 0):,.0f}
- Travelers: {trip.get('num_people', 1)} people

CURRENT SPENDING CRISIS:
- Days Elapsed: {summary.days_elapsed}
- Days Remaining: {replan_check['days_remaining']}
- Already Spent: ₹{summary.total_spent:,.0f} ({summary.percentage_used:.1f}% of budget)
- Remaining Budget: ₹{replan_check['remaining_budget']:,.0f}
- Current Daily Rate: ₹{replan_check.get('current_daily_rate', 0):,.0f}/day
- MUST Reduce To: ₹{replan_check['recommended_daily_rate']:,.0f}/day maximum

Why Replanning Triggered:
{chr(10).join('- ' + reason for reason in replan_check['reasons'])}

Category Budget Status:
{category_status}

YOUR CRITICAL TASK:
Generate a REVISED itinerary for the REMAINING {replan_check['days_remaining']} days with STRICT budget of ₹{replan_check['remaining_budget']:,.0f}.

MANDATORY BUDGET ADJUSTMENTS:
1. 🏨 Accommodation: Downgrade to budget hotels/hostels/guesthouses (₹800-1500/night max)
   - Search: "budget hotels near {trip.get('destination')}" or "hostels in {trip.get('destination')}"
   
2. 🍽️ Food: Local restaurants/dhabas/street food only (₹200-400 per meal max)
   - Breakfast: ₹100-150 (tea stalls, local breakfast)
   - Lunch: ₹200-300 (dhabas, thalis)
   - Dinner: ₹250-400 (simple restaurants)
   
3. 🚗 Transport: Public transport/shared autos/local buses ONLY (no private taxis/cabs)
   - Use local buses (₹10-50 per ride)
   - Shared autos (₹20-100)
   - Walking where possible
   
4. 🎭 Activities: PRIORITIZE FREE attractions
   - Parks, gardens, beaches
   - Temples, churches, mosques
   - Local markets, street shopping
   - Heritage walks (free/₹50-100)
   - Keep MAXIMUM 1-2 paid experiences ONLY if critically important (₹200-500 max)
   
5. 🛍️ Shopping: CUT ALL shopping and souvenirs (or max ₹200 total)

6. 💰 Emergency Buffer: Keep ₹{replan_check['remaining_budget'] * 0.1:.0f} (10%) for emergencies

OUTPUT FORMAT - REVISED ITINERARY:
[Generate day-by-day plan for REMAINING days only, starting from Day {summary.days_elapsed + 1}]

For each remaining day, follow this exact format:

📅 Day {summary.days_elapsed + 1}: [Descriptive Title]

🏨 Budget Accommodation: [Hotel/Hostel Name] - ₹[Price]
   Why: [Cheapest option with decent reviews]
   Location: [Area name]
   📱 Book: [MakeMyTrip/Goibibo link for budget hotels in {trip.get('destination')}]

Morning (6 AM - 12 PM):
- [FREE or low-cost activity with timing]
- [Location, what to see, why it's good]

Afternoon (12 PM - 5 PM):
- [FREE or low-cost activity]
- [Details and highlights]

Evening (5 PM - 10 PM):
- [FREE or low-cost activity]
- [Atmosphere, what to expect]

🍽️ Meals (Budget Mode):
- Breakfast: [Local place] - ₹[100-150] ([What food])
- Lunch: [Dhaba/Thali place] - ₹[200-300] ([What food])
- Dinner: [Simple restaurant] - ₹[250-400] ([What food])

🚗 Local Transport: ₹[50-200] (local buses/shared autos)

💰 Day {summary.days_elapsed + 1} Total: ₹[MUST be ≤ {replan_check['recommended_daily_rate']:.0f}]
   Breakdown: Accommodation ₹[X] + Food ₹[X] + Transport ₹[X] + Activities ₹[X]

[Repeat for each remaining day]

📊 REVISED BUDGET SUMMARY:
- Total for {replan_check['days_remaining']} remaining days: ₹{replan_check['remaining_budget']:,.0f}
- Daily average: ₹{replan_check['recommended_daily_rate']:,.0f}
- Emergency buffer: ₹{replan_check['remaining_budget'] * 0.1:.0f}

🎯 KEY CHANGES FROM ORIGINAL PLAN:
- [List 3-5 major budget-saving changes made]

💡 MONEY-SAVING TIPS:
- [3-4 specific tips for staying within budget]

⚠️ IMPORTANT: This is NOT optional - you WILL run out of money if changes are not made. Be honest about the sacrifices needed but keep the trip enjoyable within the strict budget constraints.

Original itinerary for context (do NOT reuse expensive options):
{trip.get('itinerary', 'Not available')}

Now generate the revised budget-friendly itinerary:
"""

        print(f"🤖 Calling AI agent for replanning...")
        
        # Create a simple state with just the prompt
        replan_state = {
            "messages": [HumanMessage(content=replan_prompt)],
            "destination": trip.get('destination', ''),
            "num_days": replan_check['days_remaining'],
            "budget": replan_check['remaining_budget'],
            "num_people": trip.get('num_people', 1),
            "interests": trip.get('interests', []),
            "accommodation_type": "budget",
            "itinerary": "",
            "all_steps": []
        }
        
        # Invoke the agent
        result = await agent.ainvoke(replan_state)
        
        # Extract the AI response
        revised_itinerary = ""
        if result.get("messages"):
            last_message = result["messages"][-1]
            if hasattr(last_message, 'content'):
                revised_itinerary = last_message.content
        
        if not revised_itinerary:
            revised_itinerary = result.get("itinerary", "Unable to generate revised itinerary")
        
        print(f"✅ Revised itinerary generated successfully")
        
        return {
            "success": True,
            "should_replan": True,
            "reasons": replan_check['reasons'],
            "remaining_budget": replan_check['remaining_budget'],
            "days_remaining": replan_check['days_remaining'],
            "current_daily_rate": replan_check.get('current_daily_rate', 0),
            "recommended_daily_rate": replan_check['recommended_daily_rate'],
            "days_elapsed": summary.days_elapsed,
            "total_spent": summary.total_spent,
            "revised_itinerary": revised_itinerary,
            "category_status": [
                {
                    "name": cat.name,
                    "budgeted": cat.budgeted_amount,
                    "spent": cat.spent_amount,
                    "remaining": cat.remaining_amount,
                    "percentage_used": cat.percentage_used
                }
                for cat in summary.categories
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error replanning trip: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expenses/analytics", response_model=ExpenseAnalyticsResponse)
async def get_expense_analytics(
    request: ExpenseAnalyticsRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get detailed expense analytics
    
    Group expenses by category, day, location, or payment method.
    Provides insights and spending trends.
    """
    try:
        user_id = current_user.uid
        
        # Verify user owns this trip
        trip = firestore_service.get_trip_plan_by_id(request.trip_id, user_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        if trip.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this trip's analytics"
            )
        
        # Get analytics
        expense_service = get_expense_tracker_service(firestore_service.db)
        analytics = expense_service.get_expense_analytics(
            trip_id=request.trip_id,
            group_by=request.group_by,
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting expense analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expenses/split")
async def split_expense(
    request: SplitExpenseRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Split an expense among multiple people
    
    Supports equal split, custom amounts, or percentage-based split.
    """
    try:
        user_id = current_user.uid
        
        # Verify ownership
        expense_ref = firestore_service.db.collection('expenses').document(request.expense_id)
        expense_doc = expense_ref.get()
        
        if not expense_doc.exists:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        expense_data = expense_doc.to_dict()
        if expense_data.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to split this expense"
            )
        
        # Split expense
        expense_service = get_expense_tracker_service(firestore_service.db)
        result = expense_service.split_expense(
            expense_id=request.expense_id,
            split_type=request.split_type,
            split_details=request.split_details
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error splitting expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expenses/adjust-budget")
async def adjust_budget(
    request: BudgetAdjustmentRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Adjust budget for a category during the trip
    
    Allows users to reallocate budget between categories as needed.
    """
    try:
        user_id = current_user.uid
        
        # Verify user owns this trip
        trip = firestore_service.get_trip_plan_by_id(request.trip_id, user_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        if trip.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to adjust this trip's budget"
            )
        
        # Adjust budget
        expense_service = get_expense_tracker_service(firestore_service.db)
        result = expense_service.adjust_budget(
            trip_id=request.trip_id,
            category=request.category,
            new_amount=request.new_amount,
            reason=request.reason
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adjusting budget: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USER DASHBOARD
# Comprehensive dashboard showing all trips, expenses, and insights
# ============================================================================

@app.get("/api/dashboard", response_model=UserDashboard)
async def get_user_dashboard(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get complete unified dashboard with expense tracking and trip planning
    
    Returns comprehensive dashboard data including:
    
    EXPENSE TRACKING:
    - Overall statistics (total trips, expenses, spending)
    - Active and upcoming trips with budget status
    - Recent activity feed
    - AI-generated budget insights
    - Unread alerts count
    - Spending trends
    - Top spending categories
    
    TRIP PLANNING:
    - User profile information
    - Past trips summary
    - Saved destinations
    - Personalized trip suggestions
    - Quick action buttons
    
    This is the main endpoint for the user's home screen/dashboard view.
    """
    print(f"\n{'='*60}")
    print(f"📊 DASHBOARD REQUEST RECEIVED")
    print(f"{'='*60}")
    print(f"👤 User ID: {current_user.uid}")
    print(f"📧 User Email: {current_user.email}")
    print(f"{'='*60}\n")
    
    try:
        user_id = current_user.uid
        user_email = current_user.email
        
        print(f"🔄 Getting dashboard service...")
        # Get dashboard service with both firestore client and service
        dashboard_service = get_dashboard_service(firestore_service.db, firestore_service)
        
        print(f"📡 Calling get_user_dashboard...")
        # Generate complete unified dashboard
        dashboard = dashboard_service.get_user_dashboard(user_id, user_email)
        
        print(f"✅ Dashboard generated successfully!")
        print(f"📊 Stats: {dashboard.stats.total_trips} trips, {dashboard.stats.total_expenses_logged} expenses")
        return dashboard
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard/trip/{trip_id}", response_model=TripSummaryCard)
async def get_trip_summary(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get summary card for a specific trip
    
    Returns compact trip information suitable for dashboard cards.
    """
    try:
        user_id = current_user.uid
        
        # Verify user owns this trip
        trip = firestore_service.get_trip_plan_by_id(trip_id, user_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        if trip.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this trip"
            )
        
        # Get dashboard service
        dashboard_service = get_dashboard_service(firestore_service.db)
        
        # Get all expenses for the user
        expense_service = get_expense_tracker_service(firestore_service.db)
        expenses_ref = firestore_service.db.collection('expenses').where('trip_id', '==', trip_id)
        expenses = []
        for doc in expenses_ref.stream():
            expense_data = doc.to_dict()
            expense_data['expense_id'] = doc.id
            if not expense_data.get('deleted', False):
                expenses.append(expense_data)
        
        # Create trip summary card
        trip['trip_id'] = trip_id
        trip_card = dashboard_service._create_trip_summary_card(trip, expenses)
        
        return trip_card
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting trip summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# POST-TRIP FEEDBACK ENDPOINTS
# ============================================================================

@app.post("/api/feedback/submit", response_model=TripFeedbackResponse)
async def submit_trip_feedback(
    request: TripFeedbackRequest,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Submit post-trip feedback
    """
    try:
        feedback_service = get_feedback_service(firestore_service.db)
        
        # Verify trip ownership
        trip = firestore_service.get_trip_plan_by_id(request.trip_id, current_user.uid)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        # Submit feedback
        feedback = feedback_service.submit_feedback(
            trip_id=request.trip_id,
            user_id=current_user.uid,
            rating=request.rating,
            experience=request.experience,
            would_recommend=request.would_recommend,
            highlights=request.highlights,
            improvements=request.improvements,
            comment=request.comment
        )
        
        return TripFeedbackResponse(
            success=True,
            message="Thank you for your feedback!",
            feedback_id=feedback.get('feedback_id'),
            feedback=feedback
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error submitting feedback: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


@app.get("/api/feedback/trip/{trip_id}", response_model=TripFeedbackResponse)
async def get_trip_feedback(
    trip_id: str,
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get feedback for a specific trip
    """
    try:
        feedback_service = get_feedback_service(firestore_service.db)
        
        # Verify trip ownership
        trip = firestore_service.get_trip_plan_by_id(trip_id, current_user.uid)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found or access denied")
        
        feedback = feedback_service.get_trip_feedback(trip_id)
        
        if not feedback:
            return TripFeedbackResponse(
                success=False,
                message="No feedback submitted yet"
            )
        
        return TripFeedbackResponse(
            success=True,
            message="Feedback retrieved",
            feedback_id=feedback.get('feedback_id'),
            feedback=feedback
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting feedback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get feedback: {str(e)}")


@app.get("/api/feedback/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats(
    current_user: FirebaseUser = Depends(get_current_user)
):
    """
    Get overall feedback statistics (admin only in production)
    """
    try:
        feedback_service = get_feedback_service(firestore_service.db)
        stats = feedback_service.get_feedback_stats()
        
        return FeedbackStatsResponse(
            success=True,
            **stats
        )
        
    except Exception as e:
        print(f"❌ Error getting feedback stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


# ============================================================================
# EXISTING ENDPOINTS (health check)
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """
    Initialize services on application startup
    """
    print(f"\n{'='*60}")
    print(f"🚀 VOYAGE API SERVER STARTING UP")
    print(f"{'='*60}\n")
    
    # OTP service initialized on-demand via get_otp_service()
    print(f"✅ OTP service available")
    
    print(f"\n{'='*60}")
    print(f"✅ SERVER READY")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

