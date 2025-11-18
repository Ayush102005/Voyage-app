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
        <div className="absolute inset-0 bg-gradient-to-br from-[#23424A]/30 via-black to-black" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#57A5B8]/10 rounded-full blur-3xl" />
        
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
                <div className="card text-center group hover:shadow-xl hover:shadow-[#57A5B8]/20">
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

      {/* Help Section */}
      <section className="py-20 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Need <span className="gradient-text">Help?</span>
          </h2>
          <p className="text-neutral-400 text-center mb-12 text-lg">
            Find answers to common questions
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: "🤔",
                question: "How does AI trip planning work?",
                answer: "Our AI analyzes your preferences, budget, and interests to create personalized itineraries tailored just for you."
              },
              {
                icon: "💰",
                question: "What's included in the budget?",
                answer: "The budget covers accommodation, transportation, food, activities, and miscellaneous expenses based on your preferences."
              },
              {
                icon: "📱",
                question: "Can I modify my itinerary?",
                answer: "Yes! You can customize any part of your AI-generated plan to match your exact needs."
              },
              {
                icon: "🔒",
                question: "Is my data secure?",
                answer: "Absolutely. We use Firebase authentication and secure encryption to protect all your personal information."
              }
            ].map((faq, i) => (
              <div key={i} className="card group hover:shadow-lg hover:shadow-[#57A5B8]/10">
                <div className="flex gap-4">
                  <div className="text-4xl flex-shrink-0">{faq.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-[#57A5B8] transition-colors">
                      {faq.question}
                    </h3>
                    <p className="text-neutral-400 text-sm">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Get in <span className="gradient-text">Touch</span>
          </h2>
          <p className="text-neutral-400 text-center mb-12 text-lg">
            We'd love to hear from you
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            {[
              {
                icon: "📧",
                title: "Email Us",
                detail: "support@voyage.com",
                action: "mailto:support@voyage.com"
              },
              {
                icon: "💬",
                title: "Live Chat",
                detail: "Available 9 AM - 9 PM IST",
                action: "#"
              },
              {
                icon: "📞",
                title: "Call Us",
                detail: "+91 1800-VOYAGE",
                action: "tel:+911800voyage"
              }
            ].map((contact, i) => (
              <a
                key={i}
                href={contact.action}
                className="card text-center group hover:shadow-xl hover:shadow-[#57A5B8]/20 hover:scale-105 transition-all"
              >
                <div className="text-5xl mb-4">{contact.icon}</div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-[#57A5B8] transition-colors">
                  {contact.title}
                </h3>
                <p className="text-neutral-400">{contact.detail}</p>
              </a>
            ))}
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto card">
            <h3 className="text-2xl font-bold mb-6 text-center">Send us a Message</h3>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              alert('Thank you for your message! We\'ll get back to you soon.')
            }}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Name</label>
                  <input
                    type="text"
                    className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Email</label>
                  <input
                    type="email"
                    className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Subject</label>
                <input
                  type="text"
                  className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                  placeholder="How can we help?"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Message</label>
                <textarea
                  className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors resize-none"
                  placeholder="Tell us what's on your mind..."
                  rows={5}
                  required
                />
              </div>
              <button type="submit" className="w-full btn-primary">
                Send Message ✉️
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-neutral-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">✈️</span>
                <span className="text-2xl font-bold gradient-text">Voyage</span>
              </div>
              <p className="text-neutral-400 text-sm">
                AI-powered travel planning for unforgettable Indian journeys.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Home</a></li>
                <li><a href="#" onClick={() => setShowAuthModal(true)} className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Plan Trip</a></li>
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Destinations</a></li>
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Pricing</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Help Center</a></li>
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">FAQs</a></li>
                <li><a href="#" className="text-neutral-400 hover:text-[#57A5B8] transition-colors">Terms & Privacy</a></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold mb-4">Follow Us</h4>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-[#57A5B8] transition-colors">
                  <span className="text-lg">📘</span>
                </a>
                <a href="#" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-[#57A5B8] transition-colors">
                  <span className="text-lg">🐦</span>
                </a>
                <a href="#" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-[#57A5B8] transition-colors">
                  <span className="text-lg">📷</span>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-8 text-center text-neutral-500 text-sm">
            © 2025 Voyage. Crafted with AI for unforgettable journeys. All rights reserved.
          </div>
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
              <div className="w-16 h-16 bg-[#57A5B8]/10 rounded-full flex items-center justify-center mx-auto mb-6">
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
