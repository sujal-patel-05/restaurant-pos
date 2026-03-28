import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

/* ─── Utility: Intersection Observer for scroll reveals ─── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Animated Counter Hook ─── */
function useCounter(end, duration = 2000, suffix = '', prefix = '') {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const startTime = performance.now();
        const animate = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setVal(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);

  return { ref, display: `${prefix}${val.toLocaleString()}${suffix}` };
}

/* ─── Hero Word Reveal ─── */
function HeroWords({ text, startDelay = 0 }) {
  return text.split(' ').map((word, i) => (
    <span key={i} className="lp-hero-word" style={{ animationDelay: `${startDelay + i * 60}ms` }}>
      {word}&nbsp;
    </span>
  ));
}

/* ════════════════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [annual, setAnnual] = useState(true);

  // Custom cursor
  const cursorRef = useRef(null);
  const [cursorActive, setCursorActive] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cursor tracking
  useEffect(() => {
    const move = (e) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX - 4 + 'px';
        cursorRef.current.style.top = e.clientY - 4 + 'px';
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const handleProceed = useCallback(() => navigate('/login'), [navigate]);
  const scrollTo = useCallback((id) => {
    setMobileNav(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Reveal refs
  const featRef = useReveal();
  const bentoRef = useReveal();
  const hiwRef = useReveal();
  const statsRef = useReveal();
  const testRef = useReveal();
  const priceRef = useReveal();
  const ctaRef = useReveal();

  // Counters
  const c1 = useCounter(4200, 2200, '+');
  const c2 = useCounter(2.8, 2200, 'Cr');
  const c3 = useCounter(99.98, 2500, '%');
  const c4 = useCounter(0.3, 1800, 's');

  // For the 2.8 and 0.3 counters, we need decimal handling
  const [stat2, setStat2] = useState('0');
  const [stat4, setStat4] = useState('0');
  const stat2Ref = useRef(null);
  const stat4Ref = useRef(null);

  useEffect(() => {
    const animate = (el, target, setter, dur, decimals) => {
      if (!el) return;
      let started = false;
      const obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !started) {
          started = true;
          const st = performance.now();
          const run = (now) => {
            const p = Math.min((now - st) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setter((eased * target).toFixed(decimals));
            if (p < 1) requestAnimationFrame(run);
          };
          requestAnimationFrame(run);
        }
      }, { threshold: 0.3 });
      obs.observe(el);
      return () => obs.disconnect();
    };
    const d1 = animate(stat2Ref.current, 2.8, setStat2, 2200, 1);
    const d2 = animate(stat4Ref.current, 0.3, setStat4, 1800, 1);
    return () => { d1?.(); d2?.(); };
  }, []);

  // Sparkline bars
  const sparkBars = [18, 25, 15, 30, 22, 35, 28, 40, 32, 45, 38, 50];

  return (
    <div className="landing-page">
      {/* Custom Cursor (desktop only) */}
      {/* Custom Cursor (desktop only) */}
      <div ref={cursorRef} className={`cursor-dot${cursorActive ? ' active' : ''}`} />

      {/* ── NAVBAR ── */}
      <nav className={`lp-navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-navbar-logo">
          <div className="logo-icon">🍴</div>
          SujalPOS<span className="accent-dot">.</span>
        </div>

        <div className="lp-nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
          <a href="#testimonials" onClick={(e) => { e.preventDefault(); scrollTo('testimonials'); }}>Testimonials</a>
        </div>

        <div className="lp-nav-actions">
          <button className="btn-ghost" onClick={handleProceed}>Sign In</button>
          <button className="btn-primary" onClick={handleProceed}
            onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
            Get Started →
          </button>
          <button className={`lp-hamburger${mobileNav ? ' open' : ''}`} onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className={`lp-mobile-nav${mobileNav ? ' open' : ''}`}>
        <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
        <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
        <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
        <a href="#testimonials" onClick={(e) => { e.preventDefault(); scrollTo('testimonials'); }}>Testimonials</a>
        <button onClick={handleProceed} style={{ color: '#2563EB' }}>Get Started →</button>
        <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }} style={{ fontSize: 18, color: 'var(--text-muted)' }}>AI Voice Ordering</a>
      </div>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-bg">
          <div className="mesh-gradient mesh-1" />
          <div className="mesh-gradient mesh-2" />
          <div className="mesh-gradient mesh-3" />
          <div className="dot-grid" />
        </div>

        <div className="lp-hero-content">
          <div className="lp-hero-text">
            <div className="lp-hero-badge">✦ Next-Gen POS with AI Voice Ordering</div>
            <h1>
              <HeroWords text="The POS That Moves" startDelay={200} />
              <br />
              <span className="gradient-text">
                <HeroWords text="As Fast As Your Kitchen." startDelay={500} />
              </span>
            </h1>
            <p className="lp-hero-sub lp-hero-sub-animated">
              SujalPOS is the all-in-one restaurant operating system — orders, payments,
              inventory, AI voice ordering, and staff management. All in one screen.
            </p>
            <div className="lp-hero-ctas lp-hero-ctas-animated">
              <button className="btn-hero-primary" onClick={handleProceed}
                onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
                Get Started Free →
              </button>
              <button className="btn-hero-secondary" onClick={() => scrollTo('features')}>
                ▶ Watch Demo
              </button>
            </div>
            <div className="lp-trust-badges lp-trust-animated">
              <span><span className="badge-icon">✦</span> No credit card required</span>
              <span><span className="badge-icon">✦</span> Setup in 10 minutes</span>
              <span><span className="badge-icon">✦</span> 24/7 Support</span>
            </div>
          </div>

          {/* Hero Mockup */}
          <div className="lp-hero-visual">
            <div className="lp-hero-mockup">
              <div className="mockup-header">
                <div className="mockup-dot red" />
                <div className="mockup-dot yellow" />
                <div className="mockup-dot green" />
              </div>
              <div className="mockup-body">
                <div className="mockup-stat-row">
                  <div className="mockup-stat">
                    <div className="label">Revenue</div>
                    <div className="value accent">₹48.2K</div>
                  </div>
                  <div className="mockup-stat">
                    <div className="label">Orders</div>
                    <div className="value">127</div>
                  </div>
                  <div className="mockup-stat">
                    <div className="label">Covers</div>
                    <div className="value">284</div>
                  </div>
                </div>
                <div className="mockup-orders">
                  <div className="mockup-order">
                    <span className="order-id">#047</span>
                    <span className="order-table">Table 9</span>
                    <span className="order-status done">✓ Done</span>
                  </div>
                  <div className="mockup-order">
                    <span className="order-id">#048</span>
                    <span className="order-table">Table 3</span>
                    <span className="order-status pending">Prepping</span>
                  </div>
                  <div className="mockup-order">
                    <span className="order-id">#049</span>
                    <span className="order-table">Table 12</span>
                    <span className="order-status new">New!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <div className="floating-card card-1">
              <span className="fc-icon">🔔</span> New Order! <span className="fc-highlight">#049</span>
            </div>
            <div className="floating-card card-2">
              <span className="fc-icon">💰</span> Revenue: <span className="fc-highlight">₹48,200</span>
            </div>
            <div className="floating-card card-3">
              <span className="fc-icon">✅</span> Order #047 — <span className="fc-highlight">Served</span>
            </div>
          </div>
        </div>

        <div className="lp-scroll-indicator">
          <span>Scroll</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* ── MARQUEE TRUST BAR ── */}
      <section className="lp-marquee-section">
        <div className="lp-marquee-track">
          {[...Array(2)].map((_, setIdx) => (
            <React.Fragment key={setIdx}>
              <span className="lp-marquee-item"><span className="marquee-icon">🏆</span> Trusted by 4,200+ restaurants worldwide</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">🍽️</span> Fine Dining</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">🍔</span> Fast Casual</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">☁️</span> Cloud Kitchen</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">☕</span> Café</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">🚚</span> Food Truck</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">🍕</span> Pizzeria</span>
              <span className="marquee-divider">●</span>
              <span className="lp-marquee-item"><span className="marquee-icon">🍜</span> QSR</span>
              <span className="marquee-divider">●</span>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section lp-reveal" ref={featRef} id="features">
        <div className="lp-section-label">Features</div>
        <h2 className="lp-section-title">Everything your restaurant needs.<br />Nothing it doesn't.</h2>

        <div className="lp-features-grid">
          {[
            { icon: '⚡', title: 'Instant Order Flow', desc: 'Orders hit the kitchen display in <0.3s. Zero lag, zero lost tickets.' },
            { icon: '💳', title: 'Split Payments', desc: 'Split by item, by seat, or any amount. Every payment method accepted.' },
            { icon: '📊', title: 'Live Analytics', desc: 'Real-time revenue, covers, and item performance — visible from your phone.' },
            { icon: '🧾', title: 'Smart Inventory', desc: 'Auto-deduct ingredients per order. Get alerts before you run out.' },
            { icon: '👨‍🍳', title: 'KDS Integration', desc: 'Kitchen Display System built-in. No third-party hardware needed.' },
            { icon: '🤖', title: 'AI Order Calling', desc: 'AI-powered voice bot takes phone orders automatically — 24/7, no staff needed.' },
            { icon: '🔌', title: '1-Click Integrations', desc: 'Connect Uber Eats, DoorDash, Zomato, and more in one tap.' },
          ].map((f, i) => (
            <div key={i} className="lp-feature-card"
              onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
              <div className="lp-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENTO GRID ── */}
      <section className="lp-bento lp-reveal" ref={bentoRef}>
        <div className="lp-section-label">Product</div>
        <h2 className="lp-section-title">Built for speed.<br />Designed for clarity.</h2>

        <div className="lp-bento-grid">
          {/* Large Card */}
          <div className="lp-bento-card large">
            <h3>Live Order Stream</h3>
            <p>Watch orders flow in real-time from every channel — dine-in, takeaway, and delivery.</p>
            <div className="bento-dashboard">
              <div className="bento-order-stream">
                {[
                  { id: '#102', table: 'Table 5', items: 'Butter Chicken, Naan ×2', status: 'Preparing' },
                  { id: '#103', table: 'Delivery', items: 'Paneer Tikka, Dal Makhani', status: 'Ready' },
                  { id: '#104', table: 'Table 11', items: 'Biryani ×3, Raita', status: 'New' },
                  { id: '#105', table: 'Takeaway', items: 'Veg Thali, Lassi ×2', status: 'Preparing' },
                ].map((o, i) => (
                  <div key={i} className="bento-order-item">
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{o.id}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{o.table}</span>
                    <span style={{ flex: 1, marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>{o.items}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      background: o.status === 'New' ? 'rgba(37,99,235,0.12)' : o.status === 'Ready' ? 'rgba(40,200,64,0.12)' : 'rgba(6,182,212,0.12)',
                      color: o.status === 'New' ? 'var(--accent)' : o.status === 'Ready' ? '#28c840' : 'var(--accent-secondary)'
                    }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Small Cards */}
          <div className="lp-bento-card">
            <h3>Table Turn Time</h3>
            <p>Average reduced by</p>
            <div className="bento-stat-number">31%</div>
            <div className="bento-sparkline">
              {sparkBars.map((h, i) => (
                <div key={i} className="bar" style={{ height: `${h}px` }} />
              ))}
            </div>
          </div>

          <div className="lp-bento-card">
            <h3>Live Notifications</h3>
            <p>Stay on top of every transaction.</p>
            <div className="bento-notification">
              <span className="notify-icon">🔔</span>
              <span className="notify-text">Table 12 just paid <span className="notify-amount">₹2,840</span></span>
            </div>
            <div className="bento-notification" style={{ animationDelay: '2s' }}>
              <span className="notify-icon">🍳</span>
              <span className="notify-text">Order #103 <span className="notify-amount">Ready</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-hiw lp-reveal" ref={hiwRef} id="how-it-works">
        <div className="lp-section-label">How It Works</div>
        <h2 className="lp-section-title">Up and running in minutes.</h2>

        <div className="lp-hiw-steps">
          {[
            { num: '1', icon: '📋', title: 'Set Up Your Menu', desc: 'Drag and drop menu items, set prices, assign categories. Done in minutes.' },
            { num: '2', icon: '📱', title: 'Take Orders Anywhere', desc: 'From tablet, phone, POS terminal, or let AI handle phone calls — every order syncs instantly.' },
            { num: '3', icon: '📈', title: 'Close Day Automatically', desc: 'End-of-day reports, tax summaries, and inventory snapshots — generated automatically.' },
          ].map((s, i) => (
            <div key={i} className="lp-hiw-step">
              <div className="lp-hiw-step-number">{s.num}</div>
              <div className="lp-hiw-step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats lp-reveal" ref={statsRef}>
        <div className="lp-stats-grid">
          <div className="lp-stat-item" ref={c1.ref}>
            <div className="lp-stat-number">{c1.display}</div>
            <div className="lp-stat-label">Restaurants Served</div>
          </div>
          <div className="lp-stat-item" ref={stat2Ref}>
            <div className="lp-stat-number">₹{stat2}<span className="accent">Cr</span></div>
            <div className="lp-stat-label">Processed Daily</div>
          </div>
          <div className="lp-stat-item">
            <div className="lp-stat-number" ref={c3.ref}>{c3.display}</div>
            <div className="lp-stat-label">Uptime Guaranteed</div>
          </div>
          <div className="lp-stat-item" ref={stat4Ref}>
            <div className="lp-stat-number">{'< '}{stat4}<span className="accent">s</span></div>
            <div className="lp-stat-label">Order Sync Speed</div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="lp-testimonials lp-reveal" ref={testRef} id="testimonials">
        <div className="lp-section-label">Testimonials</div>
        <h2 className="lp-section-title">Loved by restaurants everywhere.</h2>

        <div className="lp-testimonials-grid">
          {[
            { quote: "SujalPOS cut our order-to-table time by 40%. The KDS integration alone is worth every rupee.", name: 'Vraj Maitrak', role: 'Owner, Spice Garden (Fine Dining)', avatar: '👨‍🍳', stars: 5 },
            { quote: "We switched from a legacy POS and couldn't be happier. The real-time analytics are a game-changer.", name: 'Anshumitra Vyas', role: 'Manager, Chai Point (Café Chain)', avatar: '👩‍💼', stars: 5 },
            { quote: "Setup took 8 minutes. The inventory tracking alone has saved us from running out mid-service twice already.", name: 'Hari Bhuva', role: 'Chef-Owner, The Bowl Company', avatar: '🧑‍🍳', stars: 5 },
            { quote: "The AI voice ordering is incredible — it handles our phone orders perfectly even during peak hours.", name: 'Dhruvi Rupera', role: 'Owner, Flavours of India (Multi-Cuisine)', avatar: '👩‍🍳', stars: 5 },
            { quote: "Inventory management used to take us hours. Now it's fully automatic. Absolute lifesaver.", name: 'Raj Gandhi', role: 'Operations Head, Urban Bites (QSR Chain)', avatar: '👨‍💻', stars: 5 },
            { quote: "From billing to KDS to reports — everything just works. Best POS decision we ever made.", name: 'Hemal Desai', role: 'Founder, The Green Plate (Cloud Kitchen)', avatar: '🧑‍💼', stars: 5 },
          ].map((t, i) => (
            <div key={i} className="lp-testimonial-card"
              onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
              <div className="lp-testimonial-stars">{'★'.repeat(t.stars)}</div>
              <p className="lp-testimonial-quote">"{t.quote}"</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">{t.avatar}</div>
                <div className="lp-testimonial-info">
                  <p className="name">{t.name}</p>
                  <p className="role">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-pricing lp-reveal" ref={priceRef} id="pricing">
        <div className="lp-section-label">Pricing</div>
        <h2 className="lp-section-title" style={{ textAlign: 'center' }}>Simple, transparent pricing.</h2>

        <div className="lp-pricing-toggle">
          <span className={!annual ? 'active' : ''}>Monthly</span>
          <div className={`lp-pricing-switch${annual ? ' annual' : ''}`} onClick={() => setAnnual(!annual)} role="switch" aria-checked={annual} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAnnual(!annual); }}} />
          <span className={annual ? 'active' : ''}>Annual</span>
          {annual && <span className="lp-pricing-save-badge">Save 20%</span>}
        </div>

        <div className="lp-pricing-grid">
          {[
            {
              name: 'Starter', desc: 'Perfect for small cafés and food trucks.', popular: false,
              price: annual ? 799 : 999, features: ['1 POS terminal', 'Basic menu management', 'Daily reports', 'Email support', 'UPI & card payments'],
            },
            {
              name: 'Pro', desc: 'For growing restaurants that need more power.', popular: true,
              price: annual ? 1999 : 2499, features: ['Up to 5 terminals', 'KDS integration', 'Live analytics dashboard', 'Inventory management', 'Priority 24/7 support', 'Multi-location support'],
            },
            {
              name: 'Enterprise', desc: 'For chains and high-volume operations.', popular: false,
              price: null, features: ['Unlimited terminals', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee', 'On-premise deployment option', 'API access'],
            },
          ].map((plan, i) => (
            <div key={i} className={`lp-pricing-card${plan.popular ? ' popular' : ''}`}>
              {plan.popular && <div className="lp-pricing-popular-badge">Most Popular</div>}
              <div className="plan-name">{plan.name}</div>
              <p className="plan-desc">{plan.desc}</p>
              {plan.price !== null ? (
                <div className="plan-price">
                  <span className="currency">₹</span>{plan.price}<span className="period">/mo</span>
                </div>
              ) : (
                <div className="plan-price">Custom</div>
              )}
              <ul className="plan-features">
                {plan.features.map((f, fi) => (
                  <li key={fi}><span className="check">✓</span> {f}</li>
                ))}
              </ul>
              <button className={`plan-cta${plan.popular ? ' primary' : ' outline'}`}
                onClick={handleProceed}
                onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
                {plan.price !== null ? 'Get Started' : 'Contact Sales'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final-cta lp-reveal" ref={ctaRef}>
        <h2>Ready to run a smarter restaurant?</h2>
        <p className="sub">Join 4,200+ restaurants already using SujalPOS.</p>
        <button className="btn-hero-primary" onClick={handleProceed}
          onMouseEnter={() => setCursorActive(true)} onMouseLeave={() => setCursorActive(false)}>
          Proceed to App →
        </button>
        <p className="fine-print">No contracts. No setup fees. Cancel anytime.</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-footer-brand">
            <div className="footer-logo">SujalPOS<span className="accent-dot">.</span></div>
            <p className="footer-tagline">The next-generation POS system with AI voice ordering, built exclusively for modern restaurants.</p>
            <div className="lp-footer-socials">
              <a href="#" aria-label="Twitter" onClick={e => e.preventDefault()}>𝕏</a>
              <a href="#" aria-label="LinkedIn" onClick={e => e.preventDefault()}>in</a>
              <a href="#" aria-label="Instagram" onClick={e => e.preventDefault()}>📷</a>
              <a href="#" aria-label="YouTube" onClick={e => e.preventDefault()}>▶</a>
            </div>
          </div>
          <div className="lp-footer-column">
            <h4>Product</h4>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            <a href="#" onClick={e => e.preventDefault()}>Changelog</a>
          </div>
          <div className="lp-footer-column">
            <h4>Company</h4>
            <a href="#" onClick={e => e.preventDefault()}>About</a>
            <a href="#" onClick={e => e.preventDefault()}>Blog</a>
            <a href="#" onClick={e => e.preventDefault()}>Careers</a>
            <a href="#" onClick={e => e.preventDefault()}>Contact</a>
          </div>
          <div className="lp-footer-column">
            <h4>Legal</h4>
            <a href="#" onClick={e => e.preventDefault()}>Privacy Policy</a>
            <a href="#" onClick={e => e.preventDefault()}>Terms of Service</a>
            <a href="#" onClick={e => e.preventDefault()}>Cookie Policy</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2025 SujalPOS Inc. All rights reserved.</span>
          <span>Made with ❤️ for restaurants</span>
        </div>
      </footer>
    </div>
  );
}
