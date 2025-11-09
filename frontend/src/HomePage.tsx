import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const HomePage = () => {
  const [trending, setTrending] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
  fetch('http://localhost:8000/api/trending')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.trending_destinations)) {
          setTrending(data.trending_destinations);
        } else {
          setTrending([]);
        }
      })
      .catch(() => setTrending([]));
  }, []);

  const handleStartJourney = () => {
    navigate('/register');
  };

  const handlePlanTrip = () => {
    navigate('/login');
  };

  return (
    <div className="homepage-container">
      <nav className="navbar">
        <div className="navbar-logo">VOYAGE</div>
        <div className="navbar-links">
          <a href="#home">Home</a>
          <a href="#explore">Explore</a>
          <a href="#features">Features</a>
        </div>
        <div className="navbar-user">
          <button className="hero-button" onClick={handlePlanTrip}>Login</button>
        </div>
      </nav>
      <section className="hero-section">
        <h1 className="hero-title">Your Journey, Reimagined by AI.</h1>
        <p className="hero-description">
          Stop planning, start traveling. Describe your perfect trip in one sentence, and let Voyage build you a complete, personalized itinerary in minutes.
        </p>
        <button className="hero-button" onClick={handleStartJourney}>Start Planning</button>
      </section>
      <section className="experiences-section">
        <h2 className="section-title">Explore Trending Destinations</h2>
        <p className="section-description">Discover what's hot right now across India.</p>
        <div className="experiences-grid">
          {trending.length === 0 ? (
            <div style={{ color: '#bdbdbd', textAlign: 'center', width: '100%' }}>Loading trending destinations...</div>
          ) : (
            trending.map((item) => (
              <div className="experience-card" key={item.destination}>
                {item.image_url && (
                  <div className="suggestion-image-wrapper">
                    <img 
                      src={item.image_url} 
                      alt={item.destination} 
                      className="suggestion-image"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=600&fit=crop&q=80';
                      }}
                    />
                  </div>
                )}
                <div className="card-header">
                  <h3>{item.title || item.destination}</h3>
                  {item.tags && Array.isArray(item.tags) && item.tags.length > 0 && (
                    <span className="tag">{item.tags[0]}</span>
                  )}
                </div>
                <p>{item.description}</p>
                <div className="card-footer">
                  {item.estimated_budget && <span className="price">{item.estimated_budget}</span>}
                  {item.best_time && <span className="best-time">{item.best_time}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="features-section">
        <h2 className="section-title">Why Choose Voyage?</h2>
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-icon" role="img" aria-label="AI Powered">🤖</span>
            <h3>AI Powered</h3>
            <p>Smart recommendations tailored to your travel style</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon" role="img" aria-label="Travel Matching">✈️</span>
            <h3>Travel Matching</h3>
            <p>Discover your travel archetype and preferences</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon" role="img" aria-label="Easy Planning">📅</span>
            <h3>Easy Planning</h3>
            <p>Organize your entire trip in one place</p>
          </div>
        </div>
      </section>
      <section className="cta-section">
        <h2 className="cta-title">Ready to explore?</h2>
        <p className="cta-description">Start planning your next adventure today with personalized AI recommendations.</p>
        <div className="cta-buttons">
          <button className="cta-button primary" onClick={handleStartJourney}>Get Started Free</button>
          <button className="cta-button" onClick={handlePlanTrip}>Plan a Trip</button>
          <button className="cta-button">Collaborate</button>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
