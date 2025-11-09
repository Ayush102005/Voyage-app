import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const HomePage = () => {
  const navigate = useNavigate()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const trendingDestinations = [
    {
      id: 1,
      name: "Goa",
      emoji: "🏖️",
      description: "Beaches, nightlife, and Portuguese heritage",
      budget: "₹15,000 - ₹40,000",
      duration: "3-5 days",
    },
    {
      id: 2,
      name: "Manali",
      emoji: "🏔️",
      description: "Himalayan adventure and snow-capped mountains",
      budget: "₹20,000 - ₹50,000",
      duration: "4-6 days",
    },
    {
      id: 3,
      name: "Jaipur",
      emoji: "🏰",
      description: "Royal palaces and vibrant culture",
      budget: "₹18,000 - ₹45,000",
      duration: "3-4 days",
    },
    {
      id: 4,
      name: "Kerala",
      emoji: "🌴",
      description: "Backwaters, beaches, and lush greenery",
      budget: "₹25,000 - ₹60,000",
      duration: "5-7 days",
    }
  ]

  return (
    <div className="min-h-screen bg-black">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-lg border-b border-neutral-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-3xl">✈️</span>
              <span className="text-2xl font-bold gradient-text">Voyage</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="text-neutral-300 hover:text-white transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => setShowAuthModal(true)}
                className="btn-primary"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-black to-black" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Your Journey,{' '}
              <span className="gradient-text">Reimagined</span>
              <br />
              by AI
            </h1>
            <p className="text-xl md:text-2xl text-neutral-400 mb-8">
              Let our AI orchestrator craft the perfect Indian getaway—tailored to your budget, 
              interests, and dreams. No hassle, just adventure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => setShowAuthModal(true)} className="btn-primary text-lg px-8 py-4">
                Plan Your Trip →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            How It <span className="gradient-text">Works</span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { emoji: "🗺️", title: "Tell Us Your Dream", desc: "Share your destination, budget, dates, and interests" },
              { emoji: "✨", title: "AI Crafts Your Plan", desc: "Our intelligent system creates a personalized itinerary" },
              { emoji: "📅", title: "Enjoy Your Journey", desc: "Get a complete day-by-day plan with bookings and insights" }
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="card text-center group hover:shadow-xl hover:shadow-red-600/20">
                  <div className="text-6xl mb-6">{step.emoji}</div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-neutral-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Destinations */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-12">
            🔥 Trending <span className="gradient-text">Now</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingDestinations.map((dest) => (
              <div
                key={dest.id}
                onClick={() => setShowAuthModal(true)}
                className="group cursor-pointer card hover:scale-105 overflow-hidden"
              >
                <div className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-7xl mb-3 group-hover:scale-110 transition-transform duration-300">
                      {dest.emoji}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-center gradient-text">{dest.name}</h3>
                  <p className="text-neutral-400 mb-4 text-center">{dest.description}</p>
                  <div className="text-sm text-neutral-500 mb-2 text-center">💰 {dest.budget}</div>
                  <div className="text-sm text-neutral-500 text-center">📅 {dest.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-neutral-800 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-neutral-500 text-sm">
          © 2025 Voyage. Crafted with AI for unforgettable journeys.
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          
          <div className="relative bg-neutral-900 rounded-2xl border border-neutral-800 max-w-md w-full p-8">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-white">
              ✕
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🔒</span>
              </div>

              <h2 className="text-2xl font-bold mb-3">Get Started with Voyage</h2>
              <p className="text-neutral-400 mb-8">
                Create an account or sign in to start planning your perfect trip
              </p>

              <div className="space-y-4">
                <button onClick={() => navigate('/signup')} className="w-full btn-primary">
                  Create Account
                </button>
                
                <button onClick={() => navigate('/login')} className="w-full btn-secondary">
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
