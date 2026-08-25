'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { TennisBallIcon } from '@/components/ui/Icons';
import { showNotification } from '@/components/ui/Notification';
import { setAuthUser } from '@/hooks/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PARTICLE_COUNT = 20;
const REMEMBER_KEY = 'rememberedEmail';

type FieldState = 'idle' | 'valid' | 'invalid';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function LoginPage() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailState, setEmailState] = useState<FieldState>('idle');
  const [passwordState, setPasswordState] = useState<FieldState>('idle');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  const shakeCard = useCallback(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { x: 0 },
      {
        keyframes: [{ x: -10 }, { x: 10 }, { x: -10 }, { x: 10 }, { x: 0 }],
        duration: 0.5,
        ease: 'power2.inOut',
      },
    );
  }, []);

  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      const size = Math.random() * 60 + 20;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 20}s`;
      particle.style.animationDuration = `${Math.random() * 20 + 15}s`;

      container.appendChild(particle);
    }

    return () => {
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const glow = glowRef.current;
    if (!section || !glow) return;

    let mouseX = 0;
    let mouseY = 0;
    let glowX = 0;
    let glowY = 0;
    let frameId = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const updateGlow = () => {
      glowX += (mouseX - glowX) * 0.1;
      glowY += (mouseY - glowY) * 0.1;
      glow.style.left = `${glowX}px`;
      glow.style.top = `${glowY}px`;
      frameId = requestAnimationFrame(updateGlow);
    };

    section.addEventListener('mousemove', onMove);
    frameId = requestAnimationFrame(updateGlow);

    return () => {
      section.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const card = cardRef.current;
    if (!section || !card) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - cardCenterX) / rect.width;
      const deltaY = (e.clientY - cardCenterY) / rect.height;

      gsap.to(card, {
        rotationY: deltaX * 2,
        rotationX: -deltaY * 2,
        transformPerspective: 1000,
        duration: 0.5,
        ease: 'power2.out',
      });
    };

    const onLeave = () => {
      gsap.to(card, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.5,
        ease: 'power2.out',
      });
    };

    section.addEventListener('mousemove', onMove);
    section.addEventListener('mouseleave', onLeave);

    return () => {
      section.removeEventListener('mousemove', onMove);
      section.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered && emailRef.current) {
      emailRef.current.value = remembered;
      setRememberMe(true);
    }
  }, []);

  const validateEmail = (value: string) => {
    if (!value) {
      setEmailState('idle');
      return false;
    }
    const isValid = EMAIL_REGEX.test(value);
    setEmailState(isValid ? 'valid' : 'invalid');
    return isValid;
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordState('idle');
      return false;
    }
    const isValid = value.length >= 6;
    setPasswordState(isValid ? 'valid' : 'invalid');
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const email = emailRef.current?.value.trim() ?? '';
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;

    if (!email || !password) {
      showNotification('Please fill in all fields', 'error');
      shakeCard();
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      showNotification('Please enter a valid email address', 'error');
      setEmailState('invalid');
      return;
    }

    if (password.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
      setPasswordState('invalid');
      return;
    }

    setLoading(true);
    setEmailState('idle');
    setPasswordState('idle');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        user?: { id: string; email: string; name: string };
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.user) {
        setAuthUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        });
      }

      setSuccess(true);
      showNotification('Login successful! Redirecting...', 'success');

      if (cardRef.current) {
        gsap.to(cardRef.current, {
          scale: 1.02,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
        });
      }

      window.setTimeout(() => {
        setOverlayActive(true);

        window.setTimeout(() => {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, email);
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }
          router.push('/profile');
        }, 600);
      }, 1200);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to reach the login server.';
      showNotification(message, 'error');
      shakeCard();
      setEmailState('invalid');
      setPasswordState('invalid');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (state: FieldState, focused: boolean) =>
    ['form-group', state === 'valid' && 'valid', state === 'invalid' && 'invalid', focused && 'focused']
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <div className={`page-overlay${overlayActive ? ' active' : ''}`} aria-hidden="true" />

      <section ref={sectionRef} className="login-section">
        <div ref={particlesRef} className="particles-container" aria-hidden="true" />
        <div ref={glowRef} className="cursor-glow" aria-hidden="true" />
        <div className="login-background" aria-hidden="true" />

        <div className="login-wrapper">
          <div ref={cardRef} className="login-card">
            <div className="login-card-content">
              <div className="login-logo">
                <TennisBallIcon size={60} className="text-paprika" />
              </div>

              <div className="login-header">
                <h1 className="login-title">Welcome Back</h1>
                <p className="login-subtitle">Sign in to access your member account</p>
              </div>

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <div className={fieldClass(emailState, emailFocused)}>
                  <input
                    ref={emailRef}
                    type="email"
                    id="email"
                    name="email"
                    placeholder=" "
                    required
                    autoComplete="email"
                    onFocus={() => {
                      setEmailFocused(true);
                      setEmailState('idle');
                    }}
                    onBlur={(e) => {
                      setEmailFocused(false);
                      validateEmail(e.target.value);
                    }}
                  />
                  <label htmlFor="email" className="floating-label">
                    Email Address
                  </label>
                  <span className="input-icon">
                    <MailIcon />
                  </span>
                </div>

                <div className={fieldClass(passwordState, passwordFocused)}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    placeholder=" "
                    required
                    autoComplete="current-password"
                    onFocus={() => {
                      setPasswordFocused(true);
                      setPasswordState('idle');
                    }}
                    onBlur={(e) => {
                      setPasswordFocused(false);
                      validatePassword(e.target.value);
                    }}
                  />
                  <label htmlFor="password" className="floating-label">
                    Password
                  </label>
                  <button
                    type="button"
                    className="toggle-password"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </button>
                </div>

                <div className="form-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      name="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="checkbox-custom" />
                    <span>Remember me</span>
                  </label>
                  <a
                    href="#"
                    className="forgot-link"
                    onClick={(e) => {
                      e.preventDefault();
                      showNotification('Password reset feature coming soon!', 'info');
                    }}
                  >
                    Forgot Password?
                  </a>
                </div>

                <button
                  type="submit"
                  className={[
                    'login-btn',
                    loading && 'loading',
                    success && 'success',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={loading || success}
                >
                  <span className="btn-spinner" aria-hidden="true" />
                  <span className="btn-text">{loading ? 'Signing in...' : success ? 'Success!' : 'Sign In'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
