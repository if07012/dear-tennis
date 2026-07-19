// ===================================
// DEAR TENNIS - MAIN JAVASCRIPT
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ===================================
    // NAVIGATION
    // ===================================
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Navbar scroll effect
    function handleNavbarScroll() {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
    
    window.addEventListener('scroll', handleNavbarScroll);
    handleNavbarScroll(); // Check on load
    
    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        this.classList.toggle('active');
    });
    
    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            mobileMenuBtn.classList.remove('active');
        });
    });
    
    // ===================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ===================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // ===================================
    // REVEAL ANIMATIONS ON SCROLL
    // ===================================
    const revealElements = document.querySelectorAll('.reveal-left, .reveal-right, .reveal-up, .reveal-scale');
    
    function checkReveal() {
        const triggerBottom = window.innerHeight * 0.85;
        
        revealElements.forEach(element => {
            const boxTop = element.getBoundingClientRect().top;
            
            if (boxTop < triggerBottom) {
                element.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', checkReveal);
    checkReveal(); // Check on load
    
    // ===================================
    // COUNTER ANIMATION FOR STATISTICS
    // ===================================
    const statNumbers = document.querySelectorAll('.stat-number, .stat-number-lg');
    let countersAnimated = false;
    
    function animateCounters() {
        if (countersAnimated) return;
        
        const statsSection = document.querySelector('.statistics');
        if (!statsSection) return;
        
        const sectionTop = statsSection.getBoundingClientRect().top;
        const triggerPoint = window.innerHeight * 0.85;
        
        if (sectionTop < triggerPoint) {
            countersAnimated = true;
            
            statNumbers.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'));
                const duration = 2000; // 2 seconds
                const increment = target / (duration / 16); // 60fps
                let current = 0;
                
                const updateCounter = () => {
                    current += increment;
                    if (current < target) {
                        counter.textContent = Math.ceil(current);
                        requestAnimationFrame(updateCounter);
                    } else {
                        counter.textContent = target;
                    }
                };
                
                updateCounter();
            });
        }
    }
    
    window.addEventListener('scroll', animateCounters);
    animateCounters(); // Check on load
    
    // ===================================
    // FAQ ACCORDION
    // ===================================
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
    
    // ===================================
    // ACTIVITY TABS FILTERING
    // ===================================
    const tabButtons = document.querySelectorAll('.tab-btn');
    const activityCards = document.querySelectorAll('.activity-card');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.getAttribute('data-tab');
            
            // Filter cards
            activityCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                if (filter === 'all' || category === filter) {
                    card.style.display = 'block';
                    // Add animation
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.style.display = 'none';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                }
            });
        });
    });
    
    // ===================================
    // TESTIMONIAL SLIDER
    // ===================================
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.nav-btn.prev');
    const nextBtn = document.querySelector('.nav-btn.next');
    let currentTestimonial = 0;
    
    function showTestimonial(index) {
        testimonialCards.forEach((card, i) => {
            card.style.display = i === index ? 'block' : 'none';
        });
        
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        currentTestimonial = index;
    }
    
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', function() {
            let newIndex = currentTestimonial - 1;
            if (newIndex < 0) newIndex = testimonialCards.length - 1;
            showTestimonial(newIndex);
        });
        
        nextBtn.addEventListener('click', function() {
            let newIndex = currentTestimonial + 1;
            if (newIndex >= testimonialCards.length) newIndex = 0;
            showTestimonial(newIndex);
        });
    }
    
    // Auto-advance testimonials every 5 seconds
    if (testimonialCards.length > 0) {
        setInterval(() => {
            let newIndex = currentTestimonial + 1;
            if (newIndex >= testimonialCards.length) newIndex = 0;
            showTestimonial(newIndex);
        }, 5000);
    }
    
    // Initialize first testimonial
    if (testimonialCards.length > 0) {
        showTestimonial(0);
    }
    
    // ===================================
    // MEMBERSHIP FORM HANDLING
    // ===================================
    const membershipForm = document.getElementById('membershipForm');
    
    if (membershipForm) {
        membershipForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            // Validate form
            if (!data.name || !data.email || !data.level) {
                alert('Please fill in all fields');
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                alert('Please enter a valid email address');
                return;
            }
            
            // Simulate form submission
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;
            
            // Simulate API call
            setTimeout(() => {
                alert(`Thank you ${data.name}! We'll contact you at ${data.email} within 24 hours.`);
                membershipForm.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1500);
            
            console.log('Form submitted:', data);
        });
    }
    
    // ===================================
    // PARALLAX EFFECT FOR HERO
    // ===================================
    const heroBg = document.querySelector('.hero-bg');
    
    if (heroBg) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            if (scrolled < window.innerHeight) {
                heroBg.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
        });
    }
    
    // ===================================
    // ACTIVE NAV LINK HIGHLIGHTING
    // ===================================
    const sections = document.querySelectorAll('section[id]');
    
    function highlightNavLink() {
        const scrollPosition = window.scrollY + 150;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', highlightNavLink);
    
    // ===================================
    // INTERSECTION OBSERVER FOR PERFORMANCE
    // ===================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.benefit-card, .activity-card, .event-card').forEach(el => {
        observer.observe(el);
    });
    
    // ===================================
    // LAZY LOADING FOR IMAGES (when added)
    // ===================================
    if ('loading' in HTMLImageElement.prototype) {
        const images = document.querySelectorAll('img[loading="lazy"]');
        images.forEach(img => {
            img.src = img.dataset.src;
        });
    }
    
    // ===================================
    // PERFORMANCE OPTIMIZATION
    // ===================================
    let ticking = false;
    
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                handleNavbarScroll();
                checkReveal();
                animateCounters();
                highlightNavLink();
                ticking = false;
            });
            ticking = true;
        }
    });
    
    // ===================================
    // CONSOLE MESSAGE
    // ===================================
    console.log('%c🎾 Dear Tennis Community', 'font-size: 20px; font-weight: bold; color: #E85D04;');
    console.log('%cWelcome to our tennis community website!', 'font-size: 14px; color: #2C5F4B;');
    
});

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Add utility to window for potential external use
window.DearTennis = {
    scrollTo: function(id) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};
