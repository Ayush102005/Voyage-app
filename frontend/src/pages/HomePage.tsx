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
              Plan your perfect trip in minutes. AI does the work, you enjoy the adventure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => setShowAuthModal(true)} className="btn-primary text-lg px-8 py-4">
                Plan Your Trip →
              </button>
            </div>
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
              <div className="flex gap-3 flex-wrap">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://threads.net" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-black hover:ring-2 hover:ring-white transition-all">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.186 3.949c-.676.019-1.347.105-1.998.256-1.912.442-3.504 1.485-4.518 2.956-.766 1.113-1.208 2.415-1.36 4.007-.03.314-.04.944-.04 2.831 0 1.888.01 2.518.04 2.832.152 1.591.594 2.893 1.36 4.006 1.014 1.471 2.606 2.514 4.518 2.956.651.151 1.322.237 1.998.256.306.008 2.125.008 2.432 0 .676-.019 1.347-.105 1.998-.256 1.912-.442 3.504-1.485 4.518-2.956.766-1.113 1.208-2.415 1.36-4.006.03-.314.04-.944.04-2.832 0-1.887-.01-2.517-.04-2.831-.152-1.592-.594-2.894-1.36-4.007-1.014-1.471-2.606-2.514-4.518-2.956a8.32 8.32 0 00-1.998-.256c-.307-.008-2.125-.008-2.432 0zm-.114 2.145c.243-.007 1.61-.007 1.856 0 .555.015 1.005.068 1.437.17 1.312.306 2.382.991 3.045 1.948.507.731.806 1.563.916 2.548.025.227.031.604.031 2.04s-.006 1.813-.031 2.04c-.11.985-.409 1.817-.916 2.548-.663.957-1.733 1.642-3.045 1.948-.432.102-.882.155-1.437.17-.246.007-1.613.007-1.856 0-.555-.015-1.005-.068-1.437-.17-1.312-.306-2.382-.991-3.045-1.948-.507-.731-.806-1.563-.916-2.548-.025-.227-.031-.604-.031-2.04s.006-1.813.031-2.04c.11-.985.409-1.817.916-2.548.663-.957 1.733-1.642 3.045-1.948.432-.102.882-.155 1.437-.17zm3.913 2.862a1.03 1.03 0 100 2.06 1.03 1.03 0 000-2.06zm-3.785.515a3.64 3.64 0 103.64 3.64 3.64 3.64 0 00-3.64-3.64zm0 1.458a2.182 2.182 0 110 4.364 2.182 2.182 0 010-4.364z"/></svg>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-black transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://snapchat.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.12-.064-.187-.023-.23.135-.436.375-.48 3.265-.525 4.732-3.879 4.806-4.029l.015-.016c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg>
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
