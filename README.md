# 🌏 Voyage - AI-Powered Travel Planner

An intelligent, comprehensive travel planning application designed for Indian travelers. Uses AI to create personalized trip itineraries for destinations worldwide with a focus on Indian preferences, budget considerations (₹), and cultural context. Features include collaborative trip planning, real-time expense tracking, smart scheduling, seasonal food recommendations, and automatic budget replanning.

---

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Core Features Guide](#-core-features-guide)
- [API Endpoints](#-api-endpoints)
- [Technologies Used](#-technologies-used)
- [Authentication Flow](#-authentication-flow)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### Trip Planning & Management
- ✅ **Natural Language Trip Planning** - Describe your ideal trip in plain English (anywhere in the world)
- ✅ **AI-Powered Itinerary Generation** - Smart day-by-day plans with timing, activities, and bookings
- ✅ **Dynamic Date System** - Real travel dates with accurate flight booking links
- ✅ **Budget-Aware Planning** - Automatic replanning when budget constraints change (in ₹)
- ✅ **Trip History** - Save, view, and manage multiple trip plans
- ✅ **Optional Authentication** - Plan trips without signing up

### Collaboration Features
- ✅ **Voyage Boards** - Collaborative trip planning with friends/family
- ✅ **Real-time Comments** - Discuss itinerary details with trip members
- ✅ **Suggestions & Voting** - Members can propose changes, others vote
- ✅ **Role-Based Access** - Creator, editor, and viewer permissions
- ✅ **Activity Log** - Track all changes and interactions

### Expense Tracking
- ✅ **On-Trip Expense Tracker** - Log expenses during your trip
- ✅ **Category Breakdown** - Track spending by Accommodation, Food, Transport, Activities, Shopping
- ✅ **Budget Alerts** - Real-time warnings when overspending
- ✅ **Automatic Replanning** - AI generates revised itinerary when budget is exceeded
- ✅ **Daily Spending Analysis** - See spending trends and projections
- ✅ **Budget Allocation Display** - View budgeted vs spent per category

### Personalization
- ✅ **Seasonal Food Recommendations** - Discover special foods for different seasons and festivals
- ✅ **Taste Graph** - AI learns your preferences over time
- ✅ **Personalized Suggestions** - Destinations, events, and foods tailored to you
- ✅ **Travel Preferences** - Save dietary needs, pace, interests, accommodation types

### Smart Scheduling
- ✅ **Google Calendar Integration** - Export trips to your calendar
- ✅ **Find Free Weekends** - AI suggests best travel dates based on your schedule
- ✅ **Smart Scheduling** - Optimal trip timing based on weather, events, crowd levels

### Discovery & Research
- ✅ **Real-time Travel Research** - Latest information for any destination worldwide
- ✅ **Safety Advisories** - Current travel warnings and visa information
- ✅ **Budget Estimates** - Costs in INR (₹) for any destination
- ✅ **Transport Options** - Flights, trains, buses, local transport options globally
- ✅ **Booking Links** - Direct links to MakeMyTrip, Booking.com, and other booking platforms

---

## 🏗️ Architecture

### Backend (Python + FastAPI)
- **Framework**: FastAPI with Uvicorn server
- **AI Engine**: Google Gemini 2.5 Flash via LangChain
- **Agent Orchestrator**: LangGraph for multi-step workflow
- **Search**: Tavily API for real-time travel research worldwide
- **Authentication**: Firebase Admin SDK with JWT verification
- **Database**: Cloud Firestore (NoSQL)
- **Currency**: Indian Rupees (₹) throughout - designed for Indian travelers
- **Focus**: Global destinations with Indian traveler perspective, budget considerations, and cultural context

**5-Step Orchestrator Workflow:**
1. **Extract** - Parse trip details from natural language
2. **Research** - Gather destination information using specialized tools
3. **Validate** - Verify research quality and completeness
4. **Plan** - Assign mission to AI planning agent
5. **Execute** - Generate detailed itinerary with bookings

**AI Agent Tools (6 Research + 6 Planning):**
- Budget estimation, travel advisories, visa info
- Accommodation search, transport options, activity recommendations
- Price estimation, booking links, restaurant suggestions

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Authentication**: Firebase Web SDK
- **API Client**: Axios
- **State Management**: React Context API
- **Styling**: Modern CSS with gradients, animations

**Key Pages:**
- Home (trip planning interface)
- My Trips (saved trip management)
- Voyage Board (collaboration)
- Expense Tracker (budget management)
- Personalized Suggestions (For You page)
- Login/Signup (authentication)

---

## 📁 Project Structure

```
Voyage_new/
├── backend/
│   ├── server.py                      # Main FastAPI app with 5000+ lines
│   ├── agent_logic.py                 # LangChain agent tools
│   ├── schemas.py                     # Pydantic models (1300+ lines)
│   ├── firebase_config.py             # Firebase Admin initialization
│   ├── firebase_auth.py               # JWT authentication middleware
│   ├── firestore_service.py           # Firestore database operations
│   ├── expense_tracker_service.py     # Expense tracking logic
│   ├── voyage_board_service.py        # Collaboration board management
│   ├── calendar_service.py            # Google Calendar integration
│   ├── taste_graph_service.py         # User preference learning
│   ├── booking_links_service.py       # Booking URL generation
│   ├── dashboard_service.py           # User dashboard data
│   ├── otp_service.py                 # OTP verification
│   ├── requirements.txt               # Python dependencies
│   ├── .env                           # Environment variables
│   └── README.md                      # Backend-specific docs
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.tsx             # Navigation with user menu
    │   │   ├── VoyageBoard.tsx        # Collaboration interface
    │   │   ├── PersonalizedSuggestions.tsx  # For You page
    │   │   └── *.css                  # Component styles
    │   ├── pages/
    │   │   ├── Home.tsx               # Trip planning page
    │   │   ├── MyTrips.tsx            # Saved trips management
    │   │   ├── ExpenseTracker.tsx     # Budget tracking
    │   │   ├── Login.tsx              # Login page
    │   │   ├── Signup.tsx             # Registration
    │   │   └── *.css                  # Page styles
    │   ├── context/
    │   │   └── AuthContext.tsx        # Authentication state
    │   ├── services/
    │   │   └── api.ts                 # API service layer
    │   ├── config/
    │   │   └── firebase.ts            # Firebase client config
    │   ├── App.tsx                    # Main app with routing
    │   └── main.tsx                   # Entry point
    ├── package.json
    └── README.md                       # Frontend-specific docs
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+** (Backend)
- **Node.js 18+** (Frontend)
- **Firebase Project** (Authentication & Database)
  - Enable Email/Password authentication
  - Enable Google Sign-In (optional)
  - Create Firestore database
- **Google API Key** (Gemini AI) - [Get Free Key](https://aistudio.google.com/app/apikey)
- **Tavily API Key** (Travel Search) - [Get Key](https://tavily.com)

---

### Backend Setup

#### 1. Navigate to Backend Directory
```powershell
cd backend
```

#### 2. Create Virtual Environment
```powershell
python -m venv venv
```

#### 3. Activate Virtual Environment

**Windows PowerShell:**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows CMD:**
```cmd
venv\Scripts\activate.bat
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

#### 4. Install Dependencies
```powershell
pip install -r requirements.txt
```

**Key Dependencies:**
- FastAPI 0.120.3, Uvicorn 0.38.0
- LangChain 0.3.27, LangChain-Google-GenAI 2.0.10
- Google-GenerativeAI 0.8.3, Tavily-Python 0.7.12
- Firebase-Admin 6.3.0, Pydantic 2.10.6

#### 5. Configure Environment Variables

Create/edit `.env` file in backend directory:

```env
# AI & Search APIs
GOOGLE_API_KEY=your_google_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key

# Firebase
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
```

**Where to get API keys:**
- **Google Gemini**: https://aistudio.google.com/app/apikey (FREE)
- **Tavily**: https://tavily.com (Free tier available)
- **Firebase Web API Key**: Firebase Console > Project Settings > General

#### 6. Add Firebase Admin Credentials

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file as `firebase-credentials.json` in backend folder
4. Verify path in `firebase_config.py`:
   ```python
   cred = credentials.Certificate("firebase-credentials.json")
   ```

#### 7. Test Firebase Connection (Optional)

```powershell
python test_firebase.py
```

Expected output:
```
✅ Firebase initialized successfully
✅ Firestore connected
✅ Authentication working
```

#### 8. Start Backend Server

```powershell
python server.py
```

Or with auto-reload:
```powershell
uvicorn server:app --reload
```

**Backend runs on:** `http://localhost:8000`

**Verify it's working:**
- Health Check: http://localhost:8000/health
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

### Frontend Setup

#### 1. Navigate to Frontend Directory
```powershell
cd ..\frontend
```
(From backend folder, go up one level then into frontend)

#### 2. Install Dependencies
```powershell
npm install
```

**Key Dependencies:**
- React 18.3.1, TypeScript 5.9.3
- Vite 6.0.11, React Router DOM 7.1.3
- Firebase 11.2.0, Axios 1.7.9

#### 3. Configure Firebase

Edit `src/config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your_firebase_api_key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

**Find these values:**
Firebase Console > Project Settings > General > Your apps > Web app

#### 4. Start Development Server
```powershell
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

#### 5. Open in Browser

Navigate to: http://localhost:5173

You should see the Voyage home page!

---

## 🎯 Core Features Guide

### 1. Trip Planning

**Natural Language Input:**
```
"Plan a 7-day trip to Rajasthan for 2 people in December with ₹50,000 budget. 
We love heritage sites, local food, and camel rides."
```

**What You Get:**
- Day-by-day itinerary with timing
- Accommodation recommendations with booking links
- Food suggestions (local specialties)
- Activities with prices
- Transportation options (flights, trains, buses)
- Total cost breakdown by category

**Features:**
- Dynamic date system (uses actual travel dates)
- Budget allocation (Accommodation 30%, Food 25%, Transport 20%, etc.)
- MakeMyTrip flight links with correct dates
- IRCTC train booking links
- Hotel recommendations with Booking.com links

### 2. Voyage Boards (Collaboration)

**Create a Board:**
1. Go to My Trips
2. Click "Create Voyage Board" on any trip
3. Share board ID with friends/family

**Features:**
- **Comments**: Discuss specific days or activities
- **Suggestions**: Propose changes (add/remove activities, change times)
- **Voting**: Upvote suggestions you agree with
- **Resolution**: Creator accepts/rejects suggestions
- **Activity Log**: See all interactions
- **Roles**: Creator, Editor, Viewer

**Use Cases:**
- Family trip planning
- Group vacations with friends
- Honeymoon planning with partner
- Corporate team retreats

### 3. Expense Tracker

**During Your Trip:**
1. Open trip in My Trips
2. Click "Track Expenses"
3. Add expenses as you spend

**What You Track:**
- Category (Accommodation, Food, Transport, Activities, Shopping, Emergency)
- Amount (₹)
- Description
- Location (optional)

**Smart Features:**
- **Real-time Alerts**: Warnings at 70%, 90%, 100% budget
- **Category Breakdown**: See spending per category vs budgeted
- **Daily Analysis**: Average daily spend, days remaining
- **Projected Total**: Estimate final spending based on current rate
- **Budget Warnings**: "🚨 90% budget used with 5 days left!"

**Automatic Replanning:**
When you overspend (90%+ used, or projected >120%), system offers:
- Click "Replan Trip" button
- AI generates revised itinerary for remaining days
- Suggests budget hotels (₹800-1500/night)
- Free/low-cost activities (parks, temples, markets)
- Local food (₹200-400/meal)
- Public transport only

### 4. Seasonal Foods

**Discover Regional Specialties:**
- **Winter** (Nov-Feb): Gajar Ka Halwa, Sarson Ka Saag, Undhiyu, Kashmiri Kahwa
- **Summer** (Mar-Jun): Pani Puri, Mango Lassi, Aam Panna
- **Monsoon** (Jul-Sep): Ghevar, Pakoras, Bhutta
- **Festivals**: Modak (Ganesh Chaturthi), Puran Poli (Holi/Diwali)

**Where to Find:**
- Home page: Food exploration section
- For You page: Seasonal foods tab with badges

### 5. Smart Scheduling

**Find Free Weekends:**
1. Connect Google Calendar
2. Click "Find Free Weekend"
3. AI suggests best dates based on:
   - Your availability
   - Weather at destination
   - Festival/event timing
   - Crowd levels

**Export to Calendar:**
- One-click export of full itinerary
- Each day becomes a calendar event
- Includes timing, activities, locations

### 6. Personalization

**Taste Graph:**
- AI learns from your trip history
- Tracks preferences (food types, accommodation, pace)
- Improves future recommendations

**For You Page:**
- Personalized destination suggestions
- Upcoming events you'd enjoy
- Seasonal food recommendations
- Trending places based on your taste

---

## 🔑 API Endpoints

### Public Endpoints (No Auth Required)

**Health & Info:**
- `GET /health` - Server health check
- `GET /api/trending` - Trending destinations and events

**Trip Planning:**
- `POST /api/plan-trip-from-prompt` - Plan trip from natural language
- `POST /api/extract-trip-details` - Extract details from prompt
- `POST /api/optimize-day` - Optimize single day itinerary

**Discovery:**
- `POST /api/compare-destinations` - Compare multiple destinations
- `POST /api/booking-links` - Generate booking URLs

### Protected Endpoints (Requires JWT Token)

**Trip Management:**
- `GET /api/trip-plans` - Get user's saved trips
- `GET /api/trip-plans/{trip_id}` - Get specific trip
- `DELETE /api/trip-plans/{trip_id}` - Delete trip
- `POST /api/saved-destinations` - Save destination
- `GET /api/saved-destinations` - Get saved destinations

**Voyage Boards (Collaboration):**
- `POST /api/voyage-board` - Create board
- `GET /api/voyage-board/{board_id}` - Get board details
- `POST /api/voyage-board/{board_id}/join` - Join board
- `POST /api/voyage-board/{board_id}/comment` - Add comment
- `POST /api/voyage-board/{board_id}/suggestion` - Add suggestion
- `POST /api/voyage-board/{board_id}/vote` - Vote on suggestion
- `POST /api/voyage-board/{board_id}/resolve` - Resolve suggestion

**Expense Tracker:**
- `POST /api/expenses` - Add expense
- `GET /api/expenses/tracker/{trip_id}` - Get expense summary
- `PUT /api/expenses/{expense_id}` - Update expense
- `DELETE /api/expenses/{expense_id}` - Delete expense
- `POST /api/expenses/replan-trip/{trip_id}` - Trigger automatic replanning

**User Profile:**
- `GET /api/profile` - Get user profile
- `POST /api/profile/preferences` - Update travel preferences
- `GET /api/dashboard` - User dashboard data
- `GET /api/taste-graph` - Get taste graph insights

**Calendar Integration:**
- `POST /api/calendar/export` - Export trip to Google Calendar
- `POST /api/calendar/find-free-weekend` - Find available dates
- `POST /api/calendar/smart-schedule` - AI-powered scheduling

---

## 📚 Technologies Used

### Backend Stack

**Core Framework:**
- FastAPI 0.120.3 - Modern Python web framework
- Uvicorn 0.38.0 - ASGI server
- Pydantic 2.10.6 - Data validation

**AI & LLM:**
- LangChain 0.3.27 - LLM orchestration
- LangChain-Google-GenAI 2.0.10 - Gemini integration
- LangGraph 0.2.82 - Agent workflow
- Google-GenerativeAI 0.8.3 - Gemini API client

**Search & Research:**
- Tavily-Python 0.7.12 - Web search API
- DuckDuckGo-Search 7.2.1 - Alternative search

**Database & Auth:**
- Firebase-Admin 6.3.0 - Authentication & Firestore
- Google-Cloud-Firestore 2.21.0 - NoSQL database

**Utilities:**
- Python-Dotenv 1.0.1 - Environment variables
- Requests 2.32.3 - HTTP client

### Frontend Stack

**Core Framework:**
- React 18.3.1 - UI library
- TypeScript 5.9.3 - Type safety
- Vite 6.0.11 - Build tool

**Routing & State:**
- React Router DOM 7.1.3 - Navigation
- React Context API - State management

**API & Auth:**
- Axios 1.7.9 - HTTP client
- Firebase 11.2.0 - Authentication & Firestore SDK

**Build Tools:**
- @vitejs/plugin-react 4.3.4 - React plugin
- ESLint 9.17.0 - Code linting
- TypeScript-ESLint 8.18.2 - TS linting

---

## 🔐 Authentication Flow

### User Registration/Login

1. **Frontend:** User enters email/password or clicks "Sign in with Google"
2. **Firebase Auth:** Validates credentials, creates user account
3. **Frontend Receives:** Firebase ID token (JWT)
4. **Token Storage:** Stored in React Context for session
5. **API Requests:** Token sent in `Authorization: Bearer <token>` header

### Backend Verification

1. **FastAPI Middleware:** Extracts token from Authorization header
2. **Firebase Admin SDK:** Verifies token authenticity and expiration
3. **Token Valid:** Extracts user ID (UID) and email
4. **Create User Object:** `FirebaseUser(uid, email, name)`
5. **Attach to Request:** Available in all protected endpoints
6. **Database Operations:** Use UID to query user-specific data

### Token Lifecycle

- **Issued by:** Firebase Authentication
- **Valid for:** 1 hour (auto-refreshed by Firebase SDK)
- **Contains:** User ID, email, auth time, issuer
- **Signed with:** Firebase private key
- **Verified by:** Firebase Admin SDK on backend

---

## 🧪 Testing

### Quick Test - Complete Flow

1. **Start Backend:**
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   python server.py
   ```
   Verify: http://localhost:8000/health returns `{"status": "healthy"}`

2. **Start Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```
   Verify: http://localhost:5173 loads home page

3. **Test Anonymous Trip Planning:**
   - Go to home page
   - Enter: "Plan a 3-day trip to Goa for 2 people with ₹30,000 budget"
   - Click "Plan My Trip"
   - Verify itinerary generates without login

4. **Test User Registration:**
   - Click "Sign Up"
   - Enter email/password
   - Verify redirect to home page
   - Check navbar shows user email

5. **Test Authenticated Trip:**
   - Plan another trip (logged in)
   - Go to "My Trips"
   - Verify trip appears in list

6. **Test Voyage Board:**
   - Click "Create Board" on a saved trip
   - Copy board ID
   - Open in incognito window
   - Click "Join Board"
   - Add comment, verify it appears in original window

7. **Test Expense Tracker:**
   - Open a trip
   - Click "Track Expenses"
   - Add expense: Food, ₹500, "Lunch at beach shack"
   - Verify budget percentage updates
   - Add more expenses to trigger warning

8. **Test Automatic Replanning:**
   - Add expenses totaling 95% of budget
   - Verify warning appears
   - Click "Replan Trip" button
   - Verify AI generates budget-friendly revised plan

### API Testing with cURL

**Health Check:**
```bash
curl http://localhost:8000/health
```

**Plan Trip (Anonymous):**
```bash
curl -X POST http://localhost:8000/api/plan-trip-from-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "3-day trip to Jaipur for 2 people with ₹40,000 budget"
  }'
```

**Get My Trips (Authenticated):**
```bash
curl http://localhost:8000/api/trip-plans \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

---

## 🚨 Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError: No module named 'fastapi'`
**Solution:**
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Problem:** `google.auth.exceptions.DefaultCredentialsError`
**Solution:**
- Ensure `firebase-credentials.json` exists in backend folder
- Check file path in `firebase_config.py`
- Verify JSON file is valid (download fresh from Firebase Console)

**Problem:** `OPENAI_API_KEY not found`
**Solution:**
- Create `.env` file in backend folder
- Add: `GOOGLE_API_KEY=your_actual_key`
- Get key from: https://aistudio.google.com/app/apikey

**Problem:** `Port 8000 already in use`
**Solution:**
```powershell
# Kill process on port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force

# Or use different port
uvicorn server:app --port 8001
```

**Problem:** Server starts then immediately shuts down
**Solution:**
- Check for syntax errors in server.py
- Verify all imports are available
- Check console for stack trace

### Frontend Issues

**Problem:** `npm install` fails
**Solution:**
```powershell
# Clear cache and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm cache clean --force
npm install
```

**Problem:** Firebase configuration error
**Solution:**
- Verify `src/config/firebase.ts` has correct config
- Get config from Firebase Console > Project Settings
- Ensure all fields are filled (apiKey, authDomain, etc.)

**Problem:** "Failed to fetch" errors when planning trip
**Solution:**
- Verify backend is running on port 8000
- Check `src/services/api.ts` baseURL is `http://localhost:8000`
- Disable browser extensions (AdBlock, etc.)
- Check browser console for CORS errors

**Problem:** Authentication not working
**Solution:**
- Verify Firebase Auth is enabled in Firebase Console
- Check Email/Password provider is enabled
- Clear browser localStorage
- Try incognito mode

**Problem:** Blank screen after login
**Solution:**
- Check browser console for errors
- Verify token is being stored in AuthContext
- Check `api.ts` is setting Authorization header
- Try logging out and back in

### Database Issues

**Problem:** "Permission denied" when accessing Firestore
**Solution:**
- Check Firestore Security Rules in Firebase Console
- For testing, use rules that allow authenticated access:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```

**Problem:** Trip not appearing in "My Trips"
**Solution:**
- Verify user is logged in
- Check browser console for errors
- Verify `user_id` field matches in Firestore
- Check Firestore collection `trip_plans` exists

### API Issues

**Problem:** 422 Unprocessable Entity
**Solution:**
- Check request body matches expected schema
- Verify all required fields are present
- Check API docs: http://localhost:8000/docs

**Problem:** 500 Internal Server Error
**Solution:**
- Check backend console for error message
- Verify environment variables are set
- Check Firebase credentials are valid

**Problem:** Request times out
**Solution:**
- AI trip planning can take 30-60 seconds
- Increase timeout in axios config
- Check Gemini API quota/limits
- Verify Tavily API is working

---

## 🎨 Customization Guide

### Changing AI Model

Edit `backend/server.py`:
```python
# Current: Gemini 2.5 Flash
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",  # Change this
    temperature=0.7
)

# Options:
# - gemini-2.5-flash (fastest, recommended)
# - gemini-2.5-pro (slower, more detailed)
# - gemini-1.5-pro
```

### Adjusting Budget Allocation

Edit `backend/server.py` line ~134-221:
```python
def extract_budget_breakdown(trip_plan: str, total_budget: float) -> dict:
    # Fallback percentages
    return {
        "Accommodation": 0.30 * total_budget,    # 30%
        "Food & Dining": 0.25 * total_budget,    # 25%
        "Transportation": 0.20 * total_budget,   # 20%
        "Activities": 0.15 * total_budget,       # 15%
        "Shopping": 0.05 * total_budget,         # 5%
        "Emergency Fund": 0.05 * total_budget    # 5%
    }
```

### Adding New Seasonal Foods

Edit `frontend/src/components/PersonalizedSuggestions.tsx` line ~40-140:
```typescript
const mockFoods: Food[] = [
  {
    dish: "Your Food Name",
    location: "City, State",
    description: "Description",
    price: "₹150-300",
    season: "winter",  // winter, summer, monsoon
    specialOccasion: "Festival Name",  // optional
    image: "image_url"
  },
  // ... add more
];
```

### Customizing Replanning Triggers

Edit `backend/expense_tracker_service.py` line ~851-900:
```python
def should_trigger_replan(self, trip_id: str) -> Dict:
    # Adjust thresholds:
    if percentage_used >= 100:          # Budget 100% used
    elif percentage_used >= 90:         # 90%+ with days left
    elif projected_total > budget * 1.2: # Projected 20% over
    # ... modify as needed
```

---

## 📄 License

This project is for educational purposes. Replace API keys before deploying to production.

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Support for more global destinations
- More seasonal food recommendations (Indian and international)
- Enhanced UI/UX
- Mobile responsive design
- Performance optimizations
- Multi-language support beyond English/Hindi

## 📞 Support

For issues:
1. Check Troubleshooting section above
2. Review API docs: http://localhost:8000/docs
3. Check browser/server console for errors
4. Verify all prerequisites are installed

---

**Happy Traveling! ✈️🌍**

Made with ❤️ for Indian travelers exploring the world
