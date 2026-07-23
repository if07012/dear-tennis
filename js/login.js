// ===================================
// DEAR TENNIS - LOGIN PAGE JAVASCRIPT
// Enhanced with GSAP Animations
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ===================================
    // PARTICLE SYSTEM
    // ===================================
    const particlesContainer = document.getElementById('particlesContainer');
    const particleCount = 20;
    
    function createParticles() {
        if (!particlesContainer) return;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random properties
            const size = Math.random() * 60 + 20;
            const left = Math.random() * 100;
            const delay = Math.random() * 20;
            const duration = Math.random() * 20 + 15;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${left}%`;
            particle.style.animationDelay = `${delay}s`;
            particle.style.animationDuration = `${duration}s`;
            
            particlesContainer.appendChild(particle);
        }
    }
    
    createParticles();
    
    // ===================================
    // CURSOR GLOW EFFECT
    // ===================================
    const cursorGlow = document.getElementById('cursorGlow');
    const loginSection = document.querySelector('.login-section');
    
    if (cursorGlow && loginSection) {
        let mouseX = 0, mouseY = 0;
        let glowX = 0, glowY = 0;
        
        loginSection.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        function updateGlow() {
            // Smooth interpolation
            glowX += (mouseX - glowX) * 0.1;
            glowY += (mouseY - glowY) * 0.1;
            
            cursorGlow.style.left = `${glowX}px`;
            cursorGlow.style.top = `${glowY}px`;
            
            requestAnimationFrame(updateGlow);
        }
        
        updateGlow();
    }
    
    // ===================================
    // GSAP ENTRANCE ANIMATIONS
    // ===================================
    function initEntranceAnimations() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            // Skip animations for users who prefer reduced motion
            document.querySelector('.login-card').style.opacity = '1';
            document.querySelector('.login-card').style.transform = 'none';
            return;
        }
        
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        
        // Background fade in
        tl.from('.login-section', {
            opacity: 0,
            duration: 1
        });
        
        // Particles appear
        tl.from('.particle', {
            opacity: 0,
            scale: 0,
            stagger: {
                amount: 1,
                from: 'random'
            },
            duration: 0.8
        }, '-=0.5');
        
        // Logo animation
        tl.from('#loginLogo', {
            opacity: 0,
            scale: 0.5,
            rotation: -15,
            duration: 0.8,
            ease: 'back.out(1.7)'
        }, '-=0.6');
        
        // Header animations
        tl.from(['.login-title', '.login-subtitle'], {
            opacity: 0,
            y: 30,
            stagger: 0.1,
            duration: 0.8
        }, '-=0.4');
        
        // Form groups with stagger
        tl.from('.form-group', {
            opacity: 0,
            y: 20,
            stagger: 0.15,
            duration: 0.6
        }, '-=0.3');
        
        // Form options
        tl.from('#formOptions', {
            opacity: 0,
            y: 20,
            duration: 0.5
        }, '-=0.3');
        
        // Login button
        tl.from('#loginBtn', {
            opacity: 0,
            y: 20,
            scale: 0.95,
            duration: 0.5
        }, '-=0.3');
        
        // Divider
        tl.from('#loginDivider', {
            opacity: 0,
            scale: 0.8,
            duration: 0.4
        }, '-=0.2');
        
        // Social login buttons
        tl.from('.social-login', {
            opacity: 0,
            y: 20,
            duration: 0.5
        }, '-=0.2');
        
        tl.from('.social-btn', {
            opacity: 0,
            y: 10,
            stagger: 0.1,
            duration: 0.4
        }, '-=0.3');
        
        // Signup link
        tl.from('#signupLink', {
            opacity: 0,
            y: 10,
            duration: 0.4
        }, '-=0.2');
    }
    
    // Initialize entrance animations
    setTimeout(initEntranceAnimations, 100);
    
    // ===================================
    // PARALLAX EFFECT ON CARD
    // ===================================
    const loginCard = document.getElementById('loginCard');
    
    if (loginCard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        loginSection.addEventListener('mousemove', (e) => {
            const rect = loginCard.getBoundingClientRect();
            const cardCenterX = rect.left + rect.width / 2;
            const cardCenterY = rect.top + rect.height / 2;
            
            const deltaX = (e.clientX - cardCenterX) / rect.width;
            const deltaY = (e.clientY - cardCenterY) / rect.height;
            
            gsap.to(loginCard, {
                rotationY: deltaX * 2,
                rotationX: -deltaY * 2,
                transformPerspective: 1000,
                duration: 0.5,
                ease: 'power2.out'
            });
        });
        
        loginSection.addEventListener('mouseleave', () => {
            gsap.to(loginCard, {
                rotationY: 0,
                rotationX: 0,
                duration: 0.5,
                ease: 'power2.out'
            });
        });
    }
    
    // ===================================
    // PASSWORD VISIBILITY TOGGLE
    // ===================================
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icons with animation
            const eyeOpen = this.querySelector('.eye-open');
            const eyeClosed = this.querySelector('.eye-closed');
            
            if (type === 'text') {
                gsap.to(eyeOpen, { scale: 0.8, duration: 0.2, onComplete: () => {
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                    gsap.from(eyeClosed, { scale: 0.8, duration: 0.2 });
                }});
            } else {
                gsap.to(eyeClosed, { scale: 0.8, duration: 0.2, onComplete: () => {
                    eyeClosed.style.display = 'none';
                    eyeOpen.style.display = 'block';
                    gsap.from(eyeOpen, { scale: 0.8, duration: 0.2 });
                }});
            }
        });
    }
    
    // ===================================
    // FORM VALIDATION & ANIMATIONS
    // ===================================
    const emailInput = document.getElementById('email');
    const emailGroup = document.getElementById('emailGroup');
    const passwordGroup = document.getElementById('passwordGroup');
    
    // Email validation
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isValid = emailRegex.test(this.value);
            
            if (this.value) {
                if (isValid) {
                    emailGroup.classList.add('valid');
                    emailGroup.classList.remove('invalid');
                } else {
                    emailGroup.classList.add('invalid');
                    emailGroup.classList.remove('valid');
                }
            }
        });
        
        emailInput.addEventListener('focus', function() {
            emailGroup.classList.remove('invalid');
        });
    }
    
    // Password validation
    if (passwordInput) {
        passwordInput.addEventListener('blur', function() {
            if (this.value && this.value.length >= 6) {
                passwordGroup.classList.add('valid');
                passwordGroup.classList.remove('invalid');
            } else if (this.value) {
                passwordGroup.classList.add('invalid');
                passwordGroup.classList.remove('valid');
            }
        });
        
        passwordInput.addEventListener('focus', function() {
            passwordGroup.classList.remove('invalid');
        });
    }
    
    // ===================================
    // LOGIN FORM SUBMISSION
    // ===================================
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const pageOverlay = document.getElementById('pageOverlay');
    
    if (loginForm && loginBtn) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            // Basic validation
            if (!email || !password) {
                showNotification('Please fill in all fields', 'error');
                shakeCard();
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email address', 'error');
                emailGroup.classList.add('invalid');
                return;
            }
            
            // Password validation (minimum 6 characters)
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters', 'error');
                passwordGroup.classList.add('invalid');
                return;
            }
            
            // Simulate login process
            loginBtn.classList.add('loading');
            loginBtn.querySelector('.btn-text').textContent = 'Signing in...';
            
            // Simulate API call
            setTimeout(() => {
                // Success state
                loginBtn.classList.remove('loading');
                loginBtn.classList.add('success');
                
                // Animate success checkmark
                gsap.fromTo(loginBtn.querySelector('.btn-spinner'), 
                    { scale: 0.8 },
                    { scale: 1, duration: 0.3 }
                );
                
                showNotification('Login successful! Redirecting...', 'success');
                
                // Pulse animation on card
                gsap.to('.login-card', {
                    scale: 1.02,
                    duration: 0.3,
                    yoyo: true,
                    repeat: 1,
                    ease: 'power2.out'
                });
                
                setTimeout(() => {
                    // Page transition
                    if (pageOverlay) {
                        pageOverlay.classList.add('active');
                        
                        setTimeout(() => {
                            // Store remember me preference
                            if (rememberMe) {
                                localStorage.setItem('rememberedEmail', email);
                            } else {
                                localStorage.removeItem('rememberedEmail');
                            }
                            
                            // Redirect to profile page
                            window.location.href = 'profile.html';
                        }, 600);
                    } else {
                        // Fallback without overlay
                        if (rememberMe) {
                            localStorage.setItem('rememberedEmail', email);
                        } else {
                            localStorage.removeItem('rememberedEmail');
                        }
                        window.location.href = 'profile.html';
                    }
                }, 1500);
            }, 1500);
        });
    }
    
    // ===================================
    // SHAKE CARD ANIMATION
    // ===================================
    function shakeCard() {
        gsap.to('.login-card', {
            x: [-10, 10, -10, 10, 0],
            duration: 0.5,
            ease: 'power2.inOut'
        });
    }
    
    // ===================================
    // SOCIAL LOGIN BUTTONS (Ripple Effect)
    // ===================================
    const socialBtns = document.querySelectorAll('.social-btn');
    
    socialBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(44, 95, 75, 0.2);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size/2}px`;
            ripple.style.top = `${e.clientY - rect.top - size/2}px`;
            
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
            
            // Show notification
            const provider = this.textContent.trim();
            showNotification(`${provider} login coming soon!`, 'info');
        });
    });
    
    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // ===================================
    // FORGOT PASSWORD LINK
    // ===================================
    const forgotLink = document.getElementById('forgotLink');
    
    if (forgotLink) {
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification('Password reset feature coming soon!', 'info');
            
            // Animate the link
            gsap.to(this, {
                scale: 1.1,
                duration: 0.2,
                yoyo: true,
                repeat: 1
            });
        });
    }
    
    // ===================================
    // SIGNUP LINK
    // ===================================
    const signupLink = document.querySelector('#signupLink a');
    
    if (signupLink) {
        signupLink.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification('Registration feature coming soon!', 'info');
            
            // Animate
            gsap.to(this, {
                scale: 1.05,
                color: '#E85D04',
                duration: 0.3
            });
        });
    }
    
    // ===================================
    // REMEMBER ME FUNCTIONALITY
    // ===================================
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    
    if (rememberedEmail && emailInput) {
        emailInput.value = rememberedEmail;
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
            // Animate checkbox
            gsap.from('.checkbox-custom', {
                scale: 0,
                duration: 0.4,
                ease: 'back.out(1.7)',
                delay: 0.5
            });
        }
    }
    
    // ===================================
    // NOTIFICATION SYSTEM (Enhanced)
    // ===================================
    function showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.login-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `login-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content" style="display: flex; align-items: center; gap: 12px;">
                <span class="notification-icon" style="font-size: 1.2rem;">${getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add styles dynamically
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 16px 24px;
            background: ${getNotificationBackground(type)};
            color: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            z-index: 9999;
            backdrop-filter: blur(10px);
            max-width: 350px;
        `;
        
        document.body.appendChild(notification);
        
        // GSAP entrance animation
        gsap.from(notification, {
            x: 100,
            opacity: 0,
            duration: 0.5,
            ease: 'power3.out'
        });
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            gsap.to(notification, {
                x: 100,
                opacity: 0,
                duration: 0.3,
                ease: 'power3.in',
                onComplete: () => notification.remove()
            });
        }, 4000);
    }
    
    function getNotificationIcon(type) {
        switch(type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'info': return 'ℹ';
            default: return '•';
        }
    }
    
    function getNotificationBackground(type) {
        switch(type) {
            case 'success': return '#2C5F4B';
            case 'error': return '#E85D04';
            case 'info': return '#5F9EA0';
            default: return '#3A3A3A';
        }
    }
    
    // ===================================
    // FORM INPUT INTERACTIONS
    // ===================================
    const formInputs = document.querySelectorAll('.form-group input');
    
    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
            
            // Scale animation
            gsap.to(this, {
                scale: 1.02,
                duration: 0.2
            });
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            
            gsap.to(this, {
                scale: 1,
                duration: 0.2
            });
        });
        
        // Input typing animation
        input.addEventListener('input', function() {
            if (this.value.length > 0) {
                gsap.from(this, {
                    scale: 1.01,
                    duration: 0.15
                });
            }
        });
    });
    
    // ===================================
    // KEYBOARD NAVIGATION ENHANCEMENTS
    // ===================================
    document.addEventListener('keydown', function(e) {
        // Enter key on inputs
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            const nextInput = getNextInput(e.target);
            if (nextInput) {
                e.preventDefault();
                nextInput.focus();
            }
        }
    });
    
    function getNextInput(current) {
        const inputs = Array.from(document.querySelectorAll('input:not([type="checkbox"])'));
        const currentIndex = inputs.indexOf(current);
        return inputs[currentIndex + 1] || null;
    }
    
});
